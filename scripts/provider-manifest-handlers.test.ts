// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const providers = ["activity", "admin", "dashboard", "institution", "student"] as const;
const hostOrigin = "https://host.example.com";

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;

const tempDirs: string[] = [];

function createBuiltModule(baseDir: string, moduleName: string) {
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(path.join(baseDir, `${moduleName}.js`), "console.log('module');");
}

function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "provider-manifest-"));
  tempDirs.push(dir);
  return dir;
}

async function loadHandler(name: string, cwd: string, origins: string | undefined) {
  vi.resetModules();
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  vi.stubEnv("MFE_HOST_ORIGINS", origins);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const module = (await import(
    `../modules/frontend/packages/mfe-${name}/api/modules/[...path].ts`
  )) as { default: Handler };
  return module.default;
}

async function requestManifest(handler: Handler) {
  const headers: Record<string, string> = {};
  let body = "";
  const res = {
    statusCode: 200,
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    },
    end: (chunk?: string) => {
      body = chunk ?? "";
    },
  } as unknown as ServerResponse;
  const req = {
    method: "GET",
    url: "/api/modules/__modules_configuration",
    headers: { origin: hostOrigin },
  } as IncomingMessage;
  await handler(req, res);
  return { status: res.statusCode, headers, body: body ? (JSON.parse(body) as unknown) : null };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe.each(providers)("mfe-%s manifest handler", (name) => {
  it("serves the manifest when cwd is the project Root Directory", async () => {
    const cwd = tempDir();
    createBuiltModule(path.join(cwd, "dist/modules"), name);

    const response = await requestManifest(await loadHandler(name, cwd, hostOrigin));

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(hostOrigin);
    expect(response.body).toMatchObject({ appName: `mfe-${name}`, modules: { [name]: {} } });
  });

  it("serves the manifest when cwd is the repository root", async () => {
    const cwd = tempDir();
    createBuiltModule(path.join(cwd, `modules/frontend/packages/mfe-${name}/dist/modules`), name);

    const response = await requestManifest(await loadHandler(name, cwd, hostOrigin));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ modules: { [name]: {} } });
  });

  it("explains a missing MFE_HOST_ORIGINS instead of crashing on import", async () => {
    const response = await requestManifest(await loadHandler(name, tempDir(), undefined));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: expect.stringContaining("MFE_HOST_ORIGINS") });
  });

  it("rejects host origins with a trailing slash", async () => {
    const response = await requestManifest(await loadHandler(name, tempDir(), `${hostOrigin}/`));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: expect.stringContaining("exact origins") });
  });
});
