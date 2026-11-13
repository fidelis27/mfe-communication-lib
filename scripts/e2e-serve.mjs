import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { serveModules } from "@lib-core-mfe/module-frontend/server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  VITE_API_URL: "http://127.0.0.1:4280",
  VITE_SUPABASE_URL: "https://e2e.supabase.co",
  VITE_SUPABASE_ANON_KEY: "e2e-anon-key",
  VITE_MFE_STUDENT_URL: "http://127.0.0.1:4274",
  VITE_MFE_INSTITUTION_URL: "http://127.0.0.1:4275",
  VITE_MFE_ACTIVITY_URL: "http://127.0.0.1:4276",
  VITE_MFE_DASHBOARD_URL: "http://127.0.0.1:4278",
  VITE_MFE_ADMIN_URL: "http://127.0.0.1:4279",
};
const providers = [
  { appName: "mfe-student", moduleName: "student", port: 4274 },
  { appName: "mfe-institution", moduleName: "institution", port: 4275 },
  { appName: "mfe-activity", moduleName: "activity", port: 4276 },
  { appName: "mfe-dashboard", moduleName: "dashboard", port: 4278 },
  { appName: "mfe-admin", moduleName: "admin", port: 4279 },
];
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const children = [];
let stopping = false;
const moduleServers = [];

function stopServers() {
  if (stopping) return;
  stopping = true;
  for (const server of moduleServers) server.close();
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  stopServers();
  process.exitCode = 130;
});
process.on("SIGTERM", () => {
  stopServers();
  process.exitCode = 143;
});

function runBuilds() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath is required; run through npm run e2e:serve.");

  const runNpm = (args, label) => {
    const result = spawnSync(process.execPath, [npmCli, ...args], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
  };

  runNpm(["run", "build", "--workspace=@mfe/shared"], "Shared package build");
  runNpm(["run", "build", "--workspace=mfe-host", "--ignore-scripts"], "Host build");
  runNpm(
    [
      "run",
      "build:module",
      "--workspace=mfe-student",
      "--workspace=mfe-institution",
      "--workspace=mfe-activity",
      "--workspace=mfe-dashboard",
      "--workspace=mfe-admin",
      "--ignore-scripts",
    ],
    "Remote module builds",
  );
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`Preview server exited before becoming ready: ${url}.`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Preview server did not become ready: ${url}.`);
}

async function startModuleServers() {
  for (const provider of providers) {
    const middleware = serveModules({
      modulesPath: path.join(
        root,
        "modules",
        "frontend",
        "packages",
        provider.appName,
        "dist",
        "modules",
      ),
      appName: provider.appName,
      basePath: "/api/modules",
      corsOrigins: ["http://127.0.0.1:4273"],
      include: [provider.moduleName],
    });
    const server = createServer((request, response) => {
      void middleware(request, response);
    });
    moduleServers.push(server);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(provider.port, "127.0.0.1", resolve);
    });
  }
}

async function startApiServer() {
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify([]));
  });
  moduleServers.push(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(4280, "127.0.0.1", resolve);
  });
}

try {
  runBuilds();
  await startApiServer();
  await startModuleServers();
  await waitForServer("http://127.0.0.1:4280/students");
  for (const provider of providers) {
    await waitForServer(`http://127.0.0.1:${provider.port}/api/modules/__modules_configuration`);
  }

  const host = spawn(
    process.execPath,
    [viteBin, "preview", "--host", "127.0.0.1", "--port", "4273", "--strictPort"],
    {
      cwd: path.join(root, "modules", "frontend", "packages", "host"),
      env,
      stdio: "inherit",
    },
  );
  children.push(host);
  host.on("error", (error) => {
    console.error("Failed to start host preview:", error);
    process.exitCode = 1;
    stopServers();
  });
  host.on("exit", (code) => {
    if (!stopping && code !== 0) {
      console.error(`Host preview exited with code ${code}.`);
      process.exitCode = 1;
      stopServers();
    }
  });
  await waitForServer("http://127.0.0.1:4273/", host);

  console.log("Host and all five manifest-based module providers are ready.");
  await new Promise((resolve) => {
    children[0].once("exit", resolve);
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  stopServers();
}
