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

## UI

- Build every screen from `@infinitibit_gmbh/ui`. Do not copy shadcn components into the repo or add another component library (ADR 0002).
- Colour, spacing, radius, shadow and type come only from the design system's `--ib-*` tokens, reached through the Tailwind theme in `src/styles.css`. A token with no utility yet is mapped there, never written inline. `@shadcn/lint` enforces this.
- Do not restyle a design-system component through `className` beyond layout. If the design needs a variant the package lacks, raise it with the design system.
- Icons come only from the design system's `<Icon>` (`@infinitibit_gmbh/ui/icons`). No other icon package.
- Render conditionally with a ternary, never `&&` in JSX: a falsy number renders as `0`.

## Checks

`pnpm lint` (oxlint, type-aware), `pnpm format` (oxfmt), `pnpm type:check`, `pnpm test`, `pnpm build`. Commits are Conventional Commits (`pnpm commit` prompts); branches are `type/scope/slug`. oxlint and oxfmt replace ESLint and Prettier (ADR 0001).

Tests drive the client through one of two seams, with every upstream stubbed by MSW (`src/testing/msw.ts`); an undeclared request fails the test:

- a server route called as `Request` → `Response`: `respond()` in `src/testing/respond.ts`;
- the real router rendered at an address: `renderRouter()` in `src/testing/render-router.tsx`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `rifat-infinitibit/saas-client-template` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
