# GAYNAV — CLAUDE.md

This file orients Claude Code on every session in this repository. Read it in full before making changes. It reflects the architecture and build plan agreed with the owner (see `GAYNAV_Greenfield_Architecture_Plan_v6.docx` if present in the repo's `/docs` folder).

## Status

*Claude Code: keep this block current. Update it whenever you check off a feature or move to a new phase — it's the fastest way for a human to see where the product stands without reading the whole file.*

- **Current phase:** 2 — Public search and listing pages (against mock data). Phase 1 complete and reviewed by the owner 2026-10-12.
- **Last updated:** 2026-10-12
- **Next up:** Epic 2.1 — server-side enforcement test (unapproved or suspended never in results). Phase 2 build order (owner left it to Claude, 2026-10-12): finish 2.1 → 2.2 detail page → 2.5 homepage & city pages → 2.6 light design round → 2.3 SEO → 2.4 trust page.

## Session protocol

*Follow this at the start and end of every session — this is what keeps this file a reliable source of truth instead of a stale plan.*

1. **At the start of a session:** read the Status block above, then scan the Build phases section top to bottom for the first unchecked (`- [ ]`) feature. That is the default next task, unless the human explicitly asks for something else. Don't skip ahead to a later phase's features even if they look easy — the phase order encodes real dependencies (e.g. don't build the booking flow before the whitelist logic exists).
2. **When a feature is genuinely done** (meets the Definition of Done below, and its PR is opened — or merged, depending on the review policy for that phase): check its box, and append a short note on the same line: `— done YYYY-MM-DD, PR #N`. Do not check a box for work that's started but not finished.
3. **When an epic's features are all checked**, you may note the epic as complete, but don't invent extra ceremony — the checkboxes are the source of truth.
4. **Update the Status block's "Current phase" and "Next up" fields** whenever they change.
5. **If you discover a feature is missing** (needed but not listed), first check `FEATURE_BACKLOG.md`. If it's already there, do not build it and do not move it — tell the human and let them decide. If it isn't there either, add it to the relevant epic here with an unchecked box and a one-line note on why, rather than silently building something that isn't tracked.
6. **`FEATURE_BACKLOG.md` holds non-MVP candidates. Never build from it on your own initiative.** Only when the human explicitly asks you to promote an item ("promote X to Epic Y"): cut it from the backlog, paste it into the named epic in this file as an unchecked `- [ ] Feature:` line (keeping its description and any "promote when" context), and confirm what you moved. After that it's tracked and built like any other feature. Do not otherwise edit, reorder, or delete backlog items.

## What this project is

GAYNAV is an LGBTQ+ travel platform being rebuilt from scratch, replacing an old vendor system (my.gaynav.com / GP Solutions) that offered no API access and no visibility into where guest data lived. The MVP scope for this repository is the **hotel booking core**: a curated hotel search and booking experience, sourced from RateHawk (a wholesale hotel bedbank), gatekept by GAYNAV's own vetting process. Villas, Connections, Forums, Reviews, Listings, Employment and Journeys are later phases, out of scope until the hotel core is live — do not build toward them unless explicitly asked.

**One site, one codebase.** This app replaces both the gaynav.com marketing site and the my.gaynav.com booking engine (owner decision 2026-10-12). Homepage, city pages, trust/about pages, search, property pages and booking all live in this one Next.js app on one domain, with one account system. Do not build a separate marketing site, and do not hand off to any external booking engine.

## Non-negotiable architecture principles

- **Whitelist-first curation.** The public site never queries RateHawk's open catalogue directly. Every search or listing query is filtered server-side against GAYNAV's own `approved_properties` table before RateHawk is asked for live rates/availability. A property only becomes visible after a staff member approves it — never automatically.
- **B2B model with GAYNAV-collected payment.** GAYNAV requires full control over which properties are shown, which only the B2B API (not the Affiliate API) supports — this is a hard requirement, not a preference. Under B2B, RateHawk's `payment_type: deposit` applies: GAYNAV collects payment from the traveler itself (via Stripe, consistent with how the current my.gaynav.com site already does this) and RateHawk deducts the net cost from a pre-funded deposit/credit balance. GAYNAV still never stores raw card data itself — Stripe Elements/Checkout handles that — but the payment collection step is GAYNAV's own, not a redirect into a RateHawk-hosted checkout. Confirm this precisely with RateHawk during contracting, but treat it as the working assumption for Phase 4 rather than an open question.
- **AI reads, a human decides.** The Claude API may generate evidence-pack summaries (reviews, policies, press) for a candidate property. It never auto-approves a listing. Every approval/rejection is a logged, human, staff-role action.
- **Secrets are server-side only.** RateHawk credentials, the Supabase service-role key, and the Claude API key live in environment variables on the hosting platform. Never in client-side code, never committed to the repo, never logged.
- **Security enforcement lives in the database, not the UI.** Supabase row-level security policies are the real access boundary. Hiding a button or route in the frontend is a convenience, never a substitute for an RLS policy.
- **Staff accounts require 2FA, no exceptions.** No self-signup path to the staff role.
- **Browsing never requires an account.** The traveler-facing site is public. An anonymous visitor (not signed in) can search, view property pages, and read the trust page, with no login prompt and no redirect to a login page. Only these are protected: staff routes (workbench, audit log), account pages, and the booking step. A traveler is asked to sign in or create an account only when they start a booking, and then returns straight to that booking (owner decision 2026-10-12, see Epic 4.1). Implementation consequences: (1) the database's anonymous role (`anon`) needs read access to the public fields of `approved` properties and nothing else — no suspended hotels, no `approved_by`, no staff-only tables; (2) public routes must not sit behind auth middleware; (3) the traveler sign-up and sign-in pages exist but must never gate public pages. Staff-only protections are unchanged by this rule.

## Decisions from the Epic 0.2 review (2026-10-12)

*These came out of the dedicated review of the schema and RLS policies (PRs #3-#5). Treat them as binding rules for everything built afterwards.*

1. **Roles never change through the app.** Not even staff can change a user's role. Roles change only through server-side admin tooling (Supabase dashboard/SQL, or a service-role script run by a human), documented in the README (Epic 0.5). A staff-driven role change would be a separate, deliberate feature (see `FEATURE_BACKLOG.md`); never add one as a side effect of another feature.
2. **Staff powers require a 2FA session, enforced in the database.** RLS grants staff privileges only when the session's authentication assurance level is `aal2`. A staff user with only a password session is treated as an ordinary signed-in user. Consequence: the app must let staff enroll and complete 2FA (Epic 0.3), and there must be a documented recovery path for a lost authenticator (a human resets the factor through admin tooling — never a self-service bypass).
3. **Hotels are suspended, never deleted.** `approved_properties` rows carry a status (`approved` / `suspended`). Pulling a hotel sets it to suspended; the row and its approval record stay. Every public query, and the whitelist enforcement test, must treat suspended exactly like unapproved. Reactivating is a logged staff action and keeps the original approval history.
4. **Staff who have approved hotels cannot be deleted.** An approval record must always resolve to a real account. Offboarding staff means removing the staff role through admin tooling (and disabling the login if needed), never deleting the account. Traveler deletion requests (Epic 5.4) are handled by anonymising the account where retained records reference it, not by hard delete.
5. **Who approved a hotel is not readable through public data.** `approved_by` is stored but not exposed to travelers or through public queries. Staff see who did what only in the audit log (Epic 1.4), which is staff-only and append-only.
6. **Public data and staff-only data live in separate tables.** Travelers and staff share one database role, so any column on a table travelers can read is readable by every signed-in traveler. Tables travelers can see (e.g. `approved_properties`) therefore hold only public fields. Staff notes, AI evidence packs, candidate data, and vetting details go in their own staff-only tables with their own RLS. The staff notes column was removed from `approved_properties` for this reason; create a staff-only notes table when a feature needs one. The public "vetting summary" on a property page is a separate, short, staff-approved text — never the raw AI evidence pack.

## Tech stack

- Frontend + backend: Next.js (React)
- Database, auth, storage: Supabase (Postgres, Supabase Auth with roles: traveler / partner / staff)
- Hosting/deploy: Vercel
- AI: Claude API for evidence-pack generation (server-side calls only)
- Hotel supply: RateHawk REST API (JSON)

## Workflow expectations

- Work in feature branches, never commit directly to `main`.
- Open a pull request for every change, however small. Include a short description of what changed and why.
- Every PR should be reviewable in isolation — keep PRs scoped to one feature where possible, not sprawling across several at once.
- Assume PRs get a Vercel preview deployment and a Supabase preview branch automatically (once those integrations are connected) — write code that works cleanly in an isolated preview environment, not one that assumes it's always talking to production data.
- Write tests for logic that matters (whitelist filtering, evidence-pack approval state transitions, booking error handling) — not just for coverage's sake.

**Definition of done, for any feature:** builds without errors, has a passing test for its core logic where that applies, runs cleanly in its own preview deployment, and does not introduce a new dependency without a one-line reason in the PR description. A feature that only "looks right in the screenshot" is not done.

**Review policy (changes by phase):**
- **Phases 0–2** (built against mock data, no real user or booking data involved): a human does not need to review every individual PR. Instead, there is one review checkpoint at the end of each phase, covering all PRs merged in that phase before moving to the next one. Exception: the database schema and RLS policies in Phase 0 should still get a dedicated review before anything is built on top of them — that foundation is expensive to unwind later.
- **From Phase 3 onward** (real RateHawk data, and from Phase 4, real bookings): every PR requires human review and approval before merge, no exceptions. Do not merge your own PRs from this point on.

## Design direction

Follow the visual direction of the existing gaynav.com site where reasonably possible — colors, typography, general tone — so the rebuilt product doesn't feel disconnected from the brand. This is a soft guideline, not a blocker: prioritize working functionality over pixel-perfect styling. A light design round happens right after the public pages exist (Epic 2.6, so the owner can see a branded demo); final polish and the mobile check stay in Phase 5.

**Brand tokens read from the live gaynav.com on 2026-10-12** (use these; don't guess):
- Font: **Lexend Deca** (Google Fonts, variable weight 100–900). Headings are light (weight 300) on the hero; body is regular.
- Primary pink scale: 900 `#58032c`, 800 `#7d073f`, 700 `#a70a55`, 600 `#c60a66`, **500 `#e40d75` (main brand color, primary buttons)**, 400 `#f04395`, 300 `#f882b7`, 200 `#fcc2db`, 100 `#fde8f1`.
- Page background white `#fff`, text `#171717`.
- Shapes: primary buttons are `#e40d75` with white text; header/login buttons use an 8px radius, hero and call-to-action buttons are fully rounded (pill). Secondary buttons on photos are translucent white/black with a pill shape.
- Look and feel: full-width photo hero with a light-weight white headline, rounded cards, lots of white space.
- Logo: `https://gaynav.com/logo/gaynav-gn.png` (small mark) and the favicon at `https://gaynav.com/icon.png`. Ask the owner for the full-resolution logo files (SVG preferred) before launch; use these as placeholders until then.
- Put these in one place (CSS variables / Tailwind theme), never as scattered hex values.

## Open items — needed before certain phases can proceed

- **RateHawk API credentials.** Not yet available at the start of this build. Phases 0–2 should be built against a realistic dummy/mock dataset that mirrors RateHawk's expected response shape (property ID, name, location, photos, amenities, live rate/availability). Phase 3 swaps the mock data source for the real RateHawk client once credentials exist — the whitelist-filtering and UI logic should not need to change, only the data-fetching layer.
- **Supabase project + Vercel project**, connected to this GitHub repo, with the GitHub integration enabled on both so PRs get preview environments automatically.
- **Brand assets.** Colors and font are already captured from the live gaynav.com (see Design direction). Still needed from the owner: the full-resolution logo (SVG preferred) and any brand guidelines; not blocking Epic 2.6.
- **A decision on RateHawk account ownership** (GAYNAV's own API key vs. routed through GP Solutions) — does not block starting the build against mock data, but blocks Phase 3.
- **Confirmation of the RateHawk contract/payment type (verify before Phase 4, but working assumption is set).** GAYNAV requires B2B (for full catalogue control), which uses `payment_type: deposit` — GAYNAV collects payment from the traveler (via Stripe) and RateHawk deducts the net cost from a pre-funded deposit/credit balance. The current my.gaynav.com site already works this way, which supports this being the correct model — but that setup (Stripe account, RateHawk deposit/credit relationship) belongs to GP Solutions, not GAYNAV. None of it carries over automatically: GAYNAV needs its own Stripe account and its own funded deposit/credit line with RateHawk, set up from scratch as part of Phase 3/4, not inherited or reused from the current platform. Still get the payment model in writing from RateHawk during contracting/certification, but Epic 4.1 can be built against this assumption rather than waiting.
- **IP whitelisting.** RateHawk requires the production server's IP address(es) to be whitelisted before the API will respond. Get this sorted early in Phase 3, not discovered as a blocker mid-build.
- **RateHawk partner certification.** Before production access, RateHawk requires reviewing and approving the integration's workflow against their expected pattern. Budget time for this between Phase 3 and go-live — it is not a formality that can be skipped.

If any of the above is missing when a phase needs it, stop and ask rather than guessing or hardcoding a placeholder that looks like a real credential.

## Build phases

Work through these in order. Each phase should end in a working, reviewable PR (or a small handful of PRs) — not one giant PR spanning multiple phases.

Each phase below is broken into epics, and each epic into features — build and PR one feature at a time, not a whole epic in one go. Every feature is a checkbox: leave it unchecked until it's genuinely done (see Definition of Done and Session protocol above).

### Phase 0 — Foundation
Next.js project scaffold. Supabase schema, RLS, auth. Deployed to Vercel with a working "hello world" page behind auth.

**Epic 0.1 — Project scaffold**
- [x] Feature: initialize Next.js app, folder structure, linting/formatting config — done 2026-10-12, PR #1
- [x] Feature: connect repo to Vercel, confirm a basic page deploys successfully — done 2026-10-12, PR #2

**Epic 0.2 — Database schema & access control**
- [x] Feature: `users` table with role column (traveler / partner / staff) — done 2026-10-12, PR #3
- [x] Feature: `approved_properties` table (the whitelist) — done 2026-10-12, PR #4
- [x] Feature: RLS policies enforcing role-based access on both tables — this is the dedicated-review exception noted above — done 2026-10-12, PR #5
- [ ] Feature: verify that an anonymous visitor (not signed in) can read the public fields of `approved` properties, and nothing else (see "Browsing never requires an account"). If the current policies only allow signed-in users, fix them. Add tests for the anonymous case: can read an approved property's public fields; cannot read suspended properties, `approved_by`, staff-only tables, or the `users` table. Added 2026-10-12 after Phase 0 finished; because this touches RLS, it needs a short dedicated human review like the rest of Epic 0.2. Do this before continuing with Phase 1

**Epic 0.3 — Authentication**
- [x] Feature: Supabase Auth wired up (sign up, sign in, session handling) — done 2026-10-12, PR #7
- [x] Feature: role assignment on account creation (new accounts are always travelers; staff accounts are provisioned manually through admin tooling, never via self-signup or from within the app — see Decisions #1) — done 2026-10-12, PR #8
- [x] Feature: mandatory 2FA enforcement specifically for the staff role, enforced in RLS at `aal2` (see Decisions #2). Includes the staff flow to enroll a TOTP factor and step up to an `aal2` session, a test proving a staff user without `aal2` gets no staff powers, and a documented lost-authenticator recovery path — done 2026-10-12, PR #9

**Epic 0.4 — CI/CD and environments**
- [x] Feature: GitHub Actions workflow running lint + tests on every PR — done 2026-10-12, PR #10
- [x] Feature: branch protection on `main` requiring the checks above to pass (and, from Phase 3 on, requiring human approval — see Review policy) — done 2026-10-12, PR #11 (approval requirement to be raised to 1 at the start of Phase 3)
- [ ] Feature: Supabase GitHub integration enabled so every PR gets its own preview database branch, not just a preview frontend — ⏸ deferred by the owner on 2026-10-12: needs the Supabase Pro plan; the prototype runs on the free plan. Meanwhile each PR is tested against a throwaway local Supabase stack in CI.
- [x] Feature: a basic test framework in place (e.g. Vitest) with one real test, so later features have a pattern to follow rather than inventing one each time — done 2026-10-12, PR #12

**Epic 0.5 — Config and secrets**
- [x] Feature: `.env.example` documenting every required environment variable (without real values), kept up to date as new integrations are added — done 2026-10-12, PR #13 (kept in sync by a test)
- [x] Feature: a short README section on how to get a local dev environment running against a Supabase preview branch — done 2026-10-12, PR #14 (written for the local Docker Supabase stack, since preview branches are deferred with the free plan; update when Branching is enabled)
- [x] Feature: a README admin runbook for the things the app deliberately cannot do: creating the first staff account, promoting or demoting a role, offboarding a staff member (remove the role, disable the login, never delete), and resetting a staff member's lost 2FA factor (see Decisions #1, #2, #4) — done 2026-10-12, PR #15

### Phase 1 — Curation workbench (against mock data)
**Epic 1.1 — Mock candidate data**
- [x] Feature: `candidate_properties` JSON fixture shaped like an expected RateHawk response (property id, name, location, photos, amenities, rate/availability) — done 2026-10-12, PR #16
- [x] Feature: align the fixture with the launch cities (owner decision 2026-10-12): London, Rome, Paris, Tokyo, Ho Chi Minh City, Bangkok — the six cities gaynav.com already features as "City curations". Replace any other pilot cities (e.g. Bali, Amsterdam, Barcelona) in the fixture, docs and tests — done 2026-10-12, PR #20

**Epic 1.2 — AI evidence-pack generation**
- [x] Feature: server-side Claude API call that produces a structured, cited summary (reviews, policies, press) from a candidate's mock data. Candidates and their evidence packs are stored in staff-only tables, never on a table travelers can read (see Decisions #6) — built 2026-10-12, PR #17; verified live 2026-10-12 (claude-opus-5-5; two mock hotels, citations checked)
- [x] Feature: error handling for a failed or incomplete AI response — never silently show a blank or fabricated summary — built 2026-10-12, PR #21; verified 2026-10-12 (missing-key path shown in the UI; live calls succeed)

**Epic 1.3 — Staff review UI**
- [x] Feature: staff-only candidate list view (behind 2FA) — done 2026-10-12, PR #22
- [x] Feature: candidate detail view showing the evidence-pack summary — done 2026-10-12, PR #23
- [x] Feature: approve / reject actions, writing approved candidates into `approved_properties`. On approval, staff also write the short public vetting summary (a separate field from the AI evidence pack, see Decisions #6) — done 2026-10-12, PR #24. Owner rules (2026-10-12): rejection reason optional; approving without an evidence pack needs a staff note; approving when the pack lists concerns needs an explicit acknowledgement and a note; a rejected hotel can be re-reviewed any time. All enforced in the database.
- [ ] Feature: suspend and reactivate actions for an approved hotel (never delete, see Decisions #3), each with a required reason

**Epic 1.4 — Audit logging**
- [x] Feature: every staff approve, reject, suspend and reactivate action logged with who, what, when, and the reason. The audit log table is append-only (no app role can update or delete rows) and readable by `aal2` staff only — done 2026-10-12, PR #24 (`vetting_decisions`; every decision is a logged row, the database then changes the whitelist; admin-SQL status changes are logged too)
- [x] Feature: a staff-only audit log view. This is the only place `approved_by` and similar "who did it" information is visible (see Decisions #5) — done 2026-10-12, PR #25 (`/staff/audit`; staff display names set by admins via `admin.set_display_name`)

### Phase 2 — Public search and listing pages (against mock data)
**Epic 2.1 — Search**
- [x] Feature: public search page querying only `approved_properties`, joined with mock rate/availability data — done 2026-10-12, PR #27
- [x] Feature: date range and guest count as required search inputs — RateHawk cannot return real availability/pricing without them, so the UI shouldn't let a search happen without them either — done 2026-10-12, PR #29 (one room, 1–6 adults, up to 30 nights; children's ages and `residency` come with the real RateHawk search in Phase 3)
- [x] Feature: empty-state messaging for a search with zero approved properties (expected and common at launch, given the deliberately small, hand-picked catalogue — this must not look like a broken page) — done 2026-10-12, PR #31
- [ ] Feature: server-side enforcement test proving an unapproved or suspended property can never appear in results
- [ ] Feature: test that the whole public flow works with no session at all: an anonymous visitor can run a search and open a property page, with no redirect to a login page and no staff-only data in the response

**Epic 2.2 — Property detail page**
- [ ] Feature: detail page with photos, amenities, the public vetting summary (the staff-approved text, never the raw AI evidence pack), and a "Check availability" call to action (no real booking yet)

**Epic 2.3 — SEO foundations**
- [ ] Feature: server-rendered metadata (title, description, Open Graph tags) per property and search page — organic search is called out as a core growth channel in the business plan, and this is much cheaper to build in from the start than to retrofit later

**Epic 2.4 — Trust page**
- [ ] Feature: a public page explaining the vetting process in plain language (why every property is reviewed, what disqualifies one) — this is the core brand promise and costs little to build, but was missing from the original phase plan

**Epic 2.5 — Homepage and city pages**
*This app replaces gaynav.com entirely (owner decision 2026-10-12), so the public entry points of the current site are rebuilt here. Accounts are this app's own — no combined login with the old site.*
- [ ] Feature: homepage with a hero, a search box, and "City curations" cards for the six launch cities, each linking to a city page (replaces the current deep links into my.gaynav.com search)
- [ ] Feature: city page per launch city showing only approved properties for that city, server-rendered with its own metadata (SEO)
- [ ] Feature: About, Privacy and Terms pages (placeholder text where legal copy isn't final, flagged clearly). The Insiders news feed is NOT part of the MVP (see `FEATURE_BACKLOG.md`)

**Epic 2.6 — Light design round (owner demo)**
*Goal: the owner can open the preview and see something that feels like GAYNAV, not a bare prototype. Uses the brand tokens in "Design direction". Not a full polish pass — that stays in Phase 5.*
- [ ] Feature: design tokens (Lexend Deca, the pink scale, radii, spacing) in a single theme file, plus a shared header (logo, nav, login) and footer used by every public page
- [ ] Feature: style the homepage with a photo hero, the search box and the six city cards in the gaynav.com look
- [ ] Feature: style the search results page, hotel cards and the property detail page; responsive down to phone width (basic layout only — the full mobile check stays in Phase 5)
- [ ] Feature: style the trust page, the sign-in/sign-up pages and the staff workbench lightly (consistent fonts and colors, no redesign)

**Deferred, deliberately out of MVP scope:** favoriting/saved properties, multi-language UI, personalized recommendations. Not forgotten — reviewed and postponed past MVP.

### Phase 3 — Real RateHawk integration
Depends on RateHawk credentials being available — flag and pause if they aren't yet. Before building Epic 3.1, check RateHawk's actual API docs for whether booking status updates arrive via webhook or must be polled — this plan assumes polling but should not be built blind to the alternative.

**Epic 3.1 — RateHawk API client**
- [ ] Feature: authenticated client for RateHawk's sandbox API (search, availability), using the `hid` field (not `id`) as the stable hotel identifier for all internal references, per RateHawk's own mapping guidance
- [ ] Feature: error handling and rate-limit handling
- [ ] Feature: do not cache live search/rate responses — RateHawk's own guidance prohibits caching hotelpage and prebook responses, and discourages caching search results generally

**Epic 3.2 — Hotel static data ingestion**
*Replaces a simpler "candidate pull" assumption: RateHawk expects partners to bulk-download and store hotel content, not fetch it live per request.*
- [ ] Feature: job to retrieve RateHawk's full hotel data dump (updated weekly) and store it — name, address, photos, amenities, `metapolicy_struct`/`metapolicy_extra_info` (house rules, extra fees, ID requirements)
- [ ] Feature: job to retrieve the daily incremental dump and apply updates, so static content doesn't go stale
- [ ] Feature: candidate selection for the launch cities (London, Rome, Paris, Tokyo, Ho Chi Minh City, Bangkok) pulled from this locally-stored static data, replacing the Phase 1 mock fixture

**Epic 3.3 — Swap mock data for live data**
- [ ] Feature: search and detail pages read live rates/availability from RateHawk (joined with the locally-stored static content from Epic 3.2), filtered through the same whitelist logic from Phase 2 — this logic should not need to change, only its data source
- [ ] Feature: search requests include a `residency` (citizenship) parameter — required by RateHawk for accurate pricing, not optional. A single fixed default is acceptable for MVP; a user-facing selector can wait, but the parameter itself cannot be omitted or prices may be wrong at check-in.
- [ ] Feature: prebook step implemented between search and checkout — confirms the rate is still valid immediately before booking, and handles the case where the price changed

**Epic 3.4 — Pricing, taxes, and markup**
- [ ] Feature: a configurable markup (percentage or fixed) applied on top of RateHawk's net rate before it's shown publicly — keep this in one place (a config value or a small admin-editable setting), not hardcoded in multiple spots, since the actual markup percentage is still an open business decision
- [ ] Feature: document that Stripe's transaction fee (roughly 2.9% + a fixed amount per charge) is deducted from what GAYNAV receives, not shown separately to the traveler — it silently reduces GAYNAV's real margin unless the markup is set high enough to absorb it. This is a business-decision input, not something to hardcode, but the markup config above should be set with this in mind rather than discovered as a shortfall later.
- [ ] Feature: a decided and documented display currency (RateHawk supports multiple) — pick one consistent currency for MVP rather than leaving it to whatever the API happens to return
- [ ] Feature: taxes/fees not included in RateHawk's quoted price (`included_by_supplier: false`) are displayed to the traveler as a separate line item, never silently folded into or omitted from the total

### Phase 4 — Booking flow
From this phase on, every PR requires human review before merge (see Review policy above).

**Epic 4.1 — Checkout handoff**
*Scope note: this is a checkout UI that calls RateHawk's API to place a reservation — not a rebuild of a booking engine. RateHawk remains responsible for rates, inventory, and hotel contracts. Working assumption (see Open Items): GAYNAV collects payment itself via Stripe, matching the current site's pattern, rather than redirecting into a RateHawk-hosted checkout.*
- [ ] Feature: GAYNAV-built checkout form, using the confirmed prebook result from Epic 3.3. Browsing (search, property pages) never requires an account; sign-in or account creation is asked only when the traveler starts a booking, and they return straight to that booking afterwards (owner decision 2026-10-12)
- [ ] Feature: Stripe integration (Stripe Elements or Checkout) to collect the traveler's payment — GAYNAV never handles raw card data directly, Stripe does, but the checkout experience itself is GAYNAV's own
- [ ] Feature: the actual async booking sequence implemented as RateHawk specifies it — call `booking/form`, then `booking/finish`, then poll `booking/finish/status` (or use the booking-status webhook instead of polling — pick one, see Epic 4.2) — with the specific retry rules RateHawk documents (e.g. up to 10 retries on a 5xx/timeout before treating the booking as failed)
- [ ] Feature: sequencing logic between the Stripe charge and the RateHawk booking call — decide and implement which happens first, and how to handle the failure case where one succeeds and the other doesn't (e.g. payment captured but RateHawk booking fails — this needs a defined refund path, not an unhandled edge case)

**Epic 4.2 — Booking outcomes**
- [ ] Feature: decide webhook vs. polling for receiving final booking status, and implement it end to end — RateHawk supports both, but at least one is mandatory; webhook avoids maintaining a polling loop but requires a public endpoint RateHawk can reach
- [ ] Feature: transactional email service set up (e.g. Resend or Postmark) for booking confirmations — this is new infrastructure, not just a template
- [ ] Feature: booking confirmation screen and email
- [ ] Feature: graceful handling of failed/declined bookings, tested against real sandbox edge cases, mapped to RateHawk's documented failure errors (e.g. `soldout`, `3ds`, `book_limit`)
- [ ] Feature: a local booking record that only shows as confirmed after RateHawk's own `ok`/`confirmed` status is received — never mark a booking confirmed from a client-side response alone

**Epic 4.3 — Traveler booking history**
- [ ] Feature: a traveler can view their own past and upcoming bookings
- [ ] Feature: cancellation flow that parses and displays RateHawk's actual tiered cancellation policy (`cancellation_penalties.policies`) — free until a specific timestamp, partial penalty in a middle window, full penalty after — not a simple yes/no. Do not assume free cancellation by default.

### Phase 5 — Security hardening, design pass, soft launch prep
**Epic 5.1 — Security review**
- [ ] Feature: session policy and idle-timeout tuning (shorter for the staff/admin area)
- [ ] Feature: audit-log and staff permission layer review

**Epic 5.2 — Design pass**
- [ ] Feature: final polish of the gaynav.com brand direction across all pages (the main look is done in Epic 2.6): final logo files, imagery, microcopy and tone, booking and account pages
- [ ] Feature: mobile responsiveness check across search, detail, and booking pages — most travel searches happen on a phone, this is not optional polish

**Epic 5.3 — Launch readiness**
- [ ] Feature: terms-of-service and complaint-escalation copy in place (placeholder text acceptable if legal copy isn't finalized yet — flag it clearly as a placeholder)
- [ ] Feature: final checklist and small, hand-picked soft launch catalogue

**Epic 5.4 — Privacy basics**
- [ ] Feature: a traveler can request account deletion and a copy of their own data — required for real customer PII regardless of exact jurisdiction, and much easier to build now than to retrofit once there's live data to migrate. Where retained records (e.g. bookings, audit entries) reference the account, anonymise it instead of hard-deleting (see Decisions #4)
- [ ] Feature: a cookie consent banner — legally required once there are EU visitors (the launch cities include London, Rome and Paris)
- [ ] Feature: password reset flow tested end-to-end, not just assumed to work because Supabase provides it by default

**Epic 5.5 — Measuring whether the MVP is working**
- [ ] Feature: basic analytics wired up (page views, and the search-to-booking funnel specifically) — without this, the success metrics from the business plan (e.g. a target booking count in the first weeks) can't actually be evaluated
- [ ] Feature: error monitoring (e.g. Sentry free tier, or Vercel's own logging) in place before soft launch, not added reactively after the first bug report

## What not to do

- Don't build ahead into Villas, Connections, Forums, Reviews, Listings, Employment, or Journeys unless explicitly asked — they are later phases with different data models and are out of scope here.
- Don't build anything from `FEATURE_BACKLOG.md` unless the human has explicitly promoted it into this file first.
- Don't invent or hardcode fake RateHawk credentials that look real — use clearly-labeled mock data instead.
- Don't let the AI evidence-pack step auto-approve anything. It drafts; a human decides.
- Don't skip the "ask rather than guess" rule in the Open Items section above.
- Don't leave a checkbox unchecked-but-abandoned or checked-but-unfinished — an inaccurate Status block is worse than no Status block, because a human will trust it.
