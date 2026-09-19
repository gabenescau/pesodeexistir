# OPE Club Domain Context

This glossary describes business concepts and authority boundaries. It is kept
implementation-light so UI and server modules can evolve without changing the
meaning of the product.

## Core concepts

- **User**: authenticated Supabase identity. It is the owner of personal data
  and user-scoped resources.
- **Profile**: public-facing community identity linked one-to-one to a user.
  Role and verification are server-controlled attributes.
- **Book**: catalog item that may have an author, cover and protected reading
  asset.
- **Author**: catalog person connected to one or more books.
- **Post**: community publication owned by a user. Likes, saves, comments and
  polls are separate interactions with their own ownership and uniqueness
  rules.
- **Plan**: server catalog entry describing tier, cycle, price and duration.
  The browser may display a plan, but never defines its price or entitlement.
- **Subscription**: local projection of a payment provider subscription or a
  controlled manual grant. Its status is synchronized by server/webhook logic.
- **Entitlement**: effective access derived from a subscription, its status and
  dates. It is not a client-editable flag.
- **Checkout attempt**: idempotency ledger entry that prevents duplicate or
  conflicting pending checkouts for one user.
- **Reward wallet**: user-scoped credits and XP used by rewards/store flows;
  mutations must respect database policies and server validation.
- **Suggestion**: community request that can be moved between roadmap columns;
  only administrators may change its workflow status.

## Authority boundaries

| Concern | Authoritative boundary |
| --- | --- |
| Authentication/session | Supabase Auth plus `/api/auth` BFF cookies and server session validation |
| Roles/admin | `profiles.role` protected by RLS/server authorization |
| Plan price/cycle | `server/plans.js` and payment provider configuration |
| Payment status | Stripe webhook plus server reconciliation |
| Entitlement | Server/database projection, never browser state |
| Public catalog reads | Supabase RLS with narrow selects |
| Privileged mutations | Vercel Functions and server-side Supabase access |

## Fase 4 boundary decisions

The current Vite application is preserved as a single deployable frontend, but
the code is being decomposed by domain rather than by arbitrary `frontend` and
`backend` folders. Catalog and community selectors/normalizers live under
`src/app/data/domains/`; payment rules live under `server/domains/billing.js`;
shared request validation lives under `src/lib/api-contracts.js` and is
consumed by browser-facing API boundaries.

Direct Supabase reads remain allowed only where RLS is the intended authority.
Payment, admin, account deletion and other privileged writes go through API
handlers. Further extraction of the legacy aggregate `DataContext` should be
incremental and keep one writer per domain state to avoid split-brain caches.

## Authentication bridge boundary

The SPA no longer persists Supabase tokens in browser storage. The BFF stores
the refresh and short-lived access tokens in protected cookies, while a
short-lived access token is temporarily held in JavaScript memory solely for
legacy direct RLS reads. API requests use same-origin cookies and do not receive
an `Authorization` header from the browser. The final hardening step is to move
all protected reads and uploads behind same-origin server endpoints, then stop
returning an access token to the browser entirely.
