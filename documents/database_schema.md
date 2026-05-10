# Database Schema: Temu Clone

This document outlines the relational database structure (PostgreSQL) for the Temu clone.

## 👥 User Management
### `users`
- `id`: UUID (PK)
- `email`: String (Unique)
- `phone`: String
- `password_hash`: String
- `full_name`: String
- `role`: Enum (Customer, Seller, Admin)
- `created_at`: Timestamp

### `addresses`
- `id`: UUID (PK)
- `user_id`: UUID (FK)
- `street`: String
- `city`: String
- `state`: String
- `zip`: String
- `country`: String
- `is_default`: Boolean

## 📦 Catalog
### `categories`
- `id`: Integer (PK)
- `name`: String
- `parent_id`: Integer (FK to self)
- `slug`: String

### `products`
- `id`: UUID (PK)
- `category_id`: Integer (FK)
- `name`: String
- `description`: Text
- `base_price`: Decimal
- `discount_price`: Decimal
- `status`: Enum (Draft, Active, Inactive, Archived)
- `stock_count`: Integer

### `product_variants`
- `id`: UUID (PK)
- `product_id`: UUID (FK)
- `color`: String
- `size`: String
- `sku`: String
- `additional_price`: Decimal
- `stock`: Integer

## 🛒 Transactions
### `orders`
- `id`: UUID (PK)
- `user_id`: UUID (FK)
- `address_id`: UUID (FK)
- `total_amount`: Decimal
- `status`: Enum (Pending, Paid, Shipped, Delivered, Cancelled, Returned)
- `payment_method`: Enum (CreditCard, PayPal, ApplePay, GooglePay, Credits)
- `tracking_number`: String

### `order_items`
- `id`: UUID (PK)
- `order_id`: UUID (FK)
- `variant_id`: UUID (FK)
- `quantity`: Integer
- `price_at_purchase`: Decimal

### `payments`
- `id`: UUID (PK)
- `order_id`: UUID (FK)
- `user_id`: UUID (FK)
- `amount`: Decimal
- `currency`: String (e.g., 'USD', 'EUR')
- `status`: Enum (Pending, Completed, Failed, Refunded)
- `provider`: Enum (Stripe, PayPal, Apple, Google, Internal)
- `transaction_id`: String (Provider reference)
- `created_at`: Timestamp

## 🎮 Gamification & Marketing
### `coupons`
- `id`: UUID (PK)
- `code`: String (Unique)
- `discount_type`: Enum (Percentage, Fixed)
- `value`: Decimal
- `expiry_date`: Timestamp
- `min_spend`: Decimal

### `user_rewards`
- `id`: UUID (PK)
- `user_id`: UUID (FK)
- `reward_type`: Enum (Credit, Free_Gift, Coupon)
- `amount`: Decimal
- `status`: Enum (Earned, Redeemed, Expired)

### `referrals`
- `id`: UUID (PK)
- `referrer_id`: UUID (FK to users)
- `referred_id`: UUID (FK to users)
- `status`: Enum (Pending, Successful, Invalid)
