# Web Storefront: a Swiggy/Zomato-style ordering website (implementation plan)

> **For the implementing agent (Claude Code):** work through this plan phase by phase, in order.
> Each phase ends with a **checkpoint**. Run it, make it pass, and commit before starting the next
> phase. Read `CLAUDE.md` / `frontend/AGENTS.md` first; the frontend uses a newer Next.js
> (16.x) whose conventions may differ from your training data, so check
> `frontend/node_modules/next/dist/docs/` before writing routes or layouts.

---

## 1. Goal

Today a guest can only order food through the **WhatsApp bot**. Every restaurant (tenant) should be
able to choose one or both ordering channels:

| Channel | Status |
| --- | --- |
| **WhatsApp bot** | Exists today, unchanged |
| **Website**: a public marketplace like Swiggy or Zomato | **New (this plan)** |

These product decisions are already made. Don't re-ask them:

1. The website covers **food ordering only**: browse restaurants, menu, cart, checkout and order tracking.
   There is **no** table booking on the web.
2. Customers sign in with their **phone number and an OTP**. The OTP is **mocked**: it's generated and
   stored for real, but shown on screen instead of sent by SMS.
3. **Each restaurant toggles web ordering on or off itself**, both in onboarding and in portal Settings. Only
   enabled restaurants appear on the marketplace.
4. Payment is a **mock gateway page** with a "Pay successfully" and a "Simulate failure" button.
   It must be built so real Razorpay can replace it later without touching order logic.

**Core principle:** the website is a *second front door* into the *same* data. Web orders go
into the existing `food_orders` table through the existing `create_food_order()`. Staff see them in the
existing **Food Orders** and **Kitchen Orders** portal pages and move them along with the existing
buttons. Don't build a parallel order system, menu system or customer table.

---

## 2. What already exists and must be reused

| Need | Reuse | File |
| --- | --- | --- |
| Create an order (price snapshot, atomic stock decrement, coupon, delivery fee, reference id `ORD-…`) | `create_food_order()` | `backend/db/repositories/food_orders.py` |
| Status transitions (guarded `UPDATE … WHERE status = expected`) | `advance_order_status()` and the `STATUS_*` constants | same file |
| Read orders with line items | `get_food_order()`, `list_food_orders(hospital_id, phone=…, limit=…)` | same file |
| Menu | `get_menu_items(hospital_id, category=None, available_only=True)`, `list_menu_categories()` | `backend/db/repositories/menu_items.py` |
| Coupon check before checkout | `preview_offer(hospital_id, code, subtotal_paise, fulfillment_type)`, `OfferError` | `backend/db/repositories/offers.py` |
| Delivery fee | `get_delivery_fee_paise(hospital_id, fulfillment_type)` | `food_orders.py` |
| Customer identity (one person across WhatsApp and web, keyed by phone) | `_upsert_patient(conn, hospital_id, phone, name, age)`, already called inside `create_food_order()` when `patient_name` is passed | `backend/db/repositories/appointments.py` |
| Opening hours | `get_hospital_settings(hid)["operating_days"/"operating_hours"]` (lists such as `["Mon",…]` and `["11:00-23:00"]`) | `backend/db/repositories/hospital_settings.py` |
| Signed tokens | PyJWT pattern in `issue_access_token()` / `verify_access_token()` | `backend/auth/jwt_session.py` |
| Rate limiting | `is_locked_out(key)`, `record_failure(key)`, `reset(key)`, `client_key(scope, request)` | `backend/core/rate_limit.py` |
| Audit trail | `db.record_audit_log("portal", hid, label, action, entity_type=…, entity_id=…, before=…, after=…)` | `backend/db/repositories/audit_logs.py` |
| Placeholder food images | `placehold.co` URL logic | `backend/scripts/seed_menu_images.py` |
| Frontend UI kit | `Button`, `Card`, `Input`, `Field`, `Badge`, `Switch`, `PageHeader`, toast | `frontend/src/components/ui/` |
| API base URL | `process.env.NEXT_PUBLIC_API_BASE_URL \|\| "http://localhost:8000"` | e.g. `frontend/src/lib/api.ts` |

Useful facts:

- Phones are stored **digits-only with the country code**, as WhatsApp sends them, e.g. `919812345601`.
- Money is always **paise** (integer). ₹249 is stored as `24900`.
- Timestamps are **ISO text** columns, stamped in Python and never left to DB defaults.
- Tenant id is `hospital_id` everywhere. The name is historical, and every query must be scoped by it.
- Two DB access styles coexist. Raw `get_connection()` is psycopg2 in autocommit mode with `?` placeholders.
  The other is SQLAlchemy `get_session()`. Follow whichever the surrounding file uses.
- `db/repository.py` is a re-export shim (`from db.repositories.X import *`). Add new repository
  modules there too.
- The order status flow is:
  - Online payment: `pending_payment → paid → accepted → preparing → ready_for_pickup | out_for_delivery → completed`.
  - Pay at restaurant: starts at `placed` instead of `pending_payment → paid`.
  - Any of these can end in `cancelled` (stock is restored automatically).
- Portal status changes do **not** send WhatsApp messages (`portal/routes/food_ordering.py`), so web orders
  can safely move through the same buttons.

---

## 3. Schema changes (Phase 1)

### 3.1 Two places must change together

1. **Alembic migration** `backend/db/migrations/versions/0049_web_storefront.py`, with `revision = "0049"` and
   `down_revision = "0048"`. Copy the header and docstring style of `0047_automations.py`.
2. **`backend/db/init_db.py` → `init_db_on_connection()`**: tests never run Alembic, so every schema
   change must also go here as idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
   `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`). Add a `# Migration 0049 -- …` block right after the
   Migration 0047 block and before `conn.commit()`.

### 3.2 Columns and tables

**`hospitals`** gets the storefront profile:

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| `web_ordering_enabled` | BOOLEAN NOT NULL | false | the channel toggle |
| `storefront_slug` | TEXT NULL | | URL `/order/<slug>`, partial unique index `WHERE storefront_slug IS NOT NULL` |
| `cuisine_tags` | TEXT NULL | | comma-separated, e.g. `North Indian, Biryani` |
| `tagline` | TEXT NULL | | |
| `address_line` | TEXT NULL | | |
| `city` | TEXT NULL | | marketplace city filter |
| `logo_url` | TEXT NULL | | |
| `cover_image_url` | TEXT NULL | | |
| `min_order_paise` | INTEGER NOT NULL | 0 | checkout blocks below this |
| `avg_prep_minutes` | INTEGER NOT NULL | 30 | shown on cards ("30 min") |

**`food_orders`**:

| Column | Type | Notes |
| --- | --- | --- |
| `source` | TEXT NOT NULL DEFAULT `'whatsapp'` | CHECK `source IN ('whatsapp','web')`, named `food_orders_source_chk` |
| `mock_payment_ref` | TEXT NULL | e.g. `mockpay_3f9a…`, set by the mock gateway on success |

**New table `customer_otps`**:
- Columns: `id SERIAL PK`, `phone TEXT NOT NULL`, `code_hash TEXT NOT NULL`, `expires_at TEXT NOT NULL`,
  `attempts INTEGER NOT NULL DEFAULT 0`, `consumed_at TEXT NULL`, `created_at TEXT NOT NULL`.
- Index on `(phone, created_at)`.

### 3.3 ORM (`backend/db/orm_models.py`)

- `HospitalRow`: add the 10 columns. Use `mapped_column(default=…)` for the non-null ones.
- `FoodOrder`: add `source: Mapped[str] = mapped_column(default="whatsapp")` and `mock_payment_ref`.
- New `class CustomerOtp(Base)` with `__tablename__ = "customer_otps"`.
- Give each addition a short comment saying *why* (this repo documents its reasons in comments).

### 3.4 `food_orders.py` changes

- Add these constants: `SOURCE_WHATSAPP = "whatsapp"`, `SOURCE_WEB = "web"`, `ORDER_SOURCES = (…)`.
- `create_food_order(…, source: str = SOURCE_WHATSAPP)`:
  - validate `source`, include it in the `INSERT` column list and the values tuple;
  - leave the default unchanged so WhatsApp callers need no edits.
- Add `FoodOrder.source, FoodOrder.mock_payment_ref` to `_ORDER_COLUMNS`. That exposes them from both
  `get_food_order()` and `list_food_orders()`.

**✅ Checkpoint 1:** `uv run pytest tests/test_food_ordering_redesign.py tests/test_food_orders_list_guest_names.py tests/test_food_orders_list_period.py`
still passes. Also run `alembic upgrade head` once against an empty local Postgres to prove the
migration applies.

---

## 4. Backend: storefront repository (Phase 2)

New file `backend/db/repositories/storefront.py`, re-exported from `db/repository.py`.

### 4.1 Profile

- `class StorefrontError(ValueError)`: its message is shown to restaurant staff as-is.
- `slugify(name) -> str`: lowercase, non-alphanumerics become `-`, strip leading and trailing dashes, fall back to `"restaurant"`.
- `normalize_customer_phone(raw) -> str | None`:
  - strip non-digits;
  - a 10-digit number gets the `91` prefix;
  - accept 11–15 digits and return `None` otherwise.
- `get_storefront(hospital_id) -> dict`, with these keys:
  - `hospital_id`, `name`, `web_ordering_enabled`, `slug`;
  - `cuisines` (a list parsed from `cuisine_tags`);
  - `tagline`, `address_line`, `city`, `logo_url`, `cover_image_url`, `min_order_paise`, `avg_prep_minutes`.
- `update_storefront(hospital_id, fields: dict) -> dict`:
  - Only these whitelisted keys are written: `web_ordering_enabled`, `storefront_slug`, `cuisine_tags`, `tagline`,
    `address_line`, `city`, `logo_url`, `cover_image_url`, `min_order_paise`, `avg_prep_minutes`.
  - The slug must match `^[a-z0-9]+(-[a-z0-9]+)*$`, be at most 60 characters, and be free. Raise `StorefrontError` otherwise.
  - Integers must be ≥ 0. Blank strings become NULL.
  - **If enabling with no slug, auto-generate a free one** from the name (`name`, then `name-2`, `name-3`…).
    A listed restaurant must always have a URL.

### 4.2 Marketplace reads

- `is_open_now(hospital_id, tz_name, now=None) -> bool`:
  - Uses `operating_days` and `operating_hours` in the restaurant's timezone (`hospitals.timezone`, via `zoneinfo`).
  - Handles ranges that cross midnight.
  - **Treats a restaurant with no hours set as open.**
- `list_public_restaurants(search=None, city=None, cuisine=None) -> list[dict]`:
  - Returns only `web_ordering_enabled AND is_active = 1 AND storefront_slug IS NOT NULL`.
  - `search` does an `ilike` over name, cuisine tags and tagline.
  - `city` is matched case-insensitively.
  - Each card adds `is_open`. Sort open restaurants first, then by name.
  - **Never** return `web_ordering_enabled` restaurants' private fields (tokens, Razorpay keys and so on). Build the
    card dict explicitly.
- `get_public_restaurant(slug) -> dict | None`: the same filter plus the slug.
- `list_public_cities() -> list[str]`.

### 4.3 OTP (mock delivery, real verification)

- `request_otp(phone) -> str`:
  - invalidate earlier unused codes for that phone by setting `consumed_at`;
  - create a 6-digit code with `secrets.randbelow`;
  - store `sha256(f"{phone}:{code}")` and an expiry 10 minutes out;
  - **return the plain code.** The route decides whether to show it; that decision is the mock.
- `verify_otp(phone, code) -> bool`:
  - check the latest unconsumed row: not expired and `attempts < 5`;
  - compare hashes with `hmac.compare_digest`;
  - a wrong code does `attempts += 1`, a right one sets `consumed_at`;
  - each code works exactly once.

### 4.4 Mock payment

- `mark_order_paid_mock(hospital_id, order_id) -> dict | None`:
  - set `mock_payment_ref = "mockpay_" + token_hex(8)` only where `status = 'pending_payment'`;
  - then return `advance_order_status(hid, oid, STATUS_PAID, expected_status=STATUS_PENDING_PAYMENT)`;
  - `None` means it wasn't awaiting payment. **This must use the same transition the Razorpay webhook uses**
    (`handle_razorpay_webhook()` in `food_orders.py`).

**✅ Checkpoint 2:** write unit tests for everything in this section (see §9) and make them pass.

---

## 5. Backend: customer session tokens (Phase 3)

New file `backend/auth/customer_session.py`, modeled on `auth/jwt_session.py`:

- Config: add `CUSTOMER_JWT_SECRET: str = ""` to `core/config.py` with a comment in the file's style.
  - If it's empty, derive a secret with `hmac(JWT_SECRET, b"customer")`. Customer tokens must **never** verify as staff tokens or the reverse.
  - Add `os.environ.setdefault("CUSTOMER_JWT_SECRET", "test-customer-jwt-secret")` to `tests/conftest.py`.
- `issue_customer_token(phone: str, name: str | None) -> str`: payload is `{"sub": phone, "name": name, "typ": "customer", "iat", "exp"}`. TTL is **30 days**, since customers shouldn't re-login every 15 minutes.
- `verify_customer_token(token) -> dict | None`: returns `None` on any failure. Require `typ == "customer"`.
- `get_current_customer(authorization: str | None) -> dict | None`: parses `Bearer …`.

---

## 6. Backend: public API (Phase 4)

New package `backend/web/` with `__init__.py` and `routes.py` exposing `router = APIRouter()`. Register it in
`backend/main.py` next to the other `app.include_router(...)` calls. CORS already allows `FRONTEND_ORIGIN`.

Every route here is **unauthenticated at the staff level**. Customer routes take `Authorization: Bearer <customer token>`.
Return JSON errors in the house style: `JSONResponse({"error": "…"}, status_code=…)`.

| Method & path | Auth | Behaviour |
| --- | --- | --- |
| `GET /api/public/restaurants?search=&city=&cuisine=` | none | `{"restaurants": [...], "cities": [...]}` |
| `GET /api/public/restaurants/{slug}` | none | `{"restaurant": card, "categories": [{"name", "items": [...]}], "delivery_fee_paise": {"pickup": 0, "delivery": n\|null}}`. Items come from `get_menu_items(hid, available_only=True)`; expose only `id, name, description, price_paise, category, image_url, stock_count`. Returns 404 if unknown or disabled. |
| `POST /api/public/restaurants/{slug}/coupon-preview` `{code, subtotal_paise, fulfillment_type}` | none | wraps `preview_offer()`. `OfferError` gives 400 `{"error": str(e)}`. |
| `POST /api/public/auth/otp/request` `{phone}` | none | Normalize the phone (400 if invalid). Rate-limit with `client_key("customer_otp", request)` plus a per-phone key; return 429 when locked. Returns `{"sent": true, "mock_code": code}`. **`mock_code` is only included while `WEB_OTP_MOCK` is true** (new setting, default `True`), so switching to real SMS later is one flag plus one sender function. |
| `POST /api/public/auth/otp/verify` `{phone, code, name?}` | none | If `verify_otp` passes, return `{"token", "customer": {"phone", "name"}}`. Otherwise `record_failure` and return 401. If the phone already has a profile anywhere, fill `name` from `db.get_patient_by_phone` for the display name. |
| `GET /api/public/me` | customer | `{"phone", "name"}` |
| `POST /api/public/orders` | customer | Body: `{slug, items:[{menu_item_id, quantity}], fulfillment_type, delivery_address?, payment_method: "online"\|"pay_at_restaurant", coupon_code?, name}`. See the validation list below. |
| `GET /api/public/orders` | customer | Orders **for the token's phone** across all web-enabled restaurants, newest first, limit 50. Each order includes `restaurant: {name, slug}`. A simple SQL filter on `food_orders.phone` joined to `hospitals` is fine. |
| `GET /api/public/orders/{order_id}` | customer | The order plus restaurant name and slug. **404 (not 403) if the order's phone ≠ the token's phone**, so ids can't be probed. |
| `POST /api/public/orders/{order_id}/mock-pay` `{outcome: "success"\|"fail"}` | customer | Same ownership check. `success` calls `mark_order_paid_mock` (409 if the order isn't `pending_payment`). `fail` changes nothing and returns `{"ok": false, "order": …, "error": "Payment failed (simulated). You can try again."}`. |
| `POST /api/public/orders/{order_id}/cancel` | customer | Only while `pending_payment` or `placed`; uses `advance_order_status(..., STATUS_CANCELLED, expected)`, which restores stock. Otherwise 409. |

Validation for `POST /api/public/orders`, in this order:
1. Resolve the restaurant from the slug. Return 404 if it's missing or disabled.
2. Refuse when `is_open_now` is false: 409 "Restaurant is closed right now".
3. Check that every `menu_item_id` belongs to **this** restaurant. `create_food_order` already rejects unknown ids for the hospital; map `IntegrityError` to 409 with its message.
4. Require `delivery_address` when `fulfillment_type == "delivery"`.
5. Check `quantity` is between 1 and 20 and there are at most 30 lines.
6. Compute the subtotal from DB prices, never from client prices. If it's below `min_order_paise`, return 400.
7. Call `db.create_food_order(hid, phone, items, fulfillment_type, delivery_address, patient_name=name, payment_method=..., coupon_code=..., source="web")`. `OfferError` gives 400.
8. Record the audit log as `("portal", hid, "web storefront", "food_order.web_placed", entity_type="food_order", entity_id=…)`.
9. Return `{"order": …, "next": "pay" | "track"}`, where `pay` means `payment_method == "online"`.

**Security checklist for this phase:**
- Customer data is always filtered by the token's phone.
- Restaurant data is always filtered by the slug-resolved `hospital_id`.
- No staff or secret columns are ever serialized.
- Prices come only from the DB.

**✅ Checkpoint 3:** API tests in §9 pass.

---

## 7. Portal changes (Phase 5)

### 7.1 Settings API

In `backend/portal/routes/settings.py` (copy the style of `POST /api/portal/settings/booking-confirmation`):
- `GET /api/portal/settings/storefront` returns `get_storefront(hid)` plus `public_url_path: "/order/<slug>"`.
- `POST /api/portal/settings/storefront` calls `update_storefront`. `StorefrontError` gives 400. On success it records the audit log `settings.storefront`
  with before and after diffs. Use the same permission gate the other settings writes use (`settings`, `write`).

### 7.2 Onboarding

The backend is `backend/admin/onboarding.py` and the wizard is `frontend/src/components/onboarding/`:
- Add a **"Channels"** choice with three options: *WhatsApp bot*, *Website*, *Both*. The default is *WhatsApp bot*, which is today's behaviour.
- Choosing *Website* or *Both* sets `web_ordering_enabled = true` after the hospital is created, via `update_storefront`.
- Choosing *Website only* must let the WhatsApp credential steps be skipped. Check `create_hospital()` and the
  wizard's validation. `whatsapp_phone_number_id` is already nullable in `HospitalRow`, but confirm that
  nothing (webhook routing, the tenants list, `seed_restaurant_sample_data`) assumes it's set, and guard any place that does.

### 7.3 Portal UI

- New page `frontend/src/app/portal/settings/storefront/page.tsx`, titled **Online Storefront**. It has:
  - a `Switch` for "Accept orders on the website";
  - fields for store link (slug), cuisines, tagline, address, city, logo URL, cover image URL, minimum order (₹, converted to paise) and average prep time;
  - a live preview card that looks like the marketplace card;
  - a **"View my store ↗"** link to `/order/<slug>`.
  - Use the existing `PageHeader`, `Card`, `Field`, `Input`, `Button` and toast components.
- Add a sidebar entry in `frontend/src/components/portal/PortalSidebar.tsx` under the Admin group with
  `pageKey: "settings"`, next to Settings.
- Food Orders (`frontend/src/app/portal/food-orders/page.tsx`) and Kitchen Orders
  (`frontend/src/app/portal/kitchen-orders/page.tsx`) get a small `Badge` for "Web" or "WhatsApp" from `order.source`. Extend
  the order type in `frontend/src/lib/foodOrders.ts` with `source` and `mock_payment_ref`.

**✅ Checkpoint 4:** `npm run lint` and `npm run build` in `frontend/` pass, and backend tests pass.

---

## 8. Customer website (Phase 6)

### 8.1 Structure

- Route group: `frontend/src/app/(storefront)/order/...` with its **own `layout.tsx`**. It has no portal sidebar,
  a top bar with the logo, a "My orders" link and a login/avatar button, and a mobile-first layout.
  Wrap the children in a `CartProvider`.
- `frontend/src/lib/storefront.ts`:
  - a typed API client (axios or fetch, matching `lib/api.ts`) with the base URL `NEXT_PUBLIC_API_BASE_URL`;
  - the customer token stored in `localStorage` under key `customer_token`, with the session under `customer_session`;
  - helpers `getCustomerToken()`, `saveCustomerSession()`, `logoutCustomer()`;
  - `formatRupees(paise)`.
- `frontend/src/lib/cart.tsx`:
  - A `CartProvider` plus a `useCart()` hook, persisted to `localStorage` under `cart_v1`.
  - The cart holds **one restaurant at a time**, as on Swiggy: adding an item from a different restaurant shows a confirm dialog
    ("Start a new cart?"). Use `ConfirmDialog` from `components/ui`.
  - The state is `{slug, restaurantName, lines: [{menu_item_id, name, price_paise, image_url, quantity}]}`.
  - Actions: `add`, `increment`, `decrement`, `remove`, `clear`, and a derived `subtotal_paise` and `count`.
  - Prices in the cart are for display only. The server recomputes them.

### 8.2 Pages

| Route | What it shows |
| --- | --- |
| `/order` | Marketplace home: a hero with a search box, a city dropdown, cuisine chips built from the loaded cards, and a responsive grid of **restaurant cards** (cover image, logo, name, cuisines, "⏱ 30 min", minimum order, an "Open" or "Closed" badge; closed cards are dimmed but still clickable). Show an empty state when nothing matches. Search is debounced (300 ms) and uses query params. |
| `/order/[slug]` | Restaurant page: a cover banner, info row and closed banner; sticky **category tabs** that scroll to sections; **menu item cards** (image, name, description, price, then **ADD** turning into a `– n +` stepper, or "Sold out" when `stock_count === 0`); a sticky bottom **cart bar** ("3 items · ₹747 · View cart →"). |
| `/order/cart` | Line items with steppers, **Pickup / Delivery** segmented control (address textarea for delivery), **payment method** (Pay online / Pay at restaurant), **coupon** input with Apply (calls `coupon-preview` and shows the discount or the error), and a **bill details** box (item total, discount, delivery fee from the restaurant response, to pay). Show a minimum-order warning. The **Place order** button sends a logged-out user to `/order/login?next=/order/cart`. |
| `/order/login` | Step 1: phone input (+91 prefix). Step 2: 6-box OTP input plus name (only when the name is unknown). In mock mode show a clear yellow banner: "Demo mode: your code is **123456**", using `mock_code`. Offer resend after 30 s. On success, save the session and redirect to `next`. |
| `/order/pay/[orderId]` | **Mock gateway.** It's deliberately styled as a separate "DinePay (test mode)" screen: amount, order ref, fake card/UPI tabs (display only), **Pay ₹X** (calls `mock-pay` with `success` and redirects to the tracker) and **Simulate failure** (calls `mock-pay` with `fail`, shows an error, and lets the customer retry). A "Cancel order" link calls cancel. |
| `/order/orders` | Order history cards: restaurant, reference id, date, total, status badge. |
| `/order/orders/[id]` | **Live tracker**, polling `GET /api/public/orders/{id}` every 10 s until the order is `completed` or `cancelled`. It has a vertical stepper (Order placed or paid, Accepted, Preparing, Ready for pickup or Out for delivery, Completed), a cancelled state, item list, bill, and a "Pay now" button if the order is still `pending_payment`. |

### 8.3 UX details worth doing

- Use skeleton loaders on marketplace and menu loads.
- Use `next/image` only if remote patterns are configured for `placehold.co` and the image hosts. Otherwise use plain `<img>`.
- Stay usable at 360 px width. The cart bar and buttons are thumb-reachable.
- Clear the cart after an order is placed successfully.
- A 401 from any customer call logs the customer out and redirects to login.

**✅ Checkpoint 5:** `npm run lint` and `npm run build` pass. Then do a manual or Playwright walk-through (§10).

---

## 9. Tests (write them alongside each phase)

Put them in `backend/tests/test_web_storefront.py`. Use the existing fixtures: `hospital_id`, `second_hospital_id` and the
per-test fresh DB from `tests/conftest.py`. Copy the env-var preamble and helper style of
`tests/test_food_orders_list_guest_names.py`, and use FastAPI `TestClient(app)` for the routes.

The suite should include these tests:
1. `update_storefront` auto-creates a slug when enabling; a duplicate slug raises; a bad slug raises.
2. The marketplace lists only enabled and active restaurants; search, city and cuisine filters work.
3. `is_open_now`: no hours means open, inside hours means open, outside means closed, a range across midnight works.
4. OTP: the right code verifies once; reuse fails; a wrong code 5 times locks; expiry fails; a new request invalidates the old code.
5. A customer token is rejected by staff auth, and a staff token is rejected by customer routes.
6. `POST /api/public/orders`:
   - creates `source='web'` with the correct totals (items, coupon, delivery fee);
   - an unknown or other-restaurant item gives 409;
   - below the minimum order gives 400;
   - a closed restaurant gives 409;
   - delivery without an address gives 400.
7. Mock pay: `success` gives `paid` with `mock_payment_ref` set, and a second success gives 409. `fail` leaves `pending_payment`. A pay-at-restaurant order can't be mock-paid.
8. Customer B gets 404 on customer A's order (GET, mock-pay, cancel).
9. The existing portal `POST /api/portal/food-orders/{id}/accept` and later actions work on a web order, and
   `GET /api/portal/food-orders` includes `source`.
10. A regression check that a WhatsApp-created order still has `source='whatsapp'`.

Run the backend suite locally with a real Postgres:
`TEST_DATABASE_URL=postgresql://… uv run pytest -q` (without it, conftest starts a testcontainer, which needs Docker).

---

## 10. End-to-end verification

1. Start Postgres, then run the backend with `DATABASE_URL=… uv run uvicorn main:app --port 8000` from `backend/`.
2. Seed the demo data (next section), then run `npm run dev` in `frontend/`.
3. Walk the flow in a browser or Playwright script:
   - `/order` shows the demo restaurant;
   - open it, add 3 items, go to the cart, apply a coupon, choose delivery and online payment;
   - log in with the mock OTP;
   - Place order takes you to the mock pay page; Simulate failure shows an error; Pay takes you to the tracker showing **Paid**.
4. In the portal (staff login), Food Orders shows the order with a **Web** badge. Click Accept, then
   Preparing, then Ready. The customer tracker advances within 10 s each time.
5. Place a second order with *Pay at restaurant*. It goes straight to **Placed**, with no pay page.

---

## 11. Demo seed (Phase 7)

Add `backend/scripts/seed_web_storefront_demo.py <whatsapp_phone_number_id>`. It must be idempotent and
non-destructive, in the same style as `scripts/seed_restaurant_sample_data.py`, which it should call first so
tables and menu exist. It then:
- enables web ordering and fills a realistic storefront profile (cuisines, tagline, city, placeholder
  logo and cover from `placehold.co`);
- gives any menu item without an image a placeholder (reuse the `seed_menu_images.py` colour logic, parameterised by hospital);
- creates a demo coupon (e.g. `WELCOME50`: flat ₹50 off orders of ₹299 or more, valid 90 days) if the restaurant has no offers.

Usage: `DATABASE_URL="…" uv run python -m scripts.seed_web_storefront_demo 1376657368855699`

---

## 12. Out of scope (don't build now)

- Table booking on the website.
- Real SMS OTP, real Razorpay on the web (keep the seams described above).
- Delivery partner tracking or maps, ratings on the website, customer addresses book, push notifications.
- Any change to the WhatsApp conversation flow.

## 13. Suggested commit sequence

1. `Add web storefront schema (migration 0049)`
2. `Add storefront repository: profile, marketplace, OTP, mock payment`
3. `Add customer session tokens`
4. `Add public storefront API`
5. `Add Online Storefront settings + channel choice in onboarding; show order source in portal`
6. `Add customer ordering website (/order)`
7. `Add web storefront demo seed script`
