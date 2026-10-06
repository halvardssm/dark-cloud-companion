// One-off extraction: .local/guides/DC.txt -> src/data/{chapters,sections,checklist}.json
// Only structured facts are carried over (names, numbers, recipes, flags) — never walkthrough prose.
// Run: node scripts/extract/dc.ts
import { readFileSync, writeFileSync } from "node:fs";
import {
  chaptersFile,
  checklistFile,
  sectionsFile,
  type Chapter,
  type ChecklistItem,
  type Section,
} from "../../src/data/schema.ts";

// Spelling inconsistencies in the source, normalised to the correct spelling.
function fixName(s: string) {
  return s
    .replace(/Vaccuum/g, "Vacuum")
    .replace(/Peeping Pole/g, "Peeping Hole")
    .replace(/Dr\. Jaming/g, "Doctor Jaming")
    .replace(/Sulphur-Colored/g, "Sulfur-Colored")
    .replace(/Decorative Lights?\b/g, "Decorative Lights");
}

const SRC = ".local/guides/DC.txt";
const text = new TextDecoder("utf-16le").decode(readFileSync(SRC)).replace(/^﻿/, "");
const lines = fixName(text.replace(/\r/g, "")).split("\n");

// ---------- locate headers ----------
interface Header {
  title: string;
  code: string;
  line: number;
}
const headers: Header[] = [];
for (let i = 0; i < lines.length - 1; i++) {
  const m = lines[i].match(/^(\S.*?)\t+\[([A-Z0-9]+)\]\s*$/);
  if (m && /^(--==|==--|=-=-=)\s*$/.test(lines[i + 1])) {
    headers.push({ title: m[1].trim(), code: m[2], line: i });
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const chapters: Chapter[] = [];
const sections: Section[] = [];
const items: ChecklistItem[] = [];
const usedIds = new Set<string>();
const uid = (base: string) => {
  let id = base;
  for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
};

function blocks(body: string[]) {
  // Splits "Label:" blocks (until blank line); returns map label -> lines
  const out: Record<string, string[]> = {};
  for (let i = 0; i < body.length; i++) {
    const m = body[i].match(/^([A-Z][A-Za-z' -]*):\s*$/);
    if (!m) continue;
    const block: string[] = [];
    let j = i + 1;
    // Power-ups are grouped by area with blank lines between groups: read to the next label.
    const spansBlanks = /^power-ups$/i.test(m[1]);
    while (
      j < body.length &&
      (spansBlanks ? !/^[A-Z][A-Za-z' -]*:\s*$/.test(body[j]) : body[j].trim() !== "")
    )
      block.push(body[j++]);
    while (block.length && block[block.length - 1].trim() === "") block.pop();
    out[m[1].toLowerCase()] = block;
    i = j;
  }
  return out;
}

function joinWrapped(block: string[], itemStart: RegExp) {
  const res: string[] = [];
  for (const l of block) {
    if (itemStart.test(l) || res.length === 0) res.push(l.trim());
    else res[res.length - 1] += " " + l.trim();
  }
  return res;
}

function parseRecipe(raw: string) {
  return raw.split("&").map((p) => {
    const t = p.trim();
    return { scoop: t.startsWith("*"), name: t.replace(/^\*/, "").trim() };
  });
}

// ---------- chapters ----------
const chapterHeaders = headers.filter((h) => /^WCHAPTER\d$/.test(h.code));
for (let ci = 0; ci < chapterHeaders.length; ci++) {
  const ch = chapterHeaders[ci];
  const number = Number(ch.code.replace("WCHAPTER", ""));
  const chapterId = `c${number}`;
  const next = chapterHeaders[ci + 1];
  const endLine = next
    ? next.line
    : (headers.find((h) => h.line > ch.line && !h.code.startsWith("C"))?.line ?? lines.length);
  const hs = headers.filter((h) => h.line > ch.line && h.line < endLine && /^C\d/.test(h.code));

  const chapter: Chapter = {
    id: chapterId,
    number,
    title: ch.title.replace(/^Chapter \d+ ~ /, ""),
    phase: "main",
    seals: [],
    sectionIds: [],
  };

  const chapterSections: Section[] = [];
  let overview: string[] = [];

  hs.forEach((h, idx) => {
    const bodyEnd = hs[idx + 1]?.line ?? endLine;
    const body = lines.slice(h.line + 2, bodyEnd);
    if (h.code === `C${number}OVER`) {
      overview = body;
      return;
    }
    const b = blocks(body);
    const id = `${chapterId}-${slug(h.code.replace(/^C\d/, ""))}`;
    // Usually a "Medals:" block; a few sections use "Medal:" or list the goals without a heading.
    const medalLines =
      b["medals"] ??
      b["medal"] ??
      body.filter((l) => /^(Time Attack|Fishing Goal|Clear Goal|Sp?h?eda Prize):/.test(l));
    const medalsObj: NonNullable<Section["medals"]> = {};
    for (const l of medalLines) {
      const m = l.match(/^([^:]+):\s*(.+)$/);
      if (!m) continue;
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      if (k.startsWith("time")) medalsObj.timeAttack = v;
      else if (k.startsWith("fishing")) medalsObj.fishingGoal = v;
      else if (k.startsWith("clear")) medalsObj.clearGoal = v;
      else if (/prize/.test(k)) {
        medalsObj.prize = v;
        medalsObj.prizeType = /sp?h?eda/.test(k) ? "spheda" : "other";
      }
    }
    const enemies = (b["enemies"] ?? []).flatMap((l) => {
      const m = l.match(/^(.+?)(\*?)\s*\t+\s*(\d+)\s*$/);
      return m ? [{ name: m[1].trim(), carriesKey: m[2] === "*", count: Number(m[3]) }] : [];
    });
    const totals = body
      .map((l) => l.match(/^Totals?:\s*([\d,]+) ABS,\s*([\d,]+) Gilda/))
      .find(Boolean);
    const geostone = body.map((l) => l.match(/^Geostone:\s*(.+)$/)).find(Boolean)?.[1];
    const seal = body.map((l) => l.match(/^(\w+) Seal\s*$/)).find(Boolean)?.[1];

    // Photos and inventions: a section can contain several "New Photos:" / "New Inventions:" blocks.
    const newPhotos: string[] = [];
    const newInventions: Section["newInventions"] = [];
    for (let pi = 0; pi < body.length; pi++) {
      const label = ["New Photos:", "New Ideas:"].find((lb) => body[pi].startsWith(lb));
      if (label) {
        let text = body[pi].replace(label, "");
        for (
          let j = pi + 1;
          j < body.length && body[j].trim() && !/^[A-Z][A-Za-z ]*:/.test(body[j]);
          j++
        )
          text += " " + body[j];
        newPhotos.push(
          ...text
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        );
      } else if (body[pi].startsWith("New Inventions:")) {
        const blk: string[] = [];
        for (let j = pi + 1; j < body.length && body[j].trim(); j++) blk.push(body[j]);
        for (const l of joinWrapped(blk, /^- /)) {
          const m = l.match(/^- (.+?) \[(.+)\]$/);
          if (m) newInventions.push({ name: m[1].trim(), recipe: parseRecipe(m[2]) });
        }
      }
    }

    // Boss, restriction, per-section scoop notes, photo totals and recruits.
    const bossLine = body.map((l) => l.match(/^Boss:\s*(.+?)(\s*\(scoop\))?\s*$/)).find(Boolean);
    const boss = bossLine ? { name: bossLine[1].trim(), scoop: !!bossLine[2] } : undefined;
    const special = body
      .map((l) => l.match(/^Special:\s*(.+)$/))
      .find(Boolean)?.[1]
      ?.trim();
    const scoopNotes = body.flatMap((l) => {
      const m = l.match(/^Scoop:\s*(.+?)(\s*\((only chance)\))?\s*$/);
      return m ? [{ name: m[1].trim(), onlyChance: !!m[3] }] : [];
    });
    const pc = [...body]
      .reverse()
      .map((l) =>
        l.match(
          /^Photo Count:\s*(\d+) ideas?[^,]*,\s*(\d+) scoops?[^(]*(?:\([^)]*new\)\s*)?(?:\(Lv\. (\d+), (\d+) pts\))?/,
        ),
      )
      .find(Boolean);
    const photoCount = pc
      ? {
          ideas: Number(pc[1]),
          scoops: Number(pc[2]),
          ...(pc[3] ? { level: Number(pc[3]), points: Number(pc[4]) } : {}),
        }
      : undefined;
    const georamaBuild: { name: string; qty: number }[] = [];
    for (let j = 0; j < body.length; j++) {
      if (!/(build|make) the following:?\s*$/i.test(body[j])) continue;
      for (let k = j + 1; k < body.length; k++) {
        const m = body[k].match(/^(\d+) (.+?)\s*$/);
        if (m) georamaBuild.push({ qty: Number(m[1]), name: m[2] });
        else if (body[k].trim() !== "") break;
        else if (georamaBuild.length && body[k].trim() === "") break;
      }
    }
    const recruits: { name: string; location: string }[] = [];
    {
      let current: string | undefined;
      for (let j = 0; j < body.length; j++) {
        const r = body[j].match(/^\* ([^-]+?) - /);
        if (r) current = r[1].trim();
        const loc = body[j].match(/^Location:\s*(.+)$/);
        if (loc && current) {
          let text = loc[1];
          for (let k = j + 1; k < body.length && body[k].trim() && !body[k].startsWith("* "); k++)
            text += " " + body[k].trim();
          recruits.push({ name: current, location: text.replace(/\s+/g, " ").trim() });
          current = undefined;
        }
      }
    }

    const kind: Section["kind"] =
      boss || /boss|dead end/i.test(h.title)
        ? "boss"
        : medalLines.length
          ? "dungeon"
          : /^Interlude/i.test(h.title)
            ? "interlude"
            : "story";

    const section: Section = {
      id,
      chapterId,
      code: h.code,
      title: h.title,
      kind,
      order: chapterSections.length,
      ...(Object.keys(medalsObj).length ? { medals: medalsObj } : {}),
      enemies,
      ...(totals
        ? {
            totals: {
              abs: Number(totals[1].replace(/,/g, "")),
              gilda: Number(totals[2].replace(/,/g, "")),
            },
          }
        : {}),
      ...(geostone ? { geostone } : {}),
      ...(seal ? { seal } : {}),
      newPhotos: newPhotos.filter((p) => !p.startsWith("*")),
      newScoops: newPhotos.filter((p) => p.startsWith("*")).map((p) => p.slice(1)),
      newInventions,
      ...(boss ? { boss } : {}),
      ...(special ? { special } : {}),
      scoopNotes,
      georamaBuild,
      ...(photoCount ? { photoCount } : {}),
      recruits,
    };
    chapterSections.push(section);
    usedIds.add(id);
  });

  const endIdx = lines.findIndex(
    (l, i) => i > ch.line && i < endLine && /^End-[Cc]hapter [Ss]tats:/.test(l),
  );
  if (endIdx >= 0) {
    const mx = lines[endIdx + 1].match(/Max: (\d+) ?HP, (\d+) DEF/);
    const mo = lines[endIdx + 2].match(/Monica: (\d+) ?HP, (\d+) DEF/);
    const tot = lines[endIdx + 3].match(
      /(\d+) ideas, (\d+) scoops, (\d+) inventions \(Lv\. (\d+), (\d+) pts\)/,
    );
    if (mx && mo && tot) {
      chapter.endStats = {
        maxHp: Number(mx[1]),
        maxDef: Number(mx[2]),
        monicaHp: Number(mo[1]),
        monicaDef: Number(mo[2]),
        ideas: Number(tot[1]),
        scoops: Number(tot[2]),
        inventions: Number(tot[3]),
        level: Number(tot[4]),
        points: Number(tot[5]),
      };
    }
  }

  chapter.sectionIds = chapterSections.map((s) => s.id);
  sections.push(...chapterSections);

  // ---------- overview checklists ----------
  const ob = blocks(overview);
  const findSection = (title: string) => {
    const t = norm(title);
    if (!t) return undefined;
    return chapterSections.find(
      (s) => norm(s.title) === t || norm(s.title).includes(t) || t.includes(norm(s.title)),
    );
  };
  const sectionForPhoto = (name: string, scoop: boolean) =>
    chapterSections.find((s) =>
      (scoop ? s.newScoops : s.newPhotos).some((p) => norm(p) === norm(name)),
    ) ??
    // Scoops named in a section title (e.g. "Flotsam, Revived!") or marked by its Scoop: line.
    (scoop
      ? chapterSections.find(
          (s) =>
            norm(s.title).includes(norm(name)) ||
            s.scoopNotes.some((n) => norm(n.name) === norm(name)),
        )
      : undefined);

  const mk = (
    category: ChecklistItem["category"],
    name: string,
    extra: Partial<ChecklistItem> = {},
  ): ChecklistItem => ({
    id: uid(`${chapterId}-${category}-${slug(name)}`),
    chapterId,
    category,
    name,
    missable: false,
    postgame: false,
    ...extra,
  });

  const flagsOf = (raw: string) => {
    const flags = { missable: false, ghost: false, albumOnly: false };
    const rest = raw.replace(/\s*\((missable|ghost|photo album only)\)/gi, (_, f: string) => {
      const k = f.toLowerCase();
      if (k === "missable") flags.missable = true;
      else if (k === "ghost") flags.ghost = true;
      else flags.albumOnly = true;
      return "";
    });
    return { name: rest.trim(), flags };
  };

  for (const raw of joinWrapped(ob["scoops"] ?? [], /^\[ \]/)) {
    const { name, flags } = flagsOf(raw.replace(/^\[ \]\s*/, ""));
    const sec = sectionForPhoto(name, true);
    items.push(
      mk("scoop", name, {
        missable: flags.missable,
        ...(flags.ghost ? { ghost: true } : {}),
        ...(sec ? { sectionId: sec.id } : {}),
      }),
    );
  }

  for (const l of ob["ideas"] ?? []) {
    for (const part of l.split(/\[ \]/).slice(1)) {
      const { name, flags } = flagsOf(part.trim());
      if (!name) continue;
      const sec = sectionForPhoto(name, false);
      items.push(
        mk("idea", name, {
          ...(flags.albumOnly ? { albumOnly: true } : {}),
          ...(sec ? { sectionId: sec.id } : {}),
        }),
      );
    }
  }

  for (const raw of joinWrapped(
    [...(ob["inventions"] ?? []), ...(ob["key inventions"] ?? [])],
    /^\[ \]/,
  )) {
    const m = raw.replace(/^\[ \]\s*/, "").match(/^(.+?)\s*\[(.+)\]\s*$/);
    if (!m) continue;
    const sec = chapterSections.find((x) =>
      x.newInventions.some((n) => norm(n.name) === norm(m[1])),
    );
    items.push(
      mk("invention", m[1].trim(), {
        recipe: parseRecipe(m[2]),
        ...(sec ? { sectionId: sec.id } : {}),
      }),
    );
  }

  const powerKey = Object.keys(ob).find((k) => k === "power-ups");
  // Area headings (e.g. "Luna Lab") precede groups of items; attach each item's area.
  const powerLines: string[] = [];
  const areaOf: (string | undefined)[] = [];
  let curArea: string | undefined;
  for (const l of ob[powerKey ?? ""] ?? []) {
    if (l.trim() === "") continue;
    if (/^\S/.test(l) && !l.startsWith("[ ]")) curArea = l.trim();
    else {
      powerLines.push(l);
      if (l.startsWith("[ ]")) areaOf.push(curArea);
    }
  }
  let powerIdx = 0;
  for (const raw of joinWrapped(powerLines, /^\[ \]/)) {
    const areaName = areaOf[powerIdx++];
    const groups = [...raw.replace(/^\[ \]\s*/, "").matchAll(/\(([^)]*)\)/g)].map((g) =>
      g[1].trim(),
    );
    const name = raw
      .replace(/^\[ \]\s*/, "")
      .replace(/\s*\([^)]*\)/g, "")
      .trim();
    const when = groups.length ? groups[groups.length - 1] : undefined;
    const sec = when ? findSection(when) : undefined;
    const postgame = !!when && /^after beating/i.test(when);
    items.push(
      mk("powerup", name, {
        postgame,
        ...(sec ? { sectionId: sec.id } : {}),
        ...(groups.length || areaName
          ? { notes: [...(areaName ? [areaName] : []), ...groups] }
          : {}),
      }),
    );
  }

  for (const [label, cat] of [
    ["recruitable characters", "recruit"],
    ["georama achievements", "georama"],
    ["monster badges", "badge"],
  ] as const) {
    for (const raw of joinWrapped(ob[label] ?? [], /^\[ \]/)) {
      const body = raw.replace(/^\[ \]\s*/, "");
      const m = body.match(/^(.+?)\s*\((.+)\)\s*$/);
      items.push(mk(cat, m ? m[1].trim() : body, m ? { notes: [m[2].trim()] } : {}));
    }
  }

  const sealBlock = ob["dungeon overview"] ?? [];
  chapter.seals = sealBlock
    .map((l) => l.match(/^(\d+) (\w+) Seals?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => `${m[1]} ${m[2]}`);

  chapters.push(chapter);
}

// ---------- post-game placeholder chapter (filled later) ----------
chapters.push({
  id: "postgame",
  number: 9,
  title: "Post-game",
  phase: "postgame",
  seals: [],
  sectionIds: [],
});

// ---------- validate + write ----------
const out = {
  chapters: chaptersFile.parse(chapters),
  sections: sectionsFile.parse(sections),
  checklist: checklistFile.parse(items),
};
for (const [k, v] of Object.entries(out)) {
  writeFileSync(`src/data/${k}.json`, JSON.stringify(v, null, 2) + "\n");
}
const byCat = items.reduce<Record<string, number>>(
  (a, i) => ((a[i.category] = (a[i.category] ?? 0) + 1), a),
  {},
);
console.log(
  `chapters ${chapters.length}, sections ${sections.length}, checklist ${items.length}`,
  byCat,
);
