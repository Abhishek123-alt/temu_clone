# Temu Clone Project

A high-performance e-commerce marketplace clone inspired by Temu, featuring gamified shopping, direct-to-consumer sourcing, and viral social commerce loops.

## 🚀 Overview
This project aims to replicate the core functionalities of the Temu platform, focusing on:
- **Discovery-based Shopping:** AI-driven infinite scrolling product feeds.
- **Gamification:** Interactive games (Spin-the-wheel, daily check-ins) for rewards.
- **Scalable Architecture:** Module-wise backend for easy maintenance and expansion.
- **Modern Tech Stack:** Fast backend in Python (FastAPI) and reactive frontend in React.

## 🛠 Tech Stack
- **Frontend:** React.js, Vite, Tailwind CSS, Framer Motion.
- **Backend:** Python 3.10+, FastAPI, SQLAlchemy (PostgreSQL).
- **Caching & Tasks:** Redis, Celery.
- **Database:** PostgreSQL.
- **Payments:** Stripe API.

## 📂 Project Structure
Detailed documentation on the project layout can be found in [project_structure.md](./Documents/project_structure.md).

```
.
├── client/                 # React Frontend
├── server/                 # FastAPI Backend
│   ├── app/
│   │   ├── modules/        # Feature-based modules (Auth, Products, etc.)
│   │   ├── api/v1/         # Central API router
│   │   └── main.py         # Entry point
└── Documents/              # Project Documentation
```

## 📖 Documentation
Detailed technical specifications are available in the `/Documents` folder:
- [Analysis & Feature List](./Documents/feature_list.md)
- [Project Structure](./Documents/project_structure.md)
- [User Flow & Journeys](./Documents/user_flow.md)
- [API Design Spec](./Documents/api_design.md)
- [Database Schema](./Documents/database_schema.md)

## 🛠 Getting Started (Development)

### Backend Setup
1. Navigate to `/server`.
2. Create a virtual environment: `python -m venv venv`.
3. Activate it: `source venv/bin/activate`.
4. Install dependencies: `pip install -r requirements.txt`.
5. Start the server: `uvicorn app.main:app --reload`.

### Frontend Setup
1. Navigate to `/client`.
2. Install dependencies: `npm install`.
3. Start development server: `npm run dev`.

---
*Created as part of the Temu Clone development roadmap.*
