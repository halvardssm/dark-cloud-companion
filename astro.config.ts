import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import plans from "./integrations/plans";
import pwa from "./integrations/pwa.mjs";

// https://docs.astro.build/en/reference/configuration/
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://halvardssm.github.io/dark-cloud-companion",
  // The site is served from the repo subpath on GitHub Pages.
  base: "/dark-cloud-companion",
  output: "static",
  integrations: [react(), plans(), pwa()],
  vite: {
    plugins: [tailwindcss()],
  },
});
