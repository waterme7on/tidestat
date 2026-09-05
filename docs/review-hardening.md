# Dashboard follow-up review

This revision is incremental to the reviewed PR #25 commit `685f7aedc11160d9e2a714fafcf115cc0e6a035a`. It keeps the approved globe, neighborhood, B avatars, themes, language preferences, masked identities, 90-second activity window and 120-person demo warm start.

## Same-area navigation
The live event feed now compares the observed URL, not only its page-category node. Moving from one writing article to another records a pageview without inventing a walk between identical visual locations. A repeated unchanged poll does not add another event; visiting an earlier URL again is a new event. The timeline continues to preserve literal URLs and their chronological records. The feed reflects observed changes between polls; it is not a lossless event export.

## Demo first destination
Warm-start readers now receive a next destination different from their current area, using the existing weighted graph. Their first movement no longer heads back to the same point. Demo size and isolation from real collection are unchanged.

## Popup lifecycle and idle motion
The map listens to the native popup close/remove event and clears only the state belonging to that popup. Closing a multi-visitor group releases the idle pause. A stale close callback cannot erase a newer popup. Input still resets the 12-second wait; selected visitors and open timelines continue to pause rotation.

## Bounded live-event window
The old query took the oldest 2,000 events in its 10-minute window. Under bursts, that could exclude the newest visitors entirely. It now fetches the newest 2,000 rows plus a sentinel, ordering by timestamp and event ID, then reverses the bounded set to build chronological journeys. Equal timestamps have deterministic order.

The API adds `truncated: true` only when more than 2,000 eligible rows exist. Both views show a Chinese/English warning that counts and histories may be incomplete. The cap remains deliberate: this is not a claim of exact visitor totals or complete histories at arbitrary traffic volumes. No additional table, column, raw IP storage or deployment permission is introduced by this follow-up. The earlier PR's additive masked-IP schema and deployment preconditions still apply.

## Checks
`tests/hardening.mjs` adds a real SQLite overflow/timestamp-order case plus browser checks for article-to-article navigation, duplicate polls, literal timeline paths, translated truncation warnings, warm-start destinations, native popup close and actual idle resumption. The existing seven suites remain enabled. Test visitors are fixtures or demo data; no production statistics are requested or changed. Browser coverage remains Chromium/SwiftShader rather than physical devices or Safari.
