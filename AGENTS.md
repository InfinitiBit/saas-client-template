# saas-client-template

Default to writing zero comments. Comments are short, human, and explain _why_. Never noise, never agent chatter. Some comments are required; see [Comments that must stay](#comments-that-must-stay).

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.

User should not have to ask you for your opinion explicitly. Always evaluate what the user is asking you to do, and voice your concerns before proceeding if you don’t think it's a good idea. If possible, propose a better solution, but you can voice concerns even without one. This applies even to direct requests to revert or simplify. Still evaluate whether your original approach was better. The user may be missing important context. If there was a solid reasoning you suggested that approach, push back with reasoning instead of silently complying.

The principles above are judgment, held by review. Every rule below names the check that enforces it, or is listed under [Conventions nothing checks yet](#conventions-nothing-checks-yet).

## Layout

- **Template features** ship with the template and every derived repo keeps them: `api`, `auth`, `brand` and `shell`, listed in `settings.local.templateFeatures` in `.oxlintrc.json`. **Application features** are every other feature, the repo's own domain (ADR 0011).
- Code a feature owns lives under `src/features/<feature>/`, split into `components/`, `hooks/` and `lib/` as the feature needs them. Split a large feature into `src/features/<feature>/<subfeature>/` only when it grows enough to need it. A feature's direct children are only those folders, `generated/` in `api`, subfeature folders (each split the same way) and, in an Application feature, `index.ts`. `local/layout` enforces the folders.
- Server-only modules keep the `.server.ts` suffix and live inside the feature they belong to, or at the `src/` root when app-wide. There is no `src/server/` folder. `local/layout` enforces where they live; Start's import protection fails the build when a `.server.ts` module survives tree-shaking into the client.
- Route files live in `src/routes/`, where TanStack Router's file-based routing finds them, and stay thin: they import behaviour from a feature instead of owning it.
- Only app-wide entry points and configuration stay at the `src/` root.
- Put a component in the narrowest folder that owns it. It moves to `src/components/` only when a second feature really needs it.
- Code two features share goes as high as it fits: compose it in the route, else move it into the slice it belongs to, else `src/components/` (UI) or `src/lib/` (everything else).
- A barrel file exists in two cases only. One is a component with its own subcomponents, exporting only what other files call. The other is an Application feature's `index.ts`: only named re-exports of what another Application feature imports, no `export *`, no other statements, never a `.server.ts`, added only once another Application feature needs it. Template features get no barrel. `local/feature-boundaries` checks the `index.ts` shape.

Which feature imports which (ADR 0011). `local/feature-boundaries` enforces each rule unless another enforcer is named:

- An Application feature imports any folder of a template feature by deep path.
- A template feature never imports an Application feature.
- Template features import each other; `import/no-cycle` keeps that acyclic.
- An Application feature imports another only through that feature's `index.ts`.
- `src/components/` and `src/lib/` import no feature.

These import rules constrain only files under `src/features/`, `src/components/` and `src/lib/`. Root modules are shared code any feature may import. Routes, `router.tsx`, `server.ts`, `src/testing/` and tests import any feature, and folders inside one feature import each other freely.

## UI

- Build every screen from `@infinitibit_gmbh/ui`. Do not copy shadcn components into the repo or add another component library (ADR 0002).
- Colour, spacing, radius, shadow and type come only from the design system's `--ib-*` tokens, reached through the Tailwind theme in `src/styles.css`. A token with no utility yet is mapped there, never written inline. `@shadcn/lint` enforces this (`shadcn/no-raw-colors`, `shadcn/no-arbitrary-values`, `shadcn/no-inline-styles`).
- Do not restyle a design-system component through `className` beyond layout. If the design needs a variant the package lacks, raise it with the design system. `shadcn/no-restyle` enforces this.
- Icons come only from the design system's `<Icon>` (`@infinitibit_gmbh/ui/icons`). No other icon package. `no-restricted-imports` refuses `lucide-react` and `@phosphor-icons/react`.
- Render conditionally with a ternary, never `&&` in JSX: a falsy number renders as `0`. `local/no-jsx-and` enforces this.
- A form `Input`, `Textarea` or `SelectTrigger` renders inside the design system's `Field`, which owns its label, `id`, error and ARIA. The form passes `error={fieldError(field)}`, `required` on `Field` for a required control, and `name` on the control. Errors show after the first submit (ADR 0009). A standalone search box is the exception: it has no visible label, only an `aria-label`.
- A list is a `DataTable`, the only caller of the table and pagination primitives. Its page, size and search live in the address through `listSearchSchema` and `ListSearch` (ADR 0008).

## Data

- Screens call the orval-generated hooks directly; a feature hook only when shared or composite. Invalidate inline by the generated key prefix. Errors are handled centrally. See `docs/agents/data-fetching.md`.
- Regenerate with `pnpm api:generate`; never edit `src/features/api/generated/`. `pnpm api:check`, part of `pnpm check`, regenerates from the committed `openapi.yaml` and fails on any difference.
- A feature's hand-written mock lives in its `lib/<feature>-mock.ts`. It serves `pnpm dev:mock` through the dev handlers `src/router.tsx` wires in, and stands in for the Service in that feature's Screen tests.

## Checks

`pnpm check` runs `pnpm lint` (oxlint, type-aware, warnings fail), `pnpm format:check` (oxfmt), `pnpm type:check` and `pnpm api:check`. `pnpm format` rewrites the formatting; `pnpm test` and `pnpm build` complete the set. oxlint and oxfmt replace ESLint and Prettier (ADR 0001). Lint rules come from `.oxlintrc.json`: oxlint's own, `@shadcn/lint`, the TanStack Router plugin, the `local/*` rules in `lint/plugin.ts` and the `anti-slop/*` rules in `lint/anti-slop/`.

- No import cycles: `import/no-cycle` refuses them. Break one by moving the shared code into a module both sides import.
- No hand-written file past 600 lines: `max-lines` refuses it. Split the file by concern.
- No test that leans on another's leftover state: Vitest's `sequence.shuffle` (`vite.config.ts`) runs tests in a new order every run.

### Git hooks and CI

The git hooks are the gate, and CI repeats it.

- `pnpm install` installs the git hooks, and a Claude Code session runs it at startup (`.claude/settings.json`). `pnpm test` refuses to run while husky's pre-push hook is missing (`src/testing/require-hooks.ts`); run `pnpm install` and fix what it reports.
- Pre-commit scans the staged changes for secrets with gitleaks (`.gitleaks.toml`, the default rules), then runs lint-staged. It fails when gitleaks is not installed (`brew install gitleaks`). An allowlist entry is for a proven false positive and carries a one-line reason.
- Commits are Conventional Commits (`pnpm commit` prompts). The commit-msg hook runs commitlint.
- Branches are `type/slug` or `type/scope/slug`. Pre-push checks the branch name, then runs `pnpm check` and `pnpm test`, and fails a run over its 3-minute budget. When it does, speed up the slowest tests that the run lists.
- Never pass `--no-verify`. It skips the gate without a trace; CI (`.github/workflows/ci.yml`) still runs `pnpm check`, `pnpm test` and `pnpm build` on every pull request.
- A fast or watch test loop (`vitest`, a filtered run) is for the inner loop. It is never the gate.

### Tests

Tests drive the client through one of two seams, with every upstream stubbed by MSW (`src/testing/msw.ts`). An undeclared request fails the test: `src/testing/setup.ts` starts MSW with `onUnhandledFrame: 'error'`.

- a server route called as `Request` → `Response`: `respond()` in `src/testing/respond.ts`;
- the real router rendered at an address: `renderRouter()` in `src/testing/render-router.tsx`.

Tests mock the Service at HTTP with MSW, never the hooks, and never fake app code. `anti-slop/no-module-mocking` refuses `vi.mock`, and `vi.spyOn` on or assignment onto anything imported through `@/` or a relative path. Browser globals go through `vi.stubGlobal`.

Tests run without Start's compiler, so `createServerFn` handlers run in-process (`src/testing/setup.ts`) and read the `process.env` a test stubs with `vi.stubEnv`. Their `getRequest()` is jsdom's address and `document.cookie`, which `holdSession()` (`src/testing/session.ts`) fills and every test starts without. What they add to the document response, such as a renewed Session's `Set-Cookie`, is read back with `getResponseHeaders()`. The shim models `.handler()` only; extend it when a server function first needs `.inputValidator()` or middleware.

Every test names the bug it catches: a `// Catches: <the bug a user would hit>` line directly above its `it` or `test` call, `.each` and `.for` included. A test that cannot name one is tautological, and it costs more than it protects: if you cannot name the bug, do not write the test. `local/require-catches-comment` enforces this.

A local lint rule lives in `lint/plugin.ts` as a thin visitor around an exported pure decision function, and is tested in `lint/<rule>.test.ts`: a table test of the function with invented names (oxlint's `RuleTester` when its input is an AST node), and a smoke run, `lintSource('local/<rule>')` in `lint/lint-source.ts`, that lints the real repo with only that rule and expects exit 0.

## Comments that must stay

Lint requires these comments. A comment sweep keeps them, or `pnpm lint` fails.

- `// SAFETY: <why it holds>` before every type assertion other than `as const`. `anti-slop/require-safety-comment-for-type-assertion` requires it.
- `// Catches: <the bug a user would hit>` directly above every `it` or `test` call. `local/require-catches-comment` requires it.

## Conventions nothing checks yet

Review holds these. A new rule that nothing enforces goes on this list; when a check starts enforcing one, name the check at the rule and remove it here.

- Layout: an Application feature's `index.ts` exists only once another Application feature needs it.
- Layout: the order for placing shared code (route, then the slice it belongs to, then `src/components/` or `src/lib/`), and a component's narrowest owning folder.
- Layout: route files stay thin.
- Layout: a server-only module carries the `.server.ts` suffix; only app-wide entry points and configuration sit at the `src/` root; a component barrel exports only what other files call.
- UI: every screen is built from `@infinitibit_gmbh/ui`, with no copied shadcn component and no other component library or icon package beyond the two refused.
- UI: form controls render inside `Field`, and lists are a `DataTable` with their state in the address.
- Data: screens call the generated hooks directly and invalidate by the generated key prefix.
- Data: each feature's dev handlers are wired in `src/router.tsx`.
- Data: `openapi.yaml` matches the live Service. `pnpm api:check` only proves the generated client matches the committed file.
- Checks: a gitleaks allowlist entry carries its one-line reason.
- Checks: a local lint rule keeps the pure-function shape and its two tests.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `InfinitiBit/saas-client-template` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
