---
name: tidestat-connect
description: Connect a customer website to the hosted TideStat service, integrate consent-aware tracking, and verify a real pageview in the dashboard.
---
# Connect a website to TideStat

TideStat is the hosted collector, data store and analytics dashboard. The customer only integrates their website. Never ask the customer to deploy TideStat, configure a Worker or database, supply SITES_JSON, or create dashboard read tokens.

Use the website URL, website ID and TideStat service URL in the setup task. Inspect the website framework, existing tracker and consent flow. Preserve existing changes and avoid duplicate initialization.

## 1. Register the website

Ask the customer to sign in to TideStat and add/select their website in `/account.html` if no website ID is supplied. The service registers its origin and provides its ID. Keep the supplied ID and origin. Dashboard verification uses the customer's signed-in session. Do not copy session cookies into commands or chat.

## 2. Integrate the hosted tracker (default)

Read `/docs/index.html#browser` on the supplied service. No package installation or TideStat repository is needed. Example (replace service URL and website ID with supplied values):

```html
<script type="module"
  src="https://tidestat.yololab.cc/sdk/browser.js"
  data-site="YOUR_SITE_ID"
  data-consent="false"></script>
```

The wrapper exposes `window.tidestat` when ready and sends events to `/api/collect` on the TideStat service origin. Connect existing consent state and changes to `setConsent(granted)` after the module is ready; initial consent is false. For asynchronous consent managers, import `createTideStat` from the service's `/sdk/index.js`, initialize once with the existing consent state and subscribe to later changes. Provide the service's `/api/collect` endpoint when initializing directly. Preserve teardown; the SDK already observes SPA navigation.

Publish only the customer's website changes within existing authorization. The analytics service is run by TideStat. Website IDs are public; private credentials never belong in the tracker.

### Optional npm package

For projects with a package manager, run `npm install @waterme7on/tidestat-browser-sdk` from the website project. Import `createTideStat` from `@waterme7on/tidestat-browser-sdk` and initialize once on the client with the supplied site ID, the service's `/api/collect` endpoint, and the existing consent state. Subscribe to consent changes and call `destroy()` on teardown. Do not combine this instance with the hosted script. No TideStat checkout, Worker, database, or read token is required. The browser SDK is MIT licensed.

## 3. Verify a real visit

In the TideStat setup dialog, check the connection, then open the customer's website, grant analytics consent through its actual flow and visit a page. Inspect the browser collection request and use Check for pageview. Credentials, installing this Skill and historical events alone do not prove successful integration.

The signed-in same-origin read endpoint is `GET /api/setup?site=SITE_ID&origin=ENCODED_WEBSITE_ORIGIN&since=UNIX_MILLISECONDS`. It returns `originAllowed`, `pageviewReceived` and `lastPageviewAt` in a window of at most 30 minutes. Corroborate the new pageview with the actual website request; the result is site-scoped, not a guarantee of which allowed origin emitted it.

On failure check website ID, registered origin, consent, asset loading, blockers and collection response. Resolve a registration mismatch in the account or with the TideStat operator, not by deploying a new backend. Report changed files, website publication status, actual verification evidence and remaining blockers.

Payment connectors are optional and separate from pageview verification. Self-service connector credential setup is not yet available; activation requires the TideStat operator. Do not ask for signing secrets in chat or claim revenue is verified from a pageview.
