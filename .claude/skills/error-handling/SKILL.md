---
name: error-handling
description: Consistent error handling across the stack.
metadata:
  type: professional-standard
---

# Error Handling Standard
- Implement a global exception handler in FastAPI to return consistent JSON errors.
- Use specific custom exceptions for business logic errors (e.g., `InsufficientStockException`).
- Frontend: Implement an API error interceptor to handle 401, 403, and 500 errors globally.
- Use user-friendly error messages for the UI and detailed logs for developers.
- Implement retries for transient network failures.
- Log errors with trace IDs to easily map frontend failures to backend logs.
