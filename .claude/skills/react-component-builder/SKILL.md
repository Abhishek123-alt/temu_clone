---
name: react-component-builder
description: Build production-grade React components for a Temu-style e-commerce frontend. Trigger whenever the user asks to create, refactor, or review a React component (.jsx/.tsx), a product card, listing grid, modal, form, navigation, or any reusable UI primitive. Also trigger for "build the home page", "make a component for...", "convert this to React", "add a new screen", or similar phrasing — even when React isn't named explicitly.
---

# React Component Builder

This project's frontend is React (Vite or Next.js). Components must be fast, accessible, and composable so they hold up under infinite-scroll product feeds, gamification overlays, and a multi-region storefront.

## When this skill applies

Use this for any UI work in the `frontend/` tree: cards, lists, modals, forms, layout shells, headers/footers, skeleton loaders, toasts. For data-fetching layout decisions or global state, also consult `state-management`. For checkout/cart flows specifically, consult `cart-checkout-ui`.

## Core principles

1. **Small, single-responsibility components.** Anything over ~150 lines is a smell — split presentational vs. container.
2. **Co-locate styles, tests, and types.** A component lives in `ComponentName/` with `index.tsx`, `ComponentName.test.tsx`, and `ComponentName.module.css` (or Tailwind classes inline).
3. **Server state vs. UI state.** Use TanStack Query (or SWR) for anything fetched from FastAPI. Use `useState`/`useReducer` for transient UI state. Don't store server data in Redux/Zustand.
4. **Accessibility is not optional.** Every interactive element needs a focus ring, a sensible role, and keyboard support. Buttons are `<button>`, not `<div onClick>`.
5. **Mobile-first.** This is a Temu clone — the majority of traffic is mobile. Design at 360px first, scale up.

## Standard file layout

```
src/components/ProductCard/
├── ProductCard.tsx        # the component
├── ProductCard.test.tsx   # unit + a11y tests
├── ProductCard.stories.tsx (optional, if Storybook)
└── index.ts               # re-export
```

## Component template

```tsx
import { memo } from "react";
import clsx from "clsx";

export interface ProductCardProps {
  productId: string;
  title: string;
  priceCents: number;
  originalPriceCents?: number;
  imageUrl: string;
  soldCount?: number;
  onAddToCart?: (productId: string) => void;
  className?: string;
}

function ProductCardImpl({
  productId, title, priceCents, originalPriceCents,
  imageUrl, soldCount, onAddToCart, className,
}: ProductCardProps) {
  const discount = originalPriceCents
    ? Math.round((1 - priceCents / originalPriceCents) * 100)
    : 0;

  return (
    <article className={clsx("rounded-lg border p-2", className)}>
      <img src={imageUrl} alt={title} loading="lazy" className="aspect-square w-full object-cover" />
      <h3 className="mt-2 line-clamp-2 text-sm">{title}</h3>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-semibold">${(priceCents / 100).toFixed(2)}</span>
        {discount > 0 && <span className="text-xs text-red-600">-{discount}%</span>}
      </div>
      {soldCount && <p className="text-xs text-gray-500">{soldCount.toLocaleString()} sold</p>}
      <button
        type="button"
        onClick={() => onAddToCart?.(productId)}
        className="mt-2 w-full rounded bg-orange-500 py-1.5 text-sm font-medium text-white"
      >
        Add to cart
      </button>
    </article>
  );
}

export const ProductCard = memo(ProductCardImpl);
```

## Performance patterns

- **`memo` only when profiled.** Don't blanket-wrap; use it for cards inside long lists.
- **Lists need stable keys.** Use the product ID, never the array index.
- **Use `react-window` or `@tanstack/react-virtual`** for feeds of 200+ items.
- **Lazy-load images** (`loading="lazy"`) and use a CDN with responsive `srcset`.
- **Code-split routes** with `React.lazy` + `Suspense`.

## Anti-patterns to flag

- Inline arrow functions inside `.map()` over hundreds of items (creates re-renders).
- Using `useEffect` to set derived state — derive it during render instead.
- Reaching into `window` or `document` without a `useEffect` guard (breaks SSR).
- One giant `<App>` with everything inside it.
- Mixing Tailwind classes with CSS modules in the same component without a clear reason.

## Checklist before declaring done

- TypeScript types are explicit (no `any`).
- Component renders without props (or has sensible defaults).
- A11y: tab order works, focus is visible, screen reader makes sense.
- No layout shift on image load (set `aspect-ratio` or width/height).
- Tested at 360px, 768px, 1280px.
- A unit test exists for the main rendering path.
