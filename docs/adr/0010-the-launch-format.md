# ADR 0010: The Launch Format

## Status

Accepted

## Context

The Session gate decides from the access token's `exp` (ADR 0007). Until now a token whose `exp` could not be read counted as live, so any three dot-separated segments, such as the `dev.dev.dev` the mock-mode Launch used, drew the Application in SaaS. Nothing written down said what a **Launch** must carry, so nothing said that token was malformed.

The platform defines the format. Read from `InfinitiBit/ib-saas-platform` `dev` @ `e57ab95`:

- The catalog's `launch_url_template` must contain `{tenant_slug}`, and every registered Application uses `<origin>/{tenant_slug}`.
- The Tenant portal opens `<launch_url>#token=<access>&tenant=<slug>&refresh_token=<refresh>`.
- Every platform token is a JWT carrying `exp`, `iat`, `sub`, `aud`, `jti` and `session_id`. gt's Standalone tokens also always carry `exp`.

## Decision

**A Launch is a fragment on a fixed arrival path, and its token is a JWT with a readable `exp`.**

- SaaS arrives at `/{tenant_slug}`. The catalog's `launch_url_template` for this Application must be `<origin>/{tenant_slug}`.
- Standalone arrives at `/auth/callback`.
- The fragment holds `token` (required), `refresh_token` (optional) and `tenant`. `tenant` is ignored, because the **Workspace** comes from the Session.
- A token with no readable numeric `exp` is no Session. The gate drops both cookies and draws the sign-in card.
- The mock-mode Launch follows the format: an unsigned JWT in the platform's claim shape (`sub: usr_<uuid>`, `aud`, `tenant_slug`, `session_id`, `iat`, `jti`) with an `exp` in 2100.

## Alternatives considered

- **Treating an unreadable `exp` as live and leaving the call to upstream.** It draws the Application around a token no upstream issued, then fails on the first call. It also hid that the mock-mode Launch was malformed.
- **Validating every claim.** The decode only picks the screen and is never verified (ADR 0007). `exp` is the one claim it reads.

## Consequences

- A token from an issuer that leaves out `exp` cannot hold a Session here. Both platforms' issuers always set it.
- Platform-side validation of `launch_url_template` is the platform's to add. A template without `{tenant_slug}` Launches onto a path this client does not serve.
