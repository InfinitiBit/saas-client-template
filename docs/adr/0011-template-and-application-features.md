# ADR 0011: Template and Application Features

## Status

Accepted

## Context

Every repo made from this template keeps some features and replaces the rest. `api`, `auth`, `brand` and `shell` ship with the template and receive its later ports; `notes` is a stand-in for the repo's own domain and is deleted in every derived repo. Nothing said which folders under `src/features/` may import which. `api` imported `notes` for the dev Service's hand-written handlers, so deleting `notes` broke a template file, and fixing it meant an edit that conflicted with every later port. The design is settled in `docs/grills/feature-boundaries/agent.md`.

## Decision

**Features are template features or Application features, and imports only point from Application to template, or through an Application feature's `index.ts`.**

- **Template features** are the ones listed in `settings.local.templateFeatures` in `.oxlintrc.json`. Every other feature is an **Application feature**, so a derived repo's new features need no config.
- An Application feature imports any folder of a template feature by deep path. Template features get no `index.ts`: `auth` mixes `.server.ts` modules with client hooks, and template features have the most importers, so a barrel would cost them most.
- A template feature never imports an Application feature. Template features import each other, and `import/no-cycle` keeps that acyclic.
- An Application feature imports another only through that feature's `index.ts`. The barrel is the feature's public surface: only named re-exports of what another feature imports, no `export *`, no other code, and never a `.server.ts`. It is added only once another feature needs it.
- `src/components/` and `src/lib/` import no feature; a shared folder that imports features is a feature in disguise.
- The rule constrains only files under `src/features/`, `src/components/` and `src/lib/`. Routes, `router.tsx`, `server.ts`, `src/testing/` and tests compose features and import any of them.

`local/feature-boundaries` in `lint/plugin.ts` enforces all of this. It resolves `@/` and relative paths, and checks static and dynamic imports, type imports, `import()` types and re-exports.

## Alternatives considered

- **One service module per feature, as the server template's `service.py`.** A client feature's surface is components, hooks and functions spread over `components/`, `hooks/` and `lib/`. One module holding them would either move code out of the folders that own it or be a barrel under another name.
- **Never import another Application feature; compose in the route only** (bulletproof-react, feature-sliced design). Some code genuinely belongs to one feature and is used by another, and routing all of it through a route spreads one feature's internals over every route that needs them. An explicit surface keeps the internals free to move.
- **Barrels for every feature.** Importing one name from a barrel makes Vite's dev server, and so Vitest, transform every module the barrel lists. Deep imports into template features avoid that cost where importers are most numerous.

## Consequences

- Start's import protection denies `**/*.server.*` in the client build, which is the safety net for a `.server.ts` leak. The barrel check is the early warning, raised at lint time while the leak is still harmless.
- A barrel's dev cost is cited from Vite's performance guide, not measured here. The production build tree-shakes unused re-exports.
- Whether a barrel lists only what is imported, and exists only once needed, is judgment; the rule checks only its shape.
