import { serveModules } from "@lib-core-mfe/module-frontend/server";
import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_NAME = "mfe-institution";
const MODULE_NAME = "institution";

function parseHostOrigins(value: string | undefined): string[] | string {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length) {
    return "MFE_HOST_ORIGINS must contain the Host origin(s) allowed to load this module.";
  }
  const invalid = origins.find((origin) => {
    try {
      return new URL(origin).origin !== origin;
    } catch {
      return true;
    }
  });
  if (invalid) {
    return `MFE_HOST_ORIGINS must contain exact origins without paths or trailing slashes: ${invalid}`;
  }
  return origins;
}

// Vercel may run the function from the project Root Directory or from the repository root.
function findModulesPath(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), "dist/modules"),
    path.resolve(process.cwd(), `modules/frontend/packages/${APP_NAME}/dist/modules`),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist/modules"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function failWith(message: string) {
  console.error(`[${APP_NAME}] ${message} (cwd: ${process.cwd()})`);
  return (_req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: message }));
  };
}

function createHandler() {
  const corsOrigins = parseHostOrigins(process.env.MFE_HOST_ORIGINS);
  if (typeof corsOrigins === "string") return failWith(corsOrigins);

  const modulesPath = findModulesPath();
  if (!modulesPath) {
    return failWith(`Built modules not found for ${APP_NAME}; run build:module before deploying.`);
  }

  return serveModules({
    modulesPath,
    appName: APP_NAME,
    basePath: "/api/modules",
    corsOrigins,
    include: [MODULE_NAME],
  });
}

const handleModules = createHandler();

export default function handleRequest(req: IncomingMessage, res: ServerResponse) {
  return handleModules(req, res);
}
