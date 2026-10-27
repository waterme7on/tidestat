# Minilytics-inspired integration (phase 1)

This is a **non-invasive foundation**, not a deployed or enabled feature.
It adds a pure last-non-direct-touch selector and AI-referrer classification.
No existing event ingestion, revenue attribution, D1 tables, or UI are changed.

## Safety contract
- Attribution selection must only run **after** a payment is linked to a
  verified visitor through existing provider-signed metadata and site scope.
- Never infer a visitor from IP, email, timing, or a referrer.
- Do not silently replace TideStat's existing first-touch revenue reports.
- Treat session sources as observed signals, not verified monetary evidence.
- No new cookie or PII collection is introduced.

## Follow-up work
1. Audit canonical session source fields and adapt them into this helper.
2. Expose first-touch and last-non-direct-touch as explicitly labeled views.
3. Add site-scoped D1 query and performance tests for large lookback windows.
4. Implement global filter state and campaign/AI source dashboard components.
5. Add a signed Dodo Payments provider adapter with replay protection,
   payment/refund deduplication and webhook fixture tests.
6. Run full integration and browser suites before enabling in production.

Inspired by Minilytics (MIT):
https://github.com/surendrapandar/minilytics
No upstream code has been copied in this phase.
