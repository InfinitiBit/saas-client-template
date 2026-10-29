<div align="center">

# SaaS client template

<p align="center">
    The starter for the frontend of an InfinitiBit SaaS Application. It handles Sessions, the API proxy, Brands, translations and list Screens, so a new Application only adds its own Screens.
</p>

[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-0F172A?logo=reactrouter&logoColor=white)](https://tanstack.com/start)
[![TanStack Router](https://img.shields.io/badge/TanStack_Router-FF7F50?logo=reactrouter&logoColor=white)](https://tanstack.com/router)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![InfinitiBit UI](https://img.shields.io/badge/InfinitiBit_UI-0F172A?logo=npm&logoColor=white)](https://www.npmjs.com/package/@infinitibit_gmbh/ui)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Orval](https://img.shields.io/badge/Orval-FF9E0F?logo=openapiinitiative&logoColor=white)](https://orval.dev/)
[![MSW](https://img.shields.io/badge/MSW-FF6A33?logo=mockserviceworker&logoColor=white)](https://mswjs.io/)
[![Paraglide](https://img.shields.io/badge/Paraglide-0F172A?logo=googletranslate&logoColor=white)](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
[![oxc](https://img.shields.io/badge/oxlint_+_oxfmt-0F172A?logo=rust&logoColor=white)](https://oxc.rs/)

</div>

## Overview

Each InfinitiBit Application is a Service, its own backend, plus the client in front of it. This template is the client, with everything every Application's client shares already built.

[`CONTEXT.md`](CONTEXT.md) defines the capitalised terms used here, such as Application, Service, Mode, Launch and Session.

### Key features

- **SaaS and Standalone Modes from one build.** With `APP_MODE=saas`, the Tenant portal Launches the user and the client calls the Service directly. With `APP_MODE=standalone`, the user signs in through gt and the client reaches the Service through gt's Facade.
- **HttpOnly Session.** The browser removes the Launch credentials from the address bar before the router starts, and the server keeps them in `__Host-` cookies that no script can read.
- **Server-rendered Session gate.** A visitor without a Session gets the sign-in card in the first response and never sees the Application.
- **Two Brands.** A deployment wears `default` or `gt`, chosen at runtime and set separately from the Mode.
- **English and German.** Paraglide translates the copy, and the locale lives in a cookie, never in the URL.
- **Generated API client.** orval generates TanStack Query hooks and MSW mocks from the Service's OpenAPI spec.
- **List Screens.** One `DataTable` draws every list and keeps its page, size and search in the URL.

## Architecture and philosophy

Code a feature owns lives in that feature. Route files stay thin and import their behaviour. [`docs/adr/`](docs/adr) records each architecture decision in its own file.

### Feature-based structure

```
src/
├── routes/             # Thin TanStack file-based routes
├── features/
│   ├── api/            # The /api proxy, the axios mutator and the generated client
│   ├── auth/           # Launch, Session cookies, sign-in and the Session gate
│   ├── brand/          # Reads APP_BRAND for the root document
│   ├── shell/          # The frame around every Screen
│   └── notes/          # The example feature, to replace
├── components/         # Components more than one feature uses (DataTable, ListSearch)
├── testing/            # MSW server and the render and request helpers for tests
├── application.ts      # This Application's name and Facade prefix
└── env.server.ts       # Reads and validates the server's environment
messages/               # en.json and de.json
docs/adr/               # Architecture decision records
```

Server-only modules end in `.server.ts` and live in the feature that owns them.

### Styling strategy

- **Components.** Build every Screen from [`@infinitibit_gmbh/ui`](https://www.npmjs.com/package/@infinitibit_gmbh/ui). Do not copy shadcn components or add another component library.
- **Tokens.** Colour, spacing, radius, shadow and type come only from the design system's `--ib-*` tokens, through the Tailwind theme in `src/styles.css`. `pnpm lint` rejects raw colours, arbitrary values and restyled components.
- **Icons.** Use only the design system's `<Icon>`.

### State management

- **Server state.** TanStack Query holds it all. Screens call the generated hooks directly and invalidate by the generated key prefix. [`docs/agents/data-fetching.md`](docs/agents/data-fetching.md) has the details.
- **List state.** A list's page, size and search live in the URL through `listSearchSchema` and `ListSearch`.
- **UI state.** Components keep it in local React state.

### API integration

The browser calls the Service's own paths under `/api` in both Modes. The same-origin proxy at `/api` is the only code that knows the Mode. It forwards only the tags listed in `FORWARDED_TAGS` in `src/features/api/lib/api.ts`, adds the Facade prefix in Standalone, and renews the Session once on a `401`.

orval reads [`openapi.yaml`](openapi.yaml), or the file or URL in `API_SPEC`, and generates one hook per operation, named from its summary. `List Notes` becomes `useListNotes`. Never edit `src/features/api/generated/`. Run `pnpm api:generate` instead.

### Authentication

- **SaaS.** The Tenant portal Launches the user onto `/<tenant-slug>#token=…&refresh_token=…`. Platform Auth renews and revokes the Session.
- **Standalone.** The sign-in card sends the user to gt, which returns them to `/auth/callback` with the same fragment. gt renews the Session.
- **Session.** The browser posts the fragment to `/session`, and the server stores it in `__Host-` HttpOnly cookies. The server decides between the Session gate and the Application before it renders anything.

### Routing

- Routes are TanStack Router files in `src/routes/`.
- Every Application Screen sits under the pathless `_authenticated` layout, which holds the Session gate.
- The arrival routes, `/$tenantSlug` and `/auth/callback`, stay outside it.
- The locale never appears in the URL, because the tenant slug already takes the first path segment.

## Getting started

### Prerequisites

- Node.js at the major in `.nvmrc`
- pnpm at the version pinned in `packageManager`. `npm install -g pnpm` installs it.

### Installation

1.  **Create the repository** with **Use this template** on GitHub. Tick **Include all branches**, or create `stage` and `main` from `dev` afterwards. Then clone it.

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Set up the environment.** Copy the example for your Mode to `.env`:

    ```bash
    cp .env.saas.example .env        # or .env.standalone.example
    ```

    | Variable            | Mode       | Purpose                                                                                                             |
    | ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
    | `APP_MODE`          | both       | `saas` or `standalone`. Required. The server refuses to start without it.                                           |
    | `APP_BRAND`         | both       | `default` or `gt`. Any other value falls back to `default`.                                                         |
    | `PORT`              | both       | The port the dev and built servers listen on.                                                                       |
    | `HOST_PORT`         | both       | The host port compose publishes the container on.                                                                   |
    | `TENANT_PORTAL_URL` | SaaS       | Where the client sends a visitor with no Session to be Launched.                                                    |
    | `PLATFORM_AUTH_URL` | SaaS       | Where the proxy renews a Session and where sign-out revokes it.                                                     |
    | `SERVICE_URL`       | SaaS       | The Service that `/api` forwards to. If it is unset, `/api` answers `501`.                                          |
    | `GT_SERVER_URL`     | Standalone | The gt server. gt must list this Application in its `SSO_APP_RETURN_URIS`, or sign-in fails with `SSO_APP_UNKNOWN`. |

    The server reads these at runtime and none of them reach the browser, so one image serves every Mode and Brand.

4.  **Make it your Application.** Follow [Start a new Application](#start-a-new-application).

### Running locally

```bash
pnpm dev
```

The app runs at `http://localhost:3000`, or on the `PORT` you set.

`pnpm dev` answers the Service's paths from MSW in the browser, so the example Notes list works with no Service running. To Launch yourself, open `http://localhost:3000/dev#token=dev.dev.dev`, with your own `PORT` in place of `3000`. The client checks only the token's shape and the mocked Service checks nothing, so you land signed in. The account menu shows no Identity, because the Identity comes from the real Service.

### Running with Docker

```bash
docker compose up -d --build
```

The Dockerfile builds in two stages on the Node major in `.nvmrc` and runs `.output/server/index.mjs` as a non-root user, with a health check on `/`. Compose joins the external `ib-saas-platform_default` network, so start the platform first.

## Start a new Application

Do these in the new repository, in order.

1. **Application name and cookie prefix.** Set `APPLICATION_NAME` in [`src/application.ts`](src/application.ts) to the code the platform and gt know the Application by. The cookie prefix follows from it. Set `FACADE_PREFIX` to the path gt's Facade mounts the Service under. gt chooses that path, so ask gt for it. Put the same name in `package.json`, in the service name in `compose.yaml`, which becomes the hostname on the platform network, and in the headings of `README.md` and `AGENTS.md`. Put the display name in the page `title` in `src/routes/__root.tsx` and in the heading of `CONTEXT.md`. Point `AGENTS.md` at the new repository's issues.
2. **`PORT`.** Set the port in both `.env.*.example` files. The Tenant portal registers it in the Launch URL and gt lists it in the return URI in `SSO_APP_RETURN_URIS`, so give each Application its own. `HOST_PORT` is the port compose publishes, and `SERVICE_URL` is where the Service answers.
3. **Service spec.** Replace `openapi.yaml` with the Service's OpenAPI spec, or run generation with `API_SPEC` set to a file or URL. Each operation needs a `summary`, because the summary names its hook.
4. **Forwarded tags.** List the Service's tags in `FORWARDED_TAGS` in `src/features/api/lib/api.ts`. The proxy forwards only those tags and orval generates hooks only for them. Run `pnpm api:generate`.
5. **Brand assets.** Each Brand uses the `favicon.ico`, `logo.svg` and `mark.svg` in `public/brand/<brand>/`. These belong to the company, not the Application, so replace them only if the Application ships its own. A new Brand needs those three files, its name in `src/features/brand/lib/brand.ts`, and a theme imported in `src/styles.css` the same way `brand-gt.css` is.
6. **Nav items.** Set the `nav` list in `src/routes/_authenticated.tsx`, and put its labels in `messages/en.json` and `messages/de.json`.

Then delete the Notes example and run `pnpm lint`, `pnpm type:check`, `pnpm test` and `pnpm build`.

### Delete the Notes example

Notes stands in for the Service until yours exists. Remove it once steps 3 and 4 point at your Service.

- Delete `src/features/notes/`, `src/routes/_authenticated.notes.tsx` and `src/__tests__/notes.test.tsx`.
- Remove the Notes nav item from `src/routes/_authenticated.tsx`. Remove `shell_nav_notes` and every `notes_*` key from `messages/en.json` and `messages/de.json`.
- In `src/features/api/lib/dev-service.ts`, replace the Notes handlers with the `get<Service>Mock()` handlers orval generated in `src/features/api/generated/service.msw.ts`, or with none.
- Delete `openapi.yaml` unless step 3 replaced it with your Service's spec.
- Rewrite the Notes examples in `docs/agents/data-fetching.md` with your own feature.
- Run `pnpm build` once. It regenerates `src/routeTree.gen.ts` without the Notes route, and the type check and the tests read that file.

## Available scripts

| Script              | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `pnpm dev`          | Start the dev server with the MSW-backed Service               |
| `pnpm build`        | Build for production into `.output/`                           |
| `pnpm start`        | Serve the build, reading `.env` if it exists                   |
| `pnpm test`         | Run the tests once with Vitest                                 |
| `pnpm lint`         | Run type-aware oxlint, including the design-system token rules |
| `pnpm format`       | Format with oxfmt                                              |
| `pnpm format:check` | Check formatting without writing                               |
| `pnpm type:check`   | Compile the messages, then run `tsc`                           |
| `pnpm api:generate` | Regenerate `src/features/api/generated/` from the OpenAPI spec |
| `pnpm commit`       | Commit with Commitizen                                         |

## Testing

MSW stubs every upstream, and a request that no test declared fails the test. Tests enter the client in one of two ways:

- Call a server route with a `Request` and check the `Response`, using `respond()` from [`src/testing/respond.ts`](src/testing/respond.ts).
- Render the real router at an address with `renderRouter()` from [`src/testing/render-router.tsx`](src/testing/render-router.tsx).

Mock the Service over HTTP, never the hooks. `holdSession()` from `src/testing/session.ts` gives a test a Session.

## Workflows

- **CI.** `.github/workflows/ci.yml` runs the lint, format, type and test checks and a build. Start it by hand from the Actions tab.
- **Release.** `.github/workflows/release.yml` runs semantic-release on every push to `main`.

## Contributing

Work moves from `dev` to `stage` to `main`. `dev` is the default branch.

1.  Branch from `dev` as `type/slug` or `type/scope/slug`, such as `fix/login-redirect` or `feat/notes/create-dialog`.
2.  Run the checks: `pnpm lint`, `pnpm format:check`, `pnpm type:check`, `pnpm test`.
3.  Commit with Conventional Commits. `pnpm commit` prompts for one, and commitlint rejects any other message.
4.  Push the branch and open a pull request against `dev`. A squash merge turns the pull request title into the commit, so write the title as a Conventional Commit.

### Releases

- Promote `dev` to `stage` for testing, and `stage` to `main` to release. Promote with a merge commit, never a squash, because semantic-release reads the individual commits.
- `main` holds releases only. semantic-release reads the Conventional Commits since the last tag, and when one calls for a release it tags the version and publishes a GitHub release with the notes. The GitHub releases are the changelog. `fix` makes a patch, `feat` a minor and a `BREAKING CHANGE` footer a major. Other types release nothing.
- A hotfix branches from `main` as `fix/slug` or `fix/scope/slug` and merges into `main`. Once semantic-release publishes it, merge `main` into `stage` and `stage` into `dev`, so every branch gets the fix.

### Git hooks

- `pre-commit` runs `pnpm lint-staged`, which lints and formats the staged files.
- `commit-msg` runs commitlint on the message.
- `pre-push` rejects a push to a remote branch whose name is not `main`, `stage`, `dev`, `type/slug` or `type/scope/slug`. Tags and branch deletions pass.
