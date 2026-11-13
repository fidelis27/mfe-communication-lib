import { test, expect } from "@playwright/test";
import { installFakeWebSocket, seedAuthenticatedSession } from "./helpers.mjs";

const routes = [
  { route: "/dashboard", heading: "O pulso da operação." },
  { route: "/estudantes", heading: "Vínculos que acompanham cada trajetória." },
  { route: "/instituicoes", heading: "Uma rede de instituições, um só lugar." },
  { route: "/atividade", heading: "Atividade do sistema." },
  { route: "/admin", heading: "Pessoas e permissões." },
];

test("reports cold and warm local module performance measurements", async ({ browser }) => {
  test.setTimeout(180_000);
  const measurements = [];

  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 557, height: 359 } });
    const page = await context.newPage();
    await seedAuthenticatedSession(page);
    await installFakeWebSocket(page);
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0, remoteReady: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__perf.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      window.addEventListener("mfe:remote-ready", () => {
        window.__perf.remoteReady = performance.now();
      });
    });

    let requestCount = 0;
    const jsResponses = [];
    const decodedAssetSizes = new Map();
    page.on("request", () => {
      requestCount += 1;
    });
    page.on("response", async (response) => {
      if (!/\.js(?:\?|$)/.test(response.url())) return;
      const headers = await response.allHeaders();
      const sizes = await response.request().sizes();
      let decodedBytes = 0;
      try {
        decodedBytes = (await response.body()).byteLength;
      } catch {
        // A browser-cache response may not expose a body through Playwright.
      }
      if (decodedBytes > 0) decodedAssetSizes.set(response.url(), decodedBytes);
      jsResponses.push({
        url: response.url(),
        encodedBytes: Number(headers["content-length"] ?? 0),
        responseBodySize: sizes.responseBodySize,
        contentEncoding: headers["content-encoding"] ?? "identity",
        decodedBytes,
      });
    });

    for (const cacheState of ["cold", "warm"]) {
      const previousRequestCount = requestCount;
      const previousResponseCount = jsResponses.length;
      if (cacheState === "cold") await page.goto(`http://127.0.0.1:4273${route.route}`);
      else await page.reload();

      await expect(
        page.getByRole("main").getByRole("heading", { level: 1, name: route.heading }),
      ).toBeVisible();
      await page.waitForTimeout(1000);

      const vitals = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const paints = performance.getEntriesByType("paint");
        const firstContentfulPaint = paints.find(
          (entry) => entry.name === "first-contentful-paint",
        );
        const scripts = performance
          .getEntriesByType("resource")
          .filter((entry) => /\.js(?:\?|$)/.test(entry.name));
        return {
          ttfb: navigation.responseStart,
          fcp: firstContentfulPaint?.startTime ?? null,
          lcp: window.__perf.lcp,
          cls: window.__perf.cls,
          remoteReady: window.__perf.remoteReady,
          scriptUrls: scripts.map((entry) => entry.name),
          resourceJsTransferBytes: scripts.reduce((sum, entry) => sum + entry.transferSize, 0),
        };
      });
      const currentJsUrls = jsResponses.slice(previousResponseCount).map((entry) => entry.url);
      const decodedAssetBytes = currentJsUrls.map((url) => decodedAssetSizes.get(url) ?? 0);
      measurements.push({
        route: route.route,
        cache: cacheState,
        requests: requestCount - previousRequestCount,
        responseJs: jsResponses.slice(previousResponseCount),
        resourceJsDecodedBytes: decodedAssetBytes.reduce((sum, bytes) => sum + bytes, 0),
        largestResourceJs: Math.max(0, ...decodedAssetBytes),
        ...vitals,
      });
    }

    await context.close();
  }

  console.log(`[perf-measure] ${JSON.stringify(measurements)}`);
});
