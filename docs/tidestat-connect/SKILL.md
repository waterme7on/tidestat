---
name: tidestat-connect
description: Connect a user website to TideStat using its Browser SDK, configure site isolation and consent, and verify a newly collected pageview.
---
# Connect a website to TideStat

Use the website URL, site ID and TideStat deployment URL supplied in the task. Inspect the website framework, existing tracker and consent flow before editing. Resolve missing access or deployment details from the project; ask only for necessary missing inputs. Do not replace an existing installation with a duplicate tracker.

## 1. Configure the website

For signed-in users, create/select the website in `/account.html`; it provisions the allowed origin and site ID. Use the existing account session for verification, with no read token needed. Do not ask these users to configure Worker secrets. The following manual server configuration applies only to legacy token-based workspaces.

On the TideStat Worker, `SITES_JSON` is an object keyed by site ID. Each entry requires `origin` (exact scheme and host) and a private `readToken`; `allowedOrigins` may list additional exact origins. Merge the relevant entry without replacing other sites. Use configured secret storage, such as `wrangler secret put SITES_JSON`, within existing authorization. Never place read tokens in website code, URLs, copied agent tasks, logs or commits. If the user cannot configure the Worker, identify the required administrator action; entering a website URL alone does not provision a site.

Read the deployment's `/docs/index.html#sites` and `#deployment` for server setup. The Worker requires its D1 schema and SDK assets. Prepare code before any deployment needing separate authorization.

## 2. Install in the website project

Read `/docs/index.html#browser` on the supplied TideStat deployment. The Browser SDK is not published to npm. Do not run `npm install @tidestat/browser-sdk` or equivalent registry commands. Choose one supported route:

- **Local package:** locate the actual TideStat checkout and confirm `packages/browser-sdk/package.json` exists. From the user website project (not the TideStat repository), run `npm install "/absolute/path/to/tidestat/packages/browser-sdk"`, replacing the placeholder with the discovered path. Then import `createTideStat` from `@tidestat/browser-sdk` and supply the deployment `/api/collect` endpoint. The import name is valid after local installation; it is not a registry installation instruction. Confirm the website build environment can access the local dependency; a developer-machine path alone is not portable to CI.
- **Hosted SDK:** when no checkout is available or local paths cannot be used in deployment, use the deployed SDK directly, without an npm install. Verify the asset is reachable; do not invent a repository URL or claim the npm package is published.

Hosted example (replace the deployment and site ID):

```html
<script type="module"
  src="https://YOUR_TIDESTAT_DEPLOYMENT/sdk/browser.js"
  data-site="YOUR_SITE_ID"
  data-consent="false"></script>
```

The collector defaults to `/api/collect` on the SDK's deployment origin. The wrapper exposes `window.tidestat`. Connect the site's existing consent state and changes to `window.tidestat.setConsent(granted)` after the module is ready. Initial consent is false; merely inserting the snippet will not collect pageviews. For frameworks or asynchronous consent managers, import `createTideStat` from the deployment's `/sdk/index.js`, initialize once with the existing consent state and subscribe to subsequent consent changes. Preserve teardown and avoid double initialization on route changes. The SDK observes SPA navigation itself.

SDK site IDs are public. Read tokens and webhook signing secrets are server/dashboard credentials, never browser tracker inputs. Payment integrations are optional: consult `#stripe` or `#shopify` only when requested, and verify signed payments separately from browser pageviews.

## 3. Verify and report

For legacy workspaces only, have the user enter their read token in the TideStat setup dialog. Step 2 checks authenticated access and exact allowed origin. Step 3 records a verification start time: open the actual website after this point, use the existing consent flow, and visit a page. Inspect the browser collection request and use the dashboard's Check for pageview button.

The authenticated read-only endpoint is `GET /api/setup?site=SITE_ID&origin=ENCODED_WEBSITE_ORIGIN&since=UNIX_MILLISECONDS` with the signed-in same-origin account cookie, or the legacy read token in the Authorization Bearer header. It returns `originAllowed`, `pageviewReceived`, and `lastPageviewAt` for this site and a window of at most 30 minutes. A successful credential check, historical data or a synthetic collector request does not prove installation on the actual website. Corroborate a new pageview with the website's browser request; the server result alone is site-scoped and does not identify which of several allowed origins emitted it.

On failure check origin mismatch, consent, site ID, module loading, blockers and `/api/collect` errors. Retry after a concrete correction. Report changed files, whether deployment happened, observed verification evidence and unresolved dependencies. Do not label missing events as successful setup or infer payment verification from a pageview.
