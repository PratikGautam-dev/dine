<h1 align="center">Dine Connect</h1>

**A WhatsApp table-reservation and food-ordering receptionist for restaurants — menu-driven, multi-tenant, self-serve.**

A restaurant's guests reserve a table, order food, reschedule, cancel, and get reminders entirely inside WhatsApp — no app to install. Staff manage everything (tables, sections, menu items, reservations, orders, and the bot's own behavior) from a web portal. New restaurants onboard themselves through a guided wizard; nobody edits config files or touches code to add a tenant.

![Python](https://img.shields.io/badge/Python-3.12+-blue)
![Tests](https://github.com/PratikGautam-dev/dine/actions/workflows/tests.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

| Capability                    | How                                                                                                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Menu-driven reservations**  | Party size → section preference → date → time → guest name → confirm, entirely via WhatsApp interactive lists/buttons — no LLM in the loop, so it's deterministic and free per conversation. Which table gets assigned (nearest-fit by capacity) is resolved inside the same advisory-lock-protected transaction the confirm step runs, never guessed by the guest. |
| **Food ordering**             | Browse the menu, build a cart, and check out over WhatsApp, with Razorpay Payment Links for online payment                                                                                                                                                 |
| **Reschedule & cancel**       | Same double-booking-safe path real reservations use, guest-initiated from WhatsApp                                                                                                                                                                         |
| **English / Hindi**           | Session-level language picker; a restaurant can also set a default language or skip the picker entirely for a single-language deployment                                                                                                                   |
| **Reminders**                 | WhatsApp reminders at restaurant-configurable offsets before a reservation, triggered by an external cron hitting `/internal/send-reminders`                                                                                                               |
| **FAQ bot**                   | A separate lightweight flow for restaurant-authored Q&A, independent of the booking state machine                                                                                                                                                           |
| **Human handoff**             | A guest can escalate to a real person; staff see and reply to the queue from the portal                                                                                                                                                                    |
| **Multi-tenant from day one** | Every table, session, and connector call is scoped by `hospital_id` (this app's internal tenant identifier, unchanged since the product's earlier form) — one deployment serves many restaurants, each with its own WhatsApp number, credentials, and settings |
| **Self-serve onboarding**     | A guided wizard walks a new restaurant through Meta setup, WhatsApp credentials, sections/tables, and feature selection — no code changes, no manual DB edits                                                                                               |
| **Self-serve customization**  | Restaurants control their own menu labels, closing message, business-hours text, default language, operating hours/turnover, and session timeout from `/portal/settings`                                                                                  |
| **Staff portal**              | Dashboard, reservations, table management, food-ordering menu/orders, guest records (visit history, notes), and the message-handoff inbox                                                                                                                  |
| **Resilient state**           | Redis-backed session/history/rate-limiting with an automatic in-memory fallback — runs with zero extra infrastructure locally                                                                                                                              |
| **Tiered data access**        | A fixed connector interface (`connectors/`) abstracts "where booking data lives" — Tier 1 (this app's own Postgres) is fully built; Tiers 2/3 (a restaurant's existing system) are a defined extension point, not built speculatively ahead of a real need |

**Deliberately not here:** no AI/LLM anywhere in the booking flow (a fixed, auditable state machine instead — see [docs/Spec.md](docs/Spec.md) for the original reasoning; note that file is a historical build log from the original CareConnect (hospital) product and has not been rewritten for Dine Connect, so treat the code itself, plus [ARCHITECTURE_REFERENCE_FOR_FORKING.md](ARCHITECTURE_REFERENCE_FOR_FORKING.md) for the CareConnect-to-Dine-Connect mapping, as the current source of truth), no Google Calendar dependency for reservations (they live in this app's own database).

---

## How it works

```
Guest's WhatsApp message
        │
        ▼
┌────────────────────┐
│  FastAPI webhook    │  webhook/routes.py — validates the per-restaurant HMAC signature,
│  (webhook/)         │  resolves which restaurant owns this phone_number_id
└─────────┬───────────┘
          │
          ▼
┌────────────────────┐
│   flows/router.py    │  the feature-toggle router: owns the top-level menu,
│                     │  language selection, and reset-keyword handling
└─────────┬───────────┘
          │
   ┌──────┴───────┬─────────────┐
   ▼               ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ flows/   │  │ flows/   │  │ view/cancel/ │
│ booking/ │  │ faq.py   │  │ handoff, etc │
└────┬─────┘  └────┬─────┘  └──────┬───────┘
     │             │                │
     └─────────────┼────────────────┘
                    ▼
          ┌───────────────────┐
          │  connectors/        │  Tier 1/2/3 abstraction
          └─────────┬──────────┘
                     ▼
          ┌───────────────────┐
          │  db/repositories/   │  Postgres (Neon in production)
          └───────────────────┘

          Confirmation (with a generated reference ID) via WhatsApp
```

The **staff portal** is a separate path: the Next.js frontend (`frontend/`) talks to `portal/routes/`'s JSON API, which reads/writes the exact same Postgres tables and goes through the exact same `connectors/` booking path a WhatsApp guest uses — a staff-created reservation and a guest-created reservation are indistinguishable to the double-booking/quota logic, just tagged with a different `source`.

---

## Design principles

- **No LLM in the booking path.** Every state sends a fixed WhatsApp list/button message with a closed set of options; a reply is either a valid tap or free text, which re-prompts. Deterministic, auditable, and free per conversation.
- **Restaurant-configurable, not code-configurable.** Onboarding a new tenant, changing operating hours, or renaming a menu item never requires a code change or a manual database edit — it's a form.
- **Every query is tenant-scoped.** `hospital_id` is threaded through the session store, the database layer, and the connector interface everywhere — there's no code path that can read or write across tenants by accident.
- **Works offline from Redis.** Session state, message history, and rate limiting all have a Redis backend and an automatic in-memory fallback — run the whole stack locally with just Postgres.
- **Build the real thing once it exists, not speculatively.** The Tier 2/3 connector stubs raise a clear "not implemented yet" error rather than guessing at an external API shape before a real restaurant on that tier exists.

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/PratikGautam-dev/dine.git
cd dine/backend
uv sync
```

### 2. Configure

```bash
cp .env .env.local   # or create .env from scratch -- see below for what's required
```

Required for the bot to start:

- `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_APP_SECRET` — [Meta Developer Portal](https://developers.facebook.com/)
- `WHATSAPP_VERIFY_TOKEN` — any string you choose (must match the webhook config in Meta's dashboard)
- `INTERNAL_SECRET` — protects `/internal/send-reminders` (the cron-triggered reminder endpoint)
- `ADMIN_SECRET` — gates onboarding a _new_ restaurant via the wizard
- `TENANTS_ADMIN_SECRET` — gates the platform-wide tenant list/edit pages, deliberately separate from `ADMIN_SECRET` so a leaked onboarding secret can't also expose every existing tenant's stored credentials
- `PORTAL_SECRET`, `AUTH_SECRET`, `DOCTOR_SECRET`, `JWT_SECRET`, `SUPER_ADMIN_JWT_SECRET` — sign the various portal/staff/super-admin session tokens, each deliberately separate so a leaked one can't forge another

Optional:

- `REDIS_URL` — omit it and everything falls back to in-memory automatically (fine for local dev, not for a multi-process production deploy)
- `S3_BUCKET` (+ `S3_REGION`/`S3_ENDPOINT_URL`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`) — guest document uploads (`core/storage.py`); omit them and uploads fall back to local disk storage, fine for dev
- `FRONTEND_ORIGIN` — the deployed Next.js origin, added to CORS (defaults already include `localhost:3000` for local dev)

### 3. Database

Local development runs against its own Postgres, never the real deployed database:

```bash
docker compose -f ../docker-compose.dev-db.yml up -d   # starts a local Postgres on localhost:5433 (data persists in a Docker volume)
```

`.env`'s `DATABASE_URL` should point here by default (`postgresql://postgres:postgres@localhost:5433/whatsapp_dev`) — the app creates its schema and seeds a default restaurant automatically on first startup, no separate migration step needed. If Docker isn't an option on your machine, any locally-installed Postgres (or a portable, non-Docker binary distribution) works too — just point `DATABASE_URL` at it.

Never point local `DATABASE_URL` at the real production database, and never run a destructive seed/reset script (e.g. `scripts/seed_dev_rbac.py`) against it.

### 4. Run the backend

```bash
uv run main.py
```

Serves at `http://127.0.0.1:8000` — creates the schema and seeds a default restaurant against whichever `DATABASE_URL` is active on first request (step 3's local Postgres by default).

### 5. Run the staff portal frontend

```bash
cd ../frontend
npm install
npm run dev
```

Serves at `http://localhost:3000`. See [frontend/README.md](frontend/README.md) for frontend-specific details.

### 6. Expose the backend for WhatsApp

Use [ngrok](https://ngrok.com/) for local development:

```bash
ngrok http 8000
```

Set the webhook URL in [Meta Developer Portal](https://developers.facebook.com/) → WhatsApp → Configuration:

- Callback URL: `https://your-ngrok-url.ngrok.io/webhook`
- Verify token: same as your `WHATSAPP_VERIFY_TOKEN`

Then subscribe your app to the WhatsApp Business Account: `POST /{WABA_ID}/subscribed_apps`. Marking fields "Subscribed" in the dashboard alone is **not** sufficient — without this call, Meta logs the event internally but never calls your webhook. Also confirm "Attach a client certificate to Webhook requests" is turned **off** in Meta's dashboard — leaving it on breaks Meta's own TLS handshake to your webhook even though a manual `curl` test against it succeeds.

### 7. Onboard your first restaurant

Visit `/admin/onboard-hospital` (served by the Next.js frontend) and walk through the wizard — it collects sections, tables, WhatsApp credentials, and which features (reservations, food ordering, reschedule, cancel, FAQ, etc.) this restaurant wants enabled. No manual database work required.

---

## Testing

```bash
uv run pytest
```

50+ test files covering the booking/reschedule/cancel/FAQ state machines, multi-tenant isolation, the staff portal API, onboarding, guest records, food ordering, table management, rate limiting, and reminders. The suite needs a real Postgres to run against (`tests/conftest.py` provisions one automatically via [testcontainers](https://testcontainers.com/) if Docker is available, or set `TEST_DATABASE_URL` to point at any reachable Postgres instead — useful where Docker itself isn't available).

---

## Deploy

### Backend — Render (or any Docker host)

`backend/Dockerfile` builds a production image via `uv` and is deploy-target-agnostic — point Render (or Railway, Fly.io, etc.) at it with the service's root directory set to `backend`. Set the environment variables described in [Quick start](#2-configure) in your host's dashboard (pointing `DATABASE_URL` at your real production Postgres, e.g. Neon), plus `FRONTEND_ORIGIN` pointing at your deployed frontend's real URL.

Add a cron job for reminders — this project has no in-process scheduler by design:

```
curl -X POST https://your-app.example.com/internal/send-reminders \
  -H "X-Internal-Secret: $INTERNAL_SECRET"
```

Add a second cron job (e.g. once an hour) to auto-resolve stale "Talk to Reception" handoffs so an unanswered conversation doesn't sit open forever:

```
curl -X POST https://your-app.example.com/internal/auto-resolve-handoffs \
  -H "X-Internal-Secret: $INTERNAL_SECRET"
```

This repo also carries a `railway.toml` and a `docker-compose.prod.yml`/self-hosted-VPS path (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)) from earlier deploy setups — any platform that runs a container or plain `uvicorn main:app --host 0.0.0.0 --port $PORT` works.

### Frontend — Vercel

The Next.js app in `frontend/` deploys standalone to [Vercel](https://vercel.com/) — set `NEXT_PUBLIC_API_BASE_URL` to your deployed backend's URL, and set `FRONTEND_ORIGIN` on the backend to the deployed frontend's URL so CORS allows it.

---

## Architecture

```
dine-connect/
├── backend/                 # FastAPI app
│   ├── main.py                # composition root: FastAPI app, middleware, lifespan, include_router calls
│   ├── webhook/
│   │   ├── routes.py          # landing page, /health, /webhook GET+POST (the inbound HTTP boundary)
│   │   ├── dispatch.py        # WA-client cache, message locking, flows.handle_incoming() dispatch
│   │   └── cron_routes.py      # /internal/send-reminders, /internal/top-up-slots
│   ├── flows/
│   │   ├── router.py          # the feature-toggle router — the real conversation entry point
│   │   ├── common.py          # cap_rows/is_reset_keyword, shared across every sub-flow
│   │   ├── faq.py             # the FAQ sub-flow
│   │   ├── patient_identity/  # guest registration/selection/consent flow
│   │   └── booking/            # the reservation/reschedule/cancel state machine (no LLM), split by sub-flow and appointment type
│   ├── core/
│   │   ├── history.py         # session state + message history (Redis / in-memory)
│   │   ├── translations/      # English/Hindi string lookup for the bot's own UI text
│   │   ├── rate_limit.py      # login/secret rate limiting (Redis / in-memory)
│   │   ├── storage.py         # guest document storage (S3/R2-compatible, local-disk fallback)
│   │   ├── whatsapp.py        # WhatsApp Cloud API client
│   │   ├── config.py          # centralized process-level Settings (pydantic-settings)
│   │   └── phone.py           # phone number validation
│   ├── connectors/             # Tier 1/2/3 data-access abstraction (base.py, tier1.py, dispatch.py)
│   ├── db/
│   │   ├── schema.sql          # idempotent schema (safe to re-run against an existing database)
│   │   ├── models.py           # shared dataclasses (Appointment/Hospital/User), exceptions, constants
│   │   ├── repositories/        # raw SQL by domain (hospitals, tables, patients, appointments, food_orders, ...)
│   │   └── init_db.py           # schema + seed, run automatically on startup
│   ├── admin/
│   │   ├── onboarding.py      # the guided onboarding wizard (HTML form route)
│   │   ├── onboarding_api.py  # the same wizard's JSON API, used by the Next.js frontend
│   │   └── tenants_api.py     # platform-admin tenant list/edit
│   ├── portal/
│   │   └── routes/             # the restaurant-staff portal's JSON API (bookings, tables, food ordering, settings, staff, ...), used by the Next.js frontend
│   ├── reminders/
│   │   └── scheduler.py       # sends due reminders, called via /internal/send-reminders
│   └── tests/                  # pytest suite, real Postgres required
├── frontend/               # Next.js app — landing page, onboarding wizard, staff portal
├── docker-compose.yml       # backend + frontend, builds from ./backend and ./frontend
└── docker-compose.dev-db.yml # local Postgres for development
```

---

## Contributing

Contributions are welcome. The codebase favors small, direct, auditable code over frameworks-for-the-sake-of-frameworks — please keep it that way.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make sure tests pass (`uv run pytest`)
4. Open a pull request

No issue template, no CLA. Just describe what you changed and why.

---

## Community

- **Issues**: [GitHub Issues](https://github.com/PratikGautam-dev/dine/issues) — bug reports, feature requests, questions

---

## License

MIT
