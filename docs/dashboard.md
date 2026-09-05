# Timeline, languages, masked visitor labels and idle motion

This revision is incremental to the reviewed footprint branch at `d2c9d5f`. It retains the globe geography, B avatar generator, theme choice, page-category graph and existing 90-second online window.

## Visit timeline
The previous globe button only scrolled toward a sidebar; it did not explicitly open a timeline. Both globe and footprint buttons now invoke the same native modal dialog. The existing detail panel is moved, not duplicated, so its IDs, selection and live updates stay consistent. Escape or Close returns focus; fullscreen collapses before opening. If a visitor leaves while the dialog is open, the most recent recorded history remains readable and is marked offline. An empty history is stated explicitly. Demo mode is not a restriction on timelines. Recorded URLs remain literal text and are not translated.

## Chinese and English
`i18n.js` is a small source-message catalog. Default language follows browser preferences, with Chinese and English plus a Follow browser choice in the header. Explicit choices persist under `tidestat:language` and synchronize across tabs; restricted local storage does not prevent changing the current page. `?lang=en` / `?lang=zh` is a one-session override removed after an explicit picker choice. The application updates labels, live states, ARIA descriptions, timeline times, known demo cities, globe popups and footprint labels without rebuilding either scene or changing the B avatar mapping. Arbitrary user page paths and city names are not machine-translated.

## Masked IP labels and deployment
`privacy.js` validates IPv4 and IPv6. The collector derives the address only from Cloudflare's connecting-IP headers, masks it on the server, and stores only the masked display value (`203.*.*.42` or `2001:*:*:a01`). Client-supplied IP fields are ignored. Full source IP addresses are not added to the event table, returned by the live endpoint, or logged by this change. These shortened values are not unique, and are not a guarantee of legal anonymization. The existing anonymous visitor ID remains the internal selection key; different visitors sharing a masked label are not merged.

`schema.sql` adds an idempotent `visitor_display` table. The Worker deployment workflow applies it **before** publishing the new Worker. No tables are dropped, existing events are preserved, and old events without a display label show “IP unavailable.” The old deployment never stored IP addresses, so historical addresses cannot be reconstructed. Rolling back the Worker does not require dropping the additive table. The existing Cloudflare token needs D1 schema execution permission; deployment fails before publishing if that operation is not allowed. No production migration is executed by this PR's read-only review workflow.

Demo addresses are fabricated masked identifiers and explicitly labeled “Simulated IP.” They are never collected or mixed with live API data.

## Idle rotation
Both scenes share the preference `tidestat:idle-rotation`. After 12 seconds without pointer, wheel, keyboard or focus activity, the globe rotates gently at 0.45 degrees per second. The footprint orbit uses a similarly slow speed. Input interrupts immediately. Rotation also pauses for a selected visitor or open timeline, hidden/unfocused document, an offscreen globe, a zoomed-in globe, footprint overview/filter, compatibility mode or reduced-motion preference. The rotation control can disable it persistently. There is no time-based forced orbit while the user reads a selected visitor.

## Demo load
Demo now starts with 120 visitors, covering the existing city table. Each starts with several chronological page-category visits. The existing navigation simulation replenishes toward a gently changing target of 110–140, with a hard 150-entry cap including departing visitors. Counts can temporarily fluctuate with departures; this is illustrative traffic, not a claim about production concurrency. Real mode still reads only `/api/live`. Internal IDs and B avatar generation remain deterministic for each demo session.

## Validation
The review suite runs existing footprint/theme/avatar/globe/lifecycle regressions plus `tests/privacy.mjs` (actual SQLite-backed collection and aggregation with mocked edge requests) and `tests/dashboard.mjs` (browser languages, modal timeline, demo load and idle rotation). Browser tests use Chromium/SwiftShader and mocked live visitors, not production statistics. A passing local SQLite test is not a Cloudflare deployment test. Safari and physical devices are not covered.
