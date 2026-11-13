import { serveModules } from "@lib-core-mfe/module-frontend/server";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

const corsOrigins = process.env.MFE_HOST_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!corsOrigins?.length) {
  throw new Error("MFE_HOST_ORIGINS must contain the Host origin(s) allowed to load this module.");
}

const handleModules = serveModules({
  modulesPath: path.resolve(process.cwd(), "dist/modules"),
  appName: "mfe-activity",
  basePath: "/api/modules",
  corsOrigins,
  include: ["activity"],
});

export default function handleRequest(req: IncomingMessage, res: ServerResponse) {
  return handleModules(req, res);
}
