# saas-client-template

Default to writing zero comments. Comments are short, human, and explain _why_. Never noise, never agent chatter.

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.

User should not have to ask you for your opinion explicitly. Always evaluate what the user is asking you to do, and voice your concerns before proceeding if you don’t think it's a good idea. If possible, propose a better solution, but you can voice concerns even without one. This applies even to direct requests to revert or simplify. Still evaluate whether your original approach was better. The user may be missing important context. If there was a solid reasoning you suggested that approach, push back with reasoning instead of silently complying.

## Layout

- Code a feature owns lives under `src/features/<feature>/`, split into `components/`, `hooks/` and `lib/` as the feature needs them. Split a large feature into `src/features/<feature>/<subfeature>/` only when it grows enough to need it. A feature's direct children are only those folders, `generated/` in `api`, subfeature folders (each split the same way) and, in a feature other than the template features `api`, `auth`, `brand` and `shell`, `index.ts`. `local/layout` enforces this; its `templateFeatures` option in `.oxlintrc.json` lists the template features.
- Route files stay in `src/routes/` and stay thin: they import behaviour from a feature instead of owning it.
- Put a component in the narrowest folder that owns it. It moves to `src/components/` only when a second feature really needs it.
- A barrel file only for a component with its own subcomponents, exporting only what other files call.
- Server-only modules keep the `.server.ts` suffix and live inside the feature they belong to, or at the `src/` root when app-wide. There is no `src/server/` folder. `local/layout` enforces both.
- Only app-wide entry points and configuration stay at the `src/` root.

## UI

- Build every screen from `@infinitibit_gmbh/ui`. Do not copy shadcn components into the repo or add another component library (ADR 0002).
- Colour, spacing, radius, shadow and type come only from the design system's `--ib-*` tokens, reached through the Tailwind theme in `src/styles.css`. A token with no utility yet is mapped there, never written inline. `@shadcn/lint` enforces this.
- Do not restyle a design-system component through `className` beyond layout. If the design needs a variant the package lacks, raise it with the design system.
- Icons come only from the design system's `<Icon>` (`@infinitibit_gmbh/ui/icons`). No other icon package.
- Render conditionally with a ternary, never `&&` in JSX: a falsy number renders as `0`.
- A form `Input`, `Textarea` or `SelectTrigger` renders inside the design system's `Field`, which owns its label, `id`, error and ARIA. The form passes `error={fieldError(field)}`, `required` on `Field` for a required control, and `name` on the control. Errors show after the first submit (ADR 0009). A standalone search box is the exception: it has no visible label, only an `aria-label`.
- A list is a `DataTable`, the only caller of the table and pagination primitives. Its page, size and search live in the address through `listSearchSchema` and `ListSearch` (ADR 0008).

## Data

- Screens call the orval-generated hooks directly; a feature hook only when shared or composite. Invalidate inline by the generated key prefix. Errors are handled centrally. Tests mock the Service at HTTP with MSW, never the hooks. A test never fakes app code: `anti-slop/no-module-mocking` refuses `vi.mock`, and `vi.spyOn` on or assignment onto anything imported through `@/` or a relative path; browser globals go through `vi.stubGlobal`. See `docs/agents/data-fetching.md`.
- Regenerate with `pnpm api:generate`; never edit `src/features/api/generated/`. `pnpm check` regenerates from the committed `openapi.yaml` and fails on any difference.
- A feature's hand-written mock lives in its `lib/<feature>-mock.ts`; it serves `pnpm dev:mock` through the router and stands in for the Service in that feature's Screen tests.

## Checks

`pnpm lint` (oxlint, type-aware), `pnpm format` (oxfmt), `pnpm type:check`, `pnpm test`, `pnpm build`. Commits are Conventional Commits (`pnpm commit` prompts); branches are `type/slug` or `type/scope/slug`. oxlint and oxfmt replace ESLint and Prettier (ADR 0001).

- No import cycles: `import/no-cycle` refuses them. Break one by moving the shared code into a module both sides import.
- No hand-written file past 600 lines: `max-lines` refuses it. Split the file by concern.
- No test that leans on another's leftover state: Vitest's `sequence.shuffle` runs tests in a new order every run.

Pre-commit scans the staged changes for secrets with gitleaks (`.gitleaks.toml`, the default rules) before lint-staged, and fails when gitleaks is not installed (`brew install gitleaks`). An allowlist entry is for a proven false positive and carries a one-line reason.

- The git hooks are the gate. Pre-push checks the branch name, then runs `pnpm check` and `pnpm test`, and fails a run over its 3-minute budget. When it does, speed up the slowest tests that the run lists.
- `pnpm install` installs the git hooks, and a Claude Code session runs it at startup (`.claude/settings.json`). `pnpm test` refuses to run while husky's pre-push hook is missing; run `pnpm install` and fix what it reports.
- Never pass `--no-verify`. It skips the gate without a trace.
- A fast or watch test loop (`vitest`, a filtered run) is for the inner loop. It is never the gate.

Tests drive the client through one of two seams, with every upstream stubbed by MSW (`src/testing/msw.ts`); an undeclared request fails the test:

- a server route called as `Request` → `Response`: `respond()` in `src/testing/respond.ts`;
- the real router rendered at an address: `renderRouter()` in `src/testing/render-router.tsx`.

Tests run without Start's compiler, so `createServerFn` handlers run in-process (`src/testing/setup.ts`) and read the `process.env` a test stubs with `vi.stubEnv`. Their `getRequest()` is jsdom's address and `document.cookie`, which `holdSession()` (`src/testing/session.ts`) fills and every test starts without. What they add to the document response, such as a renewed Session's `Set-Cookie`, is read back with `getResponseHeaders()`. The shim models `.handler()` only; extend it when a server function first needs `.inputValidator()` or middleware.

A local lint rule lives in `lint/plugin.ts` as a thin visitor around an exported pure decision function, and is tested in `lint/<rule>.test.ts`: a table test of the function with invented names (oxlint's `RuleTester` when its input is an AST node), and a smoke run, `lintSource('local/<rule>')` in `lint/lint-source.ts`, that lints the real `src/` with only that rule and expects exit 0.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `rifat-infinitibit/saas-client-template` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
