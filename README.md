<h1 align="center">Dine Connect</h1>

**Frontend for Dine Connect — a WhatsApp table-reservation and food-ordering receptionist for restaurants.**

The Next.js app: the public landing page, the guided restaurant-onboarding wizard, the restaurant-staff portal, and the platform-admin tenant pages. It talks to the Dine Connect API (hosted separately) entirely over JSON.

Built with Next.js 16 (App Router) / React 19 / TypeScript / Tailwind v4.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app expects the API at `http://localhost:8000` by default; point it elsewhere with `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

## Pages

| Route                                       | What it is                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `/`                                         | Public landing page                                                               |
| `/admin/onboard-hospital`                   | Guided multi-step wizard for onboarding a new restaurant                          |
| `/admin/tenants`, `/admin/edit-tenant/[id]` | Platform-admin tenant list/edit                                                   |
| `/portal/login`                             | Restaurant-staff login                                                            |
| `/portal/dashboard`                         | Stat tiles, weekly trend, section breakdown, recent activity                      |
| `/portal/appointments`                      | Reservation list + cancel/reschedule/reassign-table                               |
| `/portal/tables`                            | Add/manage physical tables and sections                                           |
| `/portal/doctors`, `/portal/schedule`       | Staff/"Team" management                                                           |
| `/portal/food-menu`, `/portal/food-orders`  | Food-ordering menu management and order tracking                                  |
| `/portal/patients`, `/portal/patients/[id]` | Guest directory + record                                                          |
| `/portal/messages`                          | Human-handoff inbox                                                               |
| `/portal/new-booking`                       | Staff-created table reservations                                                  |
| `/portal/settings`                          | Bot customization: menu labels, closing message, hours, language, session timeout |

## Design system

`src/app/globals.css` defines the token set (colors, spacing, typography, shadows) — extend it there rather than hardcoding one-off values. Shared primitives live in `src/components/ui/`. Icons via `lucide-react`; charts via `recharts`.

## Production

```bash
npm run build
npm start
```

Next.js bakes `NEXT_PUBLIC_*` values in at build time, so set `NEXT_PUBLIC_API_BASE_URL` before building. Docker: see `Dockerfile`, `docker-compose.yml` and `docker-publish.sh`.

## License

MIT
