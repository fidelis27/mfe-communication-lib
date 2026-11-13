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
  VITE_API_URL: "http://127.0.0.1:3333",
  VITE_SUPABASE_URL: "https://e2e.supabase.co",
  VITE_SUPABASE_ANON_KEY: "e2e-anon-key",
  VITE_MFE_STUDENT_URL: "http://127.0.0.1:4274",
  VITE_MFE_INSTITUTION_URL: "http://127.0.0.1:4275",
  VITE_MFE_ACTIVITY_URL: "http://127.0.0.1:4276",
  VITE_MFE_DASHBOARD_URL: "http://127.0.0.1:4278",
  VITE_MFE_ADMIN_URL: "http://127.0.0.1:4279",
};
const workspaces = [
  ["host", 4273],
  ["mfe-student", 4274],
  ["mfe-institution", 4275],
  ["mfe-activity", 4276],
  ["mfe-dashboard", 4278],
  ["mfe-admin", 4279],
];
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const children = [];
let stopping = false;
let activityModuleServer;

function stopServers() {
  if (stopping) return;
  stopping = true;
  activityModuleServer?.close();
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
  runNpm(
    [
      "run",
      "build",
      "--workspace=mfe-host",
      "--workspace=mfe-student",
      "--workspace=mfe-institution",
      "--workspace=mfe-activity",
      "--workspace=mfe-dashboard",
      "--workspace=mfe-admin",
      "--ignore-scripts",
    ],
    "Frontend workspace builds",
  );
  runNpm(
    ["run", "build:module", "--workspace=mfe-activity", "--ignore-scripts"],
    "Activity module build",
  );
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
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

async function startActivityModuleServer() {
  const modulesPath = path.join(
    root,
    "modules",
    "frontend",
    "packages",
    "mfe-activity",
    "dist",
    "modules",
  );
  const middleware = serveModules({
    modulesPath,
    appName: "mfe-activity",
    basePath: "/api/modules",
    corsOrigins: ["http://127.0.0.1:4273"],
    include: ["activity"],
  });
  activityModuleServer = createServer((request, response) => {
    void middleware(request, response);
  });
  await new Promise((resolve, reject) => {
    activityModuleServer.once("error", reject);
    activityModuleServer.listen(4276, "127.0.0.1", resolve);
  });
}

try {
  runBuilds();
  await startActivityModuleServer();

  for (const [workspace, port] of workspaces) {
    if (workspace === "mfe-activity") {
      await waitForServer("http://127.0.0.1:4276/api/modules/__modules_configuration", {
        exitCode: null,
      });
      continue;
    }

    const child = spawn(
      process.execPath,
      [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      {
        cwd: path.join(root, "modules", "frontend", "packages", workspace),
        env,
        stdio: "inherit",
      },
    );
    children.push(child);
    child.on("error", (error) => {
      console.error(`Failed to start ${workspace} preview:`, error);
      process.exitCode = 1;
      stopServers();
    });
    child.on("exit", (code) => {
      if (!stopping && code !== 0) {
        console.error(`${workspace} preview exited with code ${code}.`);
        process.exitCode = 1;
        stopServers();
      }
    });
    const entrypoint = workspace === "host" ? "/" : "/assets/remoteEntry.js";
    await waitForServer(`http://127.0.0.1:${port}${entrypoint}`, child);
  }

  console.log("Host, four federation remotes, and the activity module provider are ready.");
  await new Promise((resolve) => {
    children[0].once("exit", resolve);
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  stopServers();
}
