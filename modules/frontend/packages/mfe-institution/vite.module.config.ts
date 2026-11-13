import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { inlineModuleCss } from "../../vite-module-css-plugin";

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryPlugins = sentryAuthToken
  ? [
      sentryVitePlugin({
        org: "fidelis",
        project: "mfe-institution",
        authToken: sentryAuthToken,
        release: { name: process.env.VITE_SENTRY_RELEASE },
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      }),
    ]
  : [];

export default defineConfig(({ mode }) => ({
  plugins: [react(), inlineModuleCss("institution"), ...sentryPlugins],
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
  },
  build: {
    target: "esnext",
    outDir: "dist/modules",
    lib: {
      entry: "src/module.tsx",
      name: "InstitutionModule",
      formats: ["iife"],
      fileName: () => "institution.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
    cssCodeSplit: false,
    sourcemap: sentryAuthToken ? "hidden" : false,
  },
}));
