import { defineConfig } from "vite";

// GitHub Pages serves project sites from https://<user>.github.io/<repo>/,
// so every asset URL needs that repo-name prefix in production. Local dev
// keeps the default "/" root.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/milipede-pwa/" : "/",
});
