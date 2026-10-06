// The predefined plans: what gets generated into src/data/plans.json at build time (see
// scripts/planner/predefined.ts and integrations/plans.ts). One built-in guide is generated per
// target × variant — this is the file to edit.
//
//   targets    Weapon ids to plan for; the entry "finals" expands to every final-tier weapon
//              and can be mixed with explicit ids.
//   objective  abs | gilda | steps — what the optimiser minimises.
//   goal       max = maxed stats, reach = just get the weapon.
//   abilities  carried by the finished weapon (coins are added where the chain doesn't provide
//              them); set to [] for none.
//   maxChapter shops/items/enemy kills available up to this chapter; spBonus is the support bonus.
//
// Group settings apply to all its variants; variant settings win. Variant ids must be unique
// across all plans (guide id = <targetId>-<variantId>) and must not collide with the curated
// guides in src/data/guides.json.
import type { PlansConfigInput } from "./plans-config.ts";

export const plansConfig = {
  defaults: {
    goal: "max",
    maxChapter: 8,
    spBonus: 1,
    abilities: [
      "poison",
      "stop",
      "abs-up",
      "steal",
      "wealth",
      "dark",
      "durable",
      "absorb",
    ],
  },
  groups: [
    {
      targets: ["finals", "falcon"],
      variants: [
        { id: "max-abs", objective: "abs", label: "Least ABS" },
        { id: "max-fast", objective: "steps", label: "Fastest" },
      ],
    },
    // {
    //   // The original curated guides (formerly scripts/planner/curated.ts → src/data/guides.json):
    //   // maxed stats without the ability preset, plus a budget variant. Variant ids are kept
    //   // stable — user profiles reference them (activeGuides, tick ids).
    //   targets: [
    //     "grade-zero",
    //     "legend",
    //     "supernova",
    //     "griffon-fork",
    //     "island-king",
    //     "dark-cloud",
    //     "five-star-armlet",
    //   ],
    //   abilities: [],
    //   variants: [
    //     { id: "abs", objective: "abs", label: "Least ABS, no abilities" },
    //     {
    //       id: "budget",
    //       objective: "abs",
    //       label: "Least ABS on a budget",
    //       maxGilda: 15000,
    //     },
    //   ],
    // },
  ],
} satisfies PlansConfigInput;
