# Data fetching

How a Screen reads from and writes to the Service.

## The generated client

`pnpm api:generate` runs orval (`orval.config.ts`) over the Service's OpenAPI spec: the committed example `openapi.yaml`, or the file or URL in `API_SPEC`. It writes `src/features/api/generated/`, which is committed, formatted by oxfmt and excluded from lint. Never edit it; regenerate.

- One hook per operation, named from its summary: "List Notes" → `useListNotes`, "Create Note" → `useCreateNote`. An operation without a summary fails the generation.
- Only the tags in `FORWARDED_TAGS` (`src/features/api/lib/api.ts`) are generated. The proxy forwards exactly those, so a hook never exists for a path the proxy refuses. A new Service tag goes into that list, which opens both.
- The raw request functions are not exported. Every call goes through Query, and so through the cache and the Session gate.
- The mutator, `apiRequest` in `src/features/api/lib/client.ts`, is an axios instance with **no base URL**: every call is same-origin, and only the proxy knows where the Service is. It unwraps `data` and puts a refusal's body on the error's `cause`, where the Session gate reads its `error_code`.

## Screens call generated hooks directly

```tsx
const { page, size, search } = route.useSearch();
const notes = useListNotes(
	{ page, size, search: search || undefined },
	{ query: { placeholderData: keepPreviousData } },
);
```

A list's page, size and search come from the address, never component state (ADR 0008).

No wrapper hook per endpoint and no hand-written `queryOptions` layer: a wrapper drifts from the generated types. Write a feature hook only when it is shared by several Screens or composes several calls. A hand-written call beside the generated client is a gap in the spec; fix the spec instead.

## Invalidate inline, by prefix

A query key is the URL followed by whichever of the operation's arguments were given (`apiQueryKey`): `["/api/notes", { page: 2, size: 20 }]`. A key getter called with no arguments is the URL alone, so it prefixes every page and search of that endpoint:

```ts
const queryClient = useQueryClient();
const create = useCreateNote({
	mutation: {
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }),
	},
});
```

Invalidation sits in the component that owns the write, so a reader sees what a mutation refreshes. There is no central invalidation map.

## Errors are handled once

The QueryClient in `src/router.tsx` sets `retry` and `throwOnError` for queries and mutations from the Session gate's classifier. A Session error throws to the router's error component, which draws the gate, and is never retried. Any other error is retried (queries only) and handed back to the Screen, which says so in place: `isError` for a read, and for a failed write too, beside the form that can retry it. Success is a toast (`sonner`, mounted in the root), since the form it came from is gone. A Screen writes no `try`/`catch` for Session handling.

## Mock at HTTP, never the hooks

orval also generates MSW handlers (`service.msw.ts`) and faker data (`service.faker.ts`). The faker data fills human-text fields from an edge pool and lists from empty to long, on purpose (`docs/design/README.md`).

- Tests stub the Service with those handlers on the shared MSW server (`src/testing/msw.ts`), per test, and drive the real generated client through the rendered router. Never mock a generated hook or module: that tests the mock.
- A feature that needs its handler to behave like the Service, such as paging, keeps that handler beside it (`src/features/notes/lib/notes-mock.ts`) and uses it in tests and in dev alike.
- Under `pnpm dev:mock` a browser worker (`src/features/api/lib/dev-service.ts`) answers the Identity, the hand-written handlers listed there, and every other forwarded path from orval's generated handlers, seeded per request (`generatedHandlers()`), and lets any other request through to the proxy. A git-ignored scenario goes ahead of them all (`docs/design/README.md`). Plain `pnpm dev` starts no worker. When `pnpm api:generate` adds an operation, add its handler to `generatedHandlers()`: `src/__tests__/dev-service.test.ts` fails until you do.
