# ADR 0007: The Session Gate Is Drawn Before the First Byte

## Status

Accepted

## Context

A user with no live **Session** must see the **Session gate**, never the Application. The Session is held in HttpOnly cookies (ADR 0005), so no script can read it. If the browser decided, the server would render the Application, hydrate it, and fire the Screen's queries. The user would then watch it turn into a sign-in card once the first `401` came back.

A Session can also end after the page is drawn, or the user can hold a live token for a **Workspace** the Application has not been provisioned for. Only an upstream refusal reveals either.

## Decision

**The server decides between the gate and the Application before it renders anything. Every later refusal reaches the same gate through the router.**

- Every Application Screen sits under the pathless `_authenticated` layout. Its loader calls a server function that reads the Session cookies and decodes the access token's `exp` without verifying it, with a 60-second leeway. A token that has not expired draws the Application without asking anyone. An expired one is renewed first, through the same single-flight renewal the proxy uses (ADR 0006), and the new pair goes out as `Set-Cookie` on the document response, so the browser holds it before its first proxied call. No token, a token with no readable `exp` (ADR 0010), an expired one with no refresh token, or a refused renewal renders the sign-in card in place of the outlet, and the last three also drop both cookies. The answer is kept for the life of the document.
- The arrival routes (`/$tenantSlug`, `/auth/callback`) stay outside the layout. They are rendered before the Launch has been adopted.
- One exception to keeping the answer: a Launch adopted on a page inside the layout. A fragment never reaches the server, so it drew that document without the Session. After a successful adoption, the browser runs the layout's check once more on its first render. A refused adoption runs nothing more. A tenant slug that collides with a static route (`/notes`) lands here, and so does a hand-typed `/#token=…`.
- One classifier (`src/features/auth/components/session-gate.tsx`) maps an upstream `error_code` to `no-session`, `not-provisioned` or nothing. The code decides, never the status. The mapped codes were read off the running upstreams by local-file-client. `TENANT_NOT_FOUND`, the Service's "tenant not provisioned", is read from the Service's source.
- The classifier's gate is the router's `defaultErrorComponent`. Any other error falls through to the router's own error component.
- One QueryClient per router. A Session error in a query or a mutation is thrown to the gate and never retried. Any other query error is retried up to three times and stays on the Screen. Mutations keep TanStack's default of no retries, because a replayed write can land twice.

## Alternatives considered

- **A client-side check after hydration.** It flashes Application content the user cannot use.
- **Verifying the token's signature on the server.** It needs each upstream's keys in the client. The decode only chooses which screen to draw, and the upstream still checks the signature on every call.
- **Asking the upstream on every document.** It adds a round trip to every page for an answer the cookie already mostly gives.
- **Drawing the Application for an expired token next to a refresh token and leaving renewal to the proxy's first refusal.** A dead refresh token then draws the Application until its first call fails. Showing the sign-in card instead, once the 15-minute access token expires, is not acceptable either.
- **Classifying by status.** A `404` is also a document that does not exist, and gt rewrites downstream codes but keeps their status.

## Consequences

- A Launch adopted inside the layout shows the gate for a moment before the Application.
- A token that was revoked but has not expired draws the Application. The first call is then refused and the gate replaces the Screen.
- Opening a document after the access token expired costs one renewal round trip before the first byte.
- A new upstream refusal reaches the gate only once its code is added to the table. Until then it stays on the Screen. The table has to be read again whenever an upstream changes its gate.
- Not-provisioned shows up only through a refused call, so a Screen that makes no call never shows it.
- Standalone refuses an account outside gt's allowed group at sign-in (`SSO_GROUP_ACCESS_DENIED` on the callback), not through the API. Showing that refusal is sign-in work, not this gate's.
