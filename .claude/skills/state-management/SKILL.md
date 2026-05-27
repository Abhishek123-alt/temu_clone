---
name: state-management
description: Decide where state lives in the React client — Zustand (client-only), TanStack Query (server data), URL params (shareable), or useState (component-local). Trigger whenever the user mentions Zustand, TanStack Query, react-query, useQuery, useMutation, store, persist, hydration, "where should this state go", or "auth/cart/wishlist not syncing".
---

# State Management (Zustand + TanStack Query + URL + useState)

The client uses **Zustand** for global client state (`authStore`, `cartStore`, `wishlistStore`) and **TanStack Query** for everything that comes from the API. URL params drive shareable state (filters, search). Mixing these wrong is the #1 cause of "the data isn't updating" bugs.

## When this skill applies

- Adding a new feature that fetches/mutates server data.
- Adding a new global store or hook.
- Cart / auth / wishlist sync bugs (logout doesn't clear cart, filters lost on back, etc).
- Choosing between `useState`, store, query, or URL.

## Decision rubric — where does X live?

```
Is the data on the server?
├── YES → TanStack Query (useQuery / useInfiniteQuery / useMutation).
│        Never copy server data into a Zustand store.
└── NO
    ├── Does it need to survive a page reload? → Zustand with `persist` middleware (auth, cart for guests).
    ├── Should the URL reflect it (shareable, back-button)? → useSearchParams / URL state.
    └── Just this component? → useState.
```

A symptom you got it wrong: you find yourself manually calling `queryClient.setQueryData` to sync a Zustand store with a query. Stop — pick one source of truth.

## TanStack Query — server data

```js
// client/src/services/productService.js
import api from "./api";
export const productKeys = {
  all: ["products"],
  list: (filters) => [...productKeys.all, "list", filters],
  detail: (id) => [...productKeys.all, "detail", id],
};
export const fetchProducts = (filters) =>
  api.get("/products", { params: filters }).then((r) => r.data);
export const fetchProduct = (id) =>
  api.get(`/products/${id}`).then((r) => r.data);
```

```jsx
// in a component
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: productKeys.detail(id),
  queryFn: () => fetchProduct(id),
  staleTime: 60_000,
});
```

Guidelines:

- **Query key shape**: keep it as a structured factory (`productKeys.detail(id)`). Don't pass random arrays scattered across files.
- **`staleTime`**: > 0 for almost everything (60s for feed/detail, 0 only for cart/checkout where staleness causes bugs).
- **`gcTime`**: default 5 min is fine.
- Mutations call `queryClient.invalidateQueries({ queryKey: productKeys.all })` on success — don't manually patch unless you do an *optimistic update* and rollback on error.
- For long lists, use `useInfiniteQuery` (see `product-discovery-ui`).

### Optimistic updates (e.g., wishlist toggle)

```jsx
const toggle = useMutation({
  mutationFn: (id) => api.post(`/wishlist/items`, { product_id: id }),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ["wishlist"] });
    const prev = queryClient.getQueryData(["wishlist"]);
    queryClient.setQueryData(["wishlist"], (old) => toggleIn(old, id));
    return { prev };
  },
  onError: (_e, _id, ctx) => queryClient.setQueryData(["wishlist"], ctx.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
});
```

## Zustand — client-only persistent state

```js
// client/src/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    token: null,
    login: (user, token) => set({ user, token }),
    logout: () => set({ user: null, token: null }),
    hasRole: (role) => get().user?.role === role || get().user?.role === "ADMIN",
  }),
  {
    name: "auth-v1",
    partialize: (s) => ({ user: s.user, token: s.token }),  // never persist functions
    version: 1,
  },
));
```

- **Name the storage key with a version** (`auth-v1`). Bumping the version on breaking changes prevents stale localStorage from crashing the app.
- **`partialize`**: opt-in to what's persisted. Don't persist derived/computed values.
- Don't put server data here. The auth store holds the user identity + token; the user's order history is a query.

### Selector hygiene

```js
// ❌ re-renders on any auth change
const auth = useAuthStore();

// ✅ only re-renders if `user` changes
const user = useAuthStore((s) => s.user);
const logout = useAuthStore((s) => s.logout);
```

Always pass a selector. Use shallow equality when selecting multiple fields:

```js
import { useShallow } from "zustand/react/shallow";
const { user, token } = useAuthStore(useShallow((s) => ({ user: s.user, token: s.token })));
```

## URL state — `useSearchParams`

For filters, sort, search query, pagination — anything that should survive sharing the link or hitting Back.

```jsx
const [params, setParams] = useSearchParams();
const sort = params.get("sort") ?? "popular";

const onSortChange = (next) => {
  const p = new URLSearchParams(params);
  p.set("sort", next);
  setParams(p, { replace: false });   // push state so Back works
};
```

- One source of truth: the URL. Don't mirror it into a useState — they will drift.
- Encode arrays as repeated keys (`?category=tops&category=hats`) or comma-joined (`?category=tops,hats`). Pick one and stick to it across services.

## Cross-store interactions

On logout, clear or migrate dependent stores. Auth changing affects cart and wishlist.

```js
// in authStore.logout()
logout: () => {
  set({ user: null, token: null });
  useCartStore.getState().clearLocalOnly();          // keep cart for guests
  useWishlistStore.getState().clear();
  queryClient.clear();                               // wipe ALL server caches
},
```

This avoids the classic bug where user A logs out and user B logs in to see user A's order history still cached.

## Cart-specific (guest → logged-in merge)

- Guests: cart in Zustand `cartStore` (persisted).
- On login: call `POST /cart/merge` with the local cart; server returns the merged cart; from then on use TanStack Query for the cart.
- Local guest cart is cleared after a successful merge.

See `cart-checkout-ui` for the UI side of this.

## React Query setup (one place)

```jsx
// client/src/main.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => err?.response?.status >= 500 && count < 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,    // can be flippy on dev
    },
    mutations: { retry: false },
  },
});
```

Do NOT retry mutations by default — `POST /orders` would double-charge.

## Common mistakes to flag

- Copying `useQuery` data into `useState` so you can "modify" it — modify via mutations + invalidate.
- Using Zustand for the product list — pagination, caching, staleness all already solved by TanStack Query.
- No selector on `useStore()` — every component re-renders on every change.
- Persisting the entire auth store including `login`/`logout` functions (they'll be `undefined` after hydration).
- Forgetting to bump the store `version` after a breaking shape change.
- Mirroring URL params into a `useState` then using both — they will desync; pick the URL.
- `queryClient.invalidateQueries()` with no arg in a hot path — invalidates everything, refetch storm.

## Checklist

- Server data → TanStack Query. Period.
- Auth/cart/wishlist → Zustand with `persist`, versioned key, selectors at call sites.
- Filters/search/pagination → URL params.
- Logout clears the query cache AND any user-scoped Zustand stores.
- Mutations don't auto-retry; queries retry on 5xx only.
- Optimistic updates have an `onError` rollback.
