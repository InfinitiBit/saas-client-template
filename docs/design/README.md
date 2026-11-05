# Design

## Mock mode

`pnpm dev:mock` runs the client with no Service behind it. Use it to look at a Screen.

```bash
pnpm dev:mock
PORT=<port> pnpm dev:mock
```

- **Port.** `PORT`, or the one in `.env`. If that port is taken, Vite moves to the next free one, so read the port from its output, never assume it.
- **Launch URL.** Vite prints it under `Launch:`, built from the port it bound: `http://localhost:<PORT>/dev#token=dev.dev.dev`. Open it to land signed in. `/dev` is the Tenant portal's arrival route, with `dev` as the tenant slug.
- **Mode.** The dev server runs as SaaS, whatever `APP_MODE` in `.env` says.
- **Identity.** The dev Service answers it as `dev@example.com` in the `dev` Workspace, with no roles or permissions.
- **Data.** The dev Service (`src/features/api/lib/dev-service.ts`) answers the Notes paths with sample data. Any path it does not answer goes through to the proxy.

Several mock servers can run at once: each takes the next free port, and none opens a browser.
