# ADR 0002: The Design System Is Consumed as a Package

## Status

Accepted

## Context

shadcn's model is to copy component source into each app and own it there. The InfinitiBit design system publishes the same kind of components as `@infinitibit_gmbh/ui`, with its tokens in `@infinitibit_gmbh/theme-default` and its icons as one sprite behind an `<Icon>` component. The existing clients drifted in exactly the places copying invites: local component copies, three different icon sources (lucide, phosphor, svgr sprites) and raw colours next to tokens.

## Decision

**Every Application builds its UI from `@infinitibit_gmbh/ui` and styles it only with the design system's `--ib-*` tokens.** No shadcn copies, no second component library, no icon package besides the design system's `<Icon>`.

- `@infinitibit_gmbh/ui` and `@infinitibit_gmbh/theme-default` are pinned exactly: both are pre-1.0 and a minor bump can change a component.
- `src/styles.css` imports the theme and the component styles, declaring the `ib-components` layer ahead of Tailwind's so utilities still win.
- `@shadcn/lint` treats `@infinitibit_gmbh/ui` as the component source and rejects raw colours, arbitrary values, inline styles and restyling a component beyond layout.

## Consequences

- A visual change ships once, in the package, and reaches every Application on upgrade.
- When a screen needs something the package does not have, the fix is upstream — a variant or a token in the design system — rather than a local override. That is slower for the one screen and is the point.
- The package ships `Toaster` and `toast` from `0.1.0-alpha.6`. Toasts still come from `sonner` directly, one `<Toaster>` in the root document, its colours, radius and face mapped to `--ib-*` tokens in `src/styles.css`, until the move to the package's toast lands (#65).
- The field message ships in `Field` from `0.1.0-alpha.6`, so a form's label, error and ARIA come from the package (ADR 0009).
