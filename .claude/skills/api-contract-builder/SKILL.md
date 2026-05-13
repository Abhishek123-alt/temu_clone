---
name: api-contract-builder
description: Design robust Pydantic v2 schemas for API requests and responses.
metadata:
  type: professional-standard
---

# API Contract Standard
- Use Pydantic v2 for all request bodies and response models.
- strictly separate "Request" schemas from "Response" schemas (DTO pattern).
- Use `Field` for validation (min/max length, regex patterns).
- Ensure consistent error response envelopes across all endpoints.
- Use clear, descriptive naming for API fields.
- Document all endpoints using FastAPI's built-in OpenAPI generation.
