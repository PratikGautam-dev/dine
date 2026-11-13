# Tenant Portal – Feature Reference (for replication in DINE)

Source: `ERP/shopconnect-tenant` (Next.js 16 + React 19, Tailwind 4, TanStack Query/Table, axios, recharts, zod).
API: `ERP/shopconnect-backend` (FastAPI, `/api/v1/*`). Each sidebar item below is one feature: what the screen does, the data it shows, the API it calls, permission key, and the code to copy.

> Method note: derived from the sidebar, route-access table, hooks, types and each feature's main components. The four largest files (Campaigns, Discounts, Payments settings, Theme editor) are documented in depth in **Appendix A–D** at the end.

---

## 0. Cross-cutting architecture (build this first)

### 0.1 Shell & navigation
- `components/portal/PortalShell.tsx` – frame: sidebar (static ≥`lg`, off-canvas drawer below with hamburger), 64px header (date chip or **Global Filter**, **BranchSwitcher**, **HelpButton**, **UserMenu**), scrolling `<main>`. `PersistentPortalShell` keeps it mounted across route changes and maps the URL to the active sidebar key. Settings pages hide the main sidebar and show `SettingsNav` as a fixed left column instead.
- `components/portal/PortalSidebar.tsx` – a single `NAV_ITEMS` array: `{key,label,icon,href,pageKey,group,disabled?,service?,children?}`. Groups: **Main, Sales Channels, Back Office, Workforce, Admin**. Footer pins **Support** and **Settings**. Features: sub-items shown under the active parent, "Soon" pill for disabled items, lock icon when a channel's subscription is locked, optimistic highlight on click.
- Visibility = `hasPermission(session, pageKey, "view")` AND module switched on (`moduleOn`: key with `-`→`_`; whole Workforce group = module `workforce`).
- `lib/routeAccess.ts` – `ROUTES` (URL prefix → pageKey), `OPEN_ROUTES` (always allowed), `MODULE_ROUTES` (URL prefix → module), `canOpenPath`, `landingPath` (first page the user may open after login). `scripts/check-route-access.mjs` (`npm run check:access`) fails the build if a portal page is in neither list.
- Blocked page renders a lock card: "This module is switched off" vs "You do not have access to this page".

### 0.2 Auth/session (`lib/staffAuth.ts`)
- Endpoints: `POST /auth/login`, `/auth/google`, `/auth/email/start`, `/auth/email/verify`, `/auth/signup`, `/auth/invite/preview`, `/auth/accept-invite`, `/auth/logout`, `GET /auth/me`, `PATCH /auth/profile`, `POST /auth/change-password`.
- `StaffSession = {id,name,email,roles,tenant,permissions,pageAccess,tillPermissions,branches,modules,services}`.
  - `permissions`: `"module:action" → "*" | [branchIds]` (branch-scoped grants). Helpers `hasGrant`, `hasGrantAt`, `hasTenantWide`.
  - `pageAccess`: per menu `{view,write,delete}` from the server's master list (`auth/permissions.py AREAS`). `hasPermission(session,pageKey,action)`; unknown key = false.
  - `modules`: `{key: bool}` feature flags (platform + tenant). `services`: `{online|pos|whatsapp: {state,locked,plan_code,...}}`.
- Tokens: access+refresh stored client-side; `lib/apiClient.ts` + `staffFetch` wrap axios with refresh.
- Tenant verification gate (`ApplicationGate`): until `tenant.verification.status === "verified"` nothing else opens (statuses `under_review | changes_needed | verified | rejected`; resubmit + book-demo endpoints under `/tenant/application/*`).

### 0.3 Branch scope & global filter
- `lib/branch.tsx` `useActiveBranch()` → `{branchId|null (=all), branches}`; `BranchSwitcher` in header; `PageHeader scopedToBranch` shows a scope chip.
- `lib/globalFilter.ts` – header filter: period (today/7d/30d/month/custom…) + channel; `useGlobalFilter().params` is spread into list/dashboard queries; pages opt in via `FILTER_PAGES`. Server returns the resolved `period` and previous period for deltas.

### 0.4 Data layer
- `lib/erp.ts`: `erpGet`, `erpSend(path, method, body)`, `erpSendFile`, `qs()`, `useErpQuery`, `formatMoney(minor, currency)`, `toMinor/fromMinor`, `formatDateTime`, `humanize`, status→tone maps.
- Money is **integer minor units (paise)** everywhere in the UI; ids are uuid strings.
- `hooks/usePagedQuery.ts` + `components/ui/CursorPager.tsx` – cursor pagination (rows carry `cursor`).
- `lib/queryKeys.ts` – central key factory; mutations call `refreshAfterOrderChange(qc)`-style invalidators (orders, customers, inventory, finance, activity, analytics).
- Common types: `Channel = "online"|"pos"|"whatsapp"` (UI labels Website / POS / WhatsApp).

### 0.5 UI kit (`components/ui`)
Button, Card, Badge (tones), DataTable (TanStack), Tabs, Modal, ConfirmDialog, Field/Input/Select/AnchoredSelect/MultiSelect/SearchCombobox, Switch, Checkbox, PageHeader, Skeleton, StatTile, StepRail, dropdown-menu, toast (`lib/toast.ts`), RichTextEditor, PhoneInput (`libphonenumber-js`), DateTimeField. Brand colour `#4A5D45` (green scale); sidebar `bg-brand-700`.

### 0.6 Shared widgets
`PermissionGate`, `SubscriptionGate`/`ServiceLock` (locked channel), `PaymentFailedBanner`, `FirstRunChecklist` (onboarding guide, `GET/POST /onboarding`, `/onboarding/steps/{key}`, `/onboarding/dismissed`), `HelpButton` + `/portal/help` articles (`src/content/help/*.ts`), `RecordActivity` (per-record audit panel via `/audit-logs`).

---

# MAIN

## 1. Dashboard — `/portal/dashboard` (pageKey `dashboard`)
Snapshot for the global-filter period and active branch. One request: `GET /analytics/dashboard?branch_id&period…`.
- Banners: `PaymentFailedBanner`, `FirstRunChecklist`.
- **KPI tiles** (each links to its page, with % delta vs previous period): Sales (net of returns), Orders (+open now), Customers (total/new), Stock value (at cost), Returns (count, value back, refunded), Low-stock items (≤ reorder level). Tiles omitted if the user lacks the permission/module.
- **Sales trend** chart (`trend[]`, granularity hour/day/week/month).
- **Breakdown** donut toggle: by channel / by payment method.
- **Recent orders** card (`GET /orders?limit=8`).
- **Needs attention** list (`attention[]`: key,label,count,href,tone,amount) – server decides what the user may act on.
- **Top products** (units, amount) and **Channels card** (POS tills paired/online/waiting bills; WhatsApp connected + last message).
Files: `app/portal/dashboard/page.tsx`, `components/portal/dashboard/*`, `hooks/useDashboard.ts`.

## 2. Orders — `/portal/orders`, `/orders/new`, `/orders/[id]` (pageKey `orders`)
- **List** (`OrdersView`): search order #, filter status (pending, confirmed("Placed"), preparing, ready, out_for_delivery, shipped, completed, cancelled, refunded), payment status (pending, authorized, paid, failed, partially_refunded, refunded), "All dates" switch (ignores period), `sale_type=retail` (wholesale lives elsewhere). Columns: Order, Channel, Branch, Customer (Walk-in fallback), Total, Payment, Payment mode, Status, Return/Exchange badge (links to Returns), Placed At, row actions (View / Edit). Cursor pager.
- **New order** (`orders/new`): channel + branch; product search (name/SKU/barcode) → lines with qty; tax computed client-side from `/tax-rule-bands` (inclusive/exclusive per tenant); customer = existing / walk-in name+phone (E.164); POS: takeaway, serial/IMEI textarea per line when serialised, optional "pay now" method; online/WhatsApp: order type (shipping/delivery/pickup) + address + COD/remote method; notes. `POST /orders`.
- **Detail**: header with status/payment badges; fulfilment buttons per status (`confirmed→preparing→ready→(shipped|completed)→out_for_delivery→completed`, via `POST /orders/{id}/fulfilment`; stock leaves and revenue booked only at `completed`); Record payment (`POST /orders/{id}/payments`), Capture COD (`POST /payments/{id}/capture`), Return/exchange (opens ReturnModal; needs grant `orders:return`, order completed), Tax invoice / Order confirmation PDF (`GET /orders/{id}/pdf`), Cancel with reason (`POST /orders/{id}/cancel`; shows "due back" if paid). Items table with serial binding (`POST /orders/{id}/items/{itemId}/serials`), totals (subtotal, discount, delivery, tax, total, paid, refunded, outstanding), payments list, **ShipmentPanel** (`/orders/{id}/shipments`, `/shipments/{id}/status`), customer link, returns list, activity log.
Types: `Order`, `OrderItem`, `Payment` in `lib/erp.ts`. Hooks: `useOrders.ts`, `useShipments.ts`.

## 3. Returns — `/portal/returns` (pageKey `returns`)
- Tabs: **Sales returns**, **Exchanges**, **New Request** (website-originated requests awaiting decision); counts from `GET /returns` (`counts`: returns, exchanges, requests, waiting, refunded_minor, returned_value_minor). Search; table of `ReturnRow`.
- Statuses `requested|approved|rejected|completed|cancelled`; kind `return|exchange`; source `portal|pos|storefront`; reasons defective/damaged/wrong_item/size_fit/changed_mind/other.
- **ReturnModal** (started from an order): `GET /orders/{id}/returnable` (window days, policy, per-line returnable qty incl. serials) → pick lines/qty, disposition RESTOCK|WRITE_OFF, reason, receiving branch, refund mode (original, cash, card, upi, store_credit, loyalty_points, none), optional replacement items (exchange) with live `POST /orders/{id}/returns/quote` → `POST /orders/{id}/returns`.
- **ReturnDetailPanel**: original bill, customer, returned items, exchange items + replacement order, refund summary (credit note #, loyalty points credited), timeline. Actions `POST /returns/{id}/{approve|reject|…}` (note to customer) and `/receive`.
- Policy: `GET/PUT /tenant/return-policy` (`pos_window_days`, `online_window_days`, exchanges/store-credit/loyalty enabled).
Files: `lib/returns.ts`, `hooks/useReturns.ts`, `components/portal/returns/*`.

## 4. Products — `/portal/products`, `/new`, `/[id]` (pageKey `products`)
Unit of sale = **variant** (id = variant_id; `parent_product_id`, `product_name`, `variant_name`, `sku`).
- Tabs: **Products** (branch-scoped stock column) | **Categories** (name, parent, items, active items, subcategories, status, created; Add category modal with parent).
- List: search name/SKU/barcode; columns Product (+image), Category, For (audience), Color, Price, Tax, In stock, Status, Images; actions: edit, images, send labels to till. Buttons: **Import CSV/Excel**, **Add product**.
- **Editor** (`ProductEditor`): Product details (name, rich description), Media (≤6 images, first = cover, JPEG/PNG/WebP, reorder `PUT …/images/order`), Pricing (price, MRP ≥ price, cost, tax rule), Inventory (stock per branch table, tracking NONE/SERIAL/IMEI, barcode type, manufacturer barcode, extra barcodes with source supplier/maker, generate shop-label barcode), Shipping (weight kg, L/W/H cm), Variants (add variant: sku,name,price), Attributes (age group, "For" audience, colour), Status (draft/active/discontinued/archived), Organization (category, brand), link to Inventory.
- **Bulk import** (`POST /products/import`, ≤5 MB, .csv/.xlsx) – columns: name, sku, price, variant_name, description, category (auto-create), brand (auto-create), mrp, cost, tax_code, serialization_type, barcode, status; result modal lists created/skipped/errors.
- **Send labels to till**: branch, number of labels, note → `/label-requests`.
API: `/products` (GET q/paged, POST, PATCH /{id}), `/products/{id}/variants`, `/images`, `/barcodes`, `/generate-barcode`, `/categories`, `/brands`.

## 5. Collections — `/portal/collections`, `/new`, `/[id]` (pageKey `collections`)
- List: filter All / Manual / With conditions; search; select-all; toggle "show in header" per row (`PATCH /collections/{id}/header` with `version`); delete.
- **Editor**: cover image upload (`POST /collections/cover`), title, description, **Show in header**, header order, **dropdown menu** of sub-collections, items grid/list with search/sort/status filter, **manual products** picker (`CollectionProductPicker`) + **conditions** (`category_id is`, `lifecycle_status is`, `name contains`) + excluded variants; live preview `POST /collections/preview`; optimistic concurrency via `version`; discard-changes prompt.
Model: `ProductCollection {name, description, image_url, conditions[], excluded_variant_ids[], show_in_header, header_order, header_dropdown, dropdown_collection_ids[], item_count, version}`.

## 6. Customers (parent with sub-items) — pageKey `customers`
Sub-items: All Customers, Membership, Tags, Segments, Discounts, Campaigns (each own pageKey: `membership`, `tags`, `segments`, `discounts`, `campaigns`). Sidebar shows the first child the user can open if the parent isn't permitted.

### 6.1 All Customers — `/portal/customers` (+ `/[id]`)
Tabs **Customers | Follow-ups | Insights**. KPI tiles from `GET /crm/summary`: total, active (bought ≤6 months), platinum, new this month, avg purchase value, repeat customers/rate, follow-ups due.
- **Customers tab** (`GET /crm/customers`): search; filters Membership (segment), Tag, Segment (saved), Status (active/blocked); columns Customer(code), Phone, Tags/Membership, Purchase amount, Orders, Last purchase, Status, Actions. **Add customer** modal (name required + phone or email; DOB, membership enrol, source, tags) → `POST /customers`.
- **Customer profile** (`CustomerProfile`; tabs Overview, Purchase History, Communication, Notes): KPIs loyalty points, credit balance, orders, total spent; tags add/remove; birthday + special days (anniversaries `POST /crm/customers/{id}/special-days`); addresses; GSTIN; preferences; edit modal; **adjust loyalty points** (`/crm/customers/{id}/loyalty`, delta + reason); **store credit** (`/customers/{id}/store-credit`); orders list; send message (WhatsApp/SMS/email via `/crm/messages`); notes with follow-up date (`/crm/customers/{id}/notes`, `/crm/notes/{id}`).
- **Follow-ups tab** (`GET /crm/follow-ups/board`): KPIs total/due today/upcoming/completed/overdue/conversion; filters assignee, channel, priority, status, date range; table Customer, Type (call, whatsapp, email, in_store, birthday, win_back, membership_renewal, payment_reminder…), Purpose, Assigned To, Last/Next contact, Channel, Priority, Status; staff performance panel with period.
- **Insights tab** (`GET /crm/insights?period=30d|90d|6m|12m&segment&tag&segment_id&branch_id`): KPIs (total, active, repeat rate, avg purchase value, lifetime value, new vs returning), growth chart, segment split, tags, cohort retention matrix, top customers.
- Segments (membership tier): regular, silver, gold, platinum, inactive, not_member; thresholds in `CrmSettings` (`GET/PUT /crm/settings`: silver/gold/platinum min points, inactive_after_days, points_per_100, redemption_points/value).

### 6.2 Membership — `/portal/customers/membership` (`membership`; configure needs tenant-wide `membership:manage`)
Views: **All Memberships** (tier plan cards: annual fee, validity months, key benefits, members; KPIs total/active/new/revenue; `GET /crm/membership/overview`, `PUT …/tiers/{tier}`), **Benefits** (CRUD `…/benefits`, per tier, types e.g. discount/free delivery/support/events), **Members** (list with joined/expires/source/status active|expiring|paused|expired, tier summary with renewal rate, renewals, pause/resume/renew actions `…/members/{id}/{action}`), **Rules** (membership automation rules: award points / follow-up, "system rules" toggles, run-now, shared rule engine – see 6.4), **Loyalty points** (`GET /crm/loyalty`: members, earned, adjusted, top, recent ledger).

### 6.3 Tags — `/portal/customers/tags` (`tags`)
Views **All Tags** (CRUD `/crm/tag-records`; name, description, colour (8), icon (12), kind manual|rule|system, applies_to all|tiers|selected|business, tier filter, status active|draft|inactive, customer count), **Customer Tagging** (`/crm/tagging`: filter by tag/status/source/tier, bulk tag/untag), **Tag Rules** (`/crm/rules?scope=tag`). KPI header `GET /crm/tags/summary` (total, created this month, tagged customers, auto vs manual, multi-tagged, top tags, by tier).

### 6.4 Rules & Segments engine (shared) — `lib/rules.ts`, `components/crm/rules/*`
Conditions `{field, op, value, window?}` – fields: total_spend, orders (windowed: last N days or between dates), points, days_since_last_purchase, joined_within_days, birthday_within_days / this_month, anniversary_*, membership_expires_within_days, coupon_uses, tier, customer_type, purchase_channel, city, gender, has_tag; ops gt/gte/lt/lte/eq/ne/in/nin/is. `match: all|any`; segments allow one level of groups. Rule = conditions + action (`tag` | `award_points{points,reason,once ever|year|month}` | `follow_up{note,once}`) + frequency (real_time/daily/weekly) + status (active/draft/paused). `POST /crm/rules/preview` gives live match count + sample. Run now: `…/rules/{scope}/{id}/run` → `{matched, added, removed}`.

### 6.5 Segments — `/portal/customers/segments` (`segments`)
Views: All Segments, Segment Builder, Customers in Segment (paged `…/customer-segments/{id}/customers`), Analytics. Saved segment: name, description, conditions, kind dynamic|static, status active|draft, `marketing` (usable as campaign audience), `show_in_filters`, member_count. CRUD `/crm/customer-segments`.

### 6.6 Discounts — `/portal/discounts` (`discounts`)
List + 8-section form: (1) basic (name, code, description), (2) type & value (`percent`, `flat`, `free_delivery`, `bogo`, `buy_x_get_y`, `fixed_price`; max discount, min order, min quantity, buy/get qty), (3) product eligibility (all / categories / collections / products), (4) customer eligibility (all / memberships / tags / saved segments / chosen customers / business accounts), (5) channels & branches, (6) usage & combination (usage limit, per-customer limit, combine with discounts/points, priority, apply on subtotal|total), (7) validity (start/end, active), (8) review summary (`lib/discountSummary.ts`). `GET/POST/PATCH/DELETE /discounts`. Used by POS, website and campaigns.

### 6.7 Campaigns — `/portal/campaigns` (`campaigns`)
`CampaignsTab`: objective (sales, retention, loyalty, launch, reactivation, awareness), type (discount, loyalty, message, new-product launch, event), channels (WhatsApp, Email, SMS send; POS/Website show the offer), audience (memberships, saved segment, tag, chosen customers, customer type, city, purchase behaviour, gender, since; live count via `/crm/audience-preview`, options `/crm/audience-options`), schedule, message/subject, linked discount, WhatsApp template + `{{n}}` params (templates `/whatsapp/templates`, editor `TemplateEditor`), **automation triggers** (birthday / anniversary N days before, repeated sends, new_arrival) with pause toggle (`…/automation`), send (`…/send`, background "sending" status), delivery stats queued→sent→delivered→read/failed from Meta reports, per-message log `/crm/messages`. Status draft|sending|sent.

## 7. WhatsApp Inbox — `/portal/whatsapp-inbox` (pageKey `whatsapp`, module `whatsapp_inbox`)
Human-handoff inbox: tabs Waiting / All; conversation list `GET /whatsapp/conversations`, thread + reply `POST …/{id}/messages`, **hand back to ordering bot** `POST …/{id}/hand-back`. Hook `useWhatsApp.ts`.

## 8. WhatsApp Automation — `/portal/whatsapp-automation` (`whatsapp`)
Order-event automated messages (transactional templates) – uses `/whatsapp/templates` (`WhatsAppTemplates.tsx`). Currently a thin page; template list/status from Meta.

## 9. Analytics — `/portal/analytics` (pageKey `reports`, module `analytics`)
Sales analytics for global-filter period: `GET /analytics/sales`, `/analytics/today` (hooks `useAnalytics.ts`): revenue/orders summary, trend, channel and payment splits, top products, branch comparison cards. Financial & GST reports live in Finance › Reports.

## 10. Feedback — `/portal/feedback`, `/[id]` (`feedback`)
Reviews and WhatsApp ratings: table Product/subject, Rating (★), Review, Customer(+ID), Order, Branch, Channel, Received; filters search, branch, rating, category (`/feedback/categories`); detail "Review details"; delete (confirm). `rating_kind` experience|delivery for WhatsApp.

## 11. Growth — disabled placeholder (`growth`)
Shown with "Soon" pill; route redirects to dashboard; excluded from `landingPath`.

---

# SALES CHANNELS (each gated by a paid **service**: `session.services[x].locked` → lock icon + `ServiceLock`)

## 12. Website — `/portal/channels/online` (pageKey `website`)
Status strip + **setup checklist** + `ChannelPanels`; **OnlineStoreThemes**: theme gallery, preview (`/store-admin/themes/{key}/preview`), open **ThemeEditor** `/channels/online/themes/[key]` (`ThemeFields`: colours/fonts/sections/images via `/store-admin/themes`, `/theme-images`, `/theme-collections`), publish. Related settings: domains, policies, email sender/templates, shipping zones, payments (see Settings).

## 13. POS — `/portal/channels/pos` (`pos_channel`)
Till brand panel (`PosBrandPanel`, `/channels/pos/branding`): logo/colours/messages; **PosScreenEditor** (till screen content); downloads (`/api/pos/latest`, `/download`); branch terminals live in Settings › Locations.

## 14. WhatsApp — `/portal/channels/whatsapp` (`whatsapp_channel`)
`WhatsAppWalkthrough` (guided setup), `WhatsAppConnect` (connect/disconnect Meta number; `/whatsapp/account`, `/account/check`), `WhatsAppBot` (enable ordering bot, session timeout default 30 min; tenant setting `whatsapp_bot_enabled`), `WhatsAppTemplates`.

---

# BACK OFFICE (each item its own optional module)

## 15. Procurement — `/portal/procurement`, `/orders/[id]` (`procurement`)
Tabs: **Purchase orders** (PO, Supplier, Branch, Total, Status, Paid/owed, Created), **Bills**, **Payments made**, **Suppliers** (name, GSTIN, state, payment terms, status; add supplier).
- New PO (`NewPurchaseOrder`): supplier, branch, lines (variant, qty, unit cost), tax. Statuses via `PO_STATUS_TONE`; actions `POST /purchase-orders/{id}/{action}` (approve/send/cancel…); purchase requests `/purchase-requests/{id}/{action}`.
- PO detail: **Receive goods** (GRN – stock into branch, freight spread as landed cost, books amount owed), **Return to supplier** (`/goods-receipts/{id}/returns`), payments (`/purchase-orders/{id}/payments`).
- Bills (`/supplier-bills`), **Pay bills** modal (`/supplier-payments`), supplier statement (`/suppliers/{id}/statement`).

## 16. Wholesale — `/portal/wholesale`, `/orders/[id]`, `/orders/[id]/print` (`wholesale` = wholesale | customer_accounts | price_lists rows)
Tabs shown per permission: **Sales orders** (quotation → confirm → dispatch; `/sales-orders`, `/sales-orders/{id}/{action}`, `/dispatch` with DispatchModal, print view), **Invoices** (`/wholesale/invoices`), **Business customers** (account: GSTIN, state, price list, credit limit/terms, status; `/customer-accounts`, `/credit`), **Receivables** (ageing, `/wholesale/receivables`), **Payments received** (`/customer-receipts`), **Price lists** (`/price-lists`, per-variant prices), **Credit settings** (`/tenant/wholesale-settings`). `/wholesale/quote` prices a draft order. Account statement via `/customer-accounts/{id}/statement`.

## 17. Inventory — `/portal/inventory` (`inventory`)
Tabs **Stock levels** (Product, Branch, Available, Reserved, In transit, Reorder at; edit reorder level `PUT /inventory/reorder-level`) and **Movements** ledger (When, Product, Branch, Movement type, Change, Balance, Note; `GET /inventory/ledger`). Actions: **Receive stock** (`POST /inventory/receipts` – qty, cost, serial/IMEI numbers when tracked), **Adjust stock** (`/inventory/adjustments` – stock-take/damage/loss with reason), quick **add variant**. Low-stock highlighting.

## 18. Transfers — `/portal/transfers` (`transfers`, module `transfers`)
Branch-to-branch stock moves: table Transfer #, From → To, Value, Status, Requested. Statuses `REQUESTED → APPROVED → DISPATCHED → RECEIVED` (also REJECTED, CANCELLED); actions `POST /transfers/{id}/{action}`; **New transfer** modal (from, to, lines).

## 19. Finance — `/portal/finance` (`finance`)
Tabs: **Overview** (`/finance/reports/summary`: revenue, expenses, receivable/payable, cash), **Expenses** (`/finance/expenses`, categories, approve/reject/pay `…/{id}/{action}`), **Tax invoices** (`/finance/tax-documents`, GST invoices & credit notes), **Reports** (`FinancialReports` – P&L, balance sheet, trial balance, ledger…; `GstReturnReport` – GSTR-style summaries; `/finance/reports/{name}`), **Reconciliation** (gateway settlements import `/finance/settlements/import`, `/unreconciled-payments`), **Journal** (double-entry `/finance/journal-entries`, reverse, period lock `/finance/period-lock`, chart of accounts `/finance/accounts`).

---

# WORKFORCE (single module `workforce`; API `/attendance/*`, `/leave/*`; hooks `useHr.ts`)

## 20. Attendance (own) — `/portal/attendance` (open route)
My hours, overtime, attendance history by month (`GET /attendance/my-summary?month`), status chips.

## 21. Check-in / Check-out — `/portal/check-in-out` (open)
Today state `GET /attendance/today`; `POST /check-in` (geolocation with accuracy, optionally shop Wi-Fi verification per branch rule), `POST /check-out`, `/break/start|end`; if check fails → **request approval** (`/check-in/request` with reason). Check modes: none / location / shop Wi-Fi / either / both.

## 22. My Leave — `/portal/leave` (open)
Balance (allowance/used/pending/remaining, `LeaveBalance`), apply (type, from/to, half-day, reason; `POST /leave/mine`), history, cancel (`/leave/mine/{id}/cancel`).

## 23. Holidays — `/portal/holidays` (open)
Year calendar (`/leave/calendar?year`): holidays (company or branch-specific), weekly offs, team leave; managers add/edit/delete holidays and copy year→year (`/attendance/holidays…`).

## 24. Team Attendance — `/portal/attendance-overview` (`attendance`)
Date-wise overview (`/attendance/overview?date&branch`): who's in/late/off, month totals (`/summary`), per-staff month view, correct a record (`/records/{id}/correct`), approve/reject check-in requests (`/attendance/requests`).

## 25. Leave Requests — `/portal/leave-requests` (`leave_requests`)
Filter pending/approved/declined/all; approve/reject with note (`/leave/requests/{id}/{action}`), shows branch overlap conflicts and requester balance; set yearly allowance policy (`/leave/policy`).

---

# ADMIN (pinned bottom)

## 26. Support — `/portal/support`, `/[id]` (`support`)
Ticket list + **Raise ticket** modal (category from `/support/categories`, subject, description, attachments) to the platform team; detail thread with messages (`/support/tickets/{id}/messages`), status, counters.

## 27. Settings — `/portal/settings/*` (left column `SettingsNav`; each row has its own pageKey)
| Item | Route | pageKey | What it does (API) |
|---|---|---|---|
| General | `/settings` | settings | Business profile, contact details, currency/timezone, tax-inclusive pricing (`/tenant`, `/tenant/contact`, `/tenant/settings`) |
| Plan and billing | `/settings/billing` (+`/checkout`) | billing | Per-service plans (online/pos/whatsapp), Razorpay checkout, quote, cancel, payment method, invoices PDF, usage stats, billing contact (`/billing/*`) |
| Modules | `/settings/modules` | module_settings | Toggle optional modules on/off (`/tenant/modules`) |
| Users | `/settings/staff`, `/[id]` | staff | Invite/manage staff, branch role assignments, extras, PIN, password reset (`/users*`) |
| Roles and permissions | `/settings/roles`, `/new`, `/[id]` | roles | Role CRUD/duplicate with permission grid from `/roles/catalogue` (`PermissionGrid`, `RoleEditor`) |
| Payments | `/settings/payments` | online_payments | Online gateway config, payment machines (card terminals `/payment-machines`), methods |
| Shipping and delivery | `/settings/shipping` | shipping | Delivery zones by pincode/district with map editor (`ZoneEditor`, `DeliveryMap`; `/delivery-zones*`), charges |
| Barcode labels | `/settings/labels` | label_settings | Shop-label barcode format (`/tenant/label-settings`) |
| Taxes and duties | `/settings/taxes` | taxes | Tax rules + rate bands (`/tax-rules`, `/tax-rule-bands`), GST registrations per state (`/tenant/gst-registrations`) |
| Locations | `/settings/branches`, `/[id]` | branches | Branch CRUD, hours/schedule, GST registration, cashiers + PIN, POS terminals, pairing codes, handover bills, daily closes, terminal sync health (`/branches*`, `/terminals*`) |
| Attendance and holidays | `/settings/attendance` | attendance_settings (module workforce) | Business rules (hours, lateness), per-branch check method, work patterns |
| Sales channels | `/settings/channels`, `/[slug]` | channels | Branch ↔ channel mapping, readiness, API client keys (`/channels/*`, `/channel-clients`) |
| Domains | `/settings/domains` | domains | Custom domain connect/verify (`/store-admin/domains`) |
| Notifications | `/settings/notifications`, `/[key]` | notifications | Email templates & sender (`/store-admin/email-templates`, `/email-sender`) |
| Policies | `/settings/policies` | policies | Store policy pages (`/store-admin/policies`) |
| Activity log | `/settings/activity` | activity | Audit trail with filters/CSV (`/audit-logs`) |
| Email log | `/settings/email-log` | email_log | Sent emails (`/email-log`) |
| Checkout, Customer accounts, Customer privacy | — | — | "Soon" placeholders |

Also: `/portal/profile` (own profile + change password), `/portal/help` (+`/[topic]`), `/portal/login`, `/auth` (sign-in/sign-up, Google, email OTP), `/auth/accept-invite`, `/onboarding` (signup wizard), `/plans`, `/download`.

---

## Porting checklist for DINE
1. Build the **foundation** first: session/permission model (§0.2), shell + sidebar + route-access table (§0.1), branch switcher + global filter (§0.3), `erp.ts` helpers + paged query (§0.4), UI kit (§0.5).
2. Port feature-by-feature in this order: Products/Categories → Inventory/Transfers → Orders/Returns → Customers (+CRM) → Discounts → Procurement → Finance → Wholesale → Workforce → Channels/Settings/Billing.
3. Keep the contract: money in minor units, uuid ids, `tenant_id + branch_id + channel` on transactions, order status enum with stock/revenue at `completed`, `variant_id` as the sellable unit.
4. Adapt vocabulary for restaurant (products→menu items, variants→portions, serial/IMEI tracking and wholesale likely drop).

---

# Appendix A — Campaigns in depth (`components/crm/CampaignsTab.tsx`, `campaignView.tsx`, `lib/crm.ts`)

**List page** — header "Campaigns" (+ "Add campaign" / "Add automated campaign" depending on tab). KPI tiles: Total, Active, Scheduled campaigns, Messages delivered. Two tabs: **Manual Campaigns (n)** and **Automated Campaigns (n)** (those with a `trigger`). Filters: search (name/description/discount code), channel, type, status (draft/sending/sent), date range (by `created_at`). Table columns: Campaign Name, Type, Audience, Channels, Offer/Discount, Schedule/Trigger, Status, Actions (view messages, edit, send, pause/resume automation, delete draft). Below: **Campaign Performance** (what sent campaigns reached) and **Recent Activity**.

**Create/edit wizard (7 numbered sections)**
1. *Campaign Details* — name (required), objective (Increase sales · Customer retention · Loyalty & rewards · Promote a new product · Win back inactive customers · Brand awareness), description.
2. *Campaign Type* — cards: Discount, Loyalty, Message, New product launch, Event.
3. *Audience* — "Individuals" mode (pick specific customers via `CustomerMultiSelect`; filters then ignored) **or** filters: Membership (multi-select tiers; none = all), Saved segment (`/crm/customer-segments`, only `marketing` ones), Customer tag, Customer type, City, Purchase behaviour (`bought | never | repeat | recent`), Gender, Customer since (30d/90d/1y), only-new. Live recipient count via `POST /crm/audience-preview`; option lists from `GET /crm/audience-options`.
4. *Offer / Discount* — "Use existing discount" (select from `/discounts`) or "Create a new discount" inline (name, coupon code auto-generated if blank, type percent/flat…, value, minimum order) — the discount is POSTed first, then the form flips to "existing" so a retry never creates a second one. Required for discount-type campaigns.
5. *Channels & Message* — checkboxes WhatsApp / Email / SMS / POS / Website. Only WhatsApp/Email/SMS **send**; POS and Website only **display the offer**. WhatsApp requires an **approved Meta template** (`useWhatsAppTemplates`) and a value for every `{{n}}` variable (active-variable focus, token insert buttons). Free text for other channels. Merge tokens: `{{name}} {{code}} {{discount}} {{expiry_date}} {{store_name}} {{occasion}} {{occasion_date}} {{product}}`; live phone-style preview substitutes sample values (Priya, Silk Saree, 15 Feb…). Template create/edit through `TemplateEditor` (`/whatsapp/templates`).
6. *Schedule* (manual) — start/end datetime, **or** *Launch* (automated): trigger `birthday | anniversary | new_arrival`; `days_before` (0–60); repeat `sends` (>1) every `interval_days` (1–14), last send must not fall after the day itself (`days − (sends−1)·gap ≥ 0`); anniversary can be limited to a label (e.g. Wedding).
7. *Review & Launch* — summary; buttons **Save draft**, **Launch** (→ "Send this campaign?" confirm; automated campaigns just turn on, no manual send).

**Validation rules (client)**: at least one *messaging* channel; WhatsApp template chosen & all params filled; "individuals" needs ≥1 customer; message non-empty; end > start; trigger numeric ranges above; existing-discount selected when required; new-discount percent 1–100 or amount > 0.

**Payload** `POST /crm/campaigns` / `PUT /crm/campaigns/{id}`: `{name, channel(primary), channels[], description, objective, campaign_type, audience{segments, segment_id, tag, customer_ids, customer_type, only_new, city, purchase, gender, since}, subject:null, message, discount_id, starts_at, ends_at, trigger{type,days_before,sends,interval_days,label}|null, whatsapp_template, template_language, template_params[]}`.

**Lifecycle/endpoints**: `POST …/{id}/send` → status `sending` (background; counts update from Meta delivery reports: queued→sending→sent→delivered→read/failed) or immediate `sent`; `PATCH …/{id}/automation {active}` pause/resume; `PATCH …/{id}/details` — a **sent** campaign may only change name, description, objective, discount, schedule (audience/channels/message are frozen); `DELETE` only drafts; `GET /crm/messages?campaign_id` drawer lists every message and its failure reason.

# Appendix B — Discounts in depth (`app/portal/discounts/page.tsx`, `components/discounts/discountView.tsx`, `lib/discountSummary.ts`)

**List** — KPI tiles (Total, Active, …), `TypeDonut` (mix by type), `ChannelUsage`, `DiscountActivity` feed. Filters: search, status (Active/Paused/Expired + Scheduled), type, channel, branch, date range (All time · Running now · Ends within 30 days · Starts within 30 days). **Stage** is computed client-side by `stageOf`: `!is_active → paused`; `ends_at < now → expired`; `starts_at > now → scheduled`; else `active`. Columns: Discount Name, Status, Code, Type, Value ("Buy 1 Get 1" for bogo), Product Eligibility, Customer Eligibility, Channels (icons), Validity, Usage (`times_used / usage_limit`), Actions (Edit, Pause/Resume, Delete → "Remove discount?").

**Types** (`DiscountKind`): Percentage off (0<v≤100, optional *max discount ₹*), Flat amount off, Free delivery, Buy one get one, Buy X get Y (buy_quantity, get_quantity both required), Fixed price. Money stored as minor units; percent as number.

**Form sections** (page-level editor with right-hand aside for 7–8):
1. Basic details — name*, description, code (auto-generate button `generateCode`; blank = automatic/no code), Active toggle.
2. Type & value — option cards (icon + hint), value, buy/get qty, max discount (percent only), minimum order ₹.
3. Product eligibility — "All products" or any combination of **scopes**: categories (`/categories`), collections (`/collections`), specific products (ProductPicker).
4. Customer eligibility — "All customers" or any of: membership tiers, customer tags (`/crm/tags`), individual customers (searchable), customer segments (`/crm/customer-segments`). (Business `account_ids` are not editable here; legacy values preserved on edit.)
5. Channels & branches — channel checkboxes (online/pos/whatsapp; ≥1 required); branches: all or selected (`branch_ids: null` = all).
6. Usage & combination — total uses, uses per customer, minimum purchase quantity, combine with other discounts (allow/no), combine with loyalty points (allow/no), priority (low/normal/high), apply on subtotal | total.
7. Validity — start/end datetimes (`DateTimeField`, local↔ISO helpers).
8. Review & summary — plain-English sentence from `discountSummary()`.
Buttons: **Create/Save**, **Save as draft** (stores `is_active:false`).

**Validation**: value range per type; buy/get ints; min/max parse; ≥1 channel; if a scope is ticked it must have ≥1 selection; "selected branches" needs ≥1.
**API**: `GET/POST /discounts`, `PATCH/DELETE /discounts/{id}`; `Discount` fields in `lib/erp.ts` (category_ids, collection_ids, product_ids, memberships, customer_tags, customer_ids, segment_ids, branch_ids, channels, usage_limit, per_customer_limit, min_quantity, combine_*, priority, apply_on, starts_at, ends_at, is_active, times_used). Server applies them at checkout on all channels; Campaigns reference them by `discount_id`.

# Appendix C — Settings › Payments in depth (`app/portal/settings/payments/page.tsx`, `lib/paymentMachines.ts`, `hooks/usePaymentMachines.ts`)

Page: "Payments — card machines and UPI at your tills". Six cards, all under `/api/v1/payment-machines` (permission `online_payments`; editing needs write).

1. **RazorpayCard** — the business's *own* Razorpay account (never DAAP plan billing) used by website and tills. Fields: Key id (`rzp_test_` / `rzp_live_` ⇒ mode derived), Key secret (write-only, never returned), Webhook secret. Shows mode chip (Test / Live / Not connected), `webhook_url` to paste into Razorpay, required `webhook_events`, registered `website_url` hint, toggle "show Razorpay QR on tills" (`qr_on_tills`). `GET/PUT /razorpay`. **Test payment** modal (₹1–₹100): creates a real test payment and polls until final.
2. **UpiCard** — shop UPI id, name shown to payer, `manual_entry` (cashier may confirm UPI manually), `razorpay_qr` flag. `GET/PUT /settings`. **Shop-QR test modal** shows exactly the QR a till shows (`upiQrLink()` builds NPCI `upi://pay?pa&pn&am&cu=INR&tr(≤35 alnum)&tn`).
3. **ConnectionsCard / ConnectModal** — provider accounts: pick provider (from `GET /providers`: key, name, `available`, `methods` card/upi, `device_ref_label`, `credential_fields[{key,label,secret,help}]`), label, credentials → `POST /connections`; `PATCH /connections/{id}` (enable/disable, rotate); `POST /connections/{id}/test` ("works"/"provider refused"). Providers marked unavailable allow machines with typed references only.
4. **MachinesCard / DeviceModal** — card/UPI machines per branch: branch, name, provider, device reference (serial/TID), connected account, accepts_card / accepts_upi, active. `GET/POST /devices`, `PATCH /devices/{id}`. The till sends the bill amount to the machine.
5. **RequestsCard + ResolveModal** — log of payment requests (`GET /requests`, cursor paged) with status labels `created=Sending, pending=Waiting, succeeded=Paid, failed, cancelled, expired=Timed out, unknown=Check`; columns device, branch/terminal, cashier, method, amount, RRN / card last4 / UTR, failure reason, linked order. Highlights `unused_count` = confirmed payments no bill used for 30 min; **Resolve** (`POST /requests/{id}/resolve {note}` "What was done") after refund/void.
6. **Test payments** — `POST /test-payments`, poll `GET /test-payments/{id}`, actions `POST /test-payments/{id}/{action}` (cancel/refund; `can_refund` else void on machine then mark).

Types: `PaymentSettings`, `RazorpayAccount`, `PaymentProvider`, `PaymentConnection`, `PaymentDevice`, `PaymentRequest`, `TestPayment`. DINE note: only needed if DINE has in-person card/UPI terminals; otherwise keep just RazorpayCard + UpiCard.

# Appendix D — Website themes & Theme editor (`components/portal/channels/OnlineStoreThemes.tsx`, `theme-editor/ThemeEditor.tsx`, `ThemeFields.tsx`, `lib/themes.ts`, `hooks/useThemes.ts`)

**Architecture**: the *storefront app owns each theme* (code, schema, defaults) and serves its schema at `GET {shop site}/api/themes/{key}` (`useThemeDefinition`; site URL from `useShopSite`). The portal only edits values against that schema and saves via `/api/v1/store-admin/themes`; the storefront re-validates before render. Two stores of config per theme: **draft** (`draft_version`) and **published** (`published_version`).

**Gallery page** (`OnlineStoreThemes`): "Your live website" card with preview thumbnail (`SitePreview`/`ThemeImage`), badge *Unpublished changes*, **Customize** button, More menu (Preview via short-lived token, Publish, Remove). "Discover themes" grid of `available` themes (Add → `POST /themes/{key}` installs). Remove confirm ("Remove {theme}?"). `GET /themes` → `{installed[], available[]}`; `InstalledTheme {theme_key,name,is_active,draft_version,published_version,published_at,has_unpublished_changes}`.

**Editor** (`/portal/channels/online/themes/[key]`): split view.
- Left nav "Parts of your website": groups **Logo & name, Announcement bar, Header, Footer, Store pages** (`settings[group]`), then **Home page sections** — ordered list with Move up / Move down / Remove, **Add a section** (from `schema.sections`, each instance `{id,type,settings}`). Click a row → right panel `ThemeFields` for that group/section with Back.
- Top bar: Live / Not live badge, **Save draft**, **Publish** (confirm dialog; auto-saves first; toast "Shoppers see the new look within about a minute"), Reload preview.
- Right: `StorePreview` iframe of the storefront showing the *draft* using a two-hour preview token (`POST /themes/{key}/preview`), scaled to fit 1440px desktop width; iframe reloads (`frame` counter) after each save.
- State: `config {settings, templates:{home}}`, `dirty` (blocks tab close via `beforeunload`), optimistic version from server (`PUT /themes/{key}/draft {config, version}`; `POST /themes/{key}/publish {version}`); `configProblems(def, config)` blocks save/publish with inline errors.
- `editableConfig(def, draft)` merges saved draft over theme defaults; `fieldValue/fieldValues` coerce wrong-typed data to defaults.

**Field types** (`ThemeField`, rendered in `ThemeFields.FieldInput`): `text`, `textarea` (max), `url` (must match `URL_OK`: site path, `#`, http(s), mailto, tel), `image` (upload `POST /store-admin/theme-images` → `image_url`; must match `IMAGE_OK`: site path or https), `collection` (single picker), `collections` (multi, max; options from `GET /store-admin/theme-collections` → `{slug,name,kind: category|craft|occasion|collection,product_count}`), `toggle`, `number` (min/max), `select` (options), `list` (repeatable sub-field groups with `itemLabel`, max, reorder/remove — `ListInput`).

**DINE porting note**: replicate by (a) defining a theme schema JSON in the DINE storefront, (b) exposing it at `/api/themes/{key}`, (c) storing draft/published JSON + versions per tenant, (d) building the generic schema-driven form (`ThemeFields`) and iframe preview with signed preview token. The editor itself is theme-agnostic.
