import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

export function inlineModuleCss(moduleName: string): Plugin {
  return {
    name: "inline-module-css",
    apply: "build",
    async writeBundle(outputOptions) {
      const outputDir = path.resolve(outputOptions.dir ?? "dist/modules");
      const files = await readdir(outputDir);
      const cssFiles = files.filter((fileName) => fileName.endsWith(".css"));
      if (cssFiles.length === 0) return;

      const entryFile = `${moduleName}.js`;
      if (!files.includes(entryFile)) {
        throw new Error(`Could not find the IIFE entry "${entryFile}" for module "${moduleName}".`);
      }

      const css = (
        await Promise.all(
          cssFiles.map((fileName) => readFile(path.join(outputDir, fileName), "utf8")),
        )
      ).join("\n");
      const entryPath = path.join(outputDir, entryFile);
      const entryCode = await readFile(entryPath, "utf8");
      const styleInjection = `\n;(() => { const style = document.createElement("style"); style.dataset.moduleStyles = ${JSON.stringify(moduleName)}; style.textContent = ${JSON.stringify(css)}; document.head.append(style); })();\n`;

      await writeFile(entryPath, `${entryCode}${styleInjection}`);
      await Promise.all(cssFiles.map((fileName) => unlink(path.join(outputDir, fileName))));
    },
  };
}
