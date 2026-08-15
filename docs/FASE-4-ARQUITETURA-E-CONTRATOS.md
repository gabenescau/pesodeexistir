# Fase 4 — Arquitetura e Contratos

## Aplicado

- API inputs for billing, account deletion and admin operations are validated
  by `src/lib/api-contracts.js` on the server boundary.
- API responses use `{ success, data, error, requestId }` through the shared
  helpers in `server/supabase.js`. Health checks remain an explicit exception
  because uptime probes commonly consume their `status` payload.
- The browser API client in `src/lib/authenticated-api.js` centralizes session
  token acquisition, JSON parsing, `AbortSignal` support and `ApiError` with
  `status`/`requestId`.
- Billing activity and entitlement calculation are isolated in
  `server/domains/billing.js`; plan values still come exclusively from
  `server/plans.js`.
- Catalog selectors and legacy asset normalization are isolated in
  `src/app/data/domains/catalog.js`.
- `docs/CONTEXT.md` records the domain glossary and authority boundaries.

## Boundary map

### Client

React pages, interaction state, loading states and presentation. It may request
public/user-scoped data through Supabase RLS and call authenticated API
handlers, but it cannot decide price, role, verification, payment status or
entitlement.

### Server

`api/` handlers authenticate and authorize requests. `server/` owns Stripe,
Supabase service access, plans, webhook synchronization and audit behavior.
`server/domains/` contains business rules that should not be duplicated in UI
components.

### Shared

`src/lib/api-contracts.js` contains transport-shape validation only. It does
not grant authorization and does not replace server-side ownership checks.

### Database

Supabase/Postgres remains the persistence and RLS boundary. Unprivileged reads
must use narrow selects and privileged writes must use server-controlled
operations or explicitly constrained RLS policies.

## Remaining incremental work

`DataContext` still contains legacy aggregate state for compatibility. Catalog
and community derived views are now isolated as the first controlled slices.
The next safe slice is rewards/store, with one owning module and focused
queries. A broad rewrite would create duplicate caches and regressions, so it
is intentionally deferred until each slice has tests and a migration owner.

## Decision records

1. Stripe is the payment authority; local subscriptions are a synchronized
   projection.
2. The server plan catalog is the only source for price, cycle and entitlement
   mapping.
3. A user may have at most one open checkout attempt; conflicting attempts are
   rejected rather than merged by the browser.
4. API errors expose a safe message and request id, never provider secrets or
   raw database details.
5. Domain extraction is incremental and preserves existing public context APIs
   until consumers are migrated.
