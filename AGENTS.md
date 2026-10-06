# Agent guide — Dark Chronicles Companion

Unofficial companion web app for Dark Chronicles (Dark Cloud 2): chapter/collectable tracking, guides, and an optimal weapon-build planner. Static site (Astro 7 SSG) with React islands, shadcn/ui (base-nova, neutral) and Tailwind v4. Everything user-specific lives in the browser (localStorage).

Read `README.md` for the overview and `.local/plan.md` for decisions, status and the backlog (`.local/` is git-ignored: it also holds the source guides, never commit those).

## Commands

```sh
pnpm dev              # astro dev  (agents: use `astro dev --background`, manage with `astro dev stop|status|logs`)
pnpm build            # static site -> dist/ (also writes dist/sw.js via integrations/pwa.mjs)
pnpm check            # oxfmt --check + oxlint        (pnpm fmt / pnpm fix to apply)
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest: logic + data cross-checks
pnpm e2e              # Playwright (Chromium, desktop + Pixel 7): builds and serves the site itself
pnpm test:all         # all of the above
```

Before finishing a change run `pnpm check && pnpm typecheck && pnpm test`, plus `pnpm e2e` when UI, routing, storage, the service worker or the planner changed. Mention in your summary anything you could not verify.

## Where things are

- `src/data/` – the extracted static game data (JSON only; schemas live in `src/lib/schemas.ts`). The cross-check tests live in `scripts/extract/data.test.ts`. `INCONSISTENCIES.md` is generated (`node scripts/extract/crosscheck.ts && pnpm fmt`).
- `src/lib/weapons/` – pure game mechanics (ABS curve, levelling, spectrumize, build-up). Verified against the weapon FAQ's worked examples; do not "simplify" the formulas.
- `src/lib/planner/` – `simulate.ts` is the source of truth for rules; `solve.ts` builds a MILP (HiGHS wasm, `highs.ts`) per build-up chain; `plan.ts` ranks chains, solves the best, adds ability coins; `templates.ts` generates sphere-weapon templates; `worker.ts`/`client.ts` run it off the main thread.
- `src/lib/guide/` – the unified guide model (`types.ts`), generated main walkthrough (`main.ts`), derived build data (`derive.ts`, never stored), progress/dashboard helpers, legacy converters.
- `src/lib/profiles.ts` (schema v2 + migration from `profiles-v1.ts`), `src/lib/store.ts` (nanostores, persistence key `dcc:state`).
- `src/components/` – React islands (`dashboard/`, `guide/`, `guides/`, `planner/`, `items/`, `weapons/`, `minigames/`, `settings/`, `ui/` = shadcn). `src/pages/` – Astro routes; client-only pages use `client:only="react"` and read `?id=` etc.
- `scripts/` – one-off extractors (need `.local/guides/*`), planner scripts, icon generation. `e2e/` – Playwright specs.

## Invariants and conventions

- **No guide prose in the repo.** Only facts (names, numbers, recipes, locations). Walkthrough text in the app is user-authored. Never commit `.local/`.
- **Everything is a guide** (`Guide`/`Step`/entries `text | item | section`). Weapon builds are steps with a `build` stage; stats/costs are _derived_ by the simulator when shown. Built-in guides are read-only (`kind: "builtin"`); copy with `duplicateGuide`.
- **Ticks** live in `profile.checks`: data items/medals by their own ids (shared by every guide), text entries and step ticks as `g:<guide>:<step>[:<entry>]`. Progress is always computed from _switched-on_ guides only (`profile.activeGuides`).
- **State is versioned.** Changing the profile shape means: bump/extend the zod schema with defaults, keep old data loading (`parseState`), add a migration test. User-supplied content (imports) must pass `content-validate.ts` before it can reach the UI.
- **Planner changes** need a simulator re-check: every plan the optimiser returns must simulate with zero errors (see `plan.test.ts`). Items: "buyable" vs "found-only" is `itemAvailability()`; the profile setting `view.buyableOnly` drives the planner.
- **i18n:** all UI strings go through `useTranslations()` / `src/i18n/en.ts`; add keys there, don't hard-code text in components. Keys are typed, so dynamic keys need `as const` casts.
- **Islands hydrate late:** server-rendered markup is clickable before React takes over. In e2e use the `go()` helper (waits for hydration). Components reading localStorage must not render differently on the first client render than on the server (use a `mounted` flag).
- Formatting is oxfmt; it rewrites files (including generated Markdown), so run `pnpm fmt` after generating and don't rely on exact source text when scripting edits.
- Shell: quote Astro dynamic route paths (`'src/pages/weapons/[id].astro'`) in zsh.
- `astro preview` keeps a lock file; Playwright's config passes `--ignore-lock` and never reuses a running server so it always tests a fresh build.

## Gotchas learned the hard way

- Servers that send `Vary: Origin` break cache matching for module scripts/fonts in the service worker; `integrations/sw-template.js` matches with `ignoreVary` (covered by the offline e2e).
- The in-app/desktop browser pane cannot register service workers; use Playwright for offline checks.
- YALPS was too slow for the planner's MILP; HiGHS (wasm, ~3.4 MB) is loaded lazily and run in a worker.
- Source guides contain typos and conflicting values; extractors normalise spellings and `INCONSISTENCIES.md` records every disagreement and which value the app keeps.

## Astro documentation

Full documentation: https://docs.astro.build

- [Routing](https://docs.astro.build/en/guides/routing/) · [Astro components](https://docs.astro.build/en/basics/astro-components/) · [Framework components](https://docs.astro.build/en/guides/framework-components/) · [Content collections](https://docs.astro.build/en/guides/content-collections/) · [Styling / Tailwind](https://docs.astro.build/en/guides/styling/) · [i18n](https://docs.astro.build/en/guides/internationalization/)
