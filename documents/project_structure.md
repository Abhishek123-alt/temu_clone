# Project Structure: Temu Clone

This document outlines the directory structure and technology stack for the Temu clone, featuring a Python (FastAPI) backend and a React frontend.

## 🏗 Overall Architecture
The project is split into two main repositories/directories:
- `client/`: React application (Frontend)
- `server/`: Python FastAPI application (Backend)

---

## 💻 Frontend (`client/`)
**Stack:** React, Vite, Tailwind CSS, Lucide Icons, Framer Motion (for animations).

```
client/
├── public/                 # Static assets (logos, icons)
├── src/
│   ├── assets/             # Images, Global CSS
│   ├── components/         # Reusable UI components
│   │   ├── common/         # Buttons, Inputs, Modals
│   │   ├── layout/         # Navbar, Footer, Sidebar
│   │   ├── product/        # Product Cards, Grid, Reviews
│   │   └── games/          # Spin-the-wheel, Mini-game components
│   ├── hooks/              # Custom React hooks (useAuth, useCart)
│   ├── pages/              # Page components (Home, PDP, Cart, Checkout)
│   ├── services/           # API call logic (Axios/Fetch)
│   ├── store/              # State management (Zustand or Redux)
│   ├── utils/              # Helper functions, constants
│   ├── App.jsx             # Main routing & layout
│   └── main.jsx            # Entry point
├── .env                    # Frontend environment variables
├── package.json
└── vite.config.js
```

---

## 🐍 Backend (`server/`)
**Stack:** Python 3.10+, FastAPI, PostgreSQL (SQLAlchemy), Redis (Caching), Celery.

```
server/
├── app/
│   ├── modules/            # Domain-driven modules
│   │   ├── auth/
│   │   │   ├── router.py   # Auth specific endpoints
│   │   │   ├── schemas.py  # Pydantic models for auth
│   │   │   ├── models.py   # SQLAlchemy models for auth
│   │   │   └── services.py # Auth business logic
│   │   ├── products/
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── services.py
│   │   ├── orders/
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── models.py
│   │   │   └── services.py
│   │   └── ...             # cart, gamification, etc.
│   ├── api/
│   │   └── v1/
│   │       └── api.py      # Aggregates all module routers here
│   ├── core/               # Global config, security (JWT), constants
│   ├── db/                 # Database session & Base model setup
│   ├── tasks/              # Global Celery background tasks
│   └── main.py             # Entry point (imports only app.api.v1.api)
├── migrations/             # Alembic migrations
├── tests/                  # Pytest suite
├── .env                    # Environment variables
└── requirements.txt        # Dependencies
```

---

## 🛠 Infrastructure & DevOps
- **Database:** PostgreSQL (Primary)
- **Cache:** Redis (Product feed, cart, game sessions)
- **Containerization:** Docker & Docker Compose
- **Media Storage:** AWS S3 or Cloudinary
- **Payments:** Stripe API
