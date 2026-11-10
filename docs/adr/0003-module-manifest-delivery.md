# ADR-0003: Serve remote-module manifests through Vercel Functions

## Status

Accepted.

## Context

`@lib-core-mfe/module-frontend` v0.2.0 exposes `serveModules` as Node
middleware. The remote applications are deployed as static Vercel projects, but
the consumer requires the middleware's manifest response and the middleware
also serves versioned JavaScript with SHA-384 integrity metadata. The library
does not provide a static manifest-generation API.

## Decision

Use a Vercel Node Function in each remote project to run `serveModules` over
that remote's built `dist/modules` directory. The function uses a dedicated
`/api/modules` base path, publishes only the modules explicitly included for
that remote, and requires the comma-separated `MFE_HOST_ORIGINS` environment
variable to configure CORS. Vercel includes the generated module bundles in
the function deployment.

## Alternatives considered

- **Generate a static manifest during the build:** rejected because the
  library does not expose a static manifest builder; recreating its version,
  integrity, and response behavior outside the library would duplicate its
  contract.
- **Run a separate Node server:** rejected for production because the remotes
  are deployed as static Vercel projects and this would introduce a separate
  runtime service to operate.
- **Use the Vercel Function with `serveModules`:** accepted because it runs
  the library's actual middleware alongside the statically deployed remote
  bundle and keeps manifest and asset behavior consistent with the library.

## Consequences

Each remote deployment now needs `MFE_HOST_ORIGINS` configured with the
approved Host origin(s). Module files must be present in the Vercel Function
bundle. The manifest's integrity and version metadata are calculated at
request time by the library; this adds a serverless request and function
runtime to module loading. The E2E harness exercises the same middleware
locally, with deterministic CORS origins.
