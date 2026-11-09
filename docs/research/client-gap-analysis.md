# Client gap analysis

What to add to or refactor in the **client side** of `saas-client-template`: forms, data fetching, routing and URL state, feedback states, React 19, i18n, client tests and feature structure. Researched 2026-10-03 against `dev` at `c0eee1f`. It follows `template-gap-analysis.md` and does not repeat it. That note already covers the server, CI, headers, CSRF, env, logging, Docker, the error screen (§3.4), a11y basics (§3.11), E2E with axe (§3.10), Service 422s on form fields (§3.15) and SSR'd list data (§3.16, "not now").

Every recommendation is meant to fit `AGENTS.md`: the simplest thing that works, no speculative abstraction, established libraries over local code, and long-term decisions.

Verified locally. Scratch generations ran outside the repo, and nothing was committed.

- **Query keys.** Generating the repo's orval config against the spec plus one detail endpoint (`GET /api/notes/{note_id}`) gives the detail query the key `['/api/notes/abc', 'abc']`. `getListNotesQueryKey()` is `['/api/notes']`, so invalidating it does **not** reach a detail query, and the path param is in the key twice. With `shouldSplitQueryKey: true` and no `queryKey` mutator, the keys are `['api', 'notes', params]` and `['api', 'notes', noteId]`.
- **Hook-named getter.** The custom `queryKey` mutator makes orval name the options getter `useListNotesQueryOptions` instead of `getListNotesQueryOptions` (`@orval/query` `shouldUseOptionsHook`: `return !!queryKeyMutator || !!mutator?.isHook`). That gives a plain function a hook name, so it cannot be called from a loader or `ensureQueryData` without breaking the hook naming rule.
- **axios size.** axios 1.20 bundled alone for the browser (esbuild, minified) is 51,106 B raw and **19,507 B gzipped**.
- **axios array params.** axios serialises an array param as `tag[]=a&tag[]=b` (`axios.getUri`). FastAPI reads a list query param as repeated keys, `?q=foo&q=bar` ([FastAPI][fastapi-list]).
- **Placeholder data.** `placeholderData` is used only while the query is `pending` (`query-core/src/queryObserver.ts:610-614`). A failed new page therefore has no data, while a failed background refetch keeps its data.
- **Retry delay.** The default delay is `Math.min(1000 * 2 ** failureCount, 30000)` (`retryer.ts:53-55`). Three retries hold an error for about 7 s (1 + 2 + 4).
- **Router defaults.** `scrollRestoration` defaults to `false`, `defaultPreloadStaleTime` to 30 s and `defaultPendingMs` to 1000 ms (`router-core/dist/esm/router.d.ts`).
- **Devtools.** `@tanstack/devtools-vite` is in `vite.config.ts:19`, but no `<TanStackDevtools>` is mounted anywhere in `src/`.
- **No manual memoisation.** No `useMemo`, `useCallback`, `memo(`, `forwardRef` or `useEffect` exists in `src/` outside generated code.

## 1. Summary

| #   | Item                                                                                                                                                           | Category | Value    | Effort | Confidence                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ------ | --------------------------------- |
| 1   | Hierarchical generated keys: orval `shouldSplitQueryKey`, delete the `apiQueryKey` mutator. This also restores the non-hook `getXQueryOptions`.                | Data     | High     | S      | High (verified by generation)     |
| 2   | A form kit with `createFormHook`: `useAppForm` with a pre-bound `TextField` and `SubmitButton`, focus on the first invalid field, `useId`                      | Forms    | High     | S-M    | High                              |
| 3   | Data-first status checks on Screens, plus one `QueryCache.onError` toast for failed background refetches                                                       | Data/UX  | Med-High | S      | High                              |
| 4   | A recipe doc, `docs/agents/adding-a-screen.md`: spec → tag → generate → route → list → form → mock → tests → messages                                          | DX       | Med-High | S      | High                              |
| 5   | Stop retrying deterministic 4xx refusals: retry only when there was no answer, on 5xx, or on 408/429                                                           | Data     | Medium   | S      | High (amends ADR 0007)            |
| 6   | Replace axios with orval's `fetch` client and one fetch mutator, shared with `useIdentity`                                                                     | Data     | Medium   | S-M    | High (size) / Medium (arrays)     |
| 7   | Mount `<TanStackDevtools>` with the Query, Router and Form panels the installed Vite plugin expects                                                            | DX       | Medium   | S      | High                              |
| 8   | Show that a page is loading while the previous page stays (`isPlaceholderData` → `aria-busy` plus an indicator)                                                | UX       | Medium   | S      | Medium                            |
| 9   | `@testing-library/user-event` for new interaction tests; `axe-core` run in the existing seams                                                                  | Testing  | Medium   | S      | High                              |
| 10  | Return the invalidation promise from `onSuccess`, so the dialog closes once the list already shows the new row                                                 | Data     | Low-Med  | XS     | High                              |
| 11  | Prefetch list data on intent: `queryClient` in router context, `loaderDeps` and a browser-only `prefetchQuery`, `staleTime` 30 s, `defaultPreloadStaleTime: 0` | Data     | Medium   | M      | Medium (do after #1)              |
| 12  | `scrollRestoration: true` on the router                                                                                                                        | Routing  | Low-Med  | XS     | High                              |
| 13  | Import form limits from orval's generated zod constants (`createNoteBodyTitleMax`), not hand-copied numbers                                                    | Forms    | Low-Med  | S      | Medium (bundle effect unmeasured) |

Explicit **skip / not now** verdicts are in §3.14: Suspense queries for lists, an optimistic create, central invalidation (MutationCache meta or orval `mutationInvalidates`), `useActionState` and `<form action>`, `useOptimistic`, orval zod schemas as the form validator, `useBlocker` now, the Query ESLint plugin, locale switching without a reload, a global `staleTime` now, skeletons, a confirm dialog now, a feature generator, import-boundary lint now, `vitest-axe`, and `pendingComponent` now.

Suggested order: #1 → #2 → #3 and #5 (both in `router.tsx`) → #4 (it documents the result) → the rest. #11 depends on #1.

## 2. Already in place

These already match primary-source best practice and should be kept.

- **Screens call the generated hooks directly.** There is no wrapper per endpoint (`docs/agents/data-fetching.md:26`). TkDodo now advises the same: "There's nothing wrong with calling `useQuery` in your component directly" ([The Query Options API][tkdodo-qo]).
- **One QueryClient per router.** It is created inside `getRouter` (`src/router.tsx:33-43`), as TanStack requires for SSR: "create `QueryClient` inside the `createRouter` factory function. A module-level singleton leaks data between server requests" ([Router + Query skill][tsr-query-skill]).
- **Session errors are classified once.** `throwOnError` and `retry` come from the gate's classifier (`src/router.tsx:21`, `:37-41`). Mutations are never retried (`:40-41`).
- **Cancellation works.** The generated query functions pass Query's `signal` into the axios config (`src/features/api/generated/service.ts:55-61`, `:82-84`), so changing the page or search aborts the request in flight. Mutations do not take a signal, which is right.
- **Paginated lists keep the previous page.** `placeholderData: keepPreviousData` (`src/features/notes/components/notes-list.tsx:38-41`), as in TanStack's paginated-queries guide ([Paginated queries][tq-paginated]).
- **List state lives in the URL** (ADR 0008).
  - zod 4 goes straight into `validateSearch`, with `.default().catch()` on each field (`src/components/list-search.tsx:13-17`). The Router docs say "With Zod v4, you should directly use the schema in `validateSearch`" ([Search params][tsr-search]).
  - `stripSearchParams` sits in the route's middlewares (`src/routes/_authenticated.notes.tsx:8`).
  - Writes use a functional `navigate` (`notes-list.tsx:58-61`). A search commit uses `replace: true` and resets `page` to 1 (`list-search.tsx:44-50`).
  - The Pacer debouncer flushes on blur (`list-search.tsx:40-53`, `:66`).
- **Validation timing follows TanStack Form's current guidance.** `revalidateLogic()` stays quiet until the first submit, then re-validates on change (`new-note-dialog.tsx:84-85`). zod 4 is used as a Standard Schema.
- **Transformed values are read the documented way.** `schema.parse(value)` in `onSubmit` (`new-note-dialog.tsx:86-87`) is what the docs prescribe: TanStack Form "does not preserve the output data of a Standard Schema" ([Submission handling][tsf-submit]).
- **Mutation errors stay in the dialog, success is a toast.** A failed write leaves what was typed (`new-note-dialog.tsx:104-107`). Success is a toast after the dialog closes (`:70-76`).
- **Invalidation and the toast live in `useMutation`'s own callbacks**, so they still fire if the dialog unmounts mid-flight. TkDodo warns that callbacks on `mutate` "might not fire _at all_ if the component unmounts" ([Mastering Mutations][tkdodo-mut]).
- **React 19 and the Compiler.** There is no manual memoisation and no `useEffect` (verified above). Context is read with `use()` (`src/features/shell/components/shell.tsx:27`). `ListSearch` uses the "adjust state when a prop changes" pattern (`list-search.tsx:55-59`) instead of an effect.
- **MSW is the only mock seam.** orval's generated handlers and faker data are used, with stateful handlers beside the feature (`src/features/notes/lib/notes-mock.ts`) shared by dev and tests. An unhandled request fails the test (`src/testing/setup.ts:30`). The notes tests cover the empty, no-match, error-after-retries, Session-gate, Back/forward, malformed-URL and keep-previous-page states (`src/__tests__/notes.test.tsx`).
- **i18n.** Messages are read per render through factories (`new-note-dialog.tsx:30-39`, `notes-list.tsx:19-32`). Dates go through `Intl` with `getLocale()`, and language names through `Intl.DisplayNames` (`shell.tsx:147`). An en/de parity test exists.
- **Type-safe navigation.** `NavItem.to` is `LinkProps['to']` (`shell.tsx:32-35`), and Screens use `getRouteApi`.

## 3. Recommendations

### 3.1 Hierarchical generated query keys; drop `apiQueryKey`

**Current.**

- `orval.config.ts:45` swaps orval's key factory for `apiQueryKey` (`src/features/api/lib/client.ts:24-34`). That function builds `[url, ...args]`, with the URL already filled in.
- The list works: `getListNotesQueryKey()` → `['/api/notes']` prefixes every page.
- The first endpoint with a path param breaks the model, as shown in the generation above:
  - The detail key is `['/api/notes/abc', 'abc']`, so `invalidateQueries({ queryKey: getListNotesQueryKey() })` (`new-note-dialog.tsx:71-73`) never refreshes a detail Screen.
  - The id appears twice.
  - `docs/agents/data-fetching.md:30` promises a prefix that only holds for endpoints without path params.
- Because a `queryKey` mutator is configured, orval emits `useListNotesQueryOptions` (`service.ts:67`). That is a plain function with a hook's name, so it cannot be used in a loader (#11), in `queryClient.fetchQuery` or in `ensureQueryData` without breaking the hook naming rule.

**Best practice.**

- "Structure your Query Keys from _most generic_ to _most specific_", so that invalidating `['todos']` covers both lists and details ([Effective React Query Keys][tkdodo-keys]).
- orval has this built in: `shouldSplitQueryKey` generates array keys split per path segment ([orval output][orval-output]). Verified output: `['api', 'notes', params]` and `['api', 'notes', noteId]`.
- With no key mutator, orval names the getter `getXQueryOptions`, which is what `ensureQueryData` and `prefetchQuery` take. TkDodo: "Separating QueryKey from QueryFunction was a mistake"; `queryOptions` is the shared unit ([The Query Options API][tkdodo-qo]).

**Proposal.**

- In `orval.config.ts`, replace `queryKey: { path: client, name: 'apiQueryKey' }` with `shouldSplitQueryKey: true`.
- Delete `apiQueryKey` from `client.ts`.
- Regenerate.
- Rewrite `data-fetching.md:28-42` around `getListNotesQueryKey()` → `['api', 'notes']`, which covers every list, search and detail of the resource.

The call site in `new-note-dialog.tsx` does not change. No test asserts a key.

**Risk.** Prefix invalidation is now resource-wide: a create also refetches active detail queries of the same resource. That is what TkDodo recommends. A Screen that needs only the lists can pass a `predicate` (unverified whether it will ever be needed).

### 3.2 A form kit built on `createFormHook`

**Current.** `new-note-dialog.tsx:108-139` wires each field by hand:

- the `Label` and its `htmlFor`
- a fixed `id`
- `aria-describedby`
- `error={!isValid}`
- the `value`, `onChange` and `onBlur` handlers
- an error `<p>` built from tokens, because the design system has no field message (ADR 0002 consequences)

That is about 15 lines per field, copied into every future form. On an invalid submit, focus stays on the Submit button, and the error line is not a live region, so a screen-reader user hears nothing. The submit button reads `create.isPending` directly (`:146`).

**Best practice.**

- TanStack Form calls `createFormHook` the "Recommended approach for large-scale forms": "pre-bind components, ensuring type safety and reducing boilerplate" ([Form composition][tsf-composition]; [quick start][tsf-quickstart]).
- `useFieldContext` gives a field component its field. `useFormContext` and `form.Subscribe` give a submit button `isSubmitting` and `canSubmit`.
- Focus management: "you may want to focus the first input with an error". The React guide does this in `onSubmitInvalid` by focusing the first `[aria-invalid="true"]` ([Focus management][tsf-focus]). The installed `form-core` has `onSubmitInvalid` (`FormApi.d.ts:163`).
- The design system's `Input` already sets `aria-invalid` from its `error` prop. The existing test asserts it (`notes.test.tsx:361`).

**Proposal.** Write one small module now. The notes dialog is the first consumer, and every Application's forms are the reason it exists. This follows the precedent of `DataTable` and `ListSearch` in `src/components/`.

- `src/components/form.tsx`:
  - `createFormHookContexts()`, then `createFormHook({ fieldComponents: { TextField, TextareaField }, formComponents: { SubmitButton } })`.
  - Export `useAppForm` only.
- `TextField({ label })`:
  - `useId()` for the input and error ids.
  - `Label` + `Input` with `error={!field.state.meta.isValid}` and `aria-describedby` pointing at the error line.
  - The token-built error line, which then lives in one place to delete once the design system ships a field message.
- `SubmitButton({ children })`: `form.Subscribe` to `isSubmitting`.
  - For it to cover the request, `onSubmit` must `await create.mutateAsync(...)`.
  - TkDodo prefers `mutate` because it handles errors for you ([Mastering Mutations][tkdodo-mut]). Here the error still shows through `create.isError`, so the only care needed is to `catch` the rejection inside `onSubmit`.
  - Unverified: whether a rejected `onSubmit` surfaces as an unhandled rejection in TanStack Form 1.33.
- Pass `onSubmitInvalid` to every form from `useAppForm`'s callers. It focuses the first `[aria-invalid="true"]` inside the form element, not `document`, because dialogs stack.
- Rewrite `NewNoteForm` with `form.AppField` and `field.TextField`. The dialog's `onOpenAutoFocus` keeps working if it focuses the form's first field, not `#note-title`.

**Risk.**

- One more indirection. It earns its place only if every form uses it; say so in the recipe (#4).
- Keep the kit to fields the design system already has (`Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup`). Add each one when its first form needs it, not up front.

### 3.3 Data-first status checks and a background-error toast

**Current.**

- `notes-list.tsx:52-79` checks `isError` before `data`.
- With the default `refetchOnWindowFocus`, a background refetch that fails after its retries replaces a table the user is reading with "The notes could not be loaded."
- No Screen hears about a background failure otherwise.

**Best practice.**

- TkDodo checks data first, "since React Query retries failed queries three times with exponential backoff, potentially leaving users staring at an error screen… before displaying data that was already available" ([Status Checks][tkdodo-status]).
- For background failures he uses one global callback: `QueryCache({ onError: (error, query) => { if (query.state.data !== undefined) toast.error(...) } })` ([React Query Error Handling][tkdodo-errors]).
- A failed _new_ page still lands on the error branch, because `placeholderData` only applies while pending (verified above).

**Proposal.**

- Reorder Screens to `data ? table : isError ? banner : indicator`. Write that rule into `data-fetching.md`.
- Add `queryCache: new QueryCache({ onError })` in `router.tsx`. It skips Session errors, which already go to the gate, and toasts a translated "Couldn't refresh. Showing what was loaded." only when `query.state.data !== undefined`.
- Add one test: a refetch that fails keeps the rows and shows the toast.

**Risk.** Stale rows with a toast is the intended trade. If a Screen must never show stale data, it can opt out with its own check.

### 3.4 A recipe for adding a Screen

**Current.**

- `docs/agents/` has data fetching, issues, triage and domain docs, but nothing that walks through adding a resource from start to finish.
- The steps are spread across ADR 0006 (`FORWARDED_TAGS`), ADR 0008 (list route), `data-fetching.md`, `dev-service.ts` (mock list), `AGENTS.md` (layout) and the en/de parity test.
- An agent adding "Projects" today has to rebuild that order from the Notes code.

**Best practice.** Bulletproof React documents the feature folder and its rules as prose ([project structure][bpr-structure]). Neither it nor the TanStack examples use a generator. The worked example plus a checklist is the established form.

**Proposal.** Add a checklist doc of about 60 lines that points at the Notes files as the worked example:

1. Spec: an operation `summary` for every operation, and the tag added to `FORWARDED_TAGS`.
2. Run `pnpm api:generate`.
3. Route file: `validateSearch: listSearchSchema` (or `.extend`) plus `stripSearchParams`.
4. `src/features/<x>/components/` with columns and the `DataTable`.
5. The form through `useAppForm` (#2).
6. Invalidate with `getXQueryKey()`.
7. Stateful handlers in `lib/<x>-mock.ts` and the `dev-service.ts` list.
8. Tests through `renderRouter`: list, empty, error, Session gate, create, invalid create.
9. en and de messages, with `plural`, `number` and `datetime` formatters where needed (§3.13).

Link it from `AGENTS.md` beside `data-fetching.md`.

**Risk.** Docs drift. Keep it a list of pointers, not copied code.

### 3.5 Retry only what can succeed on a retry

**Current.**

- `router.tsx:37` retries every non-Session query error up to three times.
- That includes a 403 permission refusal (session-gate.tsx:18 leaves those to the Screen), a 404 or a 422. Each is deterministic, and each holds the spinner for about 7 s before the Screen can say so.
- The notes test advances 10 s to reach the error (`notes.test.tsx:296-310`).

**Best practice.**

- `retry` accepts `(failureCount, error) => boolean`. The default is 3 retries on the client and 0 on the server, with exponential backoff capped at 30 s ([QueryOptions][tq-options]).
- TkDodo's error-handling post routes errors by status (`throwOnError: (error) => error.response?.status >= 500`) ([React Query Error Handling][tkdodo-errors]).
- Retrying a request the server refused for a reason that will not change only delays the answer. This is reasoning, not a quoted rule.

**Proposal.**

- `retry: (n, error) => !isSessionError(error) && isTransient(error) && n < 3`.
- `isTransient` is true when there was no response, on 5xx, or on 408/429.
- With #6 it reads a `status` the mutator puts on the error. With axios it reads `error.response?.status`.
- Amend ADR 0007's bullet ("Any other query error is retried up to three times") and `data-fetching.md:46`.

**Risk.** A proxy or gateway that answers a transient fault with a 4xx would not be retried. Re-read the proxy's own codes (`api-proxy.server.ts`) when writing `isTransient`.

### 3.6 orval's fetch client instead of axios

**Current.**

- `httpClient: 'axios'` (`orval.config.ts:35`) with an axios instance that has no base URL, no interceptors and no config beyond `.request` (`client.ts:5-18`). The proxy does everything an interceptor would.
- `useIdentity` already uses `fetch` and wraps refusals the same way by hand (`src/features/auth/hooks/identity.ts:19-28`). The codebase has two HTTP clients and two copies of the "refusal body as `cause`" rule that `session-gate.tsx:34-35` depends on.
- axios costs 19.5 KB gzipped on every data Screen (measured above). It also serialises array query params as `tag[]=a`, which FastAPI does not read (verified above, [FastAPI][fastapi-list]). That is a latent bug for the first filter list.

**Best practice.**

- orval supports `httpClient: 'fetch'` with a custom mutator of the Fetch signature, `(url: string, init?: RequestInit) => Promise<T>`.
- `override.fetch.includeHttpResponseReturnType: false` makes the mutator resolve with the body alone ([orval output][orval-output]; [orval mutator examples][orval-fetch]).
- The generated URL builder uses `URLSearchParams` (verified by generation).
- Native `fetch` sits above a dependency on the `AGENTS.md` ladder.

**Proposal.**

- Switch to `httpClient: 'fetch'` with `fetch: { includeHttpResponseReturnType: false }`.
- One `apiRequest(url, init)` of about 12 lines:
  - It throws `new Error(…, { cause: body })` with a `status` on a non-OK response.
  - It returns `undefined` on 204.
  - It parses JSON otherwise.
- `readIdentity` calls `apiRequest(IDENTITY_PATH)` and keeps only `identitySchema.parse`.
- Remove axios.

**Risk.**

- `ErrorType<Body>` stops being an `AxiosError`; nothing outside `client.ts` reads axios fields today.
- How orval's fetch client serialises arrays with `explode` is unverified. Check it with the first array parameter.

### 3.7 Mount the TanStack Devtools

**Current.** `devtools()` runs in `vite.config.ts:19`. No panel is mounted, so Query's cache, the Router's matches and loaders, and Form state are invisible in `vite dev`.

**Best practice.**

- Mount `<TanStackDevtools plugins={[{ name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> }, { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> }]} />` at the root.
- The Vite plugin "removes the devtools import and JSX element from the production build" (`removeDevtoolsOnBuild` defaults to true) ([TanStack Devtools][devtools]).
- TanStack's Start + Query example mounts the Query and Router devtools ([example root][tsr-example-root]).

**Proposal.**

- Add the dev dependencies `@tanstack/react-devtools`, `@tanstack/react-query-devtools`, `@tanstack/react-router-devtools` and `@tanstack/react-form-devtools`.
- Render `<TanStackDevtools>` in `RootDocument` (`src/routes/__root.tsx:61-76`).
- If the team does not want devtools, delete the Vite plugin instead. A half-installed tool is the worst option.

**Risk.** Confirm after `pnpm build` that no devtools chunk ships (`grep -r react-query-devtools .output/public`).

### 3.8 Say that the next page is loading

**Current.**

- After a page click, `Pagination` shows the new page at once, since it reads from the URL (`notes-list.tsx:63`).
- The rows stay on the old page with no sign that anything is happening until the answer arrives.
- The same happens when a search commits.

**Best practice.** TanStack's paginated example uses `isPlaceholderData` to know the data is the previous page's, and `isFetching` to "show a background loading indicator" ([Paginated queries][tq-paginated]).

**Proposal.**

- `DataTable` takes `busy` (`notes.isPlaceholderData`) and sets `aria-busy` on its wrapper.
- It draws the design system's `ActivityIndicator` beside `Pagination`.
- Dimming the rows is styling, so ask the design system for a busy state rather than adding opacity here (ADR 0002).

**Risk.** None of note. Flicker on fast answers is the indicator's own concern (unverified whether `ActivityIndicator` has a delay).

### 3.9 `user-event` and axe in the existing seams

**Current.**

- `@testing-library/user-event` is not installed. All 29 interactions use `fireEvent` (`src/__tests__/`). `fireEvent.change` skips focus and blur, so `ListSearch`'s flush-on-blur (`list-search.tsx:66`) is never exercised.
- No test runs axe. The previous note's axe check is in E2E (§3.10 there), which runs only once that suite exists.

**Best practice.**

- "`fireEvent` dispatches _DOM events_, whereas `user-event` simulates full _interactions_" ([user-event][user-event]).
- jest-axe: "Color contrast checks do not work in JSDOM so are turned off", and "~30% of access barriers are missed by automated testing" ([jest-axe][jest-axe]).
- `vitest-axe` is a fork of jest-axe, last published as 0.1.0 in January 2025 (`npm view`). jest-axe 11 documents only Jest.

**Proposal.**

- Install `@testing-library/user-event`. Use `userEvent.setup()` in new tests and in any test touching focus, typing or keyboard. With fake timers, use `setup({ advanceTimers: vi.advanceTimersByTime })`. Do not mass-migrate passing tests.
- Install `axe-core` alone and call it directly, with no wrapper library:

  ```ts
  expect((await axe.run(document)).violations).toEqual([]);
  ```

  Put it in one test per Screen state: list, empty, dialog open with errors, gate.

**Risk.** axe in jsdom misses contrast and anything that depends on layout. It complements E2E; it does not replace it.

### 3.10 Await the invalidation in `onSuccess`

**Current.** `new-note-dialog.tsx:71-75` fires `invalidateQueries` with `void`, closes the dialog and toasts. The list then refetches after the dialog has gone, so for a moment the new note is missing.

**Best practice.** "Promises returned from the mutation callbacks are awaited by React Query… `invalidateQueries` returns a Promise", so the mutation stays pending until the refetch ends ([Mastering Mutations][tkdodo-mut]).

**Proposal.** Make `onSuccess` async: `await queryClient.invalidateQueries(...)`, then toast, then `onCreated()`. The Submit button stays busy through the refetch.

**Risk.** A slow list keeps the dialog open a little longer. That is the intended trade.

### 3.11 Prefetch list data on intent (client-only)

**Current.**

- `defaultPreload: 'intent'` (`router.tsx:47`) has nothing to preload: no route has a loader.
- Every navigation into a list draws a spinner and then fetches.
- The previous note left SSR'd list data as "not now", because a server-side call needs the cookie path to the Service. This is the browser-only half, which does not.

**Best practice.**

- TanStack's Start + Query example:
  - passes `context: { queryClient }`
  - sets `defaultPreloadStaleTime: 0`
  - sets a default `staleTime: 30_000`
  - calls `context.queryClient.ensureQueryData(...)` in loaders ([example router][tsr-example-router]; [External data loading][tsr-external])
- "Set `defaultPreloadStaleTime: 0` when using TanStack Query. Without this, Router's built-in preload cache (30s default) prevents Query from controlling data freshness" ([Router + Query skill][tsr-query-skill]).
- `loaderDeps` keys the loader by search params ([Data loading][tsr-data-loading]).
- With SSR, set "some default staleTime above 0 to avoid refetching immediately on the client" ([Query SSR][tq-ssr]). Here it is also what stops a hover prefetch from being refetched on mount.

**Proposal** (after #1, which provides `getListNotesQueryOptions`):

- `__root.tsx` → `createRootRouteWithContext<{ queryClient: QueryClient }>()`.
- `router.tsx` → `context: { queryClient }`, `defaultPreloadStaleTime: 0`, `staleTime: 30_000` in the query defaults.
- The list route:

  ```ts
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    if (!import.meta.env.SSR) void context.queryClient.prefetchQuery(getListNotesQueryOptions(deps));
  },
  ```

  It is not awaited, so navigation never waits and the Screen keeps its own `isError`, Session and empty handling. The `import.meta.env.SSR` guard matches `router.tsx:26`.

**Risk.**

- `staleTime: 30_000` means a list revisited within 30 s does not refetch on mount. Window focus still refetches stale data.
- The custom `retry` (`router.tsx:37`) overrides Query's server default of 0. Keep the guard, so no query ever runs on the server until the cookie path exists.
- Medium confidence that the gain is felt. Measure the hover-to-click gap on the real Service before adopting.

### 3.12 Scroll restoration

**Current.** `createRouter` (`router.tsx:45-49`) leaves `scrollRestoration` at its default, `false`. Back from page 3 of a long list lands at the top of page 2.

**Best practice.** `scrollRestoration: true` "Enables automatic monitoring, caching, and restoring of scroll positions… across navigations". TanStack's Start build-from-scratch router sets it ([Scroll restoration][tsr-scroll]).

**Proposal.** One line. `ListSearch` already passes `resetScroll: false` (`list-search.tsx:49`), and that keeps working.

**Risk.** None found. Tests already stub `window.scrollTo` (`src/testing/setup.ts:25-27`).

### 3.13 Generated limits for form rules; i18n formatting conventions

**Current.**

- `TITLE_MAX = 200` (`new-note-dialog.tsx:28`) and the page size bound `max(100)` (`list-search.tsx:15`) copy numbers that are in the spec.
- No message uses plurals yet.

**Best practice.**

- orval's `client: 'zod'` output exports each constraint as a constant. Verified with the repo's naming: `createNoteBodyTitleMax = 200`, `listNotesQuerySizeMax = 100`, `listNotesQuerySizeDefault = 20` ([orval zod][orval-zod]).
- Paraglide has built-in `plural` (`Intl.PluralRules`), `number`, `datetime` and `relativetime` formatters in message declarations ([Paraglide formatting][pg-format]; [variants][pg-variants]).

**Proposal.**

- Add a second orval output (`client: 'zod'`, `target: …/generated/service.zod.ts`).
- Import `createNoteBodyTitleMax` in the form. The localised messages stay hand-written.
- Keep `listSearchSchema`'s 100 as it is: it is shared by all lists. A list whose Service differs `.extend`s it.
- In the recipe (#4), state that counts use the `plural` formatter and that numbers and dates use `number`/`datetime` or `Intl` with `getLocale()`. Add no local i18n helper module.

**Risk.** Unmeasured: whether importing one constant pulls the module's `zod.object(...)` calls into the bundle, since orval does not mark them pure. Check the chunk after adding it. If it does, the value is low; skip it.

### 3.14 Skip, or not now

| Item                                                                     | Verdict  | Why                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useSuspenseQuery` for lists                                             | Skip     | A suspending list falls back on every page and search change unless each navigation is a transition. `keepPreviousData` already gives the no-flash behaviour ([Paginated queries][tq-paginated]). Revisit for detail Screens once #11 exists.                                                                                              |
| Optimistic create                                                        | Skip     | The list is paged, searched and ordered by the Service. A local insert would sit on the wrong page or match the wrong search. If wanted later, use the "via the UI" approach (`variables` plus `useMutationState` on `getCreateNoteMutationKey()`, already generated) before manipulating the cache ([Optimistic updates][tq-optimistic]). |
| Central invalidation (`MutationCache` meta, orval `mutationInvalidates`) | Not now  | TkDodo's global `MutationCache.onSuccess` with `meta.invalidates` ([Automatic invalidation][tkdodo-auto]) and orval's `mutationInvalidates` config both work. With one mutation, inline is clearer, as `data-fetching.md:42` decided. Revisit when mutations start invalidating other resources.                                           |
| `useActionState`, `<form action>`, `useOptimistic`                       | Skip     | Writes go through TanStack Query to the proxy, and form state through TanStack Form. React actions would add a third, parallel pending/error state machine with no server action behind it ([useActionState][react-uas]).                                                                                                                  |
| orval zod schemas as the form validator                                  | Skip     | Generic zod messages ("Too small…") are worse than product copy ("Enter a title."). Mapping them through a zod `customError` per field costs more than the hand-written schema. Reuse the constants (#13) instead.                                                                                                                         |
| `useBlocker` for unsaved changes                                         | Not now  | The only form is a modal dialog, so navigation cannot happen while it is open. Add `useBlocker({ shouldBlockFn: () => form.state.isDirty, withResolver: true })` with the first full-page form ([useBlocker][tsr-blocker]).                                                                                                                |
| `@tanstack/eslint-plugin-query`                                          | Skip     | Its main rule (`exhaustive-deps`) checks hand-written keys, and orval writes every key. `useIdentity` is the only hand-written query.                                                                                                                                                                                                      |
| Locale switch without a reload                                           | Skip     | ADR 0004 chose cookie plus reload, so there is no locale state to sync. Switching is rare.                                                                                                                                                                                                                                                 |
| A global `staleTime` now                                                 | Not now  | Only with #11. Without loaders, the default of 0 costs only a background refetch on mount or focus. Each Identity refetch on focus also doubles as a Session probe that reaches the gate (`useIdentity` inherits `throwOnError`).                                                                                                          |
| Skeletons                                                                | Skip     | The design system ships no skeleton. `ActivityIndicator` is its loading primitive (ADR 0002). Raise it upstream if wanted.                                                                                                                                                                                                                 |
| Confirm dialog for destructive actions                                   | Not now  | No destructive action exists. The package has `Dialog` but no `AlertDialog` (`role="alertdialog"`). Ask the design system before the first delete.                                                                                                                                                                                         |
| Feature generator (plop, turbo gen)                                      | Skip     | A generator is a second copy of the conventions that drifts. The recipe (#4) plus the Notes example is enough.                                                                                                                                                                                                                             |
| Import-boundary lint (Bulletproof's `import/no-restricted-paths`)        | Not now  | Bulletproof enforces "shared → features → app" ([project structure][bpr-structure]). Here `api`, `auth`, `brand` and `shell` are platform features every Screen imports by design. Whether oxlint implements that rule is unverified.                                                                                                      |
| `vitest-axe`                                                             | Skip     | Pre-1.0 and stale (above). Call `axe-core` directly (#9).                                                                                                                                                                                                                                                                                  |
| `@testing-library/jest-dom`                                              | Optional | `toHaveAccessibleDescription` would assert the `aria-describedby` wiring of #2 more directly than `getAttribute`. It is not needed otherwise.                                                                                                                                                                                              |
| `pendingComponent` / `pendingMs`                                         | Not now  | They only matter for awaited loaders. #11 deliberately does not await.                                                                                                                                                                                                                                                                     |
| Infinite queries                                                         | Skip     | ADR 0008 chose numbered pages in the URL.                                                                                                                                                                                                                                                                                                  |
| `linkOptions`                                                            | Skip     | Nav items are already typed through `LinkProps['to']`. Use `linkOptions` once a nav item carries search or params.                                                                                                                                                                                                                         |

## 4. Refactor and efficiency opportunities

1. **Page count from the Service's answer.** `pageCount={Math.ceil(notes.data.total / size)}` (`notes-list.tsx:64`) divides by the size in the address. Use `notes.data.size`: the `NotePage` says what the Service actually paged by, in case it clamps a size the URL asked for.
2. **One refusal rule.** After #6, `identity.ts:19-28` and `client.ts:7-18` collapse into one mutator. The comment in `session-gate.tsx:34-35` then names one place.
3. **The copy action.** `void navigator.clipboard.writeText(...)` (`notes-list.tsx:68`) gives no feedback and turns a refused clipboard into an unhandled rejection. Toast success or failure with two messages.
4. **The hard-coded `note-title` id** (`new-note-dialog.tsx:55`, `:111-121`) goes away with `useId` in #2. The dialog's `onOpenAutoFocus` then focuses the form's first field.
5. **`disabled` on the submit button** (`new-note-dialog.tsx:146`). TanStack Form's docs note that "disabled buttons are not accessible, use `aria-disabled` instead" ([Form validation][tsf-validation]). Decide this once, in the `SubmitButton` of #2. Whether the design system's `Button` supports `aria-disabled` styling is unverified.
6. **Docs drift.** `data-fetching.md:30` (key shape) and `:46` (retry) change with #1 and #5. ADR 0007's retry bullet changes with #5.
7. **A missing loading-state test.** No test asserts the first-load indicator ("Loading notes"). Add one when touching the list for #3 or #8.

## 5. Sources

[tkdodo-qo]: https://tkdodo.eu/blog/the-query-options-api
[tkdodo-keys]: https://tkdodo.eu/blog/effective-react-query-keys
[tkdodo-mut]: https://tkdodo.eu/blog/mastering-mutations-in-react-query
[tkdodo-errors]: https://tkdodo.eu/blog/react-query-error-handling
[tkdodo-status]: https://tkdodo.eu/blog/status-checks-in-react-query
[tkdodo-auto]: https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations
[tq-paginated]: https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries
[tq-optimistic]: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
[tq-ssr]: https://tanstack.com/query/latest/docs/framework/react/guides/ssr
[tq-options]: https://github.com/TanStack/query/blob/main/docs/framework/angular/reference/interfaces/QueryOptions.md
[tsr-external]: https://tanstack.com/router/latest/docs/guide/external-data-loading
[tsr-data-loading]: https://tanstack.com/router/latest/docs/guide/data-loading
[tsr-search]: https://tanstack.com/router/latest/docs/guide/search-params
[tsr-scroll]: https://tanstack.com/router/latest/docs/guide/scroll-restoration
[tsr-blocker]: https://tanstack.com/router/latest/docs/api/router/useBlockerHook
[tsr-query-skill]: https://github.com/TanStack/router/blob/main/packages/react-router/skills/compositions/router-query/SKILL.md
[tsr-example-router]: https://github.com/TanStack/router/blob/main/examples/react/start-basic-react-query/src/router.tsx
[tsr-example-root]: https://github.com/TanStack/router/blob/main/examples/react/start-basic-react-query/src/routes/__root.tsx
[tsf-composition]: https://tanstack.com/form/latest/docs/framework/react/guides/form-composition
[tsf-quickstart]: https://tanstack.com/form/latest/docs/framework/react/quick-start
[tsf-focus]: https://tanstack.com/form/latest/docs/framework/react/guides/focus-management
[tsf-submit]: https://tanstack.com/form/latest/docs/framework/react/guides/submission-handling
[tsf-validation]: https://tanstack.com/form/latest/docs/framework/react/guides/validation
[devtools]: https://github.com/TanStack/devtools/blob/main/packages/devtools/skills/devtools-production/SKILL.md
[orval-output]: https://orval.dev/docs/reference/configuration/output/
[orval-fetch]: https://github.com/orval-labs/orval/blob/master/docs/content/docs/reference/configuration/output.mdx
[orval-zod]: https://orval.dev/docs/guides/zod/
[pg-format]: https://github.com/opral/paraglide-js/blob/main/docs/formatting.md
[pg-variants]: https://github.com/opral/paraglide-js/blob/main/docs/variants.md
[user-event]: https://testing-library.com/docs/user-event/intro
[jest-axe]: https://github.com/NickColley/jest-axe
[react-uas]: https://react.dev/reference/react/useActionState
[bpr-structure]: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
[fastapi-list]: https://fastapi.tiangolo.com/tutorial/query-params-str-validations/#query-parameter-list-multiple-values

- TkDodo (TanStack Query maintainer):
  - [The Query Options API][tkdodo-qo]
  - [Effective React Query Keys][tkdodo-keys]
  - [Mastering Mutations][tkdodo-mut]
  - [Error handling][tkdodo-errors]
  - [Status checks][tkdodo-status]
  - [Automatic invalidation][tkdodo-auto]
- TanStack Query:
  - [paginated queries][tq-paginated]
  - [optimistic updates][tq-optimistic]
  - [SSR][tq-ssr]
  - [useQuery options][tq-options]
  - installed `@tanstack/query-core@5.104.0` source: `retryer.ts:53-55`, `:200`; `queryObserver.ts:610-614`
- TanStack Router and Start:
  - [external data loading][tsr-external]
  - [data loading][tsr-data-loading]
  - [search params][tsr-search]
  - [scroll restoration][tsr-scroll]
  - [useBlocker][tsr-blocker]
  - [Router + Query skill][tsr-query-skill]
  - Start + Query example: [router][tsr-example-router], [root][tsr-example-root]
  - installed `@tanstack/router-core@1.171` types
- TanStack Form:
  - [composition][tsf-composition]
  - [quick start][tsf-quickstart]
  - [focus management][tsf-focus]
  - [submission][tsf-submit]
  - [validation][tsf-validation]
  - installed `form-core` `FormApi.d.ts:163`
- TanStack Devtools: [production and setup][devtools]
- orval:
  - [output configuration][orval-output]
  - [fetch mutator][orval-fetch]
  - [zod][orval-zod]
  - installed `@orval/query@8.38.0` `dist/index.mjs`: `shouldUseOptionsHook` (:51-54), default key factory (:2905-2931), split route (:1663-1665)
- Paraglide: [formatting][pg-format] · [variants][pg-variants]
- Testing: [user-event][user-event] · [jest-axe][jest-axe] · vitest-axe (https://github.com/chaance/vitest-axe)
- React: [useActionState][react-uas]
- Bulletproof React: [project structure][bpr-structure]
- FastAPI: [list query parameters][fastapi-list]
