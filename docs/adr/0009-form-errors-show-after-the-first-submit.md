# ADR 0009: Form Errors Show After the First Submit

## Status

Accepted

## Context

A form has to decide when a field may call itself wrong. Shown too early, an error greets a user who has typed one letter, or who tabbed through a field on the way to another. Shown too late, the user corrects one field, submits, and only then learns about the next.

GOV.UK's design system validates when the form is submitted and keeps the errors in step with the fields after that. working-paper-client chose differently: its form-level validators run `onChange`, and a field shows its error once it is touched (its ADR 0009 rule 1, kept under the design system's `Field` by its ADR 0014).

From `0.1.0-alpha.6` the design system's `Field` renders the error. Its `error` prop is the invalid state: when present, the message renders with `role="alert"` and the control gets `aria-invalid`. So the timing is whatever decides when a form passes `error`.

## Decision

**No field shows an error until the form's first submit. From then on, errors follow the values as the user types.**

- The form validates through TanStack Form's `revalidateLogic()` with its schema under `validators.onDynamic`. Before the first submit, nothing validates. The submit validates every field, and each change after it revalidates.
- A field passes `error={fieldError(field)}` to `Field`. `fieldError` returns the schema's first message for a touched field and nothing otherwise. The submit touches every field, so all errors appear together.
- The error text comes only from the schema.

## Alternatives considered

- **`onChange` after touch,** as in working-paper-client. An error appears while the user is still typing the first value, and a field merely tabbed through is touched and wrong before anything was submitted.
- **`onBlur`.** Leaving a field empty on the way to another reports an error the user was about to fix.
- **Submit only, without revalidating.** A corrected field keeps its error until the next submit, so the screen says something is wrong after it is fixed.

## Consequences

- An empty submit announces every error at once, through each `Field`'s `role="alert"`.
- A form that needs an earlier check, such as availability of a name, adds it as a field validator of its own. It does not change this timing.
- This client and working-paper-client time errors differently. A form ported between them changes its validation logic, not its fields.
