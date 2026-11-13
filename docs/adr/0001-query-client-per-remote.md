# ADR-0001: Isolate TanStack Query clients by remote

## Status

Accepted.

## Context

The five modules query and mutate backend resources independently while running
in the same browser page. `@lib-core-mfe/module-frontend` bundles each module's
React and dependencies independently, so the React and TanStack Query runtimes
are not shared between modules. Sharing one cache across separately deployed
MFEs would couple their query keys, invalidation behavior and lifecycles.

## Decision

- Bundle a separate TanStack Query runtime in each module.
- Create one `QueryClient` in each remote's root and provide it only to that
  remote's component tree.
- Keep cache keys feature-specific and include the API URL and resource
  identity where applicable.
- Propagate domain-event envelopes through the in-page bus so each remote can
  update or invalidate its own cache, deduplicating by `eventId`.

## Alternatives considered

- **One cache in the host or `@mfe/shared`:** rejected because it creates
  cross-remote cache ownership and invalidation coupling.
- **One Query runtime and cache in the Host:** rejected because it couples
  ownership and invalidation across independently deployed modules.

## Consequences

Cache entries and mutations remain isolated to the remote that owns them, while
each module uses its own Query runtime and cache. Domain events are the
cross-module synchronization mechanism; they do not expose one module's cache
to another. The cost of the duplicated runtimes is tracked in
[the performance comparison](../performance-lib-comparison.md).
