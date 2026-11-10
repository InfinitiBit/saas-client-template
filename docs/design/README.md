# Design

## Mock mode

`pnpm dev:mock` runs the client with no Service behind it. Use it to look at a Screen.

```bash
pnpm dev:mock
PORT=<port> pnpm dev:mock
```

- **Port.** `PORT`, or the one in `.env`. If that port is taken, Vite moves to the next free one, so read the port from its output, never assume it.
- **Launch URL.** Vite prints it under `Launch:`, built from the port it bound: `http://localhost:<PORT>/dev#token=<dev token>`. Open it to land signed in. The dev token is an unsigned JWT in the Launch format ([ADR 0010](../adr/0010-the-launch-format.md)), alive until 2100. `/dev` is where the Tenant portal Launches a user, and it moves to `/` once the Launch is adopted.
- **Mode.** The dev server runs as SaaS, whatever `APP_MODE` in `.env` says.
- **Identity.** The dev Service answers it as `dev@example.com` in the `dev` Workspace, with no roles or permissions.
- **Data.** The dev Service (`src/features/api/lib/dev-service.ts`) answers every path the proxy forwards. MSW answers with the first handler that matches, in this order: the scenario's handlers, the Identity, the hand-written handlers `src/router.tsx` passes in (Notes' sample data that pages, searches and saves), then orval's generated handlers, which answer any other forwarded path with faker data. A request none of them matches goes through to the proxy.
- **Same data on every run.** Each generated handler seeds faker from the request's method, path and query, and counts its dates back from 2026-01-01. A page shows the same data on every reload, port and machine, in any order, and page 2 differs from page 1. A scenario keeps its own data. The Notes sample is seeded once at start, from the same date.
- **Edge data, on purpose.** The generated data stresses the layout. A string field whose name holds `name`, `title`, `description` or `company`, in any case, gets one of two letters, a 200-character sentence, a 60-character e-mail address with no spaces, `Müller-Lüdenscheidt GmbH & Co. KG`, or an ordinary phrase. A list holds 0 to 100 items. A name that is an enum, a format or not a string anywhere in the spec keeps its generated value. The Notes sample takes its titles from the same pool. To compare a Screen against its Figma frame, use a scenario: it shows the frame's data, not edge data. The pool is `src/features/api/lib/edge-text.ts`, which `orval.config.ts` reads: run `pnpm api:generate` after changing it.

### Reaching a State

A scenario gives one State the exact data its frame shows. It is `src/features/api/lib/dev-scenario.ts`, a git-ignored file whose `devScenario` export is an array of MSW handlers. Its handlers answer ahead of every other one.

1. Copy `src/features/api/lib/dev-scenario.example.ts` to `src/features/api/lib/dev-scenario.ts`.
2. Edit its data. The generated `get…MockHandler` helpers type it from the Service's schemas.
3. Reload the page.

Delete the file and reload to go back to the default data. A scenario is local: never commit one.

Several mock servers can run at once: each takes the next free port, and none opens a browser.
