---
name: gamification-ui
description: Build the retention and engagement surface — spin-the-wheel, daily check-in, quests, flash sales, referrals, reward toasts with confetti. Trigger whenever the user mentions spin wheel, daily rewards, quest, mission, streak, referral, invite friend, flash sale, countdown, rewards, coins, badges, confetti, or "gamify X".
---

# Gamification UI

Retention surfaces drive Temu-style stickiness. The backend already exposes quests (`/quests`), spin-the-wheel (`/users/spin`), flash sales (`/flash-sales`), and referrals (`/users/referrals`). The frontend's job is to make these feel rewarding — fast feedback, satisfying motion, never deceptive.

## When this skill applies

- Building or polishing `client/src/components/gamification/*`.
- Adding a new reward type, quest tile, or daily-checkin UI.
- Wiring `canvas-confetti` reward bursts.
- Flash sale countdown timers, urgency badges.
- Referral share flows.

For underlying components see `react-component-builder`. For product card / urgency on the feed, see `product-discovery-ui`.

## The honesty principle

Every urgency / reward shown on screen must be backed by real backend data:

- "9:42 left" → comes from a flash sale `ends_at` from the API.
- "1,243 sold today" → real `sold_count`, never a hardcoded fake.
- "You earned 50 coins!" → the server actually granted them and returned the new balance.

Fake urgency works for a week. Then users notice, and trust is gone forever. Build it honestly from day one.

## Quest tile pattern

```jsx
function QuestTile({ quest }) {
  const pct = Math.min(100, (quest.progress / quest.target) * 100);
  const done = pct >= 100;
  return (
    <div className={cn(
      "rounded-2xl p-4 bg-white shadow-sm",
      done && "ring-2 ring-emerald-400"
    )}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{quest.title}</h3>
          <p className="text-sm text-zinc-500">{quest.description}</p>
        </div>
        <RewardChip reward={quest.reward} />
      </div>
      <div className="mt-3 h-2 rounded-full bg-zinc-100 overflow-hidden">
        <motion.div
          className="h-full bg-orange-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <p className="text-xs text-zinc-500 mt-2">
        {quest.progress} / {quest.target}
      </p>
      {done && <ClaimButton questId={quest.id} />}
    </div>
  );
}
```

- Progress bar animates from previous value (not from 0) so users see the increment.
- Done state has clear affordance and a Claim button (never auto-claim — losing the click moment loses the dopamine).

## Spin-the-wheel

```jsx
function SpinWheel({ segments, onLand }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const spin = async () => {
    setSpinning(true);
    const result = await api.post("/users/spin").then(r => r.data);
    // server decides the prize; client just animates to it
    const targetDeg = degreesForSegment(segments, result.prize_index);
    const total = 360 * 5 + targetDeg;        // 5 full rotations + land
    setRotation((r) => r + total);
    setTimeout(() => {
      setSpinning(false);
      onLand(result);
    }, 4200);
  };

  return (
    <div className="relative">
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ duration: 4, ease: [0.17, 0.67, 0.3, 1] }}
      >
        <WheelSvg segments={segments} />
      </motion.div>
      <Pointer />
      <Button onClick={spin} disabled={spinning}>Spin</Button>
    </div>
  );
}
```

Key rules:

- **Server decides the outcome.** Never compute the prize on the client — it's trivially cheatable in DevTools.
- The animation lands on the server's chosen segment; client just calculates the angle.
- One spin per user per `spin_cooldown` (24h typical). Server enforces this with `last_spin_at`; UI shows a countdown.

## Confetti & reward toast

```jsx
import confetti from "canvas-confetti";

export function celebrate() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 },
  });
}

// usage on a reward claim
const claim = useMutation({
  mutationFn: (id) => api.post(`/quests/${id}/claim`),
  onSuccess: (r) => {
    celebrate();
    toast.reward(`+${r.data.coins} coins`);
  },
});
```

Reward toast lives at the top center on mobile, top right on desktop, auto-dismiss 2.5s, `aria-live="polite"`. Don't spam — debounce so 5 rapid claims yield one celebration.

## Flash sales

`GET /flash-sales/active` returns `{ id, ends_at, products: [...] }`. The strip on the home page:

- Reads `ends_at`, renders a single `<CountdownTimer>` driving the whole strip — don't create 12 setIntervals.
- When the sale ends client-side, refetch — the server may have a new sale queued.
- "X sold of Y" comes from `sold_count` + `total_count`; render as a progress bar.

```jsx
function CountdownTimer({ endsAt }) {
  const [remaining, setRemaining] = useState(() => endsAt - Date.now());
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(endsAt - Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (remaining <= 0) return <span>Ended</span>;
  return <span className="font-mono">{formatHMS(remaining)}</span>;
}
```

Always derive from `endsAt`; don't store the elapsed counter in state — page focus/blur drifts.

## Referrals

- Each user has a `referral_code` (already on the user model).
- Share link: `https://temu-clone.app/?ref={code}`. On signup, the code goes into `referred_by`.
- Share UX uses `navigator.share` when available (mobile native sheet); falls back to a copy-link button.
- "You and {friend} both get $5" — text comes from the backend's referral config; don't hardcode the value, it changes by region.

## Quest progress is driven server-side

The user doesn't trigger quest updates from the client. The server hooks them on real events:

- `DAILY_LOGIN` — on `/auth/login` success.
- `PRODUCT_VIEW` — on adding to recently-viewed.
- `PRODUCT_UPLOAD` — for sellers, on product create.
- `ORDER_PLACED`, `ORDER_DELIVERED`, `FLASH_SALE_VIEW`.

The frontend just renders the current progress. If you find yourself calling `POST /quests/progress` from a component, stop — wire the trigger server-side instead.

## Accessibility

- Animations honor `prefers-reduced-motion` (skip the 4-second wheel spin → show the result instantly).
- Confetti is decorative — no `role`, no `aria-live`. The reward toast carries the announcement.
- Progress bars have `role="progressbar"` with `aria-valuenow`/`aria-valuemax`.

## Dark patterns to avoid

- Fake scarcity ("Only 1 left!" when stock is plenty).
- Fake social proof ("23 people are watching" when nobody is).
- Loss-aversion prompts users can't dismiss.
- Wheel "win" rates that contradict the actual server distribution.
- Variable-reward loops designed to be addictive without delivering value.

If marketing asks for any of these, push back. Long-term retention is built on trust, not tricks.

## Common mistakes to flag

- Client-side prize roll for the spin wheel (cheatable; also will desync if a reward is depleted on the server).
- 12 `setInterval`s on a flash sale strip.
- Confetti on every single click (becomes noise).
- Hardcoded reward values that don't match what the server granted.
- Showing claimed quests as still-claimable because the local cache wasn't invalidated.

## Checklist

- All gamification UIs render server-provided state — never invent numbers.
- Reward outcomes are signed/issued by the server; client just animates.
- Reduced-motion users get a graceful path.
- Countdown derives from `endsAt`, not accumulated ticks.
- Quest progress invalidates the right query keys after a claim.
- No dark patterns / fake urgency in the codebase.
