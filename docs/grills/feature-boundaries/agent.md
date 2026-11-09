# Feature import boundaries: which feature may import which

Grill record. This settles which folders under `src/features/` may import which, what enforces it, how it is tested, and the one refactor it needs. It is one part of porting `saas-server-template`'s guards to this client. Any change must keep `api` free of Application features and keep the rule's tests app-independent. Read before changing `covers`.

## Facts

| id                      | value                                                                                                                                                                                                                              | view |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| as-of                   | 2026-11-09, `dev` @ `4e36cbd`                                                                                                                                                                                                      |
| covers                  | `src/features/**`, `src/components/**`, `src/lib/**`, `lint/plugin.ts`, `.oxlintrc.json`, `src/router.tsx`, `src/features/api/lib/dev-service.ts`, AGENTS.md → Layout                                                              | eng  |
| template-features       | `api`, `auth`, `brand`, `shell`                                                                                                                                                                                                    |
| application-features    | every other folder under `src/features/`; today `notes`                                                                                                                                                                            |
| d-names                 | template features and Application features                                                                                                                                                                                         |
| d-direction             | Application → template allowed; template → Application refused; template ↔ template allowed and acyclic                                                                                                                            |
| d-template-deep         | Application features import any folder of a template feature by deep path                                                                                                                                                          |
| d-template-no-barrel    | template features get no `index.ts`                                                                                                                                                                                                |
| d-app-to-app            | Application → Application only through the imported feature's `index.ts`                                                                                                                                                           |
| d-barrel-content        | `index.ts` holds only named re-exports, lists only what another Application feature imports, never re-exports a `.server.ts`, exists only once needed                                                                              |
| d-shared-ladder         | compose in the route → move into a slice it fits → `src/components/` (UI) or `src/lib/` (non-UI)                                                                                                                                   |
| d-shared-imports        | `src/components/` and `src/lib/` import no feature                                                                                                                                                                                 |
| d-scope                 | the rule constrains only files under `src/features/`, `src/components/`, `src/lib/`; root modules are shared code any feature may import; everything else is unconstrained                                                         |
| d-exempt                | `src/routes/**`, `src/router.tsx`, `src/server.ts`, `src/testing/**`, tests may import any feature, any folder                                                                                                                     |
| d-intra-feature         | folders inside one feature, subfeatures included, import each other freely                                                                                                                                                         |
| d-enforcer              | one oxlint JS-plugin rule `local/feature-boundaries` in `lint/plugin.ts`, template list in `settings.local.templateFeatures` in `.oxlintrc.json`, shared with `local/layout`                                                       |
| d-unlisted              | a feature not in `settings.local.templateFeatures` is an Application feature                                                                                                                                                       |
| d-coverage              | the rule checks `import` (incl. `import type`), `export … from`, `export * from`, literal `import('…')`, `import('…')` types; resolves `./` and `../` against the file                                                             |
| d-no-cycle              | `import/no-cycle` turned on (the override line in `.oxlintrc.json`, not a CLI flag)                                                                                                                                                |
| d-test-seam             | pure `importViolation(file, specifier, templateFeatures)` and `barrelViolation(type, source)` exported from `lint/plugin.ts`, table-tested in Vitest, plus one oxlint smoke run over real `src/` expecting exit 0                  |
| d-rule-tests-home       | `lint/feature-boundaries.test.ts`, rows use invented feature names (`orders`, `invoices`)                                                                                                                                          |
| d-dev-service           | `startDevService(handWritten: () => RequestHandler[])`; `notesDevHandlers()` in `notes/lib/notes-mock.ts`; `router.tsx` passes `notesDevHandlers` directly, both modules loaded by one `Promise.all` under the existing mock guard |
| d-docs                  | update `docs/agents/data-fetching.md:54`, `docs/design/README.md:16`, `README.md:177`                                                                                                                                              | eng  |
| d-feature-mock          | a feature's hand-written mock lives in its `lib/<feature>-mock.ts`, serves `pnpm dev:mock` through `router.tsx` and stands in for the Service in that feature's screen tests                                                       |
| d-record                | terms and rules in AGENTS.md → Layout with their enforcer; reasoning in ADR 0011; `CONTEXT.md` unchanged                                                                                                                           |
| existing-violation      | `src/features/api/lib/dev-service.ts:16` imports `@/features/notes/lib/notes-mock`                                                                                                                                                 | eng  |
| start-import-protection | Start denies `**/*.server.*` in the client: mocked in dev, build error only if the module survives tree-shaking                                                                                                                    | eng  |

## Names and direction

- `d-names`. A feature's owner decides its rules. Template features ship with the template and every derived repo keeps them; Application features are the repo's own domain and are replaced in every derived repo. The split also tells a derived repo where template ports land. These are code-structure terms, so they live in AGENTS.md, not `CONTEXT.md` (`d-record`).
  - Lost: "platform features". **Platform** already means the InfinitiBit platform in `CONTEXT.md`.
  - Lost: "foundation/product", "core/domain". Neither says who owns the folder.
- `d-direction`. A template feature that imports an Application feature breaks in every derived repo the moment that feature is deleted, and forces edits to a template file that conflict on every later port. `existing-violation` is the one case today; `d-dev-service` fixes it.
- `d-template-deep`. AGENTS.md discourages barrels; deep imports are today's norm (`notes` → `api/generated`, `shell/components`).
- `d-template-no-barrel`. `auth` mixes `session.server.ts` with client hooks, so a barrel would leak server code or need a second split. Template features have the most importers (every route), so they would pay the barrel's dev and test cost most often.

## Application features importing each other

- `d-app-to-app`. A barrel gives each Application feature a public surface, the client's equivalent of the server's `service.py`: internals can move without breaking another feature, and the rule can tell surface from internals. The user relaxed AGENTS.md's barrel rule for this case on condition of better organisation and bounded cost.
  - Lost: never import; compose in the route only (bulletproof-react, feature-sliced design). Rejected in favour of an explicit public surface.
- `d-barrel-content`. Vite's performance guide says importing one name from a barrel makes the dev server, and so Vitest, fetch and transform every module the barrel lists; the production build tree-shakes unused re-exports. Keeping the barrel to named re-exports of what is actually imported bounds that cost. No `export *` keeps the surface deliberate. No code keeps `index.ts` a list with no hidden side effects. No `.server.ts` re-export catches a server leak at lint time, earlier than `start-import-protection`, and while it is still harmless. The rule checks the first three conditions; "exists only once needed" is judgment.
  - Lost: defer the content checks until a derived repo has two Application features. Each costs a line or two and makes the conditions true from the first barrel.

## Shared code and scope

- `d-shared-ladder`. Code two features share goes as high as it can: the route composes them; otherwise it moves into a slice it fits (a template feature, or the Application feature that owns the concept); otherwise UI goes to `src/components/` as AGENTS.md already says, and the rest to a new `src/lib/`, created when first needed. The ladder is judgment.
- `d-shared-imports`. Shared folders that import features become features in disguise and can form cycles. True today: `src/components/` imports no feature; `src/lib/` does not exist.
- `d-scope`. `src/nitro/**`, `src/application.ts` and `src/env.server.ts` are neither features nor shared folders. Features already import root modules (`session.server.ts:3-4`, `api-proxy.server.ts:3-4`). One sentence in AGENTS.md says what the rule covers, so nobody has to guess.
- `d-exempt`. Routes, `router.tsx` and `server.ts` are where features are composed. Tests and `src/testing/` drive the real app through any feature.
- `d-intra-feature`. A feature is one unit; its folders and subfeatures are its own business.

## Enforcement

- `d-enforcer`. oxlint 1.86 has no `import/no-restricted-paths`. A local rule beside `local/no-jsx-and` names the rule and both features in each error. `no-restricted-imports` would need one override per feature and gives a generic message. The template list lives in `settings.local.templateFeatures`, not rule options, so `local/layout` reads the same list.
- `d-unlisted`. A new feature starts restricted, so a derived repo's features are Application features without anyone editing config.
- `d-coverage`. An import-only rule misses `export { x } from '@/features/notes/…'` inside `api`. That makes everything importing `api` depend on `notes` invisibly, and it can hide a cycle. Relative paths (`../../notes/…`) carry no `@/features/` prefix to match; none exist today, but nothing stops one. An oxlint 1.86 plugin sees every listed node type (reviewer ran a scratch rule).
- `d-no-cycle`. It reports no cycle in `src/` today and resolves the `@/` alias (reviewer ran it with a control cycle). The `"import/no-cycle": "off"` override in `.oxlintrc.json` beats a CLI `-D`, so the override line itself changes.

## Testing the rule

- `d-test-seam`. Fixture files with deliberate violations fail `pnpm lint` (`--deny-warnings`, whole repo) and `tsc` (`tsconfig.json` includes `**/*.ts`). Ignoring them in `ignorePatterns` also hides them from the test, because oxlint skips ignored files even when passed by path. The table proves each rule decides right, edge cases included; the smoke run proves the rule is registered, its options arrive, and today's `src/` is clean. One seam: the check's own entry point. The `Catches:` and mock-ban rules of the wider guards spec are tested the same way.
  - Lost: oxlint over a fixture tree. Breaks the gate, as above.
- `d-rule-tests-home`. The table tests the rule, not the app: rows are strings, and the test passes its own template list. It changes only when the rule changes, in the template, and reaches derived repos with each port. Rows that named `notes` would read as stale in a repo that deleted `notes`, and `src/__tests__/` is where the derived-repo checklist tells people to delete and rewrite tests. `lint/` reads as template tooling; Vitest's default include picks the file up.

## The dev Service refactor and feature mocks

- `d-dev-service`. `devHandlers(handWritten)` already takes the hand-written handlers (`dev-service.ts:59`); only `startDevService()` names Notes. `handWritten` is a function because `sampleNotes()` draws relative dates (`faker.date.past()`) and must run after `faker.setDefaultRefDate`; the type enforces that order. `router.tsx` is an exempt entry point, and both dynamic imports stay under `!SSR && MODE === 'mock'`, so the build still drops them. A derived repo writes `startDevService(() => [...classificationsDevHandlers(), ...tagsDevHandlers()])` and never touches `api`.
  - Lost: move the Notes sample data into `api`. Every derived repo would then edit a template feature.
  - Lost: exempt `dev-service.ts`. The rule's first exception, for a fixable case.
- `d-docs`. These three still point at `dev-service.ts` for the hand-written handlers. `README.md:177` is the derived-repo checklist, so following it would edit the wrong file.
- `d-feature-mock`. An app's own mocks are tested by the feature that owns them: `notes.test.tsx` renders the real screen against `pagedNotes(notes)` (`notes.test.tsx:58-113`), so a broken mock fails the screen tests. The generated handlers and types check the mock's shape against `openapi.yaml`; `dev-service.test.ts` fails when a generated operation has no seeded handler; MSW fails any undeclared request.

## Out of scope

- `generatedHandlers()` in `api` names Notes' generated mock handlers. It imports only `api`'s own `generated/`, so it breaks no rule, but every derived repo edits it. orval's `getExampleServiceMock()` returns all handlers but without the seeded wrapper.
- Nothing checks that a feature's dev handlers are passed in `router.tsx`. Leaving one out degrades `pnpm dev:mock` to stateless faker answers for that path. It goes on AGENTS.md's "nothing checks yet" list.
- `openapi.yaml` drifting from the live Service. Types prove mocks match the spec file only. Belongs to the wider guards spec (drift check), as the server's `make contracts` does for its fake.

## Verification

- The refactor has no automated test of `startDevService` in a browser; check it by running `pnpm dev:mock` by hand: the Notes list pages, searches and shows a created note.
- The barrel's dev cost is cited from Vite's docs, not measured here.

## Open

None.
