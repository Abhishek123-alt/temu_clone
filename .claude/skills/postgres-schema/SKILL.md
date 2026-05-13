---
name: postgres-schema
description: Design PostgreSQL schemas, SQLAlchemy models, and Alembic migrations for the e-commerce backend.
metadata:
  type: professional-standard
---

# Postgres Schema Standard
- Use SQLAlchemy 2.0 style declarations.
- Always include `created_at` and `updated_at` timestamps.
- Use UUIDs for primary keys in distributed-ready tables.
- Ensure proper indexing on foreign keys and frequently searched columns.
- All migrations must be handled via Alembic.
- Use Pydantic for data validation at the API layer.
