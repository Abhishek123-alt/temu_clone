# Project Structure — Temu Clone

Two-tier monorepo: React frontend in `client/`, FastAPI backend in `server/`. Living documentation in `documents/`, ad-hoc tooling in `scratch/`.

---

## 🏗 Overall Layout
```
temu_clone/
├── client/                 # React 19 + Vite frontend
├── server/                 # FastAPI backend
│   ├── app/
│   ├── migrations/         # Alembic
│   ├── scripts/            # Seeding / maintenance
│   └── scratch/            # Throwaway experiments
├── documents/              # Specs (this folder)
├── CLAUDE.md               # Agent / contributor onboarding
└── README.md
```

---

## 💻 Frontend (`client/`)
**Stack:** React 19, Vite, Tailwind CSS, Framer Motion, Zustand, TanStack Query, react-router-dom v7, axios, lucide-react, canvas-confetti, @tanstack/react-virtual.

```
client/
├── public/
└── src/
    ├── assets/                  # Logos, hero images, global SVGs
    ├── components/
    │   ├── auth/                # (reserved)
    │   ├── common/              # Toast, ConfirmModal
    │   ├── gamification/        # SpinWheel
    │   ├── layout/              # Layout, Navbar, CategoryDropdown (mega-menu)
    │   ├── marketing/           # FlashSaleSection, MarketingCarousel
    │   ├── products/            # ProductCard, CategoryRail
    │   ├── profile/             # WishlistSection, RecentlyViewedSection
    │   ├── reviews/             # ReviewList, ReviewModal
    │   └── seller/              # SalesChart
    ├── hooks/                   # Custom React hooks
    ├── pages/
    │   ├── admin/               # AdminDashboard
    │   ├── auth/                # LoginPage, RegisterPage
    │   ├── cart/                # CartPage, CheckoutPage, PaymentPage
    │   ├── home/                # HomePage, DealsPage, NewArrivalsPage
    │   ├── orders/              # OrdersPage, OrderDetailPage
    │   ├── product/             # ProductDetailPage, SearchPage
    │   ├── profile/             # ProfilePage, AddressesPage, PaymentMethodsPage, QuestsPage
    │   ├── seller/              # OnboardingWizard, SellerDashboard
    │   └── wishlist/            # WishlistPage
    ├── services/                # api.js (axios), authService, userService, productService, adminService
    ├── store/                   # Zustand: authStore, cartStore, wishlistStore
    ├── utils/                   # Helpers
    ├── App.jsx                  # Routes + ProtectedRoute
    └── main.jsx
```

---

## 🐍 Backend (`server/`)
**Stack:** Python 3.10+, FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL + pgvector, sentence-transformers, python-jose (JWT), passlib (bcrypt), pytest.

```
server/
├── app/
│   ├── api/v1/api.py            # Central router aggregator
│   ├── core/                    # Settings, security (JWT), embeddings
│   ├── db/                      # Session, Base
│   ├── modules/
│   │   ├── auth/                # router, schemas, services, tests
│   │   ├── user/                # User, Address, PaymentMethod, Reward + spins/wishlist/recently-viewed
│   │   ├── product/             # Product, Category, Attribute defs, Options/Variants, Images
│   │   ├── cart/                # Cart, CartItem
│   │   ├── order/               # Order + Items + Events + Shipments + Returns + Outbox; worker.py
│   │   ├── review/              # Review (unique per user/product)
│   │   ├── flash_sale/          # FlashSale, FlashSaleProduct
│   │   ├── quest/               # Quest, UserQuestProgress
│   │   ├── store/               # Seller store application
│   │   └── admin/               # Stats, user/seller management, sales analytics
│   └── main.py                  # FastAPI entry, CORS, /uploads mount
├── migrations/
│   └── versions/                # 23 Alembic revisions (init → category embedding)
├── scripts/                     # seed_db, seed_extra, seed_gamification, seed_subcategories,
│                                # seed_category_attributes, expand_catalog, improve_catalog,
│                                # fix_categories_and_brands, audit_fix_attributes,
│                                # restructure_audit, backfill_category_embeddings
├── scratch/                     # Ad-hoc test scripts (not part of pytest)
├── uploads/                     # Static media served at /uploads
├── conftest.py                  # SQLite in-memory test fixture
└── requirements.txt
```

### Module Convention
Every domain module follows the same skeleton:
```
modules/<domain>/
├── models.py     # SQLAlchemy ORM models
├── schemas.py    # Pydantic v2 request/response models
├── router.py     # FastAPI APIRouter — mounted in app/api/v1/api.py
├── services.py   # Business logic (DB queries + side effects)
└── tests/        # Pytest tests (uses the SQLite fixture from conftest.py)
```

`order/` additionally has `worker.py` for the outbox consumer.

---

## 🔌 Cross-Tier Wiring
- Frontend calls `/api/v1/...` via the axios instance in `src/services/api.js`, attaching the JWT from `authStore`.
- Uploaded media is returned as absolute URLs under `http://localhost:8000/uploads/...`.
- Embeddings live in two places: `products.embedding` (HNSW indexed) and `categories.embedding` (used to bridge fuzzy searches like "mobile" → "Smartphones").

## 🛠 Infrastructure (target)
- **Database**: PostgreSQL with the `pgvector` extension.
- **Caching / queues**: Redis + Celery (planned; currently single outbox worker).
- **Media**: local `/uploads` (target: S3/Cloudinary).
- **Payments**: provider tokens stored on `payment_methods`; real Stripe/PayPal integration pending.
- **Containerization**: Docker Compose (planned).
