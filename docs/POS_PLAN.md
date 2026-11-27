# Dine Connect POS: plan

## Context

Dine Connect handles WhatsApp and web food ordering, table booking and a staff portal. It has **no restaurant billing**. We want a counter POS that works like ShopConnect's Flutter till (local-first, paired devices, cashier PINs, thermal printing, signed releases) and behaves the way Indian restaurant POS products do: tables, KOTs, rounds, bills, splits, shifts.

What exists today:
- **`dine-apps/erp-dine-backend`**:
  - Till device pairing, refresh, PIN login and `staff_pins`, copied from ShopConnect (`pos/routes.py`, `pos/service.py`, `db/pos_schema.py`).
  - `departments` (sections) and `tables` (with floor-map x/y).
  - A flat `menu_items` table.
  - `food_orders`, which only knows pickup and delivery.
  - GST registrations and `tax_rules`. These are stored but not used: "no tax engine yet".
  - `branches.service_charge_pct` is stored but not used.
  - No websockets; the frontend polls.
- **`ecommerce-apps/shopconnect-pos`** (v1.3.1) has:
  - Riverpod 3, Dio, Drift on encrypted SQLite.
  - Pairing and token rotation, offline PBKDF2 PIN check, a sync outbox.
  - ESC/POS printing over USB, network and spooler.
  - Payment-machine dialogs, an update check, and `release.yml`.
- **Core** has:
  - A `pos` service for Dine with a `kitchen_display` feature, and `outlets` and `users` limits.
  - **No `pos_terminals` limit.**
  - Till UPI QR through the Payments Service is not built.

## Decisions taken (2026-11-25)

| Topic | Choice |
|---|---|
| v1 scope | Counter POS only. Captain app and KDS come later, but the protocol is designed for them now. |
| Code reuse | New app that copies the files it needs from `shopconnect-pos`. No shared package. |
| Offline | LAN hub: one counter device holds the live floor state and other devices talk to it over Wi-Fi. |
| Order types | Dine-in, takeaway/counter, delivery (phone orders). Existing WhatsApp/web orders inside the POS come later. |

## How the POS will behave (industry standard)

**Floor and tables**
- The floor plan is built from the existing `departments` and `tables`. Each table shows a colour for its state:
  - Blank: free.
  - Running: KOT sent.
  - Bill printed: waiting for payment.
  - Needs cleaning.
- Each table shows its guest count, running total and how long it has been open.
- Table actions:
  - Transfer a table to another table.
  - Merge tables into one bill.
  - Move items between tables.
  - Split a table into sub-orders (table 5A, 5B).
- Mark an item out of stock ("86") straight from the POS. It syncs to the menu and to online ordering.

**KOT (kitchen order ticket)**
- Items are added to the order and stay editable until the cashier presses **Send KOT**.
- Each send prints a new KOT number with **only the new items** (rounds). The previous KOTs stay unchanged.
- KOTs go to printers by **kitchen station** (kitchen, bar, tandoor, desserts). Each menu item belongs to a station, and each station has a printer.
- The KOT shows the table or token, guest count, order type, item notes, modifiers and the time.
- Removing an item after its KOT was sent is a **void**:
  - It needs a reason and a permission (or a manager PIN).
  - It prints a **CANCELLED** KOT to the same station.
  - It stays in the audit log.
- A reprinted KOT is marked "REPRINT" and counted.

**Bill and settlement**
- **Print bill** locks the order. Changing it afterwards needs the "edit printed bill" permission and prints a new version.
- A reprinted bill is marked **DUPLICATE**.
- Bill totals, in order:
  1. Item totals.
  2. Item and bill discounts. Each needs a reason and has a per-role limit.
  3. Optional service charge.
  4. Packaging charge (takeaway/delivery) and delivery charge.
  5. GST.
  6. Round-off to the nearest rupee.
- **Service charge is off by default and can be removed per bill.** Since the CCPA guidelines (July 2022, upheld by the Delhi High Court), it cannot be added automatically or made mandatory.
- **GST**:
  - Restaurants: 5% without ITC.
  - Specified premises: 18%.
  - Taken from the existing `tax_rules`, set per item or per branch.
  - Printed as CGST + SGST.
  - GST is also charged on the service charge.
  - Menu prices can be set as inclusive or exclusive of tax for each restaurant. Exclusive is the usual choice.
- **Numbers** follow ShopConnect's `db/display_ids.py`. Dine's own `db/display_ids.py` stays the single place for every prefix, so the new ones are added there:
  - **Branch code**: `B1`, `B2`. Dine's branches have no code today, so one is issued for each branch.
  - **Terminal code**: the branch code plus the terminal's own number, counted per branch: `B1T1`, `B1T2`. This replaces Dine's current `T001` codes. No till has billed with them yet, so they can be re-issued.
  - **Bill number**: the terminal code plus a counter that never restarts: `B1T1/00001`.
    - Each terminal owns its own series, whether it is online, offline or the hub, so two terminals can never clash.
    - It stays within GST's 16-character limit and is unique for ever, so it is also unique within each financial year.
  - **KOT number** and **takeaway token**: per branch, reset daily (`KOT 12`, `Token 7`). They are only printed on paper and are not GST documents.
  - Counters use Dine's `code_sequences` table through `display_ids.py`, never their own table.
- **Required on the bill:** GSTIN, FSSAI licence number, outlet address, bill number and date. The customer's GSTIN is optional (B2B).
- **Settlement tenders**:
  - Cash, with change calculated.
  - Card: the cashier enters the machine's reference. Card-machine adapters come later.
  - UPI on the static QR, confirmed by the cashier.
  - Split tender.
  - **Due/credit** to a named customer.
  - **Complimentary (NC)**, with a reason and a permission.
- **Split bill**: by item, equal split, or by seat. Each split is its own bill with its own number.

**Takeaway and delivery**
- **Takeaway**: a quick order screen. You pay first (configurable) and get a **token number** that resets daily. KOTs print the same way as dine-in.
- **Delivery (phone orders)**:
  - Look up the customer by phone; name and address are saved.
  - Delivery charge, then assign a rider.
  - Statuses: placed, dispatched, delivered.
  - For COD, cash is settled when the rider returns, and each rider sees what they owe.
- **Prices per order type**: an item can have a different price for dine-in, takeaway and delivery (common in Indian restaurants).

**Shifts and cash** (ShopConnect has only a Day Close, so this is new)
- Open a shift with a cashier PIN and an opening float.
- Cash in and cash out, each with a reason.
- **X report**: a mid-shift snapshot.
- **Shift close**: the system shows expected cash, the cashier enters the counted cash, and the difference is recorded with a PIN.
- **Z report / day close**: the outlet total, split by tender, order type, voids, discounts, NC and tax.
- A bill cannot be settled without an open shift.

## Architecture

**The LAN hub**
- Each outlet chooses one counter device as the **hub**. Windows is recommended; an Android hub must run as a foreground service, because Android stops background servers.
- The hub runs an embedded HTTP + WebSocket server (`dart:io`) and stores the live floor in its own encrypted Drift database. It is the **only writer** of live order state for its outlet.
- **Every terminal, including the hub itself, uses the hub API** (the hub over loopback). There is one code path, so captains and the KDS can join later with no new protocol.
- Other terminals find the hub with mDNS, or by typing its IP. They join with a token that the cloud signs at pairing.
- The hub uploads finished bills, KOTs, voids, payments and shift/day closes to the cloud through an outbox. It copies ShopConnect's `SyncOutbox` pattern: event ids, so a resend is answered with the first answer, and oldest first.
- The cloud is the back office and keeps a mirror. It never edits live orders.
- **If the hub goes down**:
  - Other terminals show "Hub offline".
  - A manager can **promote** another terminal with a PIN. That terminal pulls the hub's last uploaded state from the cloud and takes over.
  - Two hubs at once are blocked by a hub lease, which the cloud issues and the hub renews.
  - With no internet and no hub, each terminal can still bill takeaway on its own offline series. Those bills are reconciled at upload.

**Pricing on server and till**
- New `pricing` module in `erp-dine-backend`: item, modifiers, discount, service charge, packaging, GST, round-off.
- It is ported to Dart with **shared test vectors**, as ShopConnect's `test/fixtures/pricing_vectors.json` does.
- On upload, the server recalculates each bill and **flags** mismatches (`price_differs`, `item_inactive`, `discount_not_permitted`, `clock_ahead`, and so on). It never silently changes a bill. This keeps the rule "totals are computed on the server" while the till works offline.

**Money**: whole paise everywhere. Tax rates are stored in basis points.

## Work by repo

### 1. `erp-dine-backend` (FastAPI)

Follow its conventions:
- Every migration needs two files: `db/migrations/versions/00NN_*.py` and an idempotent block in `db/init_db.py`.
- Use the `routes.py` + `service.py` pattern that the copied modules use (`crm/sql.py` `transaction()`).

**Menu**
- New tables:
  - `menu_categories`.
  - `menu_variants` (half/full, sizes).
  - `modifier_groups` and `modifier_options`, with min/max choices and a price each.
  - `kitchen_stations`.
- New columns on `menu_items`:
  - `category_id`, which replaces the free-text category through a data migration.
  - `station_id` and `tax_rule_id`.
  - Prices per order type.
  - `short_name`, for KOTs.

**Orders**
- Add `dine_in` and `takeaway` to the `food_orders` fulfillment CHECK, and add `source = 'pos'`. All orders stay in one table, so reports stay unified.
- New POS detail tables:
  - `pos_kots` and `pos_kot_items`.
  - `pos_bills`, with splits, number, version and reprint count.
  - `pos_bill_payments` (tenders).
  - `pos_voids`.
  - `pos_shifts`, `pos_cash_movements` and `pos_day_closes`.
  - `delivery_riders`.

**Till API** (extends `pos/routes.py`, copying ShopConnect's `terminal/` where it can):
- `GET /terminal/menu`, versioned so an unchanged menu is skipped, the same way ShopConnect pulls its catalog.
- `POST /terminal/bills`: a batch upload with event ids. Server recalculation and flags go here.
- `POST /terminal/shifts` and `POST /terminal/day-closes`. Both need a cashier session, as SEC-22 requires.
- `POST /terminal/cashier-session`, copied from ShopConnect's `cashier_session.py`.
- `POST /terminal/hub/lease` and `GET /terminal/hub/state`, for hub failover.
- `POST /terminal/items/{id}/availability`, for 86.

**Till permissions** (see "Roles & Permissions: Till tab" below):
- New table `role_till_permissions (restaurant_id, role, perm_key)`.
- A catalogue of till actions in `portal/permissions.py`.
- `GET/PUT /api/portal/roles/{key}/till-permissions`.
- The cashier list sent to the till carries each cashier's till permissions, so the till can enforce them offline.
- On upload, the server checks again and flags `not_permitted` instead of rejecting the bill.

**Pairing limit**: check Core's `pos_terminals` entitlement at pairing, the way ShopConnect's `_check_plan_limit` does. Until Dine is integrated with Core, read Dine's local module setting.

### 2. `dine` (Next.js portal)

Most of this **extends pages that already exist**. Only a few pages are new.

**Extend existing pages**
- **Food Menu** (`/portal/food-menu`, `MenuItemPanel.tsx`). It already has the items, categories (free text), combos, availability, stock, photos and bulk import. In the item panel, add:
  - **Variants** (half/full, sizes).
  - **Add-on groups** (min/max choices).
  - **Kitchen station**.
  - **GST rule** (picked from Settings > Taxes).
  - **Prices for dine-in, takeaway and delivery**.
  - A short KOT name.
  - Variants and add-ons are POS-only for now: WhatsApp and the website still sell the item at its own price.
- **Food Menu categories**. The category list stays where it is. It moves from free text to a real category record, with a data migration, so it can have an order, a default station and a default tax. Users see the same screen.
- **Tables** (`/portal/tables`) and sections: no change. The POS reads them as they are.
- **Settings > Taxes**: no change. Items now actually use these rules.
- **Settings > Channels > POS** (`/portal/channels/pos`, `BranchTerminals.tsx`). It already has terminals, cashier PINs and branding. Add a **POS settings** section for each branch:
  - service charge on/off
  - prices tax-inclusive or exclusive
  - takeaway pay-first and packaging fee
  - FSSAI number
  - (no bill-number setting: numbers are fixed by `display_ids.py`)
- **Settings > Roles & Permissions**: add a **Till** tab (see below).
- **Reports**: add POS reports to the existing page: bills, voids, discounts, NC, shifts, Z reports, rider COD.

**New pages (nothing like them exists today)**
- **Kitchen stations and printers** (Settings > Channels > POS > Stations). Stations such as kitchen, bar or tandoor. The printer address itself is set on the till, because the printer is on the till's local network.
- **Delivery riders** (Settings > Delivery riders). Details are under "Delivery riders" below.

**Roles & Permissions: Till tab** (the same pattern as ShopConnect's `RoleEditor.tsx` / `PermissionGrid.tsx` and `auth/permissions.py` `till_permissions`)
- Each role has two tabs, **Portal** and **Till**.
  - The **Portal** tab is today's page view/write/delete grid.
  - The **Till** tab lists POS actions by group. A tick counts only on its own tab.
  - A role with an empty Till tab cannot sign in on the till.
- **Till permissions**, by group:

| Group | Permissions |
|---|---|
| Orders | take dine-in orders; take takeaway orders; take delivery orders |
| Floor | transfer/merge tables; move items between tables; mark items out of stock (86) |
| KOT | void an item after its KOT (needs a reason); reprint a KOT |
| Bill | apply discounts (with a max % per role); complimentary/NC; edit a printed bill; reprint a bill; split a bill; remove the service charge |
| Payments | settle bills; put a bill on due/credit |
| Cash | open/close a shift; cash in/out; view X/Z reports; close the day |
| This till | change till settings and printers; promote this till to hub |

- **Manager approval**: if the cashier lacks a permission, the till asks for the PIN of someone who has it. Both names are recorded in the audit log, as in Petpooja and Posist.
- **Default permissions** for the built-in roles:
  - **Admin**: everything.
  - **Receptionist**: cashier actions (orders, settle, open/close own shift, KOT reprint).
  - **Kitchen**: none.
  - Custom roles start empty.
  - There is no built-in Manager role. Restaurants add custom roles as needed.

### Delivery riders (recommended approach)

> **Superseded 2026-11-26**: restaurants will not keep their own riders. DAAP will run its own delivery partners, and restaurants
> connect to them; that is a later phase (with equal/seat split and the offline takeaway fallback). The section below is kept for history.

**Today**: each order has only a free-text `delivery_partner_name` / `delivery_partner_phone`, typed in at dispatch. There is no rider list, no history and no way to know how much cash a rider holds.

**Recommendation**: riders are their **own record in Dine, separate from staff**.
- They never sign in to the portal or the POS.
- They will sign in to their **own rider app** later.
- Making them staff would put them in roles, PINs, attendance and the staff limit, none of which applies to them.

**Data**
- New table `delivery_riders`, per restaurant and branch: name, phone, type (`own` or `third_party`, e.g. Porter, Dunzo), and active flag.
- New column `food_orders.rider_id`. The existing name and phone columns are still filled, so the current Delivery Tracking page keeps working.

**Portal**: a Riders page to add, edit and deactivate riders. It is gated by a portal permission.

**POS v1 flow**
1. The cashier assigns a rider from the list at dispatch. A third-party rider can be typed in once.
2. The order moves to "out for delivery".
3. When the rider returns, the cashier opens **Rider settlement**. It lists that rider's COD orders.
4. The cashier records the cash received. It goes into the current shift as rider cash, and any shortfall is recorded against the rider.
5. Each rider has a running balance ("cash with rider") in reports.

**The rider app (later, its own phase)**
- Signs in with phone OTP. Dine already has an OTP service for customers.
- Sees assigned orders, marks them picked up and delivered, shares location and shows how much cash they hold.
- Uses its own token type (`typ=rider`), separate from terminal and staff tokens.
- The POS and the hub need no change for it, because the cloud already holds the orders and the rider assignment.

### 3. New repo `dine-apps/dine-pos` (Flutter: Android tablet + Windows; Linux as in ShopConnect)

- Create it with `flutter create` (official CLI rule). Add packages with `flutter pub add`: riverpod, dio, drift, sqlite3 multiple ciphers, secure storage, multicast_dns.
- **Copy from `shopconnect-pos`, then adapt:**

| Piece | Source path |
|---|---|
| API client and auth | `lib/core/api/auth_interceptor.dart`, `cashier_session.dart`, `lib/core/storage/token_store.dart` |
| Encrypted Drift setup | `lib/core/db/app_db.dart`: only the setup and the `TerminalConfigs`, `Users`, `SyncOutbox`, `DevicePrefs`, `TerminalTokens`, `HardwareEvents` tables |
| Pairing, gate, PIN | `lib/features/pairing/`, `lib/features/gate/app_gate.dart`, `lib/features/auth/` (`pin_hasher.dart`, `login_screen.dart`, `session_controller.dart`) |
| Sync | the structure of `lib/features/sync/sync_service.dart`, rewritten for bills and menu |
| Printing | all of `lib/hardware/printer/` (ESC/POS, Windows spooler, network 9100), extended to **several printers** routed by station |
| Other | `lib/hardware/hardware_log.dart`, `lib/features/updates/`, `lib/features/branding/`, `lib/theme/`, `.github/workflows/release.yml` (with the SEC-21 fixes), `windows/installer/pos.iss` |

- **Not copied:** catalog, offers, returns, CRM, wholesale, purchases or labels. These are retail-specific.
- **New modules:**
  - `features/hub/`: server, client, discovery, lease and promote.
  - `features/floor/`: table map and table actions.
  - `features/order/`: order editing, rounds, modifiers.
  - `features/kot/`: KOT build, station routing, voids.
  - `features/bill/`: the pricing port, splits, numbering.
  - `features/settle/`: tenders.
  - `features/shift/`: shifts, cash, X/Z reports.
  - `features/delivery/`: customers, riders, COD.
- **Kitchen languages**: ShopConnect's ESC/POS output is ASCII only. KOTs in Hindi or regional scripts need raster (image) printing. Add a raster KOT mode.

### 4. `daap-core`

- Add a `pos_terminals` limit (scope `service`) to Dine's `pos` service in `daap-backend/src/catalog/seed/catalog.data.ts` and in DAAP Admin.
- Record the Dine POS decisions in `docs/decisions.md`.
- No other core change in v1. Payments stay manual or on the static QR. Dynamic UPI QR through core (`purpose: qr`) and card machines come later.

## Git branches
- **All POS work goes on a branch named `chandan`** in each repo: `erp-dine-backend`, `dine` and the new `dine-pos`. It is merged into `main` when a phase is tested.
- `dine-pos` is new, so it starts with just `main` and `chandan`.
- This replaces `backend-sync` for the POS work in `erp-dine-backend`. Update its `AGENTS.md` to say so.


## Phases

1. **Foundations**:
   - Plan doc in `dine/docs/POS_PLAN.md`, and a pointer to `../daap-core` in Dine's CLAUDE.md.
   - Core `pos_terminals` limit.
   - Menu model and migrations; extend the Food Menu page.
   - Roles & Permissions Till tab and the till permission catalogue.
   - Pricing module with test vectors.
2. **App skeleton**:
   - `flutter create`.
   - Copy pairing, PIN, encrypted DB, printing and updates.
   - Menu sync.
   - Hub runs on loopback with a single terminal.
3. **Ordering**:
   - Floor view, dine-in, takeaway and delivery.
   - KOT with station routing, voids.
   - Bill, splits, tenders, settle.
   - Bill upload with server flags.
4. **Shifts and controls**:
   - Shifts, cash in/out, X/Z reports, day close.
   - Permissions and manager PIN.
   - Portal reports.
5. **Multiple terminals over the LAN**:
   - mDNS discovery and remote terminals.
   - Hub lease and promote.
   - Offline takeaway fallback.
6. **Releases**:
   - Windows installer and Android build through `release.yml`.
   - Code signing (SEC-18) and a custom download domain from the start.
7. **Later (not v1)**:
   - Captain app (Android phone, same hub API, no payments).
   - Rider app (phone OTP, assigned orders, delivered, cash held).
   - KDS (stations, bump, ready).
   - WhatsApp and web orders inside the POS.
   - Swiggy/Zomato through an integrator.
   - Dynamic UPI QR through core, card-machine adapters.
   - Inventory and recipes, loyalty.
   - Live running tables in the owner's cloud dashboard. The hub uploads a snapshot every minute.

## Target hardware (agreed 2026-11-25)
- **Counter and hub**: a Windows PC. A second counter runs on an Android tablet.
- **Kitchen and bar printers**: network (LAN/Wi-Fi) thermal printers on port 9100, one per station.
- **Receipt printer**: USB or network thermal printer at the counter.
- **Cash drawer**: plugged into the receipt printer, which opens it when the bill prints (ShopConnect already does this, on pins 2 and 5).

## Open questions
Settled as they come up.

## Changes made while building (2026-11-25 onwards)
- **POS bills have their own tables** (`pos_bills`, `pos_bill_lines`, `pos_bill_payments`, migration 0123), not `food_orders`: `food_orders`
  is read in about thirty places (kitchen board, WhatsApp flows, dashboards, loyalty) whose rules are for online orders. Reports join
  the two in phase 4.
- **The bill number is given at the first print**, not at settling: the guest's tax invoice must carry it. A printed bill is never
  cancelled (it is settled, complimentary if need be), so the series has no gaps.
- **Tax-inclusive prices and the default GST rate** are the existing Settings > Taxes values (`restaurants.tax_inclusive_prices` /
  `default_tax_rate`); the POS settings card shows them and links there.
- **Shifts and day closes upload offline-first** (migration 0124): the till sends the cashier session it has; a record uploaded after the
  session ended is still booked, flagged `unverified_cashier` (ShopConnect's SEC-22 refuses instead, but its day close is online-only).
  The server keeps its own sums beside the till's Z report and flags differences. Closing a shift is a blind count.
- **POS reports** are their own portal page, Reports > POS sales (`/portal/reports/pos`), linked from Analytics.
- **Several tills on one network (phase 5, migration 0125)**: requests to the hub are signed with a per-branch LAN key the server derives
  (never stored) and hands out with `me`; revoking a till moves the key. The server grants the hub lease (renewed every 2 minutes);
  taking it over needs a cashier session whose role holds `till.hub`. Tills find the hub by a UDP broadcast on the network (instead of
  mDNS: no extra package, works offline), then the server's lease record, then an address typed in. The hub uploads a snapshot of its
  open orders, counters and open shifts every minute; a till that takes over imports it (a printed but unpaid bill is printed again under
  the new hub's numbers). The hub issues and uploads every bill; shifts are per till's drawer and filed under that till on the server.
- **Business day (migration 0126)**: POS settings have "Business day ends at", midnight (the default, as most Indian restaurants run)
  up to 6 am, for the restaurant and per branch. Before that hour a bill counts for the evening before: KOT and token numbers carry on,
  `pos_bills.business_day` and the reports follow it, and the Z covers the whole night. A Z taken before the day's end moves the till on
  to the next day (what is sold after it belongs to tomorrow); the server accepts the till's day when it is the settle time's day or the
  next one, and otherwise books its own and flags `business_day_differs`.
- **Till sign-in safety, from ShopConnect 1.3.0 (migration 0127)**: a till that lost the answer to a refresh sends the old token again
  and gets a new one (72 h grace, while the replacement was never used) instead of being signed out. A truly copied token resets the
  terminal's credentials (`credentials_reset`): the real till pairs again with a new code and keeps its data; it is no longer revoked.
- **A revoked till hands over (migration 0127)**: for 30 days after a revoke, the till sends what it never uploaded (bills, shifts, day
  closes) with the refresh token it held at the revoke. Nothing is booked by itself: a manager approves each in the branch's Terminals
  tab (booked like any upload, flagged `from_revoked_terminal`) or rejects it with a note.
- **Releases (phase 6, 2026-11-26)**: as ShopConnect, the workflow in dine-pos builds Windows / Android / Linux and publishes to
  Dine's R2 bucket (`releases/dine-pos/`); the portal's public `/download` page and the tills read `latest.json`; the Terminals tab
  flags tills on an older version. Hosted builds use the Render backend (`https://erp-dine-backend.onrender.com/api/v1`). Windows
  builds are unsigned for now (SEC-18); a download domain comes later.
- **Till screens redesigned (2026-11-26)**, after a user review of the first build (no navigation, actions hidden under ⋮, a tap went
  straight onto the table's order, no photos or stock). The till now has ShopConnect's shell: a dark sidebar (Tables, Takeaway, Delivery,
  Running orders, KOTs, Bills (today), Menu & stock, Shift & cash, Settings), each entry shown only for the cashier's till permissions,
  and a top bar with the shift, hub and upload states. The order screen is categories | dishes (photo, veg mark, price, "N left") |
  order. A tap puts a dish in **New items · not sent** on that till (stepper, note, remove); nothing reaches the hub until **KOT** or
  **Save** (kept on the order without a KOT, shown as Items not sent: the held orders), and a table or takeaway is only opened on the hub
  then. Every action is a visible button; leaving with new items asks to send, save or drop them. Photos are kept on disk for offline
  use (a small file cache like the logo's: `cached_network_image` needs sqflite, which Windows and Linux lack).
- **Stock on the till**: plates left = the count the menu download brought, less what the outlet has on open orders and in bills the
  server has not counted yet; the hub refuses an add beyond it (`out_of_stock`). Menu & stock switches a dish off (86) or sets its count
  through `POST /terminal/items/{id}/stock` (pos/till_stock.py): a cashier session whose role holds `menu.out_of_stock`, or a manager's
  session when one approves. It is the portal's own switch and count, so online ordering follows.
- **Table flow (2026-11-27, user's choices)**: seating asks guests and the **captain** (who serves; the signed-in person unless another
  is picked), both changeable on the running order. The **customer is optional** for a table ("Add customer": phone with DPDP consent,
  recorded with the office when online; name; GSTIN for a business bill) and needed only for a bill on credit. Each KOT can carry a
  **round note** for the kitchen; the KOT prints the captain. A sent dish can be **discounted** (₹ or %, reason, within the role's limit
  or a manager's) or **moved to another table** (running or free) besides voided. **Changing a printed bill** needs "change printed
  bill"; it keeps its number and the next print says TAX INVOICE (REVISED); an unchanged copy says DUPLICATE. A settled table is free
  at once. The bill shows captain, customer and GSTIN, and each dish's discount; the upload carries `captain`, `customer.gstin`,
  `lines[].discount_reason` and `kots[].note` (pos_bills.captain_id / captain_name / customer_gstin, pos_bill_lines.discount_reason,
  migration 0129).
- **Later, by decision (2026-11-26)**: the offline takeaway fallback (no hub and no internet), equal split and split by seat (split by
  item is built), and delivery partners (DAAP's own network; not per-restaurant riders).

## Verification
- **Backend**:
  - pytest for the pricing vectors, bill upload (idempotent resend, each flag), shift/day-close permissions and the pairing limit.
  - Migrations applied to the shared Neon database after printing its host. Check the real columns afterwards.
- **Flutter**:
  - `flutter test` passes the same pricing vectors, matching to the paisa.
  - Widget tests for floor and table actions, and for KOT round building and voids.
- **End to end on real hardware**:
  1. Pair a Windows hub and an Android tablet.
  2. Open a table, send 2 rounds, void an item, and check the CANCELLED KOT at its station printer.
  3. Split the bill and settle with split tenders.
  4. Pull the network cable: the floor keeps working over the LAN.
  5. Reconnect: the bills upload once.
  6. Kill the hub and promote the tablet.
  7. Close the shift and the day, and compare the Z report with the portal reports.
