# GAYNAV — Feature backlog (not MVP)

This file holds candidate features that are **not** part of the current MVP build in `CLAUDE.md`. It exists for the owner and team to review and prioritize. Claude Code must not build anything from this file on its own initiative.

**Promotion rule:** when the team decides an item should be built, cut it from here and paste it as an unchecked `- [ ] Feature:` line into the right Phase/Epic in `CLAUDE.md`. This can be done by hand, or by Claude Code when explicitly asked ("promote X to Epic Y"). One-directional — nothing here needs to stay in sync with what's already built, and built features are tracked in `CLAUDE.md`, not here.

Items below were found by reviewing the existing my.gaynav.com hotel search flow (30 Sep 2026), to check what real functionality the rebuild might otherwise miss.

## Booking flexibility

- **Multi-room booking.** The current site lets a traveler add multiple rooms to one search, each with its own adult/child count ("Add room"). The MVP backlog assumes a single room/guest count. Promote when: group or family bookings turn out to be common enough to matter before a later phase.
- **Booking lookup without an account.** The current site has a "reservation number + last name" lookup for guests who didn't create an account. The MVP backlog only supports viewing bookings while logged in. Promote when: guest checkout (booking without requiring an account) becomes a priority.
- **"On request" room status.** Not every room on the current site confirms instantly — some are marked "On Request" and need hotel confirmation before they're final. The MVP booking flow currently assumes a simple confirmed/failed outcome. Promote when: RateHawk's actual sandbox responses show on-request inventory mixed in with instant-confirm inventory (check this during Phase 3 — it may turn out to be unavoidable rather than optional).

## Search and filtering

- **User-selectable currency.** The current site has a EUR/USD/AUD/GBP switcher. The MVP backlog only commits to picking one fixed display currency. Promote when: international travelers who'd expect to see prices in their own currency are a meaningful share of the audience.
- **Extra search filters:** star rating, meal type (e.g. room only vs. breakfast included), citizenship/nationality (affects pricing in some markets), promo code field, "only show available" toggle. None of these are in the MVP search epic. Promote individually as they become relevant — citizenship-based pricing in particular may only matter once there's real booking volume from multiple countries.

## Trust and discovery

- **Interactive map with nearby points of interest**, plus a "show all hotels on the map" toggle. The MVP detail page only plans a simple location display. Promote when: the design pass (Phase 5) has budget to spare, or user feedback specifically asks for it.
- **Per-room cancellation policy shown inline**, next to each room's price (not just a general policy page). The MVP backlog doesn't break this out per room. Promote when: building Epic 4.3 (cancellation flow) — worth reconsidering together at that point rather than fully separately.

## Administration

- **Staff can change a user's role from within the app** (for example promoting a traveler to partner). Today roles change only through server-side admin tooling, by design (see Decisions #1 in `CLAUDE.md`). Promote when: the partner role is actually used (villa/apartment hosts, Connections) and manual admin changes become a bottleneck. It must be built deliberately, with `aal2` enforcement and an audit log entry for every change.

## Content and onboarding (from the rebuilt gaynav.com, 12 Oct 2026)

- **Insiders news feed.** The current site has a news feed with 3 categories, views, author, sharing and source attribution ("Adapted from…" external sources, so check copyright before reusing content). Promote when: the hotel core is live and content is wanted for SEO and engagement.
- **Provider sign-up and onboarding.** The current site has separate Customer and Provider accounts. Maps to the `partner` role. Promote together with the partner/villa phase.
- **Destination guides** (LGBTQ+ rights and safety per country/city), **LGBTQ+ traveler reviews**, **community and meet-ups**, **curated queer experiences.** Promised on the About page; they belong to the later Reviews, Connections, Listings and Journeys phases.
- **Redirects from old gaynav.com / my.gaynav.com URLs** to their new equivalents at go-live, to keep SEO and bookmarks working. Promote at Phase 5 launch readiness.

## Personalization (already flagged as deferred in CLAUDE.md)

- Favoriting/saving properties — confirmed present on the existing site, so this is a real gap, not a hypothetical one.
- Multi-language interface.
- Personalized recommendations.
