import { defineConfig } from "vite";

// GitHub Pages serves project sites from https://<user>.github.io/<repo>/,
// so every asset URL needs that repo-name prefix in production. Local dev
// keeps the default "/" root. GITHUB_REPOSITORY ("owner/repo") is set
// automatically by GitHub Actions, so this derives the right prefix even from
// a fork or after a repo rename, instead of hardcoding the current repo name.
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];

export default defineConfig({
  base: process.env.GITHUB_PAGES && repoName ? `/${repoName}/` : "/",
});
