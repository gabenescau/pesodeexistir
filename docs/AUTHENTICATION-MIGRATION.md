# Authentication Migration

## Objective

Remove persistent Supabase tokens from the browser without breaking the
existing Vite SPA while the protected data layer is migrated safely.

## Current state

- `localStorage` and `sessionStorage` are no longer used by Supabase Auth.
- `/api/auth?action=login|signup|session|resend|update-user|logout` is the
  same-origin authentication boundary.
- Production cookies use `__Host-ope_access` and `__Host-ope_refresh` with
  `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and bounded lifetimes.
- The refresh token never reaches browser JavaScript.
- API requests use `credentials: include`; protected APIs accept the cookie
  session and refresh it when an access cookie expires.
- Login, signup and resend are rate limited server-side.
- State-changing auth requests require the same-origin `X-Requested-With:
  OPE-Auth` header in addition to the origin check.
- The access token is currently returned by the session bridge and held only in
  JavaScript memory because legacy direct Supabase RLS reads still exist.
- Profile loading and profile metadata updates now go through the authenticated
  BFF action `profile` / `update-profile`; role, credits and internal columns
  are never accepted from the browser.
- Public books, authors, releases, categories and aggregate ratings now go
  through the BFF action `catalog`; cover URLs are signed server-side and the
  action is rate limited with a short public cache.
- The regular community feed now goes through the BFF action `community`;
  post images are signed server-side and other users' IDs are not returned in
  like or poll-vote rows. Admin feed loading remains separate for moderation.
- Reading progress now goes through the authenticated BFF action `reading`;
  the server derives the owner from the HttpOnly session, validates the book
  and page bounds, and performs the unique user/book upsert server-side.
- Wallet state, missions, reward RPCs, store catalog and personal redemptions
  now go through `wallet`, `reward`, `store` and `redemptions`; reward actors
  are derived from the cookie session and redemption queries are owner-scoped.
- The regular user's subscription list now goes through the authenticated
  `subscription` action; the server derives the owner from the HttpOnly
  session and returns only billing fields needed by the app. Admin subscription
  management remains on its separately authorized admin endpoints.
- Upload authorization now starts at `upload-ticket`; the BFF validates the
  authenticated user, role, bucket, MIME type, filename and size. The browser
  sends a five-minute HMAC ticket to `secure-upload` instead of a Supabase
  bearer token. File deletion also goes through `upload-delete` with ownership
  or admin/editor checks on the server.

## Why this is staged

The app still has direct browser calls to Supabase tables, Storage and some
Functions. Removing the access token immediately would make those calls lose
authentication and break community, reading, profile and upload flows. A
JavaScript-created cookie cannot be marked HttpOnly, so the safe migration is
to move each protected read/write behind a same-origin server endpoint.

## Next phase: complete the BFF

1. Inventory and group the remaining protected reads/writes by domain: admin
   operations and legacy direct Supabase reads. Profile, public catalog, regular community feed,
   reading progress, rewards, store, subscriber billing reads and upload
   authorization are now migrated through the BFF. The Edge Function still
   needs the same `UPLOAD_TICKET_SECRET` configured in Vercel and Supabase.

### Upload deployment requirement

Generate one random secret of at least 32 characters and configure the exact
same value in both places:

- Vercel Production: `UPLOAD_TICKET_SECRET`
- Supabase Edge Function secret: `UPLOAD_TICKET_SECRET`

Then deploy the updated function from the repository root:

```bash
supabase functions deploy secure-upload --no-verify-jwt
```

The client no longer sends a Supabase bearer token to this function. Do not
put this secret in `VITE_*`, `NEXT_PUBLIC_*`, Git, or the browser.
2. Add server endpoints that validate the cookie session and apply ownership,
   role, entitlement, pagination and rate-limit checks.
3. Replace the matching client `.from`, `.rpc`, `.storage` and `.functions`
   calls with those endpoints.
4. Add integration tests for anonymous, authenticated, wrong-owner, expired
   session and admin-only cases.
5. Remove `accessToken` from `/api/auth?action=session` and delete the
   in-memory bridge from `src/app/data/supabase.js`.

## Acceptance criteria

- No auth token appears in browser storage, URL, HTML, logs or API payloads
  returned to the browser.
- A script running on the origin cannot call Supabase directly with a session
  token because no token is exposed to it.
- Every protected operation still works after refresh and access-cookie renewal.
- RLS remains enabled as a database backstop; it is not replaced by frontend
  checks.
- No new Vercel Function is added without checking the Hobby plan limit.

## Residual risk

Until the next phase is complete, a successful XSS during the current page
lifetime could operate through legacy authenticated client calls even though it
cannot read a persisted or refresh token. Content sanitization, CSP, strict
input validation and the staged BFF migration remain required defenses.
