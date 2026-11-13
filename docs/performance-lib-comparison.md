# Performance comparison: previous runtime and module-frontend

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

Captured locally on 2026-11-13 using
`npx playwright test e2e/performance.spec.mjs --workers=1`. The browser used
the same 557 × 359 CSS-pixel viewport and authenticated session setup as the
archived snapshot. Cold is the first navigation in a fresh browser context;
warm is a reload in that same context. Each cell below is one observation, not
a median or a confidence interval.

| Route        | Cache | TTFB (ms) | FCP (ms) | LCP (ms) |    CLS | Remote ready (ms) | Requests | JS for route, decoded (bytes) | Largest JS (bytes) |
| ------------ | ----- | --------: | -------: | -------: | -----: | ----------------: | -------: | ----------------------------: | -----------------: |
| Dashboard    | cold  |        19 |      312 |      704 | 0.0000 |               703 |       11 |                     1,019,326 |            524,679 |
| Dashboard    | warm  |         4 |      104 |      232 | 0.0001 |               216 |       11 |                     1,019,326 |            524,679 |
| Estudantes   | cold  |         6 |      232 |      552 | 0.0000 |               550 |       10 |                     1,027,025 |            532,378 |
| Estudantes   | warm  |         4 |       84 |      216 | 0.0000 |               207 |       10 |                     1,027,025 |            532,378 |
| Instituicoes | cold  |         5 |      168 |      472 | 0.0000 |               468 |        9 |                     1,025,432 |            530,785 |
| Instituicoes | warm  |         4 |       88 |      208 | 0.0000 |               194 |        9 |                     1,025,432 |            530,785 |
| Atividade    | cold  |         6 |      172 |      436 | 0.0000 |               434 |        9 |                     1,019,619 |            524,972 |
| Atividade    | warm  |         5 |       80 |      200 | 0.0000 |               187 |        9 |                     1,019,619 |            524,972 |
| Admin        | cold  |         9 |      192 |      452 | 0.0073 |               451 |       11 |                     1,052,274 |            557,627 |
| Admin        | warm  |         3 |       56 |      216 | 0.0073 |               201 |       11 |                     1,052,274 |            557,627 |

The route JavaScript total is the decoded Host runtime plus the single IIFE
for that route. It is reported even on warm reloads where the browser cache
avoids transferring those bytes again. In this local cold run, the Host JS
response body was 142,779 bytes (gzip) and each provider script was served
without compression; total JS response bodies were 667,458–700,406 bytes by
route. Warm reloads reused the JS resources from browser cache. In the archived baseline's warm
snapshot, route JavaScript ranged from 799,288 to 815,216 bytes and requests
ranged from 21 to 22. Relative to those archived totals, the local module
builds contain about 27–29% more decoded JavaScript per route. The number of
requests fell to 9–11. The largest module asset is now 524,679–557,627 bytes,
larger than the old largest JavaScript asset (486,433 bytes).

### Per-module assets and compression

These are built IIFE sizes, independently measured from `dist/modules` after
the CSS inliner ran. The CSS is embedded into each IIFE; no detached CSS asset
is produced. Gzip values are reproducible `gzip -9` estimates, not measured
production transfer sizes.

| Module      | Decoded JS (bytes) | Gzip -9 (bytes) |
| ----------- | -----------------: | --------------: |
| Activity    |            524,972 |         260,086 |
| Student     |            532,378 |         261,861 |
| Institution |            530,785 |         261,419 |
| Dashboard   |            524,679 |         259,848 |
| Admin       |            557,627 |         267,554 |

The Vercel Function's local middleware served module scripts without HTTP
compression during this test. The browser measured the Host script as gzip
encoded, but module scripts were identity encoded; the Gzip -9 column should
not be mistaken for observed cross-origin network bytes. `serveModules`
revalidates manifests every 60 seconds by default while a module remains
mounted. The benchmark is shorter than that interval and does not include
subsequent polling requests or the cost of a new deployment; active pages need
a reload before a new module version is used.

### Reproduction status and limits

The post-migration run uses the production Host and IIFE builds and the actual
library `serveModules` middleware, but it runs on localhost with a synthetic
JSON API/WebSocket fixture and no deployed Vercel Functions. It is one run
per route and cache state. Cross-origin Resource Timing does not expose the
module's decoded/encoded sizes in this configuration, so bundle sizes were
read from built assets and JS response bodies; the gzip figures above are
estimates. The 2026-11-03 baseline is a separate deployed, single warm-cache
observation. Therefore TTFB, FCP, LCP, CLS and remote-ready values are
descriptive, not a controlled before/after comparison. A repeated deployed
benchmark with network transfer sizes and timing-allow-origin behavior remains
open.

## Conclusion

**Mixed, with a clear bundle-size regression.** The new runtime reduces the
number of requests in this local run and reports lower warm remote-ready times
than the historical snapshot, but those timings come from different
environments and cannot establish a latency win. The route payload is
approximately 27–29% larger in decoded JavaScript, and each module carries a
separate React and dependency runtime; module IIFEs are roughly 525–558 KB
decoded each (about 260–268 KB with local gzip -9 estimation). Thus the
measured byte cost is worse, while latency performance remains inconclusive.
