# Dark Chronicles Companion

An unofficial companion web app for **Dark Chronicles (Dark Cloud 2)**, meant to be used on a phone while playing. It is a fully static site (Astro + React islands) that stores everything you track in your browser and works offline once loaded.

## Features

- **Dashboard** – follow your current chapter (chapter picker, "set as current", auto-follow), an overview of all chapters, or a per-guide view. Shows collectables (scoops, photo ideas, inventions, power-ups, Georama, recruits, badges), medals and prizes, section facts, missable warnings and the steps of every guide you switched on. Progress is tracked **per switched-on guide**; the main walkthrough is on by default.
- **Guides** – the generated main walkthrough, built-in weapon build guides, and your own guides. Everything is a guide: steps with optional chapter/section, notes, checklists (free text, collectables, section facts) and optionally weapon-build stages. Duplicate any guide to edit it; export/import your guides as JSON (content only, never progress).
- **Planner** – generate an optimal weapon build (least ABS, gilda or steps; chapter limit; gilda budget; ability coins; buyable-only items) from an existing, custom (own specs/abilities) or guide-continued start weapon to an existing or custom (required stats/level/abilities) end weapon. Weapons are picked from one tab per weapon type. Results can be opened in the guide editor or saved as a guide. The editor can also hand-craft guides, including build steps with items and sphere weapons.
- **Reference** – weapons (stats, build-up tree, where to get them), items (buyable vs found-only), Ridepod parts, monster classes, Spheda prizes.
- **Profiles** – several playthroughs, JSON export/import of whole profiles, schema migrations from earlier versions.

## Development

```sh
pnpm install
pnpm dev            # astro dev
pnpm build          # static site in dist/ (also writes the service worker)
pnpm preview
pnpm check          # oxfmt --check + oxlint (pnpm fmt to format)
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest: logic, planner, data cross-checks
pnpm e2e            # Playwright: builds the site, drives it in Chromium (desktop + phone), incl. offline mode
pnpm test:all       # everything above
```

Requires Node ≥ 22.12 and pnpm. `PUBLIC_SITE_URL` sets Astro's `site`; the app is served from the **root** of its origin. CI (`.github/workflows/ci.yml`) runs format/lint, type check, unit and end-to-end tests.

### Deploying

`pnpm build` produces a static `dist/`. Any static host works; set `PUBLIC_SITE_URL` to the final URL. Recommended headers: `Cache-Control: no-cache` for `/sw.js`, long-lived caching for `/_astro/*` (hashed), and `application/wasm` for the HiGHS solver file. The service worker precaches the whole site after the first visit.

### Profiling the planner

`scripts/planner/profile.ts` times the planner's heaviest realistic request: the final weapon of each build-up line (Island King, Love, Grade Zero, LEGEND, Supernova, Last Resort, Sigma Bazooka, Dark Cloud, Griffon Fork, Five-Star Armlet), planned from its line's root weapon (the "optimal start point") through the full build-up chain, with the max-stats goal, chapter 8, support bonus, buyable-only items and least-ABS objective.

```sh
pnpm exec vite-node --config vitest.config.ts scripts/planner/profile.ts
```

Measured with warm sphere templates (as in the app, which pre-warms them from the planner form); every plan below is simulator-verified. Indicative numbers from a developer machine (Node 26) — re-run after touching the solver settings:

| Type    | Final weapon     | Start (root)        | Build-ups | Time   |
| ------- | ---------------- | ------------------- | --------- | ------ |
| sword   | Island King      | Holy Daedalus Blade | 4         | 0.50 s |
| armband | Love             | Magic Brassard      | 7         | 7.77 s |
| wrench  | Grade Zero       | Battle Wrench       | 7         | 3.25 s |
| wrench  | LEGEND           | Battle Wrench       | 7         | 3.25 s |
| gun     | Supernova        | Jurak Gun           | 3         | 1.03 s |
| gun     | Last Resort      | Dryer Gun           | 6         | 2.34 s |
| gun     | Sigma Bazooka    | Classic Gun         | 5         | 1.75 s |
| sword   | Dark Cloud       | Baselard            | 6         | 1.75 s |
| sword   | Griffon Fork     | Baselard            | 6         | 2.85 s |
| armband | Five-Star Armlet | Magic Brassard      | 6         | 2.19 s |

Sphere templates are generated once (~1.3 s) and cached per option set in the worker. The worst case stays bounded by the solver settings in `src/lib/planner/plan.ts`: every exact solve accepts a 1 % optimality gap and a 3 s cap (`EXACT_GAP`), later chains are pruned by the incumbent's cost (`objective_bound`), and chains whose LP bound cannot beat the incumbent are skipped. Shorter requests (e.g. only the final build-up into a top-tier weapon) finish in well under a second.

## Data pipeline

The structured data in `src/data/` was extracted once from two community guides that are **not** part of this repository (they live in the git-ignored `.local/guides/`):

| Script                                                 | Output                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `scripts/extract/dc.ts`                                | chapters, sections (medals, enemies, bosses, recruits, photos…), checklists                                  |
| `scripts/extract/gamedata.ts`                          | inventions, Georama parts/requirements, shops, items, fishing, photo rewards                                 |
| `scripts/extract/minigames.ts`                         | Ridepod parts, monster classes                                                                               |
| `scripts/extract/shops.ts`                             | item prices and first chapter stocked                                                                        |
| `scripts/extract/weapons-walkthrough.ts`, `weapons.ts` | weapons, build-up, synth items, shops, recipes (FAQ + walkthrough, cross-checked)                            |
| `scripts/extract/crosscheck.ts`                        | `src/data/INCONSISTENCIES.md` – every difference between the two guides (run `pnpm fmt` after)               |
| `scripts/planner/curated.ts`                           | built-in weapon guides, produced by the planner itself (~20 min); `convert-guides.ts` is a one-off converter |
| `scripts/planner/profile.ts`                           | planner timings: final weapons, root → full build-up chain, max stats                                        |
| `scripts/icons.ts`                                     | PNG app icons from `public/favicon.svg`                                                                      |

Run extractors with `node scripts/extract/<name>.ts` (Node ≥ 22.18 or 24+ for TypeScript); planner scripts with `pnpm exec vite-node --config vitest.config.ts scripts/planner/<name>.ts`. Only facts (names, numbers, recipes, locations) are kept — no guide prose. Tests under `src/data/` cross-check the sources against each other.

## Structure

- `src/lib/weapons` – game mechanics (ABS, levelling, spectrumize, build-up).
- `src/lib/planner` – rule-checking simulator and MILP optimiser (HiGHS WebAssembly, run in a web worker), sphere-weapon templates, item/shop data joins.
- `src/lib/guide` – unified guide model, main-walkthrough generator, derived build data, dashboard helpers, legacy converters.
- `src/lib/profiles.ts`, `src/lib/store.ts` – profiles, progress, migration, persistence (`localStorage`, key `dcc:state`).
- `src/components`, `src/pages` – UI (Astro + React islands, shadcn/ui, Tailwind). `src/i18n` – message catalogue (English; all UI strings go through it).
- `integrations/pwa.mjs` – generates the service worker at build time. `e2e/` – Playwright specs.

See `AGENTS.md` for contributor/agent conventions and `.local/plan.md` (git-ignored) for decisions, status and backlog.

## Credits and legal

Unofficial fan project, not affiliated with Level-5 or Sony Interactive Entertainment. Dark Cloud 2 / Dark Chronicles is © Level-5 / Sony Interactive Entertainment. Data derived from the _Dark Cloud 2 Walkthrough_ v1.20 by Sky Render and the _Dark Cloud 2 Weapon FAQ_ v3.1 by JungleJim; none of their prose is reproduced.
