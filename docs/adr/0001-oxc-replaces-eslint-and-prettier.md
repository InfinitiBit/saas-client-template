# ADR 0001: oxc Replaces ESLint and Prettier

## Status

Accepted

## Context

The three existing Application clients lint with ESLint (typescript-eslint, react, react-hooks, jsx-a11y, import-x, `@shadcn/lint`, the TanStack Router plugin) and format with Prettier and its Tailwind plugin. Type-aware ESLint is the slowest step in every one of them, and the template is also the point where TypeScript moves to 7, whose native compiler typescript-eslint does not support.

oxlint now implements almost every rule those configs use natively, runs type-aware rules through `oxlint-tsgolint` on the TypeScript 7 compiler, and loads ESLint plugins it does not implement as JS plugins. oxfmt formats with Prettier's output and ships Tailwind class sorting and import sorting built in.

## Decision

**oxlint and oxfmt are the only linter and formatter.** ESLint, Prettier and all their plugins are removed.

- `.oxlintrc.json` is the output of `@oxlint/migrate --type-aware` run on working-paper-client's `eslint.config.mjs`, with `typeAware` on.
- Rules oxlint does not implement natively run as JS plugins: `@shadcn/lint` (design-system token rules, `settings.shadcn` at the root) and `@tanstack/eslint-plugin-router` with `create-route-property-order` and `route-param-names` switched on.
- ESLint's `no-restricted-syntax` has no oxlint equivalent, so the one use of it — forbidding `&&` rendering in JSX — is a local rule in `lint/plugin.ts`.
- `import/order` is dropped in favour of oxfmt's `sortImports`, which treats `@/` as internal: `@/` imports now sit above sibling imports.
- `eslint-plugin-sort-destructure-keys` is dropped: working-paper-client registered it without enabling a rule.
- `.oxfmtrc.json` is `oxfmt --migrate=prettier` of the same repo's Prettier config plus `sortImports`.
- `lint/anti-slop/` vendors [anti-slop](https://github.com/dmmulroy/anti-slop) as a local JS plugin, with every generic rule on. Its provenance is in `lint/anti-slop/UPSTREAM.md`; oxfmt leaves it untouched so an update diffs against upstream.

## Consequences

- oxfmt is beta and oxlint's JS plugins are alpha, outside semver. Both are pinned exactly and upgraded on purpose. A JS plugin that fails to load, or a configured rule it no longer has, fails `pnpm lint`.
- If JS plugins break on an upgrade and cannot be pinned around, the fallback is a minimal ESLint config running only `@shadcn/lint`, the router plugin and the `&&` rule beside oxlint — not a return to ESLint for everything.
- `@tanstack/eslint-plugin-router` still declares a typescript-eslint peer range below TypeScript 7. It runs without the type checker, so the unmet peer is harmless.
