---
name: gamification-ui
description: Build the "Temu Special" gamification surfaces — spin-the-wheel, daily login rewards, mini-games (Fishland/Farmland-style), flash sales, referral loops, and credit/coupon wallets. Trigger whenever the user mentions spin wheel, daily reward, mini-game, flash sale, countdown, referral, invite friends, credit, coupon, gamify, retention loop, or "make it more sticky".
---

# Gamification UI

Gamification is what separates this from a generic e-commerce shell. The patterns here are powerful — and easy to get wrong in ways that feel manipulative or buggy. Build them so the value to the user is real and the timer never lies.

## When this skill applies

- Spin-the-wheel, scratch cards, daily check-ins, login streaks.
- Mini-games (collect-points, grow-a-tree, spin-to-win).
- Flash sales with countdown timers.
- Referral programs, invite codes, "share to unlock" mechanics.
- Wallet/credit balance UI and how earned rewards apply at checkout.

## Architectural rules

1. **The server owns truth.** Never decide a reward client-side. The client *requests* a spin; the server *decides* the outcome. This prevents tampering and keeps inventory of prizes accurate.
2. **Timers are server-anchored.** Send the server's `endsAt` ISO timestamp; render the countdown by diffing against `Date.now()`. Never start a timer from "now + 10 minutes" on the client — clock drift and reloads will desync it.
3. **Idempotency on every reward claim.** Sending "claim daily reward" twice (network retry) must not give two rewards.
4. **Fail soft.** A broken mini-game should never block shopping. Catch errors and hide the widget if the game backend is down.

## Countdown timer pattern

```tsx
function useCountdown(endsAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    expired: ms === 0,
    h: Math.floor(ms / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1000),
  };
}
```

When `expired` is true, refetch the parent data — the deal is over.

## Spin-the-wheel pattern

1. User taps "Spin".
2. Client sends `POST /rewards/spin` with an idempotency key.
3. Server returns `{ rewardId, prizeIndex, prizeLabel }`.
4. Client animates the wheel to land on `prizeIndex` (CSS rotate over ~3s with `cubic-bezier(0.2, 0.8, 0.2, 1)`).
5. After animation, show a celebration modal with the prize.

The animation is purely cosmetic — the result was decided server-side before the wheel started spinning.

## Flash sale strip

A horizontal rail at the top of the home feed. Server returns:

```json
{
  "endsAt": "2026-05-07T18:00:00Z",
  "items": [{"productId": "...", "saleSlots": 500, "soldSlots": 312}, ...]
}
```

Show:
- A single shared countdown header.
- Per-item progress bar (`soldSlots / saleSlots`).
- "Almost gone!" badge when over 80% sold.

When the timer hits zero, replace the rail with the next sale block (refetch).

## Referral loop

The user gets a unique link `/r/:code` that maps to their account. When a new user installs and places a first order:

- Both users get credits.
- The inviter gets a notification ("Sarah just earned you $5!").
- The invitee sees "You unlocked $X — applies at checkout".

UI considerations:
- "Copy link" + native share sheet (`navigator.share`) on mobile.
- A status board: "3 friends joined • 2 placed orders • $15 earned".
- Respect platform anti-spam: never auto-DM or auto-post.

## Wallet & credits

Credits balance and active coupons live under `/wallet`. At checkout, show a single line:

```
Available credits: $7.50  [Apply]
```

When applied, the order summary recalculates server-side. Never let the client decide which discount stacks with which — the backend rules are complex and will diverge.

## Honesty rules (important)

- Don't show "5 left in stock" if there are 500. The user will notice patterns.
- Don't reset the daily-deal countdown on page reload — it's the same deal, same end time.
- Don't auto-trigger the spin wheel modal more than once per session.
- Avoid dark patterns: closing a reward modal should be a single tap, no obscured X button.

These are not just ethical; they protect your retention. Users who feel manipulated churn fast.

## Animation budget

- Use `transform` and `opacity` only (compositor-only, 60fps).
- Modals fade+slide in 200ms.
- Wheel spins 2.5–3.5s.
- Confetti/celebration: max 1.2s, then auto-dismiss.
- Respect `prefers-reduced-motion` — show outcomes without animation.

## Checklist

- Every reward claim is idempotent.
- Every timer is anchored to a server timestamp.
- All modals are dismissible with Esc and a visible close button.
- `prefers-reduced-motion` honored.
- Reward outcomes log to analytics with the `rewardId` so fraud/bug investigations are possible.
