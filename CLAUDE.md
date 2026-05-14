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
- **Migrations**: `cd server && alembic upgrade head`

### Testing
- **Run all backend tests**: `pytest server/app/modules`
- **Run a specific test file**: `pytest server/app/modules/<module>/tests/test_<service>.py`
- **Run a specific test case**: `pytest server/app/modules/<module>/tests/test_<service>.py::test_<function_name>`

## Architecture & Structure

### High-Level Overview
The project is a Temu-inspired e-commerce marketplace with a decoupled React frontend and a modular FastAPI backend.

### Backend Structure (`/server`)
The backend follows a **modular architecture** where each business domain is isolated in its own module within `server/app/modules/`.
- **Module Layout**: Each module typically contains:
    - `models.py`: SQLAlchemy database models.
    - `schemas.py`: Pydantic v2 models for API request/response validation.
    - `router.py`: FastAPI endpoints and business logic.
    - `tests/`: Module-specific unit and integration tests.
- **API Gateway**: All module routers are aggregated in `server/app/api/v1/api.py` and served via `server/app/main.py`.
- **Database**: PostgreSQL is used for production; SQLite is used in `server/conftest.py` for isolated, in-memory testing.

### Frontend Structure (`/client`)
A modern React application using Vite and Tailwind CSS.
- **State Management**: Uses `Zustand` for global state and `TanStack Query` (React Query) for server-state synchronization and caching.
- **Styling**: Tailwind CSS for utility-first styling and Framer Motion for animations.
- **Routing**: `react-router-dom` for page-level navigation.
- **Components**: Organized by feature and layout in `src/components` and `src/pages`.
