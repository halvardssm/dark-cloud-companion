import { describe, expect, test } from "vitest";
import { createProfile, importProfiles, initialState, parseState, STATE_VERSION } from "./profiles";

describe("profiles", () => {
  test("parseState falls back on garbage", () => {
    expect(Object.keys(parseState("nope").profiles)).toHaveLength(1);
    expect(Object.keys(parseState(null).profiles)).toHaveLength(1);
  });

  test("round-trips valid state", () => {
    const s = initialState();
    expect(parseState(JSON.stringify(s))).toEqual(s);
  });

  test("rejects state pointing at a missing profile", () => {
    const s = { ...initialState(), activeProfile: "missing" };
    expect(parseState(JSON.stringify(s)).activeProfile).not.toBe("missing");
  });

  test("import replaces same id and adds new, activating first", () => {
    const s = initialState();
    const other = createProfile("Imported");
    const merged = importProfiles(s, {
      app: "dark-chronicles-companion",
      version: STATE_VERSION,
      profiles: [other],
    });
    expect(Object.keys(merged.profiles)).toHaveLength(2);
    expect(merged.activeProfile).toBe(other.id);
  });
});
