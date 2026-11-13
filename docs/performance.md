# Frontend performance

## Runtime model

The host loads each module on demand through `@lib-core-mfe/module-frontend`.
Every module bundles its own React, React DOM, `@mfe/shared`, and
`@tanstack/react-query` runtime. Each remote creates its own `QueryClient`;
query data is isolated by MFE and is not shared across remotes. The resulting
dependency duplication and route-level impact are measured in the
[migration comparison](./performance-lib-comparison.md).
The ownership decision is documented in
[ADR-0001](./adr/0001-query-client-per-remote.md).

Feature queries call the typed API functions and include the API URL and resource
in their query keys. Query functions pass TanStack Query's `AbortSignal` through
the feature API and shared request helper. Unmounting a remote or replacing a
query therefore cancels its in-flight request. Query retries and focus
refetching are disabled to preserve the existing explicit retry behavior.

## Cache and event updates

The host publishes each validated domain event to the in-page bus as a complete
`domain:event` envelope, including its `eventId`, and continues publishing the
typed `domain:<type>` payload channel. Remote event hooks deduplicate envelopes
by `eventId` before updating or invalidating the local query cache. When the
host is unavailable, remotes use the shared authenticated WebSocket fallback.

- **Student:** queries students and institutions; successful student mutations
  add the returned resource to the student cache, and domain events insert or
  invalidate the affected query.
- **Institution:** queries the institution list; create mutations update its
  cache and institution events invalidate it.
- **Activity:** queries the latest 30 events and merges supported live events
  into that bounded cache by `eventId`.
- **Dashboard:** queries institutions, students and enrollments in parallel.
  Relevant domain events are coalesced for 100 ms before invalidating and
  refreshing the dashboard query.
- **Admin:** queries users, institutions, groups, members and candidates with
  group-specific keys; mutations and corresponding domain events invalidate
  only affected admin queries.

## Validation and measurement

Automated tests cover query cancellation on unmount for all five remotes,
Dashboard's three parallel requests, event-envelope delivery and deduplication,
Dashboard refresh behavior, Activity updates, loading/error/empty/success
states, and accessibility checks.

This document makes no browser performance claims. LCP, INP, CLS, FCP, TTFB,
remote transfer sizes and production request counts require a browser run
against deployed builds and are not measured by the unit-test suite.
