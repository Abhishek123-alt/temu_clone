---
name: product-discovery-ui
description: Build the discovery surface — infinite-scroll feeds, "For You" recommendations, search with autocomplete, category mega-menus, faceted filters, and the product detail page (PDP). Trigger whenever the user mentions home feed, infinite scroll, product list, search, autocomplete, filters, facets, PDP, product detail, image gallery, reviews, or "make products discoverable". This is the heart of a Temu clone — bias toward triggering even if the user doesn't name the exact screen.
---

# Product Discovery UI

Discovery is what makes Temu *Temu*. The home page is an infinite scroll of recommendations, search is forgiving and fast, filters are dynamic, and the PDP layers social proof on top of imagery.

## When this skill applies

- Building or refactoring the home feed, category page, search results, or PDP.
- Adding filters, sort controls, autocomplete, or "recently viewed".
- Any time you need to show a paginated list of products to a user.

For the underlying card component, use `react-component-builder`. For the cart drawer/checkout, see `cart-checkout-ui`.

## Architecture overview

```
HomeFeed
├── HeroCarousel
├── CategoryRail
├── FlashSaleStrip       (urgency: see gamification-ui)
└── InfiniteProductGrid  ← uses TanStack Query useInfiniteQuery
                          + react-virtual for virtualization

SearchPage
├── SearchBar (autocomplete, debounced 200ms)
├── FilterSidebar (faceted, URL-synced)
├── SortDropdown
└── ProductGrid (paginated)

PDP (/products/:id)
├── ImageGallery (zoom, video)
├── PriceBlock (original vs discounted, urgency)
├── VariantSelector (color, size)
├── SocialProof ("X sold today", "in Y carts")
├── ReviewSection (photo reviews)
└── StickyAddToCart (mobile)
```

## Infinite scroll pattern

Use TanStack Query `useInfiniteQuery` plus an `IntersectionObserver` sentinel — never scroll-event listeners.

```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ["feed", filters],
  queryFn: ({ pageParam = 0 }) =>
    api.get(`/products?cursor=${pageParam}&limit=20`).then(r => r.data),
  getNextPageParam: (last) => last.nextCursor ?? undefined,
  staleTime: 60_000,
});

const sentinelRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!sentinelRef.current) return;
  const obs = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, { rootMargin: "600px" });
  obs.observe(sentinelRef.current);
  return () => obs.disconnect();
}, [hasNextPage, isFetchingNextPage, fetchNextPage]);
```

The 600px `rootMargin` prefetches before the user reaches the bottom — feels seamless.

## Search & autocomplete

- Debounce input by 200–250ms.
- Show recent searches when the input is focused but empty.
- Suggestions endpoint: `/search/suggest?q=...` returning `{terms: [], categories: [], products: []}`.
- Cancel in-flight requests on each new keystroke (`AbortController`).
- Highlight the matched substring in the suggestion list.

## Filters & sort

- **URL is the source of truth.** Use `?category=tops&min_price=500&sort=popular` so links are shareable and back/forward works. Use `useSearchParams` (Next.js) or `nuqs` (Vite).
- **Debounce filter changes** before refetching (300ms) so clicking 3 checkboxes fires one request.
- **Show counts per facet** (e.g., "Red (124)") — comes from the backend `facets` block.
- **Don't lock layout while loading** — overlay a subtle skeleton on the grid.

## PDP must-haves

1. **Above the fold on mobile**: image, title, price, primary CTA. Nothing else.
2. **Variant selection updates price and image** without a full reload.
3. **Sticky CTA on scroll** (mobile). Floats once the inline CTA leaves the viewport.
4. **Social proof block**: "1,243 sold in last 24h", "23 in carts right now". These come from the backend; never fake them client-side.
5. **Review photos** in a horizontal scroller, tappable to open a lightbox.

## Performance budget

- LCP under 2.5s on 4G mid-tier mobile.
- First product card visible within 1.2s.
- Image `srcset` with at least 3 widths (200, 400, 800).
- Preload the first 4–6 hero images; lazy-load the rest.

## Common mistakes to flag

- Putting the entire feed in a single `useState` array (mem leak after 1000 items — virtualize).
- Refetching the whole feed on every filter change (paginate from page 0 with the new filters, but reuse the query client cache).
- Hard-coding "1,243 sold" as static text — must be live from API.
- Building autocomplete without a request canceller — the slowest response wins and you get stale suggestions.

## Checklist

- URL reflects current filters/sort.
- Back button restores scroll position.
- Empty state has a CTA ("Try clearing filters").
- 4xx/5xx from the API shows a retry, not a white page.
- Skeleton matches the real layout (no jump on load).
