# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Frontend (Client)
- **Development**: `cd client && npm run dev`
- **Build**: `cd client && npm run build`
- **Lint**: `cd client && npm run lint`

### Backend (Server)
- **Setup**: `cd server && pip install -r requirements.txt`
- **Run Server**: `cd server && uvicorn app.main:app --reload`
- **Migrations (apply latest)**: `cd server && alembic upgrade head`
- **Migrations (new revision)**: `cd server && alembic revision --autogenerate -m "<msg>"`
- **Seed data**: `python server/scripts/seed_db.py` (also `seed_extra.py`, `seed_gamification.py`, `seed_subcategories.py`, `seed_category_attributes.py`, `expand_catalog.py`)
- **Backfill category embeddings**: `python server/scripts/backfill_category_embeddings.py`

### Testing
- **Run all backend tests**: `pytest server/app/modules`
- **Run a specific test file**: `pytest server/app/modules/<module>/tests/test_<service>.py`
- **Run a specific test case**: `pytest server/app/modules/<module>/tests/test_<service>.py::test_<function_name>`

## Architecture & Structure

### High-Level Overview
A Temu-inspired e-commerce marketplace with a decoupled React frontend and a modular FastAPI backend. Built around four roles: `CUSTOMER`, `SELLER_PENDING`, `SELLER`, `ADMIN`. Discovery uses pgvector embeddings (sentence-transformers `all-MiniLM-L6-v2`, 384 dims) on both products and categories for semantic search.

### Backend Structure (`/server`)
The backend follows a **modular architecture** where each business domain is isolated in `server/app/modules/`. Implemented modules:

| Module | Responsibility |
| --- | --- |
| `auth/` | Register/login, JWT issuance, referral redemption on signup |
| `user/` | Profile, addresses, payment methods, wishlist, recently-viewed, rewards, spin-the-wheel, referrals |
| `product/` | Products, categories (tree), category attribute definitions, dynamic attributes, options/variants, images, semantic search, facets, recommendations |
| `cart/` | Per-user cart and cart items (with variant support) |
| `order/` | Orders, order items, status machine, shipments, returns, outbox, async worker (`worker.py`) |
| `review/` | Product reviews (one per user/product) |
| `flash_sale/` | Time-bounded flash sales with discounted prices per product |
| `quest/` | Gamification quests with role targeting, user progress, reward types |
| `store/` | Seller store applications (PENDING/ACTIVE/REJECTED) |
| `admin/` | Platform stats, user/seller management, seller application review, sales analytics |

- **Module Layout**: each typically contains `models.py`, `schemas.py`, `router.py`, `services.py`, `tests/`.
- **API Gateway**: routers are aggregated in `server/app/api/v1/api.py` and mounted at `/api/v1` by `server/app/main.py`. Static uploads served at `/uploads`.
- **Auth**: `get_current_user` is defined in `app/modules/user/router.py` (JWT via python-jose). Inactive non-admin users are blocked. `app/modules/store/router.py` has its own copy for the seller-pending flow.
- **Database**: PostgreSQL with the `pgvector` extension for embeddings (HNSW index on `products.embedding`). SQLite is used in `server/conftest.py` for isolated, in-memory testing.
- **Migrations**: Alembic, files under `server/migrations/versions/`.

### Frontend Structure (`/client`)
React 19 + Vite + Tailwind CSS app.
- **State Management**: `Zustand` for global stores (`authStore`, `cartStore`, `wishlistStore`); `@tanstack/react-query` for server state.
- **Routing**: `react-router-dom` v7, declared in `src/App.jsx`. Most routes are wrapped in `<ProtectedRoute>` which redirects unauthenticated users to `/login`.
- **Styling/Animation**: Tailwind CSS, Framer Motion, `lucide-react` icons, `canvas-confetti` for reward effects.
- **Virtualization**: `@tanstack/react-virtual` for long feeds.
- **HTTP**: shared axios instance in `src/services/api.js`. One service per backend domain (`authService`, `productService`, `adminService`, `userService`).
- **Pages**: under `src/pages/{home,auth,cart,orders,product,profile,seller,admin,wishlist}`.
- **Components**: under `src/components/{layout,common,products,marketing,gamification,reviews,profile,seller}`.

### Key Cross-Cutting Concepts
- **Embeddings**: `app/core/embeddings.py` generates 384-dim vectors. Stored on `products.embedding` and `categories.embedding`. Search combines text ILIKE matching, token expansion, and cosine-distance category expansion.
- **Dynamic attributes**: each `Category` defines `CategoryAttributeDefinition` rows (key, label, field_type, options). Products store their attribute values in a JSONB `attributes` column, indexed via a GIN index. The `/products/facets` endpoint aggregates filter facets.
- **Product variants**: a Product has `ProductOption`s (e.g. Color, Size) → `ProductOptionValue`s. Each `ProductVariant` (SKU, price, stock) is linked to a combination via the `variant_option_values` join table.
- **Order lifecycle**: `OrderStatus` enum (pending → paid → packed → shipped → delivered, plus return/refund states). Every transition is recorded in `OrderEvent` with the actor (`SYSTEM/USER/SELLER/ADMIN`). An `Outbox` table buffers events for the async worker.
- **Gamification hooks**: `quest_services.update_quest_progress(db, user_id, requirement_type)` is called from auth login (`DAILY_LOGIN`), product upload (`PRODUCT_UPLOAD`), recently-viewed (`PRODUCT_VIEW`), flash sale view (`FLASH_SALE_VIEW`), etc.
- **Referrals**: every `User` has a unique `referral_code`; signups can pass one to link `referred_by` and grant a credit reward.

## Documentation
Living specs are under `/documents`:
- [feature_list.md](./documents/feature_list.md) — implemented vs planned features
- [database_schema.md](./documents/database_schema.md) — current PostgreSQL schema
- [api_design.md](./documents/api_design.md) — REST endpoint reference
- [project_structure.md](./documents/project_structure.md) — directory layout
- [user_flow.md](./documents/user_flow.md) — primary user journeys
