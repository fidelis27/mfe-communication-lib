import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Source maps are only generated and uploaded when SENTRY_AUTH_TOKEN is set (CI / production builds).
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryPlugins = sentryAuthToken
  ? [
      sentryVitePlugin({
        org: "fidelis",
        project: "mfe-dashboard",
        authToken: sentryAuthToken,
        release: { name: process.env.VITE_SENTRY_RELEASE },
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      }),
    ]
  : [];

export default defineConfig({
  plugins: [react(), ...sentryPlugins],
  build: {
    target: "esnext",
    cssCodeSplit: false,
    sourcemap: sentryAuthToken ? "hidden" : false,
  },
});
