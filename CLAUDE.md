@AGENTS.md

## POS

- Plan: `docs/POS_PLAN.md` (counter POS for restaurants; Flutter app in `../dine-pos`, backend in `../erp-dine-backend/pos/`).
- POS work goes on the `chandan` branch in `dine`, `erp-dine-backend` and `dine-pos`.
- DAAP Core (owner identity, plans and limits such as `pos_terminals`, online payments): `../../daap-core` (its `docs/integration_contract.md`).
  Owners sign in with DAAP (`/auth`, `/auth/daap`); new restaurants are set up in DAAP Account; the portal shows DAAP's verification,
  plan and Razorpay connection (`src/hooks/useDaapStatus.ts`, `src/components/portal/DaapGate.tsx`) but the backend enforces them.
