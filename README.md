# School Secretariat — Micro-Frontend Platform

A school-administration prototype built as a **micro-frontend (MFE) ecosystem**. A React host shell composes five independently deployable modules at runtime with `@lib-core-mfe/module-frontend`, and the modules stay in sync through a **typed, versioned domain-event contract** delivered over WebSocket.

The Go API that backs it lives in [`secretaria-backend`](https://github.com/fidelis27/secretaria-backend).

> **Status:** working, deployed prototype (Vercel + Render). It is not production-hardened; see [Limitations](#limitations).

## Why this project exists

The goal is to validate three things: separation of responsibilities by bounded context, stable integration contracts between MFEs, and the ability for different teams to evolve and deploy modules independently **without direct dependencies between screens**.

The domain is a school secretariat: an authorized agent manages institutions (several campuses, e.g. different Fatec units) and their students, with access control and a trail of every change.

## Architecture

```text
Browser
└── Host (shell: auth, URL routing, error boundaries, one WebSocket)
    ├── mfe-institution   institutions and campuses
    ├── mfe-student       students, enrollments, transfers
    ├── mfe-admin         users, groups, memberships
    ├── mfe-activity      read-only feed built from domain events
    └── mfe-dashboard     KPIs refreshed by domain events
    @mfe/shared           event contract, bus, auth, design system (bundled per module)
            │  HTTPS + WSS, Supabase access token
            ▼
    secretaria-backend (Go) ── MariaDB
```

### Key design decisions

- **Runtime composition.** Each MFE builds an IIFE that registers with `Modularize`; the host loads it through `<Module>` using a manifest served by a Vercel Function. Each module has its own React runtime. Copies of `@mfe/shared` coordinate through the page-global `__mfeBus` and Supabase auth bridge.
- **Independent builds and deploys.** Each package has its own Vite build and its own Vercel project.
- **Two communication layers, each with one job.**
  - _In-page bus_ (`globalThis.__mfeBus`): local coordination between MFEs on the same page. Channels are namespaced `cmd:*` (host to MFE), `evt:*` (MFE to host) and `domain:*`. If nobody is listening, events wait in a per-channel queue (100 items, TTL, default 10 s); once a listener exists, delivery is fan-out.
  - _Backend domain events over WebSocket_: the host owns a single connection and re-dispatches each event to the bus, so remotes never open their own sockets.
- **Versioned event contract.** Every event carries `eventId`, `type`, `version`, `source`, `correlationId`, `occurredAt` and `payload`. Types are a discriminated union in `@mfe/shared`, and the `useDomainEvents` hook handles authenticated connection, reconnect with backoff, cleanup and typed parsing.
- **Failure isolation.** `<Module>` exposes loading, retry fallback, lifecycle callbacks and error reporting, so one unavailable module does not take down the shell.
- **Accessibility as a gate.** Skip link, labelled fields, `aria-live` / `aria-busy` on async regions, `jest-axe` tests per MFE, and a color-contrast check that runs in CI.
- **Shared visual language.** Semantic tokens and typed UI primitives live in `@mfe/shared`; each module's CSS is bundled and scoped beneath its own root to prevent styles from leaking across the page. See [`docs/design-system.md`](docs/design-system.md).
- **Performance by evidence.** The plan in [`docs/performance-improvement-plan.md`](docs/performance-improvement-plan.md) follows one rule: measure, change the smallest thing, measure again. It also lists what _not_ to optimize (no blanket memoization, no preloading every MFE).
- **Access-denied feedback.** The Student MFE shows friendly 403/404 errors and does not keep previously loaded rows visible after a denied refetch. E2E checks this UI behavior only; backend authorization remains the security boundary. The client does not yet know the user's institution scope, so a global scope selector/filter needs a trusted current-user scope source first.

## Repository layout

```text
modules/frontend/packages/
  host/              shell, routing, module consumer
    src/features/    auth, navigation, remotes, domain events
  mfe-institution/   remote
  mfe-student/       remote
  mfe-admin/         remote (admin workspace, API, hooks and components in features/admin/)
  mfe-activity/      remote
  mfe-dashboard/     remote
  shared/            @mfe/shared: events, bus, auth, tokens
docs/                architecture, event bus, deployment, specs, performance
scripts/             local launcher, validation, contrast check
.github/workflows/   CI
```

## Getting started

Requirements: Node 22.13+, a Supabase project (email/password auth), and the [backend](https://github.com/fidelis27/secretaria-backend) running locally or deployed.

```bash
npm ci --legacy-peer-deps
npm run lint
npm run typecheck
npm test
npm run dev:local     # PowerShell launcher (Windows): starts the host and the remotes
```

Build-time variables:

| Variable                                      | Purpose                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| `VITE_API_URL`                                | Backend base URL (HTTP and WebSocket)                      |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase Auth (anon key only; never the service role key)  |
| `VITE_MFE_*_URL`                              | Provider origins used by the host                          |
| `MFE_HOST_ORIGINS`                            | Comma-separated Host origins allowed by provider manifests |

Details: [`docs/local-development.md`](docs/local-development.md) and [`docs/deployment.md`](docs/deployment.md).

## Quality gates

CI runs on every PR and a final **CI gate** job fails if any required job fails:

- ESLint, TypeScript typecheck, Prettier check
- Vitest unit, integration and accessibility tests
- Playwright E2E tests against the built Host and five real manifest-served modules, with deterministic API and WebSocket mocks
- Playwright checks that student-write 403 and student-list 403/404 responses are visible and do not leave a success state or stale rows
- Color-contrast check
- `npm audit --audit-level=high`
- Build matrix over all seven workspaces
- Playwright report and traces uploaded as an artifact when E2E fails

## Documentation

| Doc                                                                                                                      | What it covers                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| [`mfe-architecture.md`](docs/mfe-architecture.md)                                                                        | MFE boundaries, module loading, deploy model    |
| [`design-system.md`](docs/design-system.md)                                                                              | Shared tokens, UI primitives, and CSS isolation |
| [`event-bus.md`](docs/event-bus.md)                                                                                      | Channels, queue, TTL, host WebSocket flow       |
| [`functional-specification.md`](docs/product/functional-specification.md), [`spec-technical.md`](docs/spec-technical.md) | Product and technical specs                     |
| [`performance-improvement-plan.md`](docs/performance-improvement-plan.md)                                                | Evidence-first performance tasks                |
| [Documentation archive](docs/README.md#archive)                                                                          | Historical material retained for reference      |
| [`docs/README.md`](docs/README.md)                                                                                       | Documentation index and evidence map            |

## How it was built

Spec first, in small verified steps. Product decisions and acceptance criteria were written down before code (`docs/archive/context.md`, specs), work was split into **one PR per block** with conventional commits and a "Validations" section listing the commands run, and AI assistants were used under those same rules. See `docs/archive/context.md` for the working agreement.

## Limitations

- Prototype scope: it demonstrates the architecture and the main flow (institution → student → event → activity/dashboard), not a finished product.
- Event delivery is best effort. A transactional outbox is still pending (see the backend ADR 0001).
- Each module bundles its own React and shared dependencies. The measurable cost and route-level impact are reported in [the migration performance comparison](docs/performance-lib-comparison.md).
