---
name: media-storage
description: Handle product image, review photo, and store-logo uploads for this project. Trigger whenever the user mentions upload, image, photo, file, /uploads, multipart, S3, CDN, presigned URL, image resize, thumbnail, or "where do the images go".
---

# Media Storage

Currently uploads are served from the local filesystem at `/uploads` (mounted by `app/main.py`). This skill covers the upload pipeline today and the path to S3 + CDN for production.

## When this skill applies

- Adding a new endpoint that accepts uploads (product images, review photos, store logo).
- Resizing, validating, or storing media.
- Migrating from local disk to S3 / Cloudflare R2 / Cloudinary.

For the React-side upload form, see `react-component-builder` and `cart-checkout-ui` (for the address-doc upload if added).

## Where files live today

```
server/
├── app/main.py            # app.mount("/uploads", StaticFiles(directory="uploads"))
└── uploads/
    ├── products/<product_id>/<image_id>.jpg
    ├── reviews/<review_id>/<n>.jpg
    └── stores/<store_id>/logo.png
```

Records in DB store the relative path (`products/abc-123/img-001.jpg`); the frontend prepends the API origin.

Don't store binary blobs in Postgres. The DB tracks metadata; the filesystem (or S3) holds bytes.

## Endpoint pattern (FastAPI multipart)

```python
from fastapi import UploadFile, File, HTTPException
from pathlib import Path
from PIL import Image
import io, uuid

ALLOWED = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 6 * 1024 * 1024     # 6 MB per image

@router.post("/{product_id}/images", response_model=schemas.ProductImageOut)
def upload_product_image(
    product_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.SELLER, UserRole.ADMIN)),
):
    if file.content_type not in ALLOWED:
        raise ValidationError("Unsupported file type")
    blob = file.file.read(MAX_BYTES + 1)
    if len(blob) > MAX_BYTES:
        raise ValidationError("File too large (max 6MB)")

    # decode + re-encode strips EXIF/metadata + verifies it's a real image
    img = Image.open(io.BytesIO(blob))
    img.verify()                       # raises if not a valid image
    img = Image.open(io.BytesIO(blob))  # reopen (verify consumes)
    img = _strip_orientation(img)

    return services.save_product_image(db, product_id, img, owner=user)
```

Critical:

- **Verify the file is a real image** by decoding it, not by trusting `content_type`. A malicious `.exe` renamed to `.jpg` should be rejected.
- **Strip EXIF** (cameras embed GPS coordinates — privacy leak if user reviews are public).
- **Cap size** (6 MB hard). Frontend should client-resize > 2k images before upload.
- **Auth + ownership**: a seller can only upload images for their own products. Enforce in `services.py`.

## Image variants (resize on save)

Save 3 sizes for product images to keep CDN bills sane:

```python
SIZES = {"thumb": 200, "card": 480, "hero": 1080}

def save_variants(img: Image.Image, dest_dir: Path, base: str):
    paths = {}
    for name, w in SIZES.items():
        resized = _resize_preserve_aspect(img, w)
        path = dest_dir / f"{base}-{name}.webp"
        resized.save(path, format="WEBP", quality=80, method=6)
        paths[name] = str(path.relative_to(UPLOADS_ROOT))
    return paths
```

WebP is ~30% smaller than JPEG at the same quality and supported everywhere modern (>97% of users).

Store the three relative paths in the DB. The frontend picks based on `srcset`:

```jsx
<img
  src={imgUrl(product.image.card)}
  srcSet={`${imgUrl(product.image.thumb)} 200w,
           ${imgUrl(product.image.card)}  480w,
           ${imgUrl(product.image.hero)} 1080w`}
  sizes="(max-width: 640px) 50vw, 240px"
  loading="lazy"
  decoding="async"
  alt={product.title}
/>
```

## Local dev → S3 in prod (abstraction layer)

Wrap storage behind an interface so the call sites don't care:

```python
# app/core/storage.py
from abc import ABC, abstractmethod

class StorageBackend(ABC):
    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> str: ...
    @abstractmethod
    def url(self, key: str) -> str: ...
    @abstractmethod
    def delete(self, key: str) -> None: ...

class LocalDisk(StorageBackend):
    def __init__(self, root: Path, base_url: str):
        self.root, self.base_url = root, base_url
    def put(self, key, data, content_type):
        p = self.root / key; p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data); return key
    def url(self, key): return f"{self.base_url}/uploads/{key}"
    def delete(self, key): (self.root / key).unlink(missing_ok=True)

class S3Backend(StorageBackend):
    def __init__(self, client, bucket, cdn_base):
        self.s3, self.bucket, self.cdn = client, bucket, cdn_base
    def put(self, key, data, content_type):
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data,
                           ContentType=content_type, CacheControl="public, max-age=31536000, immutable")
        return key
    def url(self, key): return f"{self.cdn}/{key}"
    def delete(self, key): self.s3.delete_object(Bucket=self.bucket, Key=key)
```

Pick the backend in `app/core/config.py` based on env (`STORAGE_BACKEND=local|s3`). Tests use `LocalDisk` against a tmp dir.

## Presigned upload URLs (the right way at scale)

For high-volume uploads (seller bulk catalog upload), don't proxy bytes through FastAPI. Issue a presigned PUT URL; the browser uploads directly to S3:

```python
@router.post("/products/{id}/images/presign")
def presign(...):
    key = f"products/{product_id}/{uuid4()}.webp"
    url = s3.generate_presigned_url("put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": "image/webp"},
        ExpiresIn=300,
    )
    return {"upload_url": url, "key": key}

@router.post("/products/{id}/images/confirm")
def confirm_upload(id, key: str, ...):
    # HEAD the object to verify it exists; validate size + type
    head = s3.head_object(Bucket=BUCKET, Key=key)
    if head["ContentLength"] > MAX_BYTES: ...
    services.attach_image(db, id, key)
```

The two-step (presign → confirm) lets the server validate after upload without proxying gigabytes.

## CDN cache rules

When you move to S3 + CloudFront / Cloudflare:

- Set `Cache-Control: public, max-age=31536000, immutable` on uploads (the key includes a UUID — never overwritten).
- Set a different cache header on **listings** (the JSON API) — `Cache-Control: no-store` for personalized feeds.
- Bust by changing the key, never by purging the CDN. Mutations on existing keys are async hell.

## Cleanup & orphans

Soft delete the DB row first; a daily job sweeps storage entries with no DB references. Never `delete()` storage in the same transaction as the DB delete — if the DB rollbacks, the image is gone.

```python
# tombstone pattern
class ProductImage(Base):
    ...
    deleted_at: datetime | None
    # background job: select where deleted_at < now() - 7d → storage.delete(key) → hard delete row
```

## Security

- **Authorize every upload by ownership**. A seller uploading to another seller's product = takeover risk.
- **Reject SVG** unless you sanitize it. SVGs can carry `<script>` tags and Stored XSS via inline event handlers.
- **No path traversal in keys** (`../../etc/passwd`). Always generate keys with `uuid4()` and constrain to a known prefix.
- **Scan for malware** if you ever accept non-image files (resumes, docs). ClamAV via an async job; quarantine on positive.

For the threat model around the current `POST /upload` endpoint (which today only validates by file extension) and full validation patterns — MIME sniff + magic bytes + dimension caps + UUID filenames — see `security-hardening`.

## Common mistakes to flag

- Trusting `file.content_type` from the client without re-decoding.
- Storing original 12MP photos at full resolution forever — bandwidth + storage spike.
- Returning absolute URLs from the API tied to dev hostnames — the React client should compose URLs from a relative path + base.
- Synchronous resize for a 30MB tiff in the request thread — push it to the Outbox/worker.
- Deleting files in the DB delete transaction — rollback orphans the DB row, leaks storage.
- Serving uploads from the API origin in prod (no CDN) — every product page lights the server on fire.
- Allowing SVG uploads as product images without sanitization.

## Checklist

- File type validated by re-decoding, not by content_type alone.
- Size cap enforced server-side (not just on the client).
- EXIF stripped on save.
- Three sizes generated and stored; frontend uses `srcset`.
- Storage backend is abstracted; tests use the local backend on a tmp dir.
- For S3: presigned upload + confirm, immutable cache headers, soft-delete + sweep job.
- Every upload endpoint authorizes by resource ownership.
