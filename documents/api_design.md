# API Design: Temu Clone

This document outlines the core RESTful API endpoints for the Temu clone, built with FastAPI.

## 🔑 Authentication
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/auth/register` | POST | Register a new user |
| `/auth/login` | POST | Login and receive JWT |
| `/auth/social` | POST | Social login (Google/Apple) |
| `/auth/me` | GET | Get current user profile |

## 📦 Products & Catalog
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/products` | GET | List products (with pagination/filters) |
| `/products/recommendations` | GET | AI-driven personalized product feed |
| `/products/{id}` | GET | Get detailed product information |
| `/products/me` | GET | (Seller) List products owned by the current seller |
| `/products/upload` | POST | Upload product images |
| `/categories` | GET | Get category tree |
| `/search` | GET | Search products with query params |

## 🛒 Shopping Cart
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/cart` | GET | View current user's cart |
| `/cart/add` | POST | Add product variant to cart |
| `/cart/update/{id}` | PUT | Change quantity or variant in cart |
| `/cart/remove/{id}` | DELETE | Remove item from cart |

## 💳 Orders & Checkout
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/orders` | POST | Place a new order |
| `/orders` | GET | List user's order history |
| `/orders/{id}` | GET | Get specific order details/tracking |
| `/orders/seller/orders` | GET | (Seller) List orders for the current seller's products |
| `/orders/seller/returns` | GET | (Seller) List return requests for current seller |
| `/orders/{id}/shipments` | POST | (Seller) Add shipping details (carrier, tracking) |
| `/orders/{id}/status` | PUT | Update order status (e.g., 'shipped') |
| `/orders/returns/{id}/process` | POST | (Seller) Approve or Reject a return request |
| `/checkout/preview` | POST | Calculate totals/taxes/coupons before payment |

## 💰 Payments
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/payments/initiate` | POST | Start a payment session for an order |
| `/payments/{id}/status` | GET | Check the status of a specific payment |
| `/payments/webhook/{provider}` | POST | Webhook for payment providers (Stripe/PayPal) |

## 🎮 Gamification & Rewards
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/rewards/daily-checkin` | POST | Claim daily login reward |
| `/rewards/spin` | POST | Execute a prize wheel spin |
| `/games/{game_id}/state` | GET | Get current progress of a mini-game |
| `/referrals/link` | GET | Get unique user referral link |

## 👤 User Profile
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/user/addresses` | GET/POST | Manage shipping addresses |
| `/user/coupons` | GET | List available and used coupons |
| `/user/wishlist` | GET/POST | Manage saved items |

## 🛠 Administration (Implemented)
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/admin/stats` | GET | Get global platform statistics (users, products, sales) |
| `/admin/users` | GET | List all users in the system |
