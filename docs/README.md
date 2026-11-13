# Documentation

This index is the entry point for product, architecture, development, and
quality guidance. For the project overview, see the [root README](../README.md).

## Start here

- [Local development](./local-development.md) — set up and run the frontend with its backend.
- [Deployment](./deployment.md) — current hosting and configuration guidance.

## Architecture

- [Architecture](./architecture.md) — runtime composition, communication, and system flows.
- [MFE architecture](./mfe-architecture.md) — package boundaries, federation, and remote ownership.
- [Technical specification](./spec-technical.md) — technical requirements and implementation constraints; currently retained in Portuguese.
- [Event bus](./event-bus.md) — local channels, queues, and event delivery.
- [Diagrams](./diagrams.md) — conceptual relational model; the backend repository owns the current schema.

## Decisions

- [ADR directory](./adr/) and [ADR-0001](./adr/0001-query-client-per-remote.md) — query-client ownership by remote.
- [ADR-0002](./adr/0002-federation-e2e-testing.md) — browser testing with real federated remotes.
- [ADR-0003](./adr/0003-module-manifest-delivery.md) — serving remote-module manifests on Vercel.

## Quality

- [Security and quality review](./security-and-quality-review.md) — quality and security review notes.
- [Performance](./performance.md) — runtime behavior and evidence limits; use it with the [improvement plan](./performance-improvement-plan.md) and task records: [PERF-002](./performance-tasks/PERF-002-shared-domain-events.md), [PERF-003](./performance-tasks/PERF-003-dashboard-event-refresh.md), [PERF-004](./performance-tasks/PERF-004-mfe-request-cancellation.md), [PERF-005](./performance-tasks/PERF-005-paginated-resource-lists.md), [PERF-006](./performance-tasks/PERF-006-remote-loading-metrics.md), [PERF-007](./performance-tasks/PERF-007-federation-runtime-analysis.md), [PERF-008](./performance-tasks/PERF-008-remove-legacy-host-entry.md).
- [Performance comparison](./performance-lib-comparison.md) — measured comparison for the `module-frontend` migration.
- [Design system](./design-system.md) — shared tokens, UI primitives, and CSS isolation.
- [Accessibility test example](../modules/frontend/packages/host/src/App.a11y.test.tsx) and [contrast checker](../scripts/check-contrast.mjs) — automated checks, not a WCAG conformance claim.
- [Playwright configuration](../playwright.config.mjs) — browser test setup; run it with `npm run test:e2e`.

## Product

- [Functional specification](./product/functional-specification.md) — expected actors, workflows, and acceptance criteria.

## Archive

Historical documents are retained for reference and are not maintained:
[context](./archive/context.md), [completed task plan](./archive/task.md),
[generic project guide](./archive/project-zero-learnings.md),
[deployment plan](./archive/production-deployment-plan.md),
[visual audit](./archive/baseline-audit.md), and
[navigation snapshot](./archive/performance-baseline.md).

## How to maintain this documentation

Update the existing document before creating one. New documents must fit this
index and be linked here in the same commit; record architecture decisions as
numbered ADRs. Do not add plans, notes, drafts, or duplicated content. Avoid
volatile values; link to reproducible evidence instead. Run `npm run check:docs`
before committing. Active docs should follow this taxonomy: start here,
architecture, decisions, quality, and product; historical material belongs in
the archive.

## Demonstrated competencies

| Competency                                   | Evidence                                                                                                                                                                                             | How to verify                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| React and TypeScript                         | [Host](../modules/frontend/packages/host/src/App.tsx), [package manifest](../package.json)                                                                                                           | `npm run typecheck`                                                         |
| Scalable modular front-end architecture      | [Packages](../modules/frontend/packages/), [host remote loader](../modules/frontend/packages/host/src/features/remotes/components/RemoteContent.tsx)                                                 | `npm run build --workspace=mfe-host`                                        |
| State management                             | [Student query hooks](../modules/frontend/packages/mfe-student/src/features/student/hooks.ts), [shared bus](../modules/frontend/packages/shared/src/bus.ts)                                          | `npm test`                                                                  |
| Componentization and Design Systems          | [Shared UI](../modules/frontend/packages/shared/src/ui/), [design tokens](../modules/frontend/packages/shared/src/tokens.css)                                                                        | `npm run check:contrast`                                                    |
| REST API consumption                         | [Student API](../modules/frontend/packages/mfe-student/src/features/student/api/index.ts), [shared API](../modules/frontend/packages/shared/src/api.ts)                                              | `npm test`                                                                  |
| Microfrontend architecture                   | [Host federation config](../modules/frontend/packages/host/vite.config.ts), [Student federation config](../modules/frontend/packages/mfe-student/vite.config.ts)                                     | `npm run build --workspaces --if-present`                                   |
| Automated testing                            | [Vitest test](../modules/frontend/packages/mfe-student/src/App.test.tsx), [Playwright config](../playwright.config.mjs)                                                                              | `npm test`; `npm run test:e2e`                                              |
| CI/CD and build automation                   | [CI workflow](../.github/workflows/ci.yml)                                                                                                                                                           | CI and builds are automated; no repository-managed CD workflow is evidenced |
| Version control (Git)                        | [Repository](../)                                                                                                                                                                                    | `git log --oneline -1`                                                      |
| Web performance                              | [Lazy remotes](../modules/frontend/packages/host/src/features/remotes/components/RemoteContent.tsx), [memoized filter](../modules/frontend/packages/mfe-admin/src/features/admin/AdminWorkspace.tsx) | `npm run build --workspace=mfe-host`                                        |
| Accessibility (WCAG)                         | [Host axe test](../modules/frontend/packages/host/src/App.a11y.test.tsx), [contrast checker](../scripts/check-contrast.mjs)                                                                          | `npm test`; `npm run check:contrast`                                        |
| Dependency management and modern build tools | [npm manifest](../package.json), [lockfile](../package-lock.json), [Vite config](../modules/frontend/packages/host/vite.config.ts)                                                                   | `npm ci --legacy-peer-deps`                                                 |

The state-management evidence is TanStack Query for server state, React state
for UI, and the shared event bus; no Redux or Zustand implementation is claimed.
Accessibility checks cover selected rendered states and color pairs; this
repository does not claim audited WCAG conformance.
