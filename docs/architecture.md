# Architecture

Diagrams for the micro-frontend platform in this repository. The Go API, its data model and its API contract are documented in [`secretaria-backend`](https://github.com/fidelis27/secretaria-backend/blob/main/docs/architecture.md); this page treats it as an external system.

Contents: [1. System context](#1-system-context) · [2. Runtime composition](#2-runtime-composition-in-the-browser) · [3. Communication layers](#3-communication-layers) · [4. Main flow](#4-main-flow-create-a-student) · [5. Event contract](#5-event-contract-frontend-vs-backend) · [6. Deployment](#6-deployment-topology) · [7. Current runtime behavior](#7-current-runtime-behavior)

---

## 1. System context

```mermaid
flowchart LR
    user(["Secretariat agent"])

    subgraph browser["Browser"]
        host["Host shell<br/>auth, routing, one WebSocket"]
        remotes["5 MFE modules<br/>institution, student, admin,<br/>activity, dashboard"]
        host -- "manifest + integrity-checked IIFE" --> remotes
    end

    api["secretaria-backend<br/>(external, own repository)"]
    auth["Supabase Auth"]
    sentry["Sentry<br/>error tracking"]

    user --> host
    host -- "email + password" --> auth
    auth -- "access token (JWT)" --> host
    remotes -- "HTTPS + Bearer token" --> api
    host -- "WSS /events<br/>token in subprotocol" --> api
    host -. "host errors" .-> sentry
```

---

## 2. Runtime composition in the browser

The host owns the shell. Modules are separate IIFE builds, loaded on demand
from manifests served by provider Vercel Functions. Each module bundles its own
React and dependencies; they are not shared runtime singletons. Each remote
owns a separate `QueryClient` and cache; query data is not shared across MFEs.

```mermaid
flowchart TB
    subgraph host["Host (Vercel project)"]
        shell["Shell: nav, login, URL routing"]
        boundary["Module<br/>loading, retry, lifecycle and errors"]
        ws["useDomainEvents<br/>single WebSocket, backoff reconnect"]
        shell --> boundary
        shell --> ws
    end

    subgraph remotes["Remotes (one Vercel project each)"]
        inst["mfe-institution<br/>/instituicoes"]
        stud["mfe-student<br/>/estudantes"]
        adm["mfe-admin<br/>/admin"]
        act["mfe-activity<br/>/atividade"]
        dash["mfe-dashboard<br/>/dashboard"]
    end

    subgraph queryClients["Remote-local query state"]
            queries["One isolated QueryClient per remote"]
    end

    featureApi["Per-MFE feature API modules<br/>Zod response validation"]

    subgraph shared["@mfe/shared (bundled per module)"]
        contract["Typed event contract"]
        bus["In-page bus<br/>globalThis.__mfeBus"]
        requestApi["Typed request helpers"]
        authlib["Auth + authenticatedFetch"]
        tokens["Design tokens"]
    end

    boundary -- "manifest + SRI-checked module<br/>provider origin from VITE_MFE_*_URL" --> remotes
    host --> shared
    remotes --> shared
    remotes --> featureApi --> requestApi --> authlib
    remotes --> queries
```

If one module is down, only its `<Module>` fallback is shown; the shell and the other modules keep working.
The per-remote cache decision is documented in [ADR-0001](./adr/0001-query-client-per-remote.md).

---

## 3. Communication layers

Backend events use two communication layers, each with one job.

```mermaid
flowchart LR
    api["Backend<br/>WSS /events"]

    subgraph page["Browser page"]
        hostws["Host WebSocket"]
        pagebus["__mfeBus (in-page)"]
        remotes["All five remotes"]
        hostws -- "domain:event envelope + domain:<type> payload" --> pagebus
        pagebus -- "event envelope with eventId" --> remotes
        remotes -- "update or invalidate cache" --> queryCache["Remote-local query caches"]
        remotes -- "evt:navigate" --> pagebus
        pagebus -- "cmd:navigate / evt:navigate" --> hostws
    end

    api -- "domain events" --> hostws
```

| Layer                                | Scope                            | Channels                                                                          | Use                                            |
| ------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Backend domain events over WebSocket | Server to every connected client | event `type` (for example `STUDENT_CREATED`)                                      | State changes that other screens must react to |
| In-page bus                          | Same page only                   | `cmd:*` host to MFE, `evt:*` MFE to host, `domain:*` re-dispatched backend events | Navigation, modal close, connection status     |

Bus delivery rules: no listener means a per-channel queue (100 items, TTL 10 s by default); once a listener exists, delivery is fan-out. Details in [`event-bus.md`](event-bus.md).

HTTP requests follow this path: component → feature query hook → feature API
(`src/features/<feature>/api/`) → shared request helper →
`authenticatedFetch` → backend. Query functions pass their `AbortSignal` to the
API helper. Feature APIs validate JSON responses with Zod schemas and report
typed `ApiError`s containing the HTTP status and backend error when available;
cancelled requests remain abort errors.

---

## 4. Main flow: create a student

The flow the architecture exists to prove: _write, react_. The backend is shown as one box; its internals are in the backend docs.

```mermaid
sequenceDiagram
    autonumber
    actor U as Agent
    participant S as mfe-student
    participant API as Backend
    participant H as Host
    participant BUS as In-page bus
    participant A as mfe-activity
    participant D as mfe-dashboard

    U->>S: fill form, submit
    S->>API: POST /students (Bearer JWT)
    alt rejected (401, 403, 4xx)
        API-->>S: error
        S->>S: show error message
    else created
        API-->>S: 201 Created with student
        S->>S: show "Estudante cadastrado."
        S->>S: Insert student into its query cache
        API-->>H: STUDENT_CREATED on the host WebSocket
        H->>BUS: dispatch domain:event envelope and domain:STUDENT_CREATED
        BUS-->>S: envelope with eventId
        S->>S: deduplicate and reconcile student cache
        BUS-->>A: envelope with eventId
        A->>A: merge event into bounded history cache
        BUS-->>D: envelope with eventId
        D->>D: coalesce event invalidations for 100 ms
        D->>API: GET /institutions, /students, /enrollments in parallel
        D->>D: update dashboard query cache and KPIs
    end
```

The student list is updated from the create response and reconciled with the
domain event. Event delivery is best effort; Activity seeds its bounded cache
from `/events/history` on mount and adds supported live events.

---

## 5. Event contract: frontend vs backend

What `@mfe/shared` declares, compared with what the backend emits today.

| Event type                                             | Declared in `@mfe/shared` | Emitted by backend | Consumed by                   |
| ------------------------------------------------------ | ------------------------- | ------------------ | ----------------------------- |
| `STUDENT_CREATED`                                      | yes                       | yes                | Student, Activity, Dashboard  |
| `STUDENT_TRANSFERRED`                                  | yes                       | yes                | Activity, Dashboard           |
| `ENROLLMENT_SUSPENDED`                                 | yes                       | yes                | Activity, Dashboard           |
| `ENROLLMENT_REOPENED`                                  | yes                       | yes                | Activity, Dashboard           |
| `INSTITUTION_CREATED`                                  | yes                       | **no**             | Institution, Admin, Dashboard |
| `INSTITUTION_UPDATED`                                  | yes                       | **no**             | Institution, Admin, Dashboard |
| `INSTITUTION_INACTIVATED`                              | yes                       | **no**             | Institution, Admin, Dashboard |
| `STUDENT_UPDATED`                                      | yes                       | **no**             | Student, Dashboard            |
| `ENROLLMENT_CREATED`                                   | yes                       | yes                | Dashboard                     |
| `USER_UPDATED`                                         | yes                       | yes                | Admin                         |
| `GROUP_MEMBERSHIP_UPDATED`, `GROUP_MEMBERSHIP_REMOVED` | yes                       | yes                | Admin                         |

The frontend schemas match the backend envelope and payloads: institution
scope is carried by the optional `institutionIds` envelope field, while
`ENROLLMENT_SUSPENDED` and `ENROLLMENT_REOPENED` carry only their student and
enrollment identifiers (plus `reason` and `date` for suspension). The backend
emits these payloads in its
[enrollment handlers](https://github.com/fidelis27/secretaria-backend/blob/main/internal/adapters/httpserver/server.go),
[user handler](https://github.com/fidelis27/secretaria-backend/blob/main/internal/adapters/httpserver/user_handler.go)
and
[group handler](https://github.com/fidelis27/secretaria-backend/blob/main/internal/adapters/httpserver/group_handler.go).

---

## 6. Deployment topology

```mermaid
flowchart LR
    gh["GitHub<br/>CI: lint, typecheck, test,<br/>a11y, contrast, audit, build"]

    subgraph vercel["Vercel (6 projects)"]
        vh["host"]
        v1["mfe-institution"]
        v2["mfe-student"]
        v3["mfe-admin"]
        v4["mfe-activity"]
        v5["mfe-dashboard"]
    end

    api["secretaria-backend<br/>(external)"]
    supa["Supabase Auth"]

    gh --> vercel
    vh -- "manifest origin" --> v1
    vh -- "manifest origin" --> v2
    vh -- "manifest origin" --> v3
    vh -- "manifest origin" --> v4
    vh -- "manifest origin" --> v5
    vh -- "VITE_API_URL" --> api
    vh -- "VITE_SUPABASE_URL" --> supa
```

Each package builds and deploys on its own. The Host's `VITE_MFE_*_URL`
variables point to provider origins. Each provider serves its allowed module
and SRI metadata through a Vercel Function; `MFE_HOST_ORIGINS` restricts CORS
to approved Host origins.

---

## 7. Current runtime behavior

- The host maintains one WebSocket while active. Any remote uses the shared
  authenticated WebSocket fallback only when the host is unavailable.
- Each remote provides its own TanStack `QueryClient` and bundles its own React,
  React DOM, TanStack Query, `@mfe/shared`, Sentry, Zod and other dependencies.
  Cache keys and data are isolated by remote. The duplicated bundle cost is
  tracked in [the migration performance comparison](./performance-lib-comparison.md).
- Each copy of `@mfe/shared` accesses the same page-global bus and host auth
  bridge; module-local state is not used for those cross-module contracts.
- Query functions pass TanStack Query's `AbortSignal` through feature APIs to
  the shared request helper. Unmounting a remote cancels its in-flight queries.
- Student creation inserts the returned resource into the Student cache.
  Validated domain events carry `eventId` through the bus so remotes can
  deduplicate cache updates and invalidations.
- Activity loads the latest 30 events on mount and merges supported live events
  into its bounded cache.
- Dashboard coalesces relevant domain events for 100 ms before refreshing its
  three data sources in parallel.
- Event delivery is best effort; reconnecting does not replay missed events.
- The frontend does not send `x-correlation-id` with HTTP requests.
- Backend authorization and emitted event behavior are authoritative; the event contract comparison in section 5 shows the frontend declarations and current backend emissions.
- Playwright E2E tests load the built Host and five real modules through the
  library manifest middleware, while API and
  WebSocket traffic is intercepted for deterministic browser checks. The scope
  and limitations are recorded in [ADR-0002](./adr/0002-federation-e2e-testing.md).
