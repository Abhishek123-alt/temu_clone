---
name: cart-checkout-ui
description: Build the shopping cart, mini-cart drawer, and checkout flow on the React side. Trigger whenever the user mentions cart, basket, checkout, address, shipping, payment form, order summary, coupon, "apply discount", or any step in the buy flow. Also trigger for "place order", "Stripe form", "Apple Pay button", or similar purchase-completion work.
---

# Cart & Checkout UI

The path from "Add to cart" to "Order placed" is the highest-stakes flow in the app. Friction here directly costs revenue. This skill focuses on the React side; payment gateway integration is in `payment-integration`.

## When this skill applies

- Building the cart drawer, full cart page, or any of the checkout steps (address → shipping → payment → review).
- Adding coupon codes, gift cards, urgency timers, or shipping calculators to the cart.
- Wiring the Stripe / PayPal / Apple Pay UI elements into the order flow.

## Cart architecture

Cart state lives in **two places** depending on auth:

- **Logged out**: client-only, persisted to `localStorage` under a versioned key (`cart_v2`).
- **Logged in**: server-side cart (FastAPI), with optimistic local mirror via TanStack Query.

On login, merge the local cart into the server cart (dedupe by `productId+variantId`, sum quantities).

```ts
type CartLine = {
  lineId: string;          // stable client-side id
  productId: string;
  variantId: string;
  quantity: number;
  unitPriceCents: number;  // snapshot at add time
  imageUrl: string;
  title: string;
};
```

## The Add-to-Cart interaction

1. Optimistically update the cart count badge.
2. Fire `POST /cart/items`.
3. Show a toast with "View cart" — don't navigate away.
4. On error, roll back the badge and show a retry.

A user adding 5 items in 5 seconds should see 5 badge increments instantly, not 5 spinners.

## Checkout flow (single-page, multi-step)

Prefer one page with steps that expand inline (Amazon-style) over multi-route wizards — faster, less router state to manage.

```
1. Contact (email)         ← logged-out only
2. Shipping address
3. Shipping method         ← cost from API; affects total
4. Payment
5. Review & place order
```

Each step:
- Validates on blur, not on every keystroke.
- Has a "saved" view collapsed under an "Edit" button once completed.
- Shows the order summary in a sticky right-rail (desktop) or collapsible header (mobile).

## Form discipline

- Use `react-hook-form` with `zod` schemas. Schema is the source of truth.
- Field-level errors live next to the field, in red, with `aria-describedby`.
- Country-specific address fields (US states vs. UK counties) — drive from a JSON config, never hard-code.
- Phone inputs: `libphonenumber-js` for formatting and validation.
- Never store full card numbers in your state — Stripe Elements handles the iframe.

## Urgency triggers (use sparingly)

Per the project brief, the cart can show:

- A countdown for "Free shipping ends in 9:42" (only when truly time-bounded).
- "3 items in your cart are almost sold out" (driven by real inventory).

Never invent urgency that isn't backed by data — users notice, and it kills trust. The backend should return any urgency flags on cart items; the UI just renders them.

## Order summary block

Always show a fully itemized breakdown:

```
Subtotal           $42.18
Shipping            $3.99
Tax                 $3.45
Coupon (SAVE10)    -$4.22
─────────────────────────
Total              $45.40
```

The backend computes these — never duplicate the math on the client. The client just renders what `GET /cart/summary` returns.

## "Place Order" button

- Disabled until: address valid, shipping method picked, payment ready, terms checked.
- On click: disable, show spinner, fire `POST /orders`.
- Idempotency key in the request header (random UUID per attempt) — protects against double-charges if the user clicks twice or the network retries.
- On success: navigate to `/orders/:id/confirmation`, clear local cart.
- On 4xx: show the server's error inline; on 5xx: keep the cart, show a retry.

## Mobile-specific

- Apple Pay / Google Pay buttons appear at the **top** of checkout when available — most mobile users tap them and skip the rest of the form.
- The "Place Order" CTA must be reachable with one thumb (sticky bottom bar).
- Keyboard never overlaps the active input — scroll into view on focus.

## Common bugs to watch for

- Cart total drifts from server total after a coupon — always re-fetch the summary after applying coupons.
- Stale variant prices: lock the line item price at the time of add, but warn the user if it changed at checkout.
- Double-submission on slow networks (idempotency key fixes this).
- Quantity changes that don't debounce — "+" tapped 5 times shouldn't fire 5 PATCH requests; debounce 400ms then send the final value.

## Checklist

- Cart survives a page reload (localStorage or server).
- All currencies render via `Intl.NumberFormat`, not string concat.
- Tax/shipping recalc when address changes.
- Empty cart has a clear CTA back to the feed.
- Tested with screen reader through the entire flow.
- Idempotency key on `POST /orders`.
