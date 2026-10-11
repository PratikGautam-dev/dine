# Multi-tenant Storefront, Domains & Themes — Plan

Status: **design / discussion** (nothing implemented yet).

## 1. Goal

Every restaurant (tenant) onboarded gets its own customer-facing website, while staff and managers all use one shared portal.

- Portal (shared): `dineconnect.daaprimetech.com` — staff/managers log in; tenant comes from their login.
- Storefront (per tenant): `rosaya.<storefront-domain>` by default, plus any custom domain the restaurant connects (e.g. `rosaya.in`). Same model as Shopify's Domains screen (a primary domain + connected domains).
- Each tenant chooses a **theme** for their website from the portal.

## 2. Repo layout

Two separate repos, plus the backend API both talk to:

| Repo | Audience | Host |
| --- | --- | --- |
| `dine` (this repo) | Restaurant staff / managers (portal) | `dineconnect.daaprimetech.com` |
| `dine-storefront` (new) | Customers ordering online | `<slug>.<storefront-domain>` + custom domains |
| `erp-dine-backend` | Both frontends (JSON API) | API host |

Platform admin (`admin-dine`) is a separate repo/host and is out of scope here.

Why separate repos:
- Independent deploys and scaling: a storefront traffic spike or bad theme can't take down the staff portal.
- Code visibility: GitHub/GitLab have no folder-level read permissions, so a developer working on the storefront would otherwise see portal code. Separate repos give separate access lists.
- Runtime isolation (below) comes from separate deployments/origins, not from repo layout, but separate repos make it natural.

Shared code: keep it minimal. Generate API types/client from the backend's OpenAPI schema in each repo; copy the few overlapping UI pieces. Only extract a private npm package if real shared code emerges.

## 3. Security

- **Separate origins.** The portal holds staff sessions; the storefront renders tenant-customized content and is the likelier XSS target. On different origins, script on a storefront cannot read portal tokens or call portal APIs as staff.
- **Use a different registrable domain for storefronts** (Shopify: `admin.shopify.com` vs `*.myshopify.com`), e.g. `rosaya.dineconnect.shop` rather than a subdomain of `daaprimetech.com`. Sibling subdomains can share cookies and are exposed to subdomain takeover. If starting on the shared parent: host-only cookies, never set a cookie on the parent domain, and plan to migrate.
- **Resolve tenant from the `Host` header on the server only.** Never trust a tenant id from the client.
- **Separate storefront and portal API surfaces.** Storefront endpoints: public, mostly read-only, tenant-scoped by host, rate-limited. Anything mutating staff data requires a portal token.
- **Verify custom domains** with a DNS TXT record before activation; remove domains cleanly so dangling DNS can't be taken over.
- **Per-host CORS and CSP.**
- **Reserved slugs:** `www`, `admin`, `api`, `portal`, etc. Slugs unique, lowercase, with a rename policy.
- Payment/WhatsApp callbacks, return URLs and CORS allow-lists must be tenant/host aware (no hardcoded origins).
- Customer cookies are per host. Treat each domain as its own session, or redirect to the primary domain (Shopify's "primary domain" behaviour — also better for SEO).

## 3a. Domains

**Data model — `tenant_domains`:** `tenant_id, domain, type (subdomain|custom), is_primary, status (pending|verified|active), verified_at, ssl_status`. Drives a Domains screen like Shopify's.

- **Wildcard subdomains:** one wildcard DNS record + one wildcard cert; no DNS work per onboarding.
- **Custom domains:** restaurant adds CNAME/A to our edge and a TXT record to prove ownership; SSL issued automatically. Options: Cloudflare for SaaS (Custom Hostnames) — closest to Shopify; Caddy on-demand TLS gated by an "is this domain in the DB?" endpoint; or Vercel's Domains API if hosted there.
- **Resolve endpoint:** `GET /web/resolve?host=...` returns tenant id, branding, branches, theme. Cache aggressively (Redis / edge).

## 4. Themes

Principle: **we write the themes; tenants only choose one and configure it.** No tenant-uploaded code initially (that is where XSS risk lives).

- Themes live in the storefront repo, e.g. `themes/<theme-id>/`, as React components registered in a theme registry (`classic`, `modern`, `minimal`, ...).
- **`tenant_themes`:** `tenant_id, theme_id, settings (JSON: colors, fonts, logo, hero, section order/visibility, copy), published_version, draft_version`.
- Request flow: **host → tenant → theme + settings → render**, cached per tenant.
- Each theme declares a **settings schema**; the portal builds its customize form from it, so new themes need no portal changes.
- **Portal "Themes / Customize" page:** theme picker + settings form. Preview = iframe of the storefront with a signed preview token loading the draft. Publish promotes draft → live; versions allow rollback.
- Later: section-based builder (drag/reorder hero, menu grid, offers, reviews); custom CSS only after sanitization; arbitrary tenant JS only once a sandbox (iframe sandbox / restricted extension model) exists.

### 4a. How themes work: shared code, per-tenant data

- Our developers write each theme **once**, in the storefront repo. All tenants on that theme run the same code (50 restaurants on `modern` = one `modern` implementation).
- A tenant stores **data only**: one `tenant_themes` row with `theme_id` + `settings` JSON. That is all that differs between two restaurants on the same theme.
- Rendering: host → tenant → `theme_id` + settings → that theme's components rendered with those settings.
- Shipping a fix to a theme updates every tenant on it at the next deploy. A bad change affects all of them, so test themes carefully; version themes (`modern@2`) to migrate tenants gradually.
- Tenants cannot change layout beyond what the theme's settings schema exposes. Anything more is a new theme or a new setting field, built by us.

**Default theme**
- One theme is the platform default (config value, e.g. `DEFAULT_THEME = "classic"`).
- A newly onboarded tenant gets a `tenant_themes` row pointing at the default with sensible default settings, so the site works immediately.
- Fallback: if a tenant has no theme row, or their theme is removed or broken, render the default instead of an error.
- A tenant can switch themes any time from the portal (draft → preview → publish).

### 4b. Liquid and sandboxing (not needed now)

Neither is for the restaurant picking a theme in the portal. Both concern whoever **writes** theme code and how the platform contains it.

<h1>{{ shop.name }}</h1>
{% for item in menu.items %}
  <p>{{ item.name }} — {{ item.price }}</p>
{% endfor %}

- **Liquid** is Shopify's restricted templating language (HTML with placeholders, loops and simple logic; no file, network or arbitrary code access). It lets Shopify safely run themes written by thousands of outside developers. **We do not use Liquid**: our themes are React components written by our own developers.
- **Sandbox** = an isolated environment (e.g. `<iframe sandbox>`, restricted runtime) so untrusted code can't reach anything else. It matters only when code we didn't write runs on the platform.

| Role | What they do | Needs Liquid / sandbox? |
| --- | --- | --- |
| Restaurant staff (portal) | Pick a theme, edit colors/logo/text, publish | No: settings only |
| Our developers | Write themes as React components in the storefront repo | No: trusted code |
| Outside developers / tenants | Upload their own theme code or scripts | **Yes**: only relevant if we later add a theme marketplace or custom-code uploads |

## 5. Order of work

1. **Backend:** `tenant_domains`, `tenant_themes`, resolve-by-host endpoint.
2. **Storefront repo:** create `dine-storefront`; move `src/app/(storefront)` and its dependencies (cart, customer auth, branch context, needed UI) out of `dine`; add host-based tenant resolution.
3. **One theme end to end:** portal picker, settings, draft/preview, publish.
4. **More themes**, then custom domains with auto-SSL and a Domains page in the portal.

## 6. Open decisions

1. Can we buy a separate domain for tenant storefronts? Largest security decision.
2. Hosting for the frontends (Vercel vs own Docker/VPS) — determines the custom-domain/SSL tooling.
3. Do tenants with multiple branches need per-branch domains, or one domain per restaurant?
4. Confirm shared-code approach: OpenAPI-generated types, copied UI, no shared package yet.
