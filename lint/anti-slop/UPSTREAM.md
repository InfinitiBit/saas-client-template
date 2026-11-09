# Upstream

- Source: https://github.com/dmmulroy/anti-slop
- Commit: c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b (`skills/install-anti-slop/assets/anti-slop`)
- Installed at `lint/anti-slop/`, registered in `.oxlintrc.json`.
- Deviation: `effect/` not vendored; the project does not depend on Effect.
- Deviation: `no-module-mocking` also refuses `vi.spyOn` on, and assignment onto, imports from `@/` or a relative path (#85).
