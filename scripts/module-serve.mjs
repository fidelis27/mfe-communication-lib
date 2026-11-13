import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { serveModules } from "@lib-core-mfe/module-frontend/server";

const [modulesPath, appName, moduleName, portValue, ...corsOrigins] = process.argv.slice(2);
const port = Number(portValue);

if (
  !modulesPath ||
  !appName ||
  !moduleName ||
  !Number.isInteger(port) ||
  corsOrigins.length === 0
) {
  throw new Error(
    "Usage: node scripts/module-serve.mjs <modulesPath> <appName> <moduleName> <port> <corsOrigin...>",
  );
}

const middleware = serveModules({
  modulesPath: path.resolve(modulesPath),
  appName,
  basePath: "/api/modules",
  corsOrigins,
  include: [moduleName],
});
const server = createServer((request, response) => {
  void middleware(request, response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`${appName} module provider listening on http://127.0.0.1:${port}/api/modules`);
});

process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
