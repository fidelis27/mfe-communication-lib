# ADR-0004: Use module-frontend for runtime composition

## Status

Accepted.

## Context

The Host must load five independently deployed MFEs, report their lifecycle and
errors, preserve domain-event communication, and keep each MFE's state isolated.
`@lib-core-mfe/module-frontend` v0.2.0 registers providers as browser modules
and loads them through a manifest with integrity metadata. It bundles a
separate React runtime into each module and does not provide the previous
singleton dependency behavior or an event bus.

The library's `serveModules` is Node middleware and does not expose a static
manifest builder. The providers are deployed as static Vercel projects, so
their manifests and module assets need a server-side endpoint.

## Decision

- Replace runtime composition with `Modularize` provider entries and the
  library's `<Module>` consumer for all five MFEs.
- Build one IIFE per MFE under `dist/modules`, with compiled CSS injected into
  that bundle. Keep each MFE's standalone entry and build.
- Use a Vercel Node Function per provider to run `serveModules`; configure
  exact Host origins through `MFE_HOST_ORIGINS` and keep the module allowlist
  explicit.
- Configure the Host with each provider origin, use the library's
  `moduleLifeCycleEvent.onMounted` callback for readiness, and report errors
  to Sentry. Use the consumer's loading state and retry fallback.
- Keep each module's React runtime and `QueryClient` isolated. Preserve shared
  auth and bus behavior through the existing global Supabase auth bridge and
  `globalThis.__mfeBus`; these are project-level contracts, not features of
  the library.
- Treat module updates as available after a page reload. The consumer
  revalidates the manifest on its 60-second default interval; include that
  polling and duplicated dependencies in performance measurements.

## Alternatives considered

- **Keep Module Federation:** rejected because the goal is to adopt the target
  library's module contract and remove the Federation plugin and its active
  configuration.
- **Generate a static manifest during build:** rejected because the library
  exposes no static manifest-generation API. Hand-authoring a manifest would
  duplicate its SRI and version contract.
- **Run a separate Node server:** rejected for production because it would add
  another service to operate beside the static Vercel projects.
- **Use Vercel Functions with `serveModules`:** accepted because this runs the
  library's own middleware and provides the required manifest and
  integrity-checked assets.
- **Share React, QueryClient, auth, or bus state through module props:** React
  and QueryClient are intentionally module-local; changing every feature
  contract to pass shared state would create broad cross-MFE coupling. The
  existing auth bridge and bus provide narrower page-global contracts.

## Consequences

Each provider deployment must bundle its module files into its Function and
set the approved `MFE_HOST_ORIGINS`. React, React DOM, TanStack Query, Sentry,
Zod, and shared utilities are duplicated where used; this is a known transfer
and parse cost, not a performance improvement claim. The library has no event
bus, so the existing global bus remains responsible for cross-module events.
Module updates require a page reload. Performance conclusions are deferred to
the reproducible cold/warm comparison in
[performance-lib-comparison.md](../performance-lib-comparison.md).
