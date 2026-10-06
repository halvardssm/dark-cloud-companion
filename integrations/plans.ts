// Predefined plans (built-in guides) are generated into src/data/plans.json at build time so they
// stay in sync with the planner and the game data. The committed file makes this a fast no-op on
// unchanged trees; when it is stale (config, planner, mechanics or data changed) the generation
// script runs before pages render. The plans themselves are configured in
// scripts/planner/plans.config.ts.
import type { AstroIntegration } from "astro";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Everything that can change what the plans contain. Outputs and tests are never inputs. */
const INPUTS = [
  "scripts/planner",
  "src/data",
];
const SKIP_FILES = new Set(["plans.json", "INCONSISTENCIES.md"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Content hash over every input; stored in src/data/plans.json to detect staleness. */
export function plansHash(): string {
  const files = INPUTS.flatMap((p) =>
    statSync(join(ROOT, p)).isDirectory()
      ? walk(join(ROOT, p))
      : [join(ROOT, p)]
  )
    .filter(
      (f) =>
        /\.(ts|json)$/.test(f) && !f.endsWith(".test.ts") &&
        !SKIP_FILES.has(basename(f)),
    )
    .sort();
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update(readFileSync(f));
  return hash.digest("hex");
}

export default function plans(): AstroIntegration {
  return {
    name: "dcc-predefined-plans",
    hooks: {
      "astro:build:start": () => {
        const out = join(ROOT, "src/data/plans.json");
        const stored = existsSync(out)
          ? JSON.parse(readFileSync(out, "utf8")).hash
          : undefined;
        if (stored === plansHash()) {
          console.log("predefined plans are up to date");
          return;
        }
        console.log("predefined plans: inputs changed — regenerating");
        const r = spawnSync(
          "pnpm",
          [
            "exec",
            "vite-node",
            "--config",
            "vitest.config.ts",
            "scripts/planner/predefined.ts",
          ],
          { stdio: "inherit", cwd: ROOT },
        );
        if (r.error || r.status !== 0) {
          throw new Error("predefined plan generation failed");
        }
      },
    },
  };
}
