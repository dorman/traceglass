# Tests

The checked-in unit and contract suite runs with Vitest in jsdom:

```bash
npm run test
```

Page fixtures preserve the invariants of managed content: section IDs and
ordering, visual asset references and metadata, links, SEO metadata, structured
component values, and unknown passthrough keys. Rich-text tests use the same
allowlisted document model as the admin editor and public renderer.

The rich-text unit regression parses Enter-created contenteditable blocks,
including an empty block, and checks that parsing and editable-HTML serialization
preserve every line. The owner Manage Pages journey types into both the legacy
body fallback and a section body at desktop and mobile widths, verifies focus
and visible text after Enter, checks that a failed save retains the draft, then
checks the successful save in the disposable database and after reload.

The platform browser harness runs the full journeys against a disposable
database. `.env.test` contains synthetic Better Auth credentials and points the
email transport at a captured-mail fixture; the harness supplies `BASE_URL`,
`DATABASE_URL`, `PORT`, and the configured `POLSIA_OWNER_EMAIL`. The email
fixture in `tests/e2e/support/email-proxy.ts` listens on loopback port `43987`.
It captures verification and password-reset links, dashboard submission
requests, and company-inbox fallback messages. Its one-request controls can
return `recorded: false`, fail submission intake, or fail email delivery so
browser tests exercise the fail-open paths without contacting an external mail
service.

The Playwright owner fixture uses the configured owner identity only in the
disposable database. It creates the account through public signup if needed,
sets a synthetic password through Better Auth's public recovery flow, and
completes verification through a captured verification link. It never uses a
production password. The recovery journey compares known and unknown address
guidance, checks mail delivery failure behavior, expires and consumes reset
tokens, verifies session revocation, and exercises anonymous, unverified-owner,
and non-owner editor denials. The Manage Pages access journey begins signed out,
follows the return-aware sign-in link, verifies the owner can edit a fixture page,
and confirms anonymous and non-owner reads and writes remain denied without
persisting unauthorized content. It also checks the access card and sign-in form
at desktop and narrow mobile widths. The unverified-owner journey pins the
in-app verification step the denial card mounts: while the configured owner's
email is unverified the API stays denied (403), the card separates the
"not verified" cause from the strict non-owner denial (and surfaces the resend
failure state), and following the resent emailed link restores full
`/admin/pages` access end to end. The non-owner denial is asserted against a
verified account — the strongest form of the owner-only restriction — after
completing the sign-up verification email. Better Auth throttles /sign-in/*
endpoints at 3 requests per rolling 10 seconds, so the owner journeys pace
their sign-in-heavy phases with a short window wait (the same pattern as the
recovery journey's 60s wait). The site-design journey checks
appearance preview/save plus page section add/remove/reorder, draft preview,
publish, and responsive columns.

The site-design browser checks also confirm the shared TraceGlass logo loads on
`/` and `/install` at desktop and 375px mobile widths without horizontal
overflow.

The marketing content-removal journey opens `/`, `/release`, and `/waitlist` at
1280px and 375px. It checks that home/release no longer contain pricing or
billing-card sections, `/release` keeps its `Notify me` link, and the waitlist
states that the paid plan is planned but unavailable, shows no price or
subscription CTA, and explains that signup does not start a subscription. It
also checks that `/billing`, `/pricing`, `/pages/billing`, and
`/api/pages/billing` are unavailable and that the disposable database has the
cleaned home/release content and no published legacy billing row.

The same journey submits the real `/waitlist` form through `/api/waitlist` with
synthetic addresses. It checks malformed email and missing consent inline
errors, the successful database write and dashboard submission (including its
row idempotency key), and the duplicate-email 409 response. It then simulates
`recorded: false`, a dashboard submission failure, and a fallback email failure;
each successful signup remains persisted and returns success. Synthetic rows
are deleted during cleanup. No existing account or customer data is read, and
the local fixture stands in for external Polsia submission and email delivery.

Run the complete disposable database, app server, unit, and browser setup with:

```bash
bash .agents/verify.sh
```

Run `npm run test:e2e` only when the app is already running at `BASE_URL` and its
email proxy points to the captured-mail fixture. The independent platform
browser checks also cover multi-section editing, rich-text formatting, draft
preview, publish promotion, canonical public rendering, duplicate slugs,
malformed content, narrow mobile layout, keyboard focus, asset loading, and
overflow.
