---
name: react-component-builder
description: Build production-grade, reusable React 19 components with Tailwind, Framer Motion, lucide-react, and clsx/tailwind-merge for this project. Trigger whenever the user mentions React component, button, modal, drawer, card, form, layout, animation, accessible, ARIA, design system, or "make a reusable component".
---

# React Component Builder (React 19 + Tailwind + Framer Motion)

This client is React 19 + Vite + Tailwind CSS, with `framer-motion` for animations, `lucide-react` for icons, and `clsx + tailwind-merge` for conditional classes. State is split between Zustand (client) and TanStack Query (server). Components live under `client/src/components/{layout,common,products,marketing,gamification,reviews,profile,seller}`.

## When this skill applies

- Building a new shared component (button, modal, drawer, card, input, badge).
- Refactoring a page-local component into a reusable one.
- Adding animations, accessibility, or responsive behavior to existing components.

For data-fetching/state placement, see `state-management`. For discovery-specific components (PDP, feed), see `product-discovery-ui`. For cart/checkout, see `cart-checkout-ui`.

## Folder conventions

```
client/src/components/
├── common/        # Button, Modal, Drawer, Skeleton, EmptyState, Toast
├── layout/        # Header, Footer, CategoryDropdown, MobileNav
├── products/      # ProductCard, PriceBlock, VariantPicker, RatingStars
├── marketing/     # BannerCarousel, CountdownTimer, BadgeStrip
├── gamification/  # SpinWheel, QuestTile, ConfettiBurst, RewardToast
├── reviews/       # ReviewItem, ReviewList, PhotoLightbox
├── profile/       # AddressForm, PaymentMethodCard
└── seller/        # SellerStatTile, ProductRow, FulfillmentBadge
```

Decide layer by **who uses it**: `common` if multiple feature folders share it, otherwise scope it to the feature folder.

## File / naming

- One component per file. PascalCase filename: `ProductCard.jsx`.
- Default-export the component. Named-export any sub-parts (`ProductCard.Skeleton`, `ProductCard.Compact`).
- Co-locate `ProductCard.module.css` only if Tailwind isn't enough — that's rare.

## The `cn` helper (must use)

```js
// client/src/lib/cn.js
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...args) => twMerge(clsx(args));
```

`twMerge` resolves Tailwind class conflicts (`px-2 px-4` → `px-4`). Use it on every component that accepts a `className` prop.

## Component shape

```jsx
import { cn } from "@/lib/cn";
import { ShoppingBag } from "lucide-react";

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...rest
}) {
  return (
    <button
      type="button"
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variant === "primary" && "bg-orange-500 text-white hover:bg-orange-600",
        variant === "ghost"   && "bg-transparent hover:bg-zinc-100",
        variant === "outline" && "border border-zinc-300 hover:bg-zinc-50",
        className,
      )}
      {...rest}
    >
      {loading && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
```

- `...rest` lets callers pass `onClick`, `aria-label`, `data-*`.
- `disabled` derived from `loading` — never spinner without disabling.
- Focus states are visible (`focus-visible:ring-*`) — keyboard users need them.

## Accessibility (non-negotiable)

- Buttons are `<button>`, links are `<a>`. Never `<div onClick>`.
- Inputs always paired with `<label htmlFor>`.
- Modal/Drawer trap focus, restore focus on close, close on `Escape`.
- Color contrast ≥ 4.5:1 on text against background.
- `aria-live="polite"` on toasts, `aria-live="assertive"` only for critical alerts.
- Images: `alt` is mandatory — empty `alt=""` is fine for decorative.

## Animation with framer-motion

Use sparingly. Default to CSS transitions for hover/focus; reach for `framer-motion` when entering/leaving the DOM or for shared element transitions.

```jsx
import { motion, AnimatePresence } from "framer-motion";

<AnimatePresence>
  {open && (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >...</motion.div>
  )}
</AnimatePresence>
```

Respect `prefers-reduced-motion`:

```jsx
const reduce = useReducedMotion();
const transition = reduce ? { duration: 0 } : { duration: 0.15 };
```

## Performance

- Wrap heavy lists in `@tanstack/react-virtual` (the feed already does).
- `React.memo` only when the component is in a hot list AND its props change rarely. Don't blanket-memo everything.
- `useCallback`/`useMemo` only when passing functions to memo'd children or for expensive computations — premature memoization is its own perf bug.
- Images: native `loading="lazy"` + `decoding="async"` + `srcSet` for responsive widths.

## Responsive (mobile-first)

Default classes target mobile; use `sm:` / `md:` / `lg:` / `xl:` only to upsize. Most e-commerce surfaces are designed mobile-first because >70% of traffic is phones.

```jsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
```

Touch targets minimum 40×40 px (`h-10 w-10`). Sticky bottom CTA on mobile checkout.

## State: where data lives

| Kind | Belongs in |
| --- | --- |
| URL state (filters, search, page) | URL params via `useSearchParams` |
| Server data (products, orders) | TanStack Query |
| Cross-page client state (auth, cart, wishlist) | Zustand store |
| Per-component UI state (modal open, hover) | `useState` |

Don't put server data in Zustand. Don't put modal-open in URL unless it's deep-linkable.

## Forms

- Controlled inputs for short forms (1–5 fields).
- For checkout/address forms, prefer `react-hook-form` + `zod` (see `cart-checkout-ui`).
- Validate on blur, not on every keystroke.
- Errors near the field, in red, with `aria-describedby` pointing at the error id.

## Loading & empty states (every component owes the user one)

A component that fetches data must render three states:

1. **Loading**: skeleton matching the real layout — no layout shift.
2. **Empty**: explicit copy ("No reviews yet") + a CTA where applicable.
3. **Error**: message + a "Retry" button (or rely on the global toast for transient).

## Common mistakes to flag

- Building a generic `<Modal>` that uses `position: absolute` instead of `position: fixed` + a portal — escapes parent overflow.
- Toggling Tailwind classes with string concat ("p-2 " + size) — use `cn()` so conflicts are resolved.
- Spinner that doesn't disable the button — users click 5×, you submit 5×.
- Using `<div onClick>` for an interactive thing — keyboard users can't reach it.
- Hard-coding image dimensions for a responsive grid — use aspect ratio classes (`aspect-square`).
- Memoizing every component "just in case" — bigger bundle, harder debugging.

## Checklist

- `className` prop is forwarded and merged with `cn()`.
- Focus styles are visible; component is keyboard-operable.
- Loading/empty/error states are designed and tested.
- Skeleton size matches final size (no CLS).
- Mobile layout works at 360px width.
- No business logic in the component — fetch via TanStack Query / Zustand at the page level and pass props down.
- Animations honor `prefers-reduced-motion`.
