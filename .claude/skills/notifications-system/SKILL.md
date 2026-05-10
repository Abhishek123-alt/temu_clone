---
name: notifications-system
description: Design and implement transactional + marketing notifications across email, SMS, push, and in-app — provider integration (SendGrid/SES/Postmark, Twilio, FCM/APNs, OneSignal), templates with i18n, user preferences, transactional vs. marketing separation, deliverability, and rate limits. Trigger whenever the user mentions email, SMS, push, notification, OTP send (channel side), order confirmation email, transactional email, marketing email, unsubscribe, "send a message to the user", template, or deliverability.
---

# Notifications System

Notifications are how the app talks to the user when they're not in the app. The bar is high: must arrive (deliverability), must be timely (queue health), must be respectful (preferences + opt-outs), must be safe (no auto-replies to attacker-controlled input).

## When this skill applies

- Wiring transactional email/SMS/push for the first time.
- Adding a new event-driven notification (e.g., "shipping delayed").
- Building user notification preferences.
- Triaging "the email didn't arrive" tickets.

## Channels & default providers

| Channel | Default | Alt |
| --- | --- | --- |
| **Transactional email** | Postmark / SES | SendGrid (transactional plan) |
| **Marketing email** | Customer.io / Klaviyo | Mailchimp |
| **SMS** | Twilio | AWS SNS / Vonage |
| **Push (mobile)** | FCM (Android) + APNs (iOS) via OneSignal / Expo | direct |
| **In-app** | DB-backed notification feed | — |

Keep transactional and marketing on **separate sending domains and IPs**. A marketing reputation hit shouldn't take down order receipts.

## Architecture

```
domain event (OrderPaid, ShipmentCreated, ...)
        ↓
   outbox table  (transactional outbox in DB)
        ↓
   notification dispatcher (worker)
        ↓
   per-channel adapter:
     ├─ email_adapter  → Postmark API
     ├─ sms_adapter    → Twilio API
     ├─ push_adapter   → FCM/APNs
     └─ inapp_adapter  → DB write + WS push
```

Don't send from inside an HTTP request handler. Always go through the outbox + worker so:

- Sends survive a crash mid-request.
- Slow providers don't block API latency.
- Retries are handled centrally.

## Templates

Store templates in code (not in the provider's UI) so they're versioned and reviewable.

```
notifications/templates/
├── order_paid/
│   ├── email.subject.txt
│   ├── email.html.j2
│   ├── email.text.j2
│   └── sms.txt.j2
├── shipment_shipped/
│   └── ...
└── _shared/
    ├── header.html.j2
    └── footer.html.j2
```

Use `Jinja2` (Python) or MJML for resilient HTML emails (renders consistently in Outlook).

```jinja
{# order_paid/email.html.j2 #}
{% extends "_shared/base.html.j2" %}
{% block body %}
  <h1>Thanks for your order, {{ user.first_name }}!</h1>
  <p>Order #{{ order.short_id }} — {{ order.total | money }}</p>
  {% include "_shared/order_lines.html.j2" %}
{% endblock %}
```

Always include a plain-text version of every email — improves deliverability, helps screen readers.

## Internationalization

Drive copy from i18n keys, not hard-coded English. Choose the user's locale from `users.locale` and fall back to `en-US`.

```
notifications/templates/order_paid/
├── en/email.html.j2
├── es/email.html.j2
└── fr/email.html.j2
```

Or keep one template per channel and pull strings from a per-locale JSON.

## User preferences

```sql
notification_prefs (
  user_id      text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_tx     boolean NOT NULL DEFAULT true,
  email_promo  boolean NOT NULL DEFAULT true,
  sms_tx       boolean NOT NULL DEFAULT true,
  sms_promo    boolean NOT NULL DEFAULT false,
  push_tx      boolean NOT NULL DEFAULT true,
  push_promo   boolean NOT NULL DEFAULT true,
  inapp        boolean NOT NULL DEFAULT true,
  quiet_hours  jsonb     -- {"start":"22:00","end":"08:00","tz":"America/Los_Angeles"}
);
```

Rules:

- **Transactional opt-out**: tighter than marketing. Some events (security-critical, account changes) cannot be opted out.
- **Marketing opt-in (in some regions)**: GDPR / CCPA require explicit consent. Default OFF in EU/CA.
- **Quiet hours** — push and SMS only.
- **Unsubscribe link** in every marketing email; one-click unsubscribe header (`List-Unsubscribe`, `List-Unsubscribe-Post`).

## Idempotency & deduping

Outbox events have a stable `dedup_key` (e.g., `order_paid:ord_123`). The worker checks Redis (`sent:{dedup_key}` with TTL) before sending. Two events with the same key only result in one send — protects against duplicate consumption from retries.

## Rate limits & throttling

- Per-user: max 1 push every 5 min; max 1 SMS per 30 min (transactional excepted).
- Per-event-type: cap how many marketing pushes a user gets per week.
- Per-IP / per-account on OTP: covered in `auth-jwt`.

Provider rate limits matter too — Twilio caps SMS by carrier; SendGrid bursts can throttle. The worker should respect 429s with backoff.

## Deliverability essentials

- **SPF, DKIM, DMARC** all set up on your sending domain. Without these, Gmail / Outlook will silent-bin you.
- **Warm up** new sending IPs (gradual volume ramp over 2–4 weeks).
- **Bounce handling**: hard-bounce → mark email invalid (`users.email_status = 'bounced'`), stop sending. Soft-bounce → retry with backoff.
- **Complaint handling**: provider feedback loop (Postmark/SES) → mark user as `complained` → stop all marketing immediately.
- **Reply-to** points at a real, monitored inbox (or `support@`). Auto-reply with a help link if you don't read it.
- Avoid spam triggers: ALL CAPS subjects, "FREE!!!", attachment-heavy emails, mismatched display name/domain.

## Push notifications

- iOS APNs and Android FCM differ on payload, sound, badge. Use a service (OneSignal, Expo) to abstract.
- Token lifecycle: store FCM/APNs tokens per device; clean up on `unregistered` errors.
- Deep links: `temu-clone://orders/ord_123` opens the order screen if the app is installed.
- Don't send "marketing" pushes to users who haven't opened the app in 30 days — they'll eventually disable notifications.

## In-app notifications

A bell icon with a badge. Stored in DB:

```sql
inapp_notifications (
  id        text PRIMARY KEY,
  user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind      text NOT NULL,       -- order_shipped, reward_earned, ...
  title     text NOT NULL,
  body      text,
  link      text,                -- deep link in the app
  read_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inapp_user ON inapp_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
```

Push to connected clients via WebSocket / SSE for instant updates; fall back to polling.

## Common notification triggers (for this app)

| Event | Email | SMS | Push | In-app |
| --- | --- | --- | --- | --- |
| `account.email_verify` | yes | — | — | — |
| `auth.login_new_device` | yes (security) | optional | — | — |
| `order.placed` | yes | — | yes | yes |
| `order.shipped` | yes | yes | yes | yes |
| `order.delivered` | yes | — | yes | yes |
| `order.refunded` | yes | — | yes | yes |
| `return.approved` | yes | — | yes | yes |
| `reward.earned` | optional | — | yes | yes |
| `cart.abandoned` (24h) | yes (marketing) | — | optional | — |
| `flash_sale.starting` | yes (marketing) | — | yes (marketing) | yes |

Marketing events respect `*_promo` prefs; transactional events respect `*_tx` prefs.

## Common mistakes to flag

- Sending email synchronously in the request handler.
- One template with `if user.locale == "es"` branches everywhere — split.
- No DKIM / DMARC — emails go to spam silently.
- Logging full email bodies (PII).
- Auto-reply to user-supplied addresses (could be attacker-controlled, leads to backscatter).
- Sending password-reset link via SMS only (SIM swap risk; email + SMS).
- No unsubscribe header / link on marketing emails (CAN-SPAM violation).
- Push notifications without a deep link (user taps, lands on home — useless).
- Quiet hours ignored.

## Checklist

- Sends go through an outbox + worker, never inline.
- Templates are code-versioned, with text + HTML + i18n.
- Notification preferences exist and are honored on every send.
- DKIM, SPF, DMARC, List-Unsubscribe configured.
- Bounces and complaints update user status and stop sending.
- Idempotency via `dedup_key` per event.
- Per-user rate limits enforced.
- Audit log for every send (user_id, kind, channel, provider_id, status).
