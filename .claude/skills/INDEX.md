# Master Skills Index

This index maps the project's directory structure and common tasks to the specialized skills available in `.claude/skills`.

## 📁 Directory $\rightarrow$ Skill Mapping

| Path / Area | Governing Skill | Purpose |
| :--- | :--- | :--- |
| `server/app/main.py` | `api-contract-builder` | Entry point, middleware, and route registration. |
| `server/app/modules/order/` | `order-management` | Order lifecycle, shipping, and fulfillment. |
| `server/app/modules/product/`| `api-contract-builder` | Product endpoints and Pydantic schemas. |
| `server/app/modules/user/`   | `auth-jwt` | User auth, session management, and JWT. |
| `server/app/core/security.py`| `security-review` | Auth logic and security headers. |
| `server/migrations/`        | `postgres-schema` | Database migrations and SQLAlchemy models. |
| `client/src/pages/home/`    | `product-discovery-ui` | Feeds, search, and product listing. |
| `client/src/pages/cart/`    | `cart-checkout-ui` | Cart state and checkout flows. |
| `client/src/components/`    | `react-component-builder`| UI component architecture and styling. |
| `server/requirements.txt`   | `deployment-cicd` | Dependency management and Dockerization. |

## 🛠️ Task $\rightarrow$ Skill Mapping

| When the user asks to... | Use Skill | Key Focus |
| :--- | :--- | :--- |
| "Add a new API endpoint" | `api-contract-builder` | Schema $\rightarrow$ Service $\rightarrow$ Router. |
| "Review this code" | `code-review-lifecycle` | Correctness $\rightarrow$ Security $\rightarrow$ Style. |
| "Change the database" | `postgres-schema` | Migration safety and indexing. |
| "Fix a bug in checkout" | `cart-checkout-ui` | State synchronization and edge cases. |
| "Send an email/SMS" | `notifications-system` | Provider integration and templates. |
| "Optimize a query" | `performance-optimization`| N+1 detection and index usage. |
| "Set up GitHub Actions" | `deployment-cicd` | CI/CD pipelines and environment secrets. |

## 🚀 Skill Activation Flow
1. **Identify Area**: Look at the file path being touched.
2. **Consult Index**: Find the corresponding skill.
3. **Apply Rubric**: Follow the `SKILL.md` checklists for that domain.
