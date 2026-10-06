import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import plans from "./integrations/plans";
import pwa from "./integrations/pwa.mjs";

// https://docs.astro.build/en/reference/configuration/
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL,
  output: "static",
  // Old routes from before the guides/dashboard restructuring.
  redirects: {
    "/walkthroughs": "/guides",
    "/walkthroughs/edit": "/planner",
    "/walkthroughs/view": "/guides",
  },
  integrations: [react(), plans(), pwa()],
  vite: {
    plugins: [tailwindcss()],
  },
});
