# MFE Architecture

The frontend is a monorepo of independently built Vite applications. The Go backend owns the authoritative API and publishes domain events.

## MFEs

- `host`: application shell, authentication, navigation, remote loading and the primary domain-event WebSocket.
- `mfe-institution`: institution listing and registration.
- `mfe-student`: student listing and registration, with query-cache updates from create responses and domain events.
- `mfe-admin`: people, groups and group-membership management.
- `mfe-activity`: recent domain-event history and live activity feed.
- `mfe-dashboard`: institution, student and enrollment indicators.
- `shared`: authentication, validated API request helpers, domain-event contracts, the in-page bus and design tokens.

## Repository layout

```text
modules/frontend/packages/
  host/
  mfe-institution/
  mfe-student/
  mfe-admin/
  mfe-activity/
  mfe-dashboard/
  shared/
```

Each MFE owns its UI, feature API modules and TanStack Query hooks under
`src/features/<feature>/`. Each provider also has a module entry and an IIFE
build. The host loads these builds with `<Module>` using a manifest served by a
Vercel Function. Each module bundles its own React and dependencies; they are
not runtime singletons. Every remote creates a separate `QueryClient`, keeping
its cache isolated from the other MFEs.
The host and remotes use shared UI primitives and semantic design tokens from
`@mfe/shared`. Each application stylesheet is a Vite CSS Module beneath its
own generated root class; module CSS is injected with the module bundle, and
remotes must not add global element or class selectors. The shared UI exports
the `@mfe/shared/ui` subpath. Bundled copies of `@mfe/shared` use
`globalThis.__mfeBus` for page-wide event state and the host's global Supabase
auth bridge for session access.

The host groups authentication, navigation, remote rendering, and domain-event
publishing under `packages/host/src/features/`. The Admin remote keeps its
workspace, API, query hooks, presentation helpers, and UI components together
under `packages/mfe-admin/src/features/admin/`; `src/App.tsx` remains the
application entry point and renders that workspace.

## Communication

HTTP requests follow this path:

```text
component -> feature API -> shared request helper -> authenticatedFetch -> backend
```

Feature APIs validate JSON responses with Zod schemas and surface typed errors. Shared helpers preserve HTTP status and backend error text where appropriate, map common failures to user-friendly messages, and leave aborted requests distinguishable.

Backend domain events reach the host over its WebSocket. The host dispatches
both the complete event envelope, including `eventId`, and the existing typed
payload channel through the in-page bus. Remotes deduplicate event envelopes
and update or invalidate their own query cache. If the host is unavailable,
remotes use the shared authenticated WebSocket fallback. Query functions pass
their `AbortSignal` through feature APIs to the shared request helper, so
in-flight requests are cancelled when their remote unmounts. The in-page bus
carries host commands, MFE events and domain events; it does not replace HTTP
requests.

## Deployment

The host and each MFE are deployed as separate Vercel projects, each building from its package directory. Each MFE deployment serves its module manifest and integrity-checked module assets from a Vercel Function; the host resolves provider origins from `VITE_MFE_*_URL`. Set `MFE_HOST_ORIGINS` in each provider project to the allowed Host origins. Frontend API requests use `VITE_API_URL`; authentication uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The backend API and its data model are maintained in the separate `secretaria-backend` repository.

See [the design-system guide](./design-system.md) for token, component, and
responsive CSS conventions.
