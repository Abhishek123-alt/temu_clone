---
name: media-storage
description: Handle product images, review photos, and video — upload to S3 / Cloudinary, generate responsive variants, sign URLs, and serve via CDN. Trigger whenever the user mentions images, image upload, file upload, S3, Cloudinary, CDN, presigned URL, image optimization, thumbnails, video, alt text, or "where do the product photos live".
---

# Media Storage

Product imagery is half the experience. Optimize aggressively, never serve originals to end users, and keep upload paths secure.

## When this skill applies

- Adding image upload from seller portal or review form.
- Generating responsive variants and serving via CDN.
- Choosing between S3 + custom pipeline vs. Cloudinary.
- Securing video / paid-content access.

## Stack choice

| Option | Pros | Cons |
| --- | --- | --- |
| **Cloudinary** (or imgix) | Done-for-you transforms, CDN, AI tagging | Per-image cost; vendor lock-in |
| **S3 + CloudFront + Lambda@Edge** | Cheap at scale, fully owned | You build the pipeline |

For an early-stage Temu clone: **Cloudinary** for speed. Switch to S3 once volume justifies it. Both fit behind the same internal `MediaService` abstraction so the code doesn't change.

## Upload flow (presigned, no proxying)

The frontend uploads **directly** to the provider — never through your FastAPI server. Proxying multi-MB uploads through Python eats RAM and bandwidth.

```
1. Frontend: POST /uploads/sign  → backend returns { uploadUrl, fields, mediaId }
2. Frontend: POST/PUT to uploadUrl with the file
3. Frontend: POST /products  with mediaId in the payload
4. Backend: validates media exists, links it to the product
```

```python
@router.post("/uploads/sign")
async def sign_upload(input: SignUploadIn, user: CurrentUser):
    media_id = new_id("media")
    key = f"products/{user.id}/{media_id}.{ext_from(input.content_type)}"
    presigned = await media.presign_put(
        key=key,
        content_type=input.content_type,
        max_bytes=10 * 1024 * 1024,   # 10MB hard cap
        expires_s=300,
    )
    await db.execute(insert(MediaAsset).values(
        id=media_id, owner_id=user.id, key=key,
        status="pending_upload", content_type=input.content_type,
    ))
    return {"mediaId": media_id, "uploadUrl": presigned.url, "fields": presigned.fields}
```

Validate `content_type` against an allowlist (`image/jpeg`, `image/png`, `image/webp`, `video/mp4`).

## Confirming upload

The provider can fire a webhook (Cloudinary `notification_url`, S3 `s3:ObjectCreated:*` via SNS/SQS) that flips the asset from `pending_upload` to `ready`. Don't trust the client's "I uploaded" — verify server-side.

## Variants & responsive images

For each image, generate (on demand or on upload):

| Width | Use |
| --- | --- |
| 200 | grid thumbnail |
| 400 | mobile card |
| 800 | tablet / desktop card |
| 1200 | PDP main |
| 1600 | zoom |

Serve via `srcset`:

```html
<img
  src="https://cdn.example.com/img/w_400/q_auto,f_auto/abc.jpg"
  srcset="
    https://cdn.example.com/img/w_200/q_auto,f_auto/abc.jpg 200w,
    https://cdn.example.com/img/w_400/q_auto,f_auto/abc.jpg 400w,
    https://cdn.example.com/img/w_800/q_auto,f_auto/abc.jpg 800w,
    https://cdn.example.com/img/w_1200/q_auto,f_auto/abc.jpg 1200w"
  sizes="(max-width: 640px) 50vw, 25vw"
  loading="lazy"
  alt="Red linen midi dress" />
```

`q_auto,f_auto` (Cloudinary) or equivalent CloudFront/Lambda@Edge logic picks the best format (AVIF → WebP → JPEG) per browser.

## Image moderation

Run uploads through:
- **Sharp** / **PIL** to strip EXIF (privacy, smaller files).
- **AWS Rekognition Moderation** or Cloudinary AI moderation on user-uploaded review photos.
- An async job that flags suspect content for human review before publishing.

Never publish a review image directly without moderation in the loop.

## Video

For PDP product videos, prefer:

- **HLS adaptive bitrate** (Cloudinary `sp_auto` or AWS MediaConvert).
- Poster image generated at 0.5s.
- Lazy-load the player; don't autoplay with sound.

For long videos behind paywall (rare here), generate **signed URLs** with short TTLs.

## Signed URLs (private content)

For seller analytics exports, invoices, or prerelease assets:

```python
url = await media.presign_get(key=key, expires_s=300)
```

Never embed signed URLs in cached pages — they expire and break.

## Cleanup

Add a daily job to delete `pending_upload` rows older than 24h that never completed. Prevents bucket bloat from abandoned uploads.

## Common mistakes to flag

- Uploading through the FastAPI server (kills RAM and concurrency).
- Trusting client-supplied `content_type` without validating bytes.
- Serving original 4000×4000 images on mobile cards (tanks LCP).
- Hard-coding CDN URLs instead of building them through a `media_url(asset, width)` helper.
- Logging signed URLs (becomes a secret leak in log aggregators).
- No EXIF stripping (leaks GPS data on user uploads).

## Checklist

- Frontend uploads directly to provider via presigned URL.
- Allowlist of content types and a max size.
- Async moderation on user-uploaded photos before they go live.
- Responsive `srcset` with at least 3 widths everywhere.
- EXIF stripped on upload.
- Cleanup job for orphaned `pending_upload` assets.
