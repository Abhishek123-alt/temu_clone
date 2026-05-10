---
name: state-management
description: Decide where state should live and wire it correctly — server state via TanStack Query, global UI state via Zustand, URL state via search params, ephemeral state via useState. Trigger whenever the user asks about state, "where should this live", caching, refetching, prop drilling, Redux, Zustand, Context, useState, useReducer, query invalidation, or "the data isn't updating".
---

# State Management

State bugs in e-commerce show up as wrong totals, stale carts, and flickering UIs. Keep the rules simple and consistent.

## When this skill applies

Anywhere data is shared across components, persisted, or fetched. Especially: cart, user session, product feed, filters, wallet balance, gamification rewards.

## The four buckets

| Kind | Where it lives | Tool |
| --- | --- | --- |
| **Server state** (products, orders, cart-on-server, wallet) | The server. Cache + revalidate. | TanStack Query |
| **URL state** (filters, sort, search, current page) | The URL. | `useSearchParams` / `nuqs` |
| **Global UI state** (auth user, theme, drawer open) | A small store. | Zustand |
| **Local UI state** (form input, hover, expanded) | The component. | `useState` / `useReducer` |

If you're putting server data in Zustand, stop and use TanStack Query instead.

## TanStack Query patterns

Query keys are arrays of stable, serializable values:

```ts
queryKey: ["products", { category, minPrice, sort }]
queryKey: ["product", productId]
queryKey: ["cart"]
queryKey: ["wallet", userId]
```

Mutations invalidate the affected keys:

```ts
const addToCart = useMutation({
  mutationFn: (line: NewCartLine) => api.post("/cart/items", line),
  onMutate: async (line) => {                            // optimistic
    await qc.cancelQueries({ queryKey: ["cart"] });
    const prev = qc.getQueryData(["cart"]);
    qc.setQueryData(["cart"], (c) => addLineLocal(c, line));
    return { prev };
  },
  onError: (_e, _v, ctx) => qc.setQueryData(["cart"], ctx?.prev),
  onSettled: () => qc.invalidateQueries({ queryKey: ["cart"] }),
});
```

Defaults that work well for this app:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // 1 min
      gcTime: 5 * 60_000,          // 5 min
      retry: 2,
      refetchOnWindowFocus: false, // products don't change that fast
    },
  },
});
```

Override per-query when needed (cart and wallet should refetch on focus).

## Zustand for global UI state

Keep stores small and per-domain. Don't build one mega-store.

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: "auth", partialize: (s) => ({ user: s.user }) }
  )
);
```

Other good Zustand candidates: `useUI` (drawer/modal flags), `useToasts`. **Bad** Zustand candidate: `useProducts` — that's server state.

## URL state for filters

Filters belong in the URL so they're shareable and survive reload:

```
/search?q=hoodie&category=tops&min_price=500&sort=popular&page=2
```

Use `nuqs` (Vite) or Next.js `useSearchParams` with a typed wrapper. Never duplicate URL state into a Zustand store — pick one source.

## Forms

`react-hook-form` + `zod`. Don't use `useState` for every field — it re-renders the whole form on every keystroke.

## Anti-patterns to flag

- `useEffect` that fetches and `setState`s — use TanStack Query.
- Provider towers (10 nested Context.Providers) — collapse into Zustand stores.
- Storing the same data in two places (e.g., cart in Redux *and* TanStack Query).
- Reaching into `localStorage` directly inside components — wrap with the persist middleware or a small util.
- Refetching with `window.location.reload()` — invalidate the query.

## When to use `useReducer`

When local state has 3+ related fields with non-trivial transitions (a wizard, a complex form). Otherwise prefer multiple `useState`s — easier to read.

## Checklist

- Every fetch goes through TanStack Query (or a thin wrapper) — no raw `useEffect` + `fetch` in components.
- Mutations invalidate the right query keys.
- Optimistic updates roll back on error.
- URL state for anything shareable (filters, search, pagination).
- Zustand stores are small and persist only what should survive reload.
