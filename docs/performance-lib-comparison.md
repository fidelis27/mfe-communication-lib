# Performance comparison: Module Federation and module-frontend

## Before

The reference values below are copied from the archived navigation snapshot
listed in the [documentation index](./README.md#archive), captured on
2026-11-03. They are a single warm-cache observation per route, not a new
benchmark run.

| Route        | TTFB (ms) | FCP (ms) | LCP (ms) |    CLS | Remote ready (ms) | Requests | Decoded JS (bytes) | Largest JS (bytes) |
| ------------ | --------: | -------: | -------: | -----: | ----------------: | -------: | -----------------: | -----------------: |
| Dashboard    |        11 |      292 |      400 | 0.0003 |               429 |       22 |            800,237 |            486,433 |
| Estudantes   |        10 |      212 |      408 | 0.0474 |               429 |       22 |            801,254 |            486,433 |
| Instituicoes |        10 |      292 |      416 | 0.0489 |               479 |       21 |            800,094 |            486,433 |
| Atividade    |        15 |      232 |      336 | 0.0003 |               353 |       21 |            799,288 |            486,433 |
| Admin        |        15 |      304 |      448 | 0.0200 |               526 |       21 |            815,216 |            486,433 |

The largest JavaScript asset was the Host shared bundle. The largest remote
asset was the schemas chunk at 89,921 decoded bytes. Compressed cross-origin
sizes were not available in that run.

### Reproduction status and limits

An attempt to repeat the deployed measurement on 2026-11-10 was not usable:
the deployed Host raised a JavaScript error involving `globalThis.__CE_SHARED__`
before first contentful paint. The repository's local Playwright baseline run
also had remote-loading and browser-worker failures, so it did not provide a
valid replacement data set. The archived values above must therefore not be
interpreted as a fresh or directly comparable measurement.

The original snapshot used one authenticated warm-cache full-page navigation
per route at a 557 × 359 CSS-pixel viewport. It recorded navigation timing,
FCP, LCP, CLS, remote-ready time, request count, and decoded JavaScript bytes.
It did not provide a cold-cache sample, repeated-run distribution, complete
cross-origin transfer sizes, or a compressed per-module breakdown.

## After

Pending a stable post-migration build and a repeatable browser run using the
same routes, viewport, authentication setup, and metric definitions. Report
cold and warm cache separately, include compressed and decoded bytes per
module, and account for the per-module React runtime and the default
60-second manifest revalidation.

## Conclusion

No performance conclusion is justified until the post-migration measurements
are available under comparable conditions.
