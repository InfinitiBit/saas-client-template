# Template gap analysis

What to add to or refactor in `saas-client-template`, measured against primary-source best practice. Researched 2026-10-03 against `dev` at `c0eee1f`. Every recommendation is meant to fit `AGENTS.md`: the simplest thing that works, no speculative abstraction, established libraries over local code, and long-term decisions.

Measured locally on a production build (`pnpm build`, then `node .output/server/index.mjs` with `APP_MODE=saas`):

- The entry chunk `assets/index-*.js` is 610,108 bytes raw and 189,349 gzipped. It went out **uncompressed** even with `accept-encoding: gzip, br`.
- `/` and `/notes` answer with no `Cache-Control` and **no security headers of any kind**.
- Hashed `/assets/*` get `cache-control: public, max-age=31536000, immutable`. `/fonts/*` and `/brand/*` get none.
- The SSR document contains inline `<script>` tags, so any CSP needs a nonce.
- `/mockServiceWorker.js` is served in production (200).

## 1. Summary

| #   | Item                                                                                                                                                                     | Category      | Value    | Effort | Confidence                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------- | ------ | ---------------------------------- |
| 1   | Run CI on `pull_request` and make it a required check (ruleset); add `concurrency`, explicit `permissions`                                                               | CI/CD         | High     | S      | High                               |
| 2   | Baseline security headers (Nitro `routeRules`) plus a nonce-based CSP (`ssr.nonce`), rolled out as Report-Only first; `Cache-Control: no-store` on documents             | Security      | High     | M      | High                               |
| 3   | Extend Start's own `createCsrfMiddleware` (Fetch Metadata) to the template's server routes (`/session`, `/api/*`) for non-safe methods                                   | Security      | High     | S      | High                               |
| 4   | Replace TanStack's default error screen (English, inline styles, "Show Error" reveals `error.message`) with a design-system, translated error screen that offers a retry | Error UX      | High     | S      | High                               |
| 5   | Pre-compress public assets (`compressPublicAssets`) and cache `/fonts`, `/brand`                                                                                         | Performance   | High*    | S      | High (*if no compressing ingress)  |
| 6   | Automated dependency updates with Renovate `config:best-practices` (pins action SHAs and image digests); add pnpm `trustPolicy: no-downgrade`                            | Supply chain  | High     | S      | High                               |
| 7   | Move to Node 24 LTS: Dockerfile, CI, `engines`, `.node-version`; align `@types/node` with the runtime                                                                    | Platform      | Med-High | S      | High                               |
| 8   | Validate the whole environment at boot with one zod schema keyed on the Mode, in the existing Nitro plugin                                                               | Config        | Medium   | S      | High                               |
| 9   | Structured stdout logs for Session and proxy events (renew/revoke failure, 502 Identity, upstream 5xx); Sentry as an org decision                                        | Observability | Med-High | M      | Medium                             |
| 10  | One Playwright smoke suite against the **built** server (SSR gate, Launch→cookie→list, CSP has no violations, axe)                                                       | Testing       | Med-High | M      | Medium (contradicts spec #1 scope) |
| 11  | Accessibility basics: per-route `head` titles, a skip link, focus moved to the `h1` on navigation                                                                        | A11y          | Medium   | S-M    | High                               |
| 12  | A cheap `/health` server route; point the Docker `HEALTHCHECK` at it; `init: true` in compose                                                                            | Ops           | Medium   | S      | High                               |
| 13  | Build the Docker image in CI (`build-push-action`, `push: false`, GHA cache)                                                                                             | CI/CD         | Medium   | S      | High                               |
| 14  | Enable CodeQL default setup and `dependency-review-action` (free for public repos)                                                                                       | Security      | Medium   | S      | High                               |
| 15  | Map a Service's 422 field errors onto TanStack Form fields via `onSubmitAsync` (only when the first real form needs it)                                                  | Forms         | Medium   | S      | Medium                             |

Explicit **skip** verdicts are in §3.16: Storybook, visual regression, coverage thresholds, Lighthouse CI, web-vitals RUM, OpenTelemetry now, feature flags, PWA, SEO, RTL, zod/mini, route-loader SSR data now, cross-tab logout sync, devcontainer, and Vitest Browser Mode now.

## 2. Already in place

- **Session.** `__Host-` HttpOnly, Secure, SameSite=Lax cookies (`src/features/auth/lib/session.server.ts:13`). Token shape is checked before any `Set-Cookie` (`:19-32`). `POST /session` requires JSON (`:44-45`). The Standalone arrival mark covers login CSRF (`:34-37`, `:56-57`). Renewal is single-flight (`:159-183`). Revocation on sign-out is best-effort (`:115-125`). OWASP's preference for non-persistent session cookies is met ([Session Mgmt CS][owasp-session]).
- **Proxy.** Path and header allowlists, and an encoded-slash guard (`src/features/api/lib/api-proxy.server.ts:18-27`, `:150-157`). It renews and replays once on a 401. Tokens never reach script.
- **Session gate.** SSR'd before the first byte. Session errors are never retried, and mutations are never retried (`src/router.tsx:33-43`).
- **Server functions are CSRF-protected.** Start installs `createCsrfMiddleware` (a `Sec-Fetch-Site`/Origin/Referer check) for server functions when there is no `src/start.ts` ([Start middleware guide][start-mw]; `@tanstack/start-server-core` `createStartHandler.js:21`). It does **not** cover server routes; see §3.3.
- **Tooling.** Type-aware oxlint with jsx-a11y, React Compiler rules, design-token lint, the local `&&` rule and vendored anti-slop rules (`.oxlintrc.json`). Also oxfmt, TypeScript 7 native ([TS 7 announcement][ts7]), React Compiler 1.0 via `reactCompilerPreset` (`vite.config.ts:23`), which matches the plugin-react 6 recommended setup ([plugin-react changelog][vite-react-cl]).
- **Tests.** Boundary tests through two seams with MSW, where an unhandled request is an error (`src/testing/setup.ts:29-31`). One set of MSW handlers serves both dev and tests (`src/features/api/lib/dev-service.ts`), as MSW's own philosophy recommends ([MSW docs][msw]). There is an en/de message-parity test.
- **Supply chain.** pnpm 12 defaults already cover `minimumReleaseAge` (1 day), `strictDepBuilds` and `blockExoticSubdeps`. `allowBuilds` is used rather than the removed `onlyBuiltDependencies` ([pnpm settings][pnpm-settings]). Pre-1.0 tools and the design system are pinned exactly.
- **Release and repo hygiene.** semantic-release with least-privilege job permissions (`.github/workflows/release.yml:7-16`). The repo's default token is `read`. Commitlint, branch-name pre-push and lint-staged.
- **Container and routing.** Multi-stage, non-root Docker image (`Dockerfile:1-20`), matching [Docker best practices][docker-bp] and [docker-node][docker-node]. Route-level code splitting is always on in Start (verified in source: `start-plugin-core` strips `autoCodeSplitting` and always installs the splitter). `defaultPreload: 'intent'`.
- **i18n.** `<html lang>` follows the locale. Dates use `Intl` with `getLocale()` (`src/features/notes/components/notes-list.tsx:26-29`). Language names come from `Intl.DisplayNames`.

## 3. Recommendations

### 3.1 CI runs on every pull request and gates merges

**Current.**

- `.github/workflows/ci.yml:3-4` is `on: workflow_dispatch` only; commit `6881d0f` changed it to "run CI on manual trigger". README:202 says "Start it by hand".
- `dev`, `stage` and `main` have no branch protection and no rulesets (`gh api …/branches/dev/protection` → 404; rulesets `[]`).
- The workflow has no `permissions:` or `concurrency:`. It uses `actions/checkout@v5` and `actions/setup-node@v5`.
- Spec #1, user story 83: "I want CI to run lint, type-check and tests on every pull request, so that nothing merges broken." That is not met.

**Best practice.**

- A required check must report on the PR's head SHA: "Required checks must pass on the latest commit SHA" ([GitHub, troubleshooting required checks][gh-required]). A dispatch-only workflow can never satisfy one.
- Rulesets "are available in public repositories with GitHub Free" ([about rulesets][gh-rulesets]).
- Cancel superseded runs with `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` ([concurrency][gh-concurrency]).
- Set token permissions explicitly per workflow ([secure use][gh-secure]).
- Epic Stack runs lint, typecheck and tests in one workflow on every push ([Epic Stack ADR 004][epic-gha]).
- Latest majors are `actions/checkout` v7 and `actions/setup-node` v7. pnpm's CI page now recommends `pnpm/setup`, which "installs pnpm, then uses it to install the requested runtime, so no separate `actions/setup-node` step is needed" ([pnpm CI][pnpm-ci]).

**Proposal.**

- `on: { pull_request: {}, push: { branches: [dev, stage, main] } }`.
- Add `permissions: { contents: read }` and a `concurrency` group.
- Keep the single job. At this size, parallel jobs add install time rather than save it.
- Add a ruleset on `dev`, `stage` and `main` that requires the `check` job.
- If PRs are squash-merged (README:212), the squash title is the PR title (`squash_merge_commit_title: COMMIT_OR_PR_TITLE`), and commitlint never sees it. Add one step: `echo "$PR_TITLE" | pnpm exec commitlint`. It needs no new dependency.
- Recent history shows merge commits, not squashes. Pick one model and make README:212 and README:216 agree.

**Risk.** Public-repo minutes are free. If minutes were the original reason for the dispatch trigger, it no longer applies (unverified; the commit gives no reason).

### 3.2 Security headers and a nonce-based CSP

**Current.**

- No response sets any security header (measured above).
- `src/routes/__root.tsx:35-48` sets only meta, stylesheet and icon. There is no `src/start.ts` and no Nitro `routeRules` (`vite.config.ts:21`).
- The HTML differs by Session (gate vs Application) but carries no `Cache-Control`.

**Best practice.**

- OWASP's headers cheat sheet ([OWASP headers][owasp-headers]) recommends:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `frame-ancestors` (with `X-Frame-Options: DENY` as the fallback)
  - HSTS
  - a deny-by-default `Permissions-Policy`
  - `Cross-Origin-Opener-Policy: same-origin`
  - "Remove all X-Powered-By headers"
- ASVS 5.0 V3.4 lists these as verification requirements:
  - nosniff on all responses (3.4.4)
  - `frame-ancestors` (3.4.6; X-Frame-Options "is obsolete and may not be relied upon")
  - a CSP with at least `object-src 'none'; base-uri 'none'` and nonces or hashes (3.4.3)
  - Source: [ASVS V3][asvs-v3].
- Strict CSP is `script-src 'nonce-{RANDOM}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`, where the nonce is "newly generated at runtime for every response". Roll it out with `Content-Security-Policy-Report-Only` ([web.dev strict CSP][webdev-csp]; [OWASP CSP][owasp-csp]).
- Epic Stack ships a nonce CSP in report-only mode by default ([ADR 008][epic-csp], [ADR 022][epic-csp-ro]).
- **TanStack Start.** Set the router's `ssr: { nonce }` so `HeadContent` and `Scripts` stamp it on tags ([Start CSS guide][start-css]). TanStack's official e2e app `e2e/react-start/csp/` does this in two steps ([router repo][tsr-csp-e2e]):
  1. It generates the nonce inside `getRouter` with `createIsomorphicFn().server(...)`.
  2. It emits the header from the root route's `headers`.
- Nitro `routeRules` can attach static headers to route patterns ([Nitro config][nitro-config]).
- OWASP says sensitive pages should not be cached ([Session Mgmt CS][owasp-session]).

**Proposal.**

- **Static headers** go in `nitro({ routeRules: { '/**': { headers: {...} } } })` in `vite.config.ts`:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000`. Leave `includeSubDomains` and preload to whoever owns the domain.
- **CSP**, generated per request in `getRouter` (`src/router.tsx:23`) as in TanStack's e2e app:
  - `default-src 'self'`
  - `script-src 'nonce-…' 'strict-dynamic'`
  - `object-src 'none'`
  - `base-uri 'none'`
  - `frame-ancestors 'none'`. This is safe because the portal opens Launches in a new tab, never a frame (ADR 0005:29).
  - `connect-src 'self'`. The proxy makes every call same-origin (ADR 0006), which is what lets the CSP be this tight.
  - `img-src 'self' data:`
  - `font-src 'self'`
  - `form-action 'self'`
  - Start as `-Report-Only` and enforce after one release without violations.
- **`Cache-Control: no-store`** on document responses, set from the same root `headers`.
- Production only: Vite HMR and the dev MSW worker need a looser dev policy.

**Risks.**

- Radix sets inline `style` attributes, and sonner injects a `<style>` at runtime (`src/styles.css:32-33`). A strict `style-src` would break both, so keep `style-src 'self' 'unsafe-inline'`. web.dev's strict CSP targets `script-src`. Whether sonner accepts a nonce is unverified.
- `strict-dynamic` makes the MSW dev worker irrelevant, since the worker is dev-only.

### 3.3 Fetch-Metadata CSRF check on the template's server routes

**Current.**

- `/api/$` forwards POST, PUT, PATCH and DELETE with the cookie-derived bearer (`src/routes/api.$.ts:7-16`, `api-proxy.server.ts:86-98`). Its only CSRF defence is SameSite=Lax.
- `DELETE /session` has no check (`src/routes/session.ts:11`) and relies on CORS preflight.
- Start's automatic CSRF middleware is filtered to `handlerType === 'serverFn'`, so it skips both routes.

**Best practice.**

- OWASP: "SameSite is useful as a defense-in-depth control but it does not replace a proper CSRF defense in most deployments." It also says to "reject non-safe methods (POST / PUT / PATCH / DELETE) when Sec-Fetch-Site: cross-site", with Origin and Referer as the fallback ([OWASP CSRF][owasp-csrf]).
- SameSite cannot see **same-site** attackers. That matters here: Applications on sibling subdomains, or on `localhost` ports, are same-site with each other.
- ASVS 3.5.3 accepts strict `Sec-Fetch-*` validation ([ASVS V3][asvs-v3]).
- MDN says the same ([MDN CSRF][mdn-csrf]; [Sec-Fetch-Site][mdn-sfs]).
- Epic Stack removed CSRF tokens in favour of SameSite=Lax ([ADR 035][epic-csrf]). Its warning, "If someone adds a GET request which does mutate state", is a reason to add a check that does not depend on review.

**Proposal.**

- Do not write a check. Start already ships one: `createCsrfMiddleware` (exported from `@tanstack/react-start`). It checks `Sec-Fetch-Site` for `same-origin` and falls back to Origin, then Referer.
- Add `src/start.ts` with `createStart(() => ({ requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' || !['GET','HEAD'].includes(ctx.request.method) })] }))`.
- The guide warns that defining `src/start.ts` drops the automatic one, so the server-function case must stay in the filter ([Start middleware][start-mw]).
- Every future server route is then covered by default. Record the decision as a short ADR beside ADR 0005.

**Risks.**

- `respond()` does not run middleware (`src/testing/respond.ts:13-15`), so the existing seam cannot test this.
- Either extend `respond()` to run the global request middleware, or cover it in the smoke E2E (§3.10).
- A per-handler guard would be testable today, but a new route could forget it.

### 3.4 A real error screen

**Current.**

- `RouterError` falls back to TanStack's `ErrorComponent` for every non-Session error (`src/features/auth/components/session-gate.tsx:44-52`).
- That component renders the hard-coded English "Something went wrong!" with inline styles. Its "Show Error" toggle prints `error.message`, and in production the toggle is still present: `useState(NODE_ENV !== "production")` only changes the default (`@tanstack/react-router/dist/esm/CatchBoundary.js:41-67`).
- `NotFound` offers no way back (`src/routes/__root.tsx:53-59`).

**Best practice.**

- Start: "Set a default for all routes via the router; Override per-route with `errorComponent`" ([Start error boundaries][start-errors]).
- ASVS 16.5.1: return generic error messages, with no internals ([ASVS V16][asvs-v16]).
- Bulletproof React: multiple error boundaries plus reporting ([BPR error handling][bpr-errors]).

**Proposal.**

- In `RouterError`'s fallback, render an `AlertBanner` (or `Card`) with translated copy and a "Try again" button that calls `reset()` then `router.invalidate()`.
- Give `NotFound` a link to `/`.
- This is where error reporting hooks in later (§3.9).

**Risk.** None material.

### 3.5 Compress and cache static assets

**Current.**

- The 610 KB entry chunk, the CSS and the HTML go out uncompressed.
- `public/fonts/*.woff2` (five GT faces) and `public/brand/*` carry only an ETag, so every visit revalidates them.

**Best practice.** Nitro: "If enabled, Nitro will generate a pre-compressed (gzip, brotli, and/or zstd) version of supported types of public assets … Using this option you can support zero overhead asset compression without using a CDN". The default is `false` ([Nitro config][nitro-config]).

**Proposal.**

- `nitro({ compressPublicAssets: { gzip: true, brotli: true }, routeRules: { '/fonts/**': { headers: { 'cache-control': 'public, max-age=604800' } } } })`.
- Fonts and brand assets are not content-hashed, so give them a bounded max-age rather than `immutable`.

**Risk.** Platform ingress is unknown. If it already compresses, this is a no-op. Check the deployed response first. Measured gain: 610 KB → 189 KB gzip for the entry alone.

### 3.6 Renovate and pnpm trust policy

**Current.**

- No Dependabot or Renovate. Actions are referenced by mutable major tags. The base image is `node:22-slim` by tag.
- Several dependencies are pinned exactly and need deliberate bumps: `oxlint`, `oxfmt`, `nitro` beta and the design system.
- A CVE bump was done by hand (`bcfe894`).

**Best practice.**

- "Pinning an action to a full-length commit SHA is currently the only way to use an action as an immutable release" ([secure use][gh-secure]).
- Dependabot's ecosystem table lists pnpm support only for **v7–v10**, and this repo uses pnpm 12 ([Dependabot ecosystems][dependabot-eco]).
- Renovate parses `pnpm-workspace.yaml`. It also has `minimumReleaseAgeBuffer`, which exists because of pnpm's own `minimumReleaseAge` ([Renovate options][renovate-opts]).
- `config:best-practices` adds `docker:pinDigests`, `helpers:pinGitHubActionDigests` and `:maintainLockFilesWeekly`; its docs say "Use the `config:best-practices` preset, instead of the `config:recommended` preset" ([Renovate upgrade best practices][renovate-bp]).
- pnpm `trustPolicy: no-downgrade` makes the install "fail if a package's trust level has decreased compared to previous releases". It is off by default ([pnpm settings][pnpm-settings]).
- OpenSSF Scorecard scores Dependency-Update-Tool, Pinned-Dependencies and Token-Permissions ([Scorecard checks][scorecard]).

**Proposal.**

- Add `renovate.json`: `{ "extends": ["config:best-practices"], "packageRules": [...] }`.
  - Group `@tanstack/*`.
  - Group oxlint, oxfmt and oxlint-tsgolint.
  - Leave `@infinitibit_gmbh/*` and `nitro` ungrouped and manual-merge, since each is pinned on purpose (ADR 0001, ADR 0002).
- Add `trustPolicy: no-downgrade` to `pnpm-workspace.yaml`.
- Repos created from the template inherit the config.

**Risk.** Renovate is a GitHub App, so installing it is an org decision. Expect a PR stream on first run.

### 3.7 Node 24 LTS, declared once

**Current.**

- `Dockerfile:1,11` and `ci.yml:14` use Node 22. README:100 says Node 22.
- There is no `engines` and no `.node-version`.
- `@types/node` is `^26.6.3` (`package.json:62`), so the type checker accepts Node 26 APIs that the Node 22 runtime lacks.
- Local development here runs Node 26.

**Best practice.**

- Node 22 entered Maintenance on 2025-10-21 (EOL 2027-04-30).
- Node 24 is Active LTS until 2026-10-20 and supported to 2028-04-30.
- Node 26 becomes LTS on 2026-10-28.
- Source: [nodejs/Release schedule.json][node-sched].
- `@types` major.minor tracks the typed library's version ([DefinitelyTyped README][dt-readme]).

**Proposal.**

- Move to `node:24-slim`.
- Add `.node-version` with `24`, and read it with setup-node's `node-version-file` (or `pnpm/setup` `runtime`).
- Add `"engines": { "node": ">=24 <25" }` and `@types/node@^24`.
- Revisit Node 26 after 2026-10-28.

**Risk.** Low. Re-run the build and tests.

### 3.8 Boot-time env validation

**Current.**

- `src/env.server.ts:1-39` validates each variable lazily, when first read.
- Only `APP_MODE` is checked at boot (`src/nitro/require-mode.ts:5-8`). A SaaS deployment missing `TENANT_PORTAL_URL` starts healthy, then answers `/signin` with a 500.
- `APP_BRAND` is read directly from `process.env` in `src/routes/__root.tsx:19-21`, outside the env module.

**Best practice.**

- Start's environment-variables guide uses "Zod for runtime validation of environment variables", parsing `process.env` once ([Start env guide][start-env]).
- Epic Stack calls `init()` with a zod schema at server start ([epic env.server.ts][epic-env]).
- Twelve-Factor keeps config in env ([12factor config][12f-config]).

**Proposal.**

- Define one `z.discriminatedUnion('APP_MODE', [saasSchema, standaloneSchema])`, so a SaaS-only variable still never breaks Standalone. That preserves the property the file's first comment protects.
- Parse it once in the existing Nitro plugin and export the parsed object. The accessor functions become property reads.
- Move `APP_BRAND` in with `.catch('default')` (ADR 0003's fallback).

**Risk.** Tests stub env per test with `vi.stubEnv`, so the module must still re-read per test, or the parse becomes a memoised function reset between tests. Keep it a function and drop the per-variable helpers.

### 3.9 Observability: log what the auth path swallows

**Current.**

- Every failure on the Session path is silent by design, with no trace:
  - a renewal that fails (`session.server.ts:196-205`, `:221-236`)
  - a revocation that fails (`:251-254`)
  - an Identity answer that fails to parse, which becomes a 502 (`api-proxy.server.ts:124-127`)
  - a failed Launch adoption (`launch.ts:29`)
- ADR 0006:33 names a multi-instance refresh race that only logs would reveal.
- There is no error tracking.

**Best practice.**

- Twelve-Factor: each process "writes its event stream, unbuffered, to stdout" ([12factor logs][12f-logs]).
- ASVS 16.3.1: "all authentication operations are logged, including successful and unsuccessful attempts" ([ASVS V16][asvs-v16]).
- TanStack's observability guide recommends Sentry and shows logging middleware ([Start observability][start-obs]).
- Sentry's TanStack Start SDK "is currently in **beta**" and needs:
  - `instrument.server.mjs` loaded with `--import`
  - a Vite plugin for source maps
  - `sentryGlobalRequestMiddleware` in `src/start.ts`
  - Source: [Sentry TanStack Start][sentry-tss].

**Proposal, in layers.**

1. Now: one JSON line to stdout per Session event: renew ok/failed with the upstream status, revoke failed, identity 502, upstream 5xx. Use `console` with `JSON.stringify` and never log token values. This is a few lines and needs no dependency. Adopt pino ([pino][pino]; it has `redact`) only if log volume or child loggers demand it.
2. When the platform picks an error tracker, wire Sentry (or whatever is chosen) into `src/start.ts`, which §3.3 creates anyway, and into the §3.4 error screen.

**Risks.** Sentry's SDK is beta. PII: Sentry's guide now uses a `dataCollection` option (unverified whether `sendDefaultPii` is deprecated). Hold Sentry until the platform decides.

### 3.10 One production-build smoke E2E

**Current.**

- Spec #1 lists "Playwright / end-to-end tests" as out of scope.
- Tests run without Start's compiler: `createServerFn` and `getRequest` are mocked (`src/testing/setup.ts:9-21`), the Nitro plugin is skipped (`vite.config.ts:19-21`), and cookies go through jsdom's `document.cookie`.
- So nothing tests the following:
  - server functions as RPC
  - real `Set-Cookie` and `__Host-` handling
  - hydration
  - the boot plugin
  - headers or CSP (§3.2)
  - global middleware (§3.3)
- A Start upgrade, like the one for the CVE, can break any of these silently.

**Best practice.**

- Playwright `webServer` boots the app for tests ([Playwright webServer][pw-webserver]).
- `@axe-core/playwright` runs accessibility scans, but "many accessibility problems can only be discovered through manual testing" ([Playwright a11y][pw-a11y]).
- TanStack's own e2e suite has a Playwright project per feature, including `csp` ([router e2e][tsr-e2e]).
- Epic Stack and Bulletproof React both ship Playwright E2E ([Epic features][epic-features]; [BPR testing][bpr-testing]).

**Proposal.**

- Add `e2e/` with `webServer: pnpm build && pnpm start` and a stub upstream. Reuse orval's MSW handlers from a tiny Node `setupServer` process listening on `SERVICE_URL`.
- Write three tests, Chromium only:
  1. No cookie → the gate in the SSR'd HTML.
  2. `/<slug>#token=…` → cookies set → the Notes list renders, with no CSP violations in the console.
  3. An axe scan of the Application and the gate.
- Run them in CI after `build`.

**Risks.** This **contradicts spec #1's out-of-scope list**. It is worth reopening because the in-process seams cannot see the compiler, server or browser boundary. Cost: about 1–2 min of CI and a browser install. Keep it to smoke tests. The two seams remain where behaviour is tested.

### 3.11 Accessibility basics

**Current.**

- One static `<title>SaaS Client Template</title>` for every route, in every Brand and locale (`src/routes/__root.tsx:39`).
- No skip link before `TopNav` (`src/features/shell/components/shell.tsx:53-83`).
- Focus stays on the clicked link after navigation.

**Best practice.**

- WCAG 2.2 SC 2.4.2: "Web pages have titles that describe topic or purpose".
- WCAG 2.2 SC 2.4.1: "A mechanism is available to bypass blocks of content that are repeated" ([WCAG 2.2][wcag22]).
- Start's SEO guide: the route `head` property "allows you to set page titles" ([Start SEO][start-seo]).
- TanStack Router does no focus management or route announcement; TanStack/router#918 is open ([issue 918][tsr-918]).
- W3C WAI curriculum (non-normative): place focus "at the beginning of the content to replicate the behavior of page reloads" ([WAI rich applications][wai-spa]).

**Proposal.**

- Each route's `head` returns `{ meta: [{ title: \`${m.notes_title()} · ${brandNames[brand]}\` }] }`.
- Add a visually hidden "Skip to content" link targeting `<main id="content">`.
- On `router.subscribe('onResolved')` after the first load, focus the Screen's `h1` (with `tabIndex={-1}`). That is about ten lines in `Shell`.

**Risk.** Focus-on-navigate must skip search-param-only navigations, such as list paging and search (ADR 0008), or typing in `ListSearch` loses focus. Gate on a pathname change.

### 3.12 `/health` route and container init

**Current.** `HEALTHCHECK` fetches `/` (`Dockerfile:17-19`). That runs the root loader, the gate server function and a full SSR every 30 s.

**Best practice.**

- TanStack's observability guide shows a `/health` server route ([Start observability][start-obs]).
- Epic Stack has `resources/healthcheck` ([epic healthcheck][epic-health]).
- Node "was not designed to run as PID 1"; use `--init` ([docker-node][docker-node]).

**Proposal.**

- Add `src/routes/health.ts` that answers `204`. Do not check upstreams: a Platform Auth outage should not restart the client.
- Point `HEALTHCHECK` at `/health`, which also removes the redirect special case.
- Add `init: true` to `compose.yaml`.

**Risk.** None. Note that the server already drains on SIGTERM (observed: "Stopping server gracefully (5s)").

### 3.13 Build the image in CI

**Current.** The Docker build broke once (`#37`, fixed in `a09d5b8`) and nothing in CI builds the image.

**Best practice.** `docker/build-push-action` with `cache-from: type=gha` ([Docker GHA cache][docker-gha]).

**Proposal.** Add a second job, `docker/build-push-action@v7` with `push: false` and the gha cache, on PRs that touch the `Dockerfile`, the lockfile or `package.json`, or on every PR if that is fast enough.

**Risk.** A path-filtered required job stays "Pending" when skipped ([GitHub][gh-required]). So either do not make it required, or run it unfiltered.

### 3.14 CodeQL and dependency review

**Best practice.** Both are free for public repositories ([CodeQL default setup][codeql]; [dependency review][dep-review]). Dependency review can "set an allow or deny list for licenses".

**Proposal.** Turn on CodeQL default setup in repo settings (no file needed). Add `actions/dependency-review-action@v5` to the PR workflow with `fail-on-severity: high`.

**Risk.** CodeQL adds a few minutes per PR, which is acceptable.

### 3.15 Server validation errors onto form fields

**Current.**

- A failed create shows one banner (`src/features/notes/components/new-note-dialog.tsx:105-107`).
- The Services are FastAPI (`orval.config.ts:5-6`), whose 422 body names each field's error location.

**Best practice.** TanStack Form's form-level `onSubmitAsync` may return `{ form, fields: { title: '…' } }` to set field errors from one API call ([TanStack Form validation][tsf-validation]).

**Proposal.**

- Wait for the first real form that has server-side rules. Do not add it speculatively.
- At that point, add one helper in `src/features/api/lib/` that turns an axios 422 `cause` into `{ fields }`, and document it in `docs/agents/data-fetching.md`.

**Risk.** FastAPI's exact `detail[].loc` shape is unverified for each Service.

### 3.16 Skip, or not now

| Item                                    | Verdict  | Why                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook                               | Skip     | Components live in `@infinitibit_gmbh/ui` (ADR 0002). Stories belong in the design-system repo.                                                                                                                                                                                                 |
| Visual regression (`toHaveScreenshot`)  | Skip     | "Browser rendering can vary based on the host OS…" ([Playwright snapshots][pw-snap]). Visuals are owned by the package.                                                                                                                                                                         |
| Coverage thresholds                     | Skip     | Tests are boundary-level by design (spec #1, "What makes a good test"). A global % gate adds friction without catching the gaps that §3.10 targets. Vitest supports it if wanted ([Vitest coverage][vitest-cov]).                                                                               |
| Lighthouse CI / size-limit              | Not now  | Gated Screens behind a Session make Lighthouse runs awkward. Revisit size-limit if the entry chunk grows (189 KB gz today).                                                                                                                                                                     |
| web-vitals RUM                          | Not now  | It needs a sink. Sentry tracing covers it if §3.9 step 2 happens ([web-vitals][web-vitals]).                                                                                                                                                                                                    |
| OpenTelemetry                           | Not now  | Start calls it "Experimental" ([Start observability][start-obs]). OTel JS browser support "is experimental" ([OTel JS][otel-js]). Nitro has an experimental `tracingChannel`.                                                                                                                   |
| Feature flags (OpenFeature)             | Skip     | No requirement. If one appears, use OpenFeature, a vendor-neutral CNCF spec ([OpenFeature][openfeature]).                                                                                                                                                                                       |
| Analytics, PWA, SEO, sitemap            | Skip     | Signed-in Application with no public pages (ADR 0004 already accepts one URL per page).                                                                                                                                                                                                         |
| RTL                                     | Skip     | en/de only.                                                                                                                                                                                                                                                                                     |
| zod/mini on the client                  | Skip     | Zod's docs: "you should probably use regular Zod unless you have uncommonly strict constraints around bundle size" ([Zod Mini][zod-mini]).                                                                                                                                                      |
| Route-loader prefetch / SSR'd list data | Not now  | Plain `useQuery` "does not execute on the server" ([Start + Query][start-query]), so lists render a spinner first. Fixing that needs server-side calls that carry the cookie to the Service, which is a second path beside the proxy. Spec #1 deferred it. Revisit if first-paint data matters. |
| Cross-tab sign-out sync                 | Skip     | Other tabs reach the gate on their next call (ADR 0007).                                                                                                                                                                                                                                        |
| orval Zod runtime response validation   | Skip     | It doubles schemas in the bundle and trusts the spec less than the generated types already do.                                                                                                                                                                                                  |
| Vitest Browser Mode                     | Not now  | Stable since Vitest 4 ([Vitest 4][vitest4]). Migrating both seams is L effort; §3.10 covers the real-browser gap more cheaply.                                                                                                                                                                  |
| knip                                    | Optional | Supports Vite, Vitest, TanStack Router, orval and MSW ([knip plugins][knip]). The repo is small and oxlint already flags unused locals.                                                                                                                                                         |
| devcontainer                            | Skip     | `.node-version` plus corepack is enough (§3.7).                                                                                                                                                                                                                                                 |

## 4. Refactor and efficiency opportunities

1. **One deployment server function.**
   - Current: `readBrand` and `readSignInWording` are two server functions with one loader (`src/routes/__root.tsx:19-32`). `readBrand` bypasses `env.server.ts`.
   - Change: merge them into one `readDeployment` that returns `{ brand, signIn }` from the §3.8 env object. Fewer RPC definitions, and one env entry point.
2. **CI steps.**
   - `pnpm/setup` replaces `pnpm/action-setup` plus `setup-node` and runs the install ([pnpm CI][pnpm-ci]).
   - `type:check` re-runs `i18n:compile`, which `prepare` already ran on install. That is harmless and needed locally, so leave it.
3. **Build-log noise.** Every `vite build` prints dozens of `MODULE_LEVEL_DIRECTIVE "use client"` warnings from Radix inside the design system. Filter that code with Vite's `build.rolldownOptions.onLog` so real warnings stay visible. The option name for Vite 8 is unverified.
4. **Paraglide plugin from a CDN.**
   - Current: `project.inlang/settings.json:6` loads `@inlang/plugin-message-format` from jsDelivr on every install and build. That means CI, Docker and `prepare` depend on CDN availability, with no integrity check. ADR 0004 accepts this "as inlang's own setup does".
   - Unverified: whether inlang accepts a local `node_modules` path. If it does, pin it through the lockfile instead.
5. **`/mockServiceWorker.js` in production.** It is served but never registered outside `vite dev`. Harmless, so leave it. MSW needs the worker at the public root for scope.
6. **Hand-parsed cookies** (`session.server.ts:257-267`, `:225-231`). Keep them. The comment explains the Request→Response purity, and values are shape-checked before use. A dependency would not simplify this.
7. **Docs drift.**
   - README:150 and README:202 describe the health check and CI, and change with §3.1, §3.12 and §3.7.
   - README:212 (squash) and the observed merge commits disagree; see §3.1.

## 5. Sources

[gh-required]: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
[gh-rulesets]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
[gh-concurrency]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
[gh-secure]: https://docs.github.com/en/actions/reference/security/secure-use
[dependabot-eco]: https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories
[codeql]: https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning
[dep-review]: https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review
[renovate-opts]: https://docs.renovatebot.com/configuration-options/
[renovate-bp]: https://docs.renovatebot.com/upgrade-best-practices/
[scorecard]: https://github.com/ossf/scorecard/blob/main/docs/checks.md
[pnpm-settings]: https://pnpm.io/settings
[pnpm-ci]: https://pnpm.io/continuous-integration
[node-sched]: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
[dt-readme]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md
[docker-bp]: https://docs.docker.com/build/building/best-practices/
[docker-node]: https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
[docker-gha]: https://docs.docker.com/build/ci/github-actions/cache/
[owasp-headers]: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
[owasp-csp]: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
[owasp-csrf]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
[owasp-session]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
[asvs-v3]: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x12-V3-Web-Frontend-Security.md
[asvs-v16]: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md
[webdev-csp]: https://web.dev/articles/strict-csp
[mdn-csrf]: https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF
[mdn-sfs]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site
[12f-config]: https://12factor.net/config
[12f-logs]: https://12factor.net/logs
[wcag22]: https://www.w3.org/TR/WCAG22/
[wai-spa]: https://www.w3.org/WAI/curricula/developer-modules/rich-applications/
[start-mw]: https://tanstack.com/start/latest/docs/framework/react/guide/middleware#global-middleware
[start-css]: https://tanstack.com/start/latest/docs/framework/react/guide/css-styling
[start-env]: https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables
[start-errors]: https://tanstack.com/start/latest/docs/framework/react/guide/error-boundaries
[start-obs]: https://tanstack.com/start/latest/docs/framework/react/guide/observability
[start-seo]: https://tanstack.com/start/latest/docs/framework/react/guide/seo
[start-query]: https://tanstack.com/start/latest/docs/framework/react/guide/tanstack-query
[tsr-csp-e2e]: https://github.com/TanStack/router/tree/main/e2e/react-start/csp
[tsr-e2e]: https://github.com/TanStack/router/tree/main/e2e/react-start
[tsr-918]: https://github.com/TanStack/router/issues/918
[tsf-validation]: https://tanstack.com/form/latest/docs/framework/react/guides/validation#setting-field-level-errors-from-the-forms-validators
[nitro-config]: https://nitro.build/config
[sentry-tss]: https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/
[pino]: https://github.com/pinojs/pino/blob/main/docs/api.md
[otel-js]: https://opentelemetry.io/docs/languages/js/
[web-vitals]: https://github.com/GoogleChrome/web-vitals
[pw-webserver]: https://playwright.dev/docs/test-webserver
[pw-a11y]: https://playwright.dev/docs/accessibility-testing
[pw-snap]: https://playwright.dev/docs/test-snapshots
[vitest-cov]: https://vitest.dev/config/coverage
[vitest4]: https://vitest.dev/blog/vitest-4
[msw]: https://mswjs.io/docs/
[knip]: https://knip.dev/reference/plugins
[openfeature]: https://openfeature.dev/
[zod-mini]: https://zod.dev/packages/mini
[ts7]: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
[vite-react-cl]: https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md
[epic-gha]: https://github.com/epicweb-dev/epic-stack/blob/main/docs/decisions/004-github-actions.md
[epic-csp]: https://github.com/epicweb-dev/epic-stack/blob/main/docs/decisions/008-content-security-policy.md
[epic-csp-ro]: https://github.com/epicweb-dev/epic-stack/blob/main/docs/decisions/022-report-only-csp.md
[epic-csrf]: https://github.com/epicweb-dev/epic-stack/blob/main/docs/decisions/035-remove-csrf.md
[epic-env]: https://github.com/epicweb-dev/epic-stack/blob/main/app/utils/env.server.ts
[epic-health]: https://github.com/epicweb-dev/epic-stack/blob/main/app/routes/resources/healthcheck.tsx
[epic-features]: https://github.com/epicweb-dev/epic-stack/blob/main/docs/features.md
[bpr-errors]: https://github.com/alan2207/bulletproof-react/blob/master/docs/error-handling.md
[bpr-testing]: https://github.com/alan2207/bulletproof-react/blob/master/docs/testing.md

- GitHub:
  - required checks: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
  - rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
  - concurrency: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
  - secure use: https://docs.github.com/en/actions/reference/security/secure-use
  - Dependabot ecosystems: https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories
  - Dependabot options: https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference
  - CodeQL: https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning
  - dependency review: https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review
- Renovate: https://docs.renovatebot.com/configuration-options/ · https://docs.renovatebot.com/upgrade-best-practices/ · https://docs.renovatebot.com/modules/manager/npm/
- OpenSSF Scorecard: https://github.com/ossf/scorecard/blob/main/docs/checks.md
- pnpm: https://pnpm.io/settings · https://pnpm.io/supply-chain-security · https://pnpm.io/continuous-integration · https://pnpm.io/cli/audit
- Node: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json · https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
- DefinitelyTyped: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md
- Docker: https://docs.docker.com/build/building/best-practices/ · https://docs.docker.com/build/ci/github-actions/cache/ · https://github.com/GoogleContainerTools/distroless
- semantic-release: https://semantic-release.gitbook.io/semantic-release/recipes/ci-configurations/github-actions
- OWASP:
  - HTTP headers: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
  - CSP: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
  - CSRF: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
  - Session management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
  - ASVS V3: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x12-V3-Web-Frontend-Security.md
  - ASVS V16: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md
- web.dev / MDN:
  - strict CSP: https://web.dev/articles/strict-csp
  - Core Web Vitals: https://web.dev/articles/vitals
  - MDN CSRF: https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF
  - MDN Sec-Fetch-Site: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site
  - MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
  - MDN Set-Cookie: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
- Twelve-Factor: https://12factor.net/config · https://12factor.net/logs
- W3C: https://www.w3.org/TR/WCAG22/ · https://www.w3.org/WAI/curricula/developer-modules/rich-applications/
- TanStack Start guides:
  - middleware: https://tanstack.com/start/latest/docs/framework/react/guide/middleware
  - CSS styling: https://tanstack.com/start/latest/docs/framework/react/guide/css-styling
  - environment variables: https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables
  - error boundaries: https://tanstack.com/start/latest/docs/framework/react/guide/error-boundaries
  - observability: https://tanstack.com/start/latest/docs/framework/react/guide/observability
  - SEO: https://tanstack.com/start/latest/docs/framework/react/guide/seo
  - TanStack Query: https://tanstack.com/start/latest/docs/framework/react/guide/tanstack-query
  - hosting: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
  - selective SSR: https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- TanStack Router guides: https://tanstack.com/router/latest/docs/guide/preloading · https://tanstack.com/router/latest/docs/guide/not-found-errors · https://tanstack.com/router/latest/docs/guide/document-head-management · https://tanstack.com/router/latest/docs/guide/scroll-restoration
- TanStack Router repo: https://github.com/TanStack/router/tree/main/e2e/react-start/csp · https://github.com/TanStack/router/tree/main/e2e/react-start · https://github.com/TanStack/router/tree/main/examples/react · https://github.com/TanStack/router/issues/918
- TanStack Query and Form:
  - QueryCache config: https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/QueryCacheConfig
  - Form validation: https://tanstack.com/form/latest/docs/framework/react/guides/validation
  - Form SSR: https://tanstack.com/form/latest/docs/framework/react/guides/ssr
- Nitro: https://nitro.build/config
- Sentry: https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/ · https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/
- OpenTelemetry: https://opentelemetry.io/docs/languages/js/ · https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
- pino: https://github.com/pinojs/pino/blob/main/docs/api.md
- web-vitals: https://github.com/GoogleChrome/web-vitals
- Playwright: https://playwright.dev/docs/test-webserver · https://playwright.dev/docs/best-practices · https://playwright.dev/docs/ci-intro · https://playwright.dev/docs/accessibility-testing · https://playwright.dev/docs/test-snapshots
- Vitest: https://vitest.dev/config/coverage · https://vitest.dev/blog/vitest-4 · https://vitest.dev/guide/browser/
- MSW: https://mswjs.io/docs/ · https://github.com/mswjs/playwright
- Orval: https://orval.dev/docs/reference/configuration/output/ · https://orval.dev/docs/guides/zod/
- jest-axe: https://github.com/NickColley/jest-axe
- knip: https://knip.dev/ · https://knip.dev/reference/plugins
- React Compiler: https://react.dev/blog/2025/10/07/react-compiler-1 · https://react.dev/reference/react-compiler/compilationMode
- Vite plugin-react changelog: https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md
- TypeScript 7: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Storybook Vitest addon: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
- Budgets: https://github.com/GoogleChrome/lighthouse-ci · https://github.com/ai/size-limit
- OpenFeature: https://openfeature.dev/
- Zod Mini: https://zod.dev/packages/mini
- Epic Stack:
  - features: https://github.com/epicweb-dev/epic-stack/blob/main/docs/features.md
  - security: https://github.com/epicweb-dev/epic-stack/blob/main/docs/security.md
  - testing: https://github.com/epicweb-dev/epic-stack/blob/main/docs/testing.md
  - decisions: https://github.com/epicweb-dev/epic-stack/tree/main/docs/decisions
  - env.server.ts: https://github.com/epicweb-dev/epic-stack/blob/main/app/utils/env.server.ts
  - healthcheck: https://github.com/epicweb-dev/epic-stack/blob/main/app/routes/resources/healthcheck.tsx
- Bulletproof React: https://github.com/alan2207/bulletproof-react/tree/master/docs
- t3-env: https://env.t3.gg/docs/introduction · https://env.t3.gg/docs/core
