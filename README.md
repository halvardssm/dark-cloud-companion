# Dark Chronicles Companion

An unofficial companion web app for **Dark Chronicles (Dark Cloud 2)**, meant to be used on a phone while playing.

- **Dashboard** – follow your current chapter (or an overview / per-guide view): collectables, medals and prizes, missable warnings, and the steps of every guide you switched on.
- **Guides** – the generated main walkthrough, weapon build guides, and your own guides. Everything is a guide; chapters are optional. Guides can be duplicated, edited, exported and imported.
- **Planner** – generate an optimal weapon build (least ABS, gilda or steps, with abilities, a gilda budget and an optional existing guide as the starting point) and hand-craft guides; generated builds prefill the editor.
- **Reference** – weapons, Ridepod parts, monster classes and Spheda prizes.

Progress is stored locally in the browser (multiple profiles, JSON export/import). The site is fully static and works offline once loaded.

## Development

```sh
pnpm install
pnpm dev            # astro dev
pnpm build          # static site in dist/
pnpm preview
pnpm test           # vitest (logic, data cross-checks)
pnpm e2e            # Playwright: builds the site and drives it in Chromium (desktop + phone), incl. offline mode
pnpm check          # oxfmt --check + oxlint
```

`PUBLIC_SITE_URL` sets Astro's `site` (the app is served from the root of its origin).

## Data pipeline

The structured data in `src/data/` was extracted once from two community guides that are **not** part of this repository (they live in the git-ignored `.local/guides/`):

| Script                                                 | Output                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `scripts/extract/dc.ts`                                | chapters, sections, checklists                             |
| `scripts/extract/gamedata.ts`                          | inventions, Georama, shops, items, fishing                 |
| `scripts/extract/minigames.ts`                         | Ridepod parts, monster classes                             |
| `scripts/extract/weapons-walkthrough.ts`, `weapons.ts` | weapons, build-up, synth items (cross-checked)             |
| `scripts/planner/curated.ts`                           | built-in weapon guides (runs the planner offline, ~20 min) |

Only facts (names, numbers, recipes, locations) are kept; no guide prose. Tests under `src/data/` cross-check the sources against each other.

## Structure

- `src/lib/weapons` – game mechanics (ABS, levelling, spectrumize, build-up).
- `src/lib/planner` – simulator and MILP optimiser (HiGHS WebAssembly, run in a web worker).
- `src/lib/guide` – unified guide model, main-walkthrough generator, derived build data.
- `src/lib/profiles.ts`, `src/lib/store.ts` – profiles, progress, migration, persistence.
- `src/components`, `src/pages` – UI (Astro + React islands, shadcn/ui, Tailwind).

## Credits

Data derived from the Dark Cloud 2 Walkthrough v1.20 by Sky Render and the Weapon FAQ v3.1 by JungleJim. Dark Cloud 2 / Dark Chronicles is © Level-5 / Sony Interactive Entertainment.
