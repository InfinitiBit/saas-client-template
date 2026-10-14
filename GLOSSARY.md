# SaaS Client Template — Domain Language

The starter for a frontend of one InfinitiBit SaaS **Application**. This glossary covers
the platform words every Application client shares. Each Application adds its own displayed
domain below them; design vocabulary (Screen, State, Overlay …) arrives with the
design documentation, per repo.

## Language

### Platform

**Application**:
One product the InfinitiBit platform offers a tenant — Custom Code, Working
Paper, Local File — identified to the platform by its code. An Application is a
**Service** plus the client in front of it; this template makes the client.
_Avoid_: app, module, tool, product

**Service**:
The Application's own backend — what this client displays. Reached directly in **SaaS**,
through the **Facade** in **Standalone**.
_Avoid_: the backend, the API, server

**Tenant portal**:
The platform surface a user starts from and is **Launched** into an Application from.
_Avoid_: dashboard, launcher, home

**Platform Auth**:
The platform's authentication service — where a **SaaS** **Session**'s refresh
token is spent for a fresh pair, and where signing out ends the Session rather
than only forgetting it here. Standalone never addresses it.
_Avoid_: the auth server, SSO, the identity provider

### Deployment

**Mode**:
Which of the client's two deployments is running, `saas` or `standalone`. A
runtime property of a deployment, not a build.
_Avoid_: environment, variant, flavour

**SaaS**:
The Mode where the platform is the way in: the user arrives by being **Launched**
from their **Tenant portal**.
_Avoid_: cloud mode, multi-tenant mode, platform mode

**Standalone**:
The Mode where gt is the way in — it signs the user in and stands in front of the
**Service**.
_Avoid_: gt mode, on-prem

**Facade**:
gt's own surface in front of the **Service**, which forwards to it and holds the
credential for it. Standalone's upstream; nothing SaaS goes through it.
_Avoid_: gateway, gt proxy, BFF

**Brand**:
Which visual identity a deployment wears, `default` or `gt`. A second axis beside
the **Mode**, never derived from it.
_Avoid_: theme, skin, white-label

### Session

**Launch**:
A user's arrival carrying credentials in the URL fragment — from the Tenant
portal in SaaS, from gt's sign-in callback in Standalone. One shape in both
Modes.
_Avoid_: SSO redirect, handoff, adoption, callback

**Session**:
The user's own credential as this client holds it — never in a script's reach.
An access token and, where the **Launch** carried one, the refresh token that
renews the pair when an upstream refuses.
_Avoid_: auth token, login

**Identity**:
Who the **Session** says the user is, as this client shapes it — email,
**Workspace**, roles and permissions. Distinct from the Session, which is the
credential rather than the person.
_Avoid_: user, profile, me, current user

**Workspace**:
The tenant a user is acting inside, named by its slug. Read from the Session,
never from the URL. Absent in Standalone, which has one tenant and no slug.
_Avoid_: org, organisation, account, tenant slug

**Session gate**:
What the user sees instead of the Application when there is no live **Session** or the
user is not provisioned for the Application.
_Avoid_: auth guard, login wall
