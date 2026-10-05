// Minimal offline support: after the build, write a service worker that precaches every output file.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** @returns {import("astro").AstroIntegration} */
export default function pwa() {
  return {
    name: "dcc-pwa",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        const files = walk(root)
          .map((f) => relative(root, f).split(sep).join("/"))
          .filter((f) => f !== "sw.js" && !f.endsWith(".map"));
        const urls = files.map((f) =>
          f.endsWith("index.html") ? "/" + f.slice(0, -"index.html".length) : "/" + f,
        );
        const hash = createHash("sha1");
        for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
        const version = hash.digest("hex").slice(0, 12);
        const sw = readFileSync(new URL("./sw-template.js", import.meta.url), "utf8")
          .replace("__VERSION__", version)
          .replace("__URLS__", JSON.stringify(urls));
        writeFileSync(join(root, "sw.js"), sw);
      },
    },
  };
}
