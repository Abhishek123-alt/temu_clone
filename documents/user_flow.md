# User Flow & Experience: Temu Clone

This document defines the primary user journeys within the Temu clone application, focusing on discovery, conversion, and retention.

## 1. Landing & Discovery Flow
The "Discovery-First" approach ensures users see relevant products immediately.
1.  **Landing:** User arrives on the Home Page.
2.  **Personalized Feed:** Infinite scroll displays products based on "Recommended" (AI-driven).
3.  **Category Browsing:** User clicks on a category (e.g., "Home & Kitchen").
4.  **Search:** User searches for a specific keyword with autocomplete suggestions.
5.  **PDP (Product Detail Page):** User clicks a product card to view details, reviews, and dynamic pricing.

## 2. Retention (Gamification) Flow
Engagement is driven by games and "free gift" mechanics.
1.  **Daily Check-in:** User logs in and receives a "Daily Reward" popup.
2.  **The Prize Wheel:** Post-registration or periodic "Spin to Win" for coupons.
3.  **The "Free Gift" Hook:** User picks a "Free Gift" but must invite 3 friends to "claim" it (Referral loop).
4.  **Mini-Games:** User plays "Fishland" or similar to earn credits toward purchases.

## 3. Cart & Checkout Flow (Conversion)
1.  **Add to Cart:** User adds items with specific variants (Size/Color).
2.  **Cart Review:** User sees "Free Shipping" progress bar (e.g., "Add $5 more for free shipping").
3.  **Coupons:** Automatic application of the best available coupon.
4.  **Checkout:** 
    - Enter/Select Shipping Address.
    - Choose Payment Method (Card, PayPal, Apple Pay).
    - Review final price (Item + Tax - Discount).
5.  **Success:** Order Confirmation page with estimated delivery date.

## 4. Order Management Flow
1.  **Tracking:** User goes to "My Orders" -> "Track Package."
2.  **Real-time Updates:** Push notifications at every milestone (Shipped, Out for Delivery, Delivered).
3.  **Returns:** One-click return initiation for eligible items.

## 5. Seller Management Flow (Implemented)
1.  **Inventory Management:** Seller logs in -> Adds/Edits product -> Uploads images -> Sets pricing/stock.
2.  **Order Fulfillment:** Seller receives "Paid" order -> Clicks "Ship Now" -> Enters carrier and tracking number -> Order status updates to "Shipped".
3.  **Return Processing:** Seller views return request -> Reviews reason -> Approves or Rejects the return.
4.  **Analytics Tracking:** Seller views Revenue Analysis chart -> Filters by date range to monitor growth.

## 6. Admin Oversight Flow (Implemented)
1.  **Platform Monitoring:** Admin logs in -> Views global stats (Total Sales, Total Customers, Active Products).
2.  **User Audit:** Admin views list of all registered users to manage platform participants.

---

## 7. Viral Growth Flow (Referrals)
1.  **Invite:** User clicks "Earn $20 Credit."
2.  **Share:** Copy unique link or share directly to WhatsApp/Social Media.
3.  **Reward:** Once the referred user completes their first order, the referrer receives credit.
