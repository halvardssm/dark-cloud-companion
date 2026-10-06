import { atom } from "nanostores";
import type { Guide } from "./types";

/** A guide being worked on in the planner's editor, shared between the generator and the editor sections. */
export const $draft = atom<{ guide: Guide; persisted: boolean } | null>(null);
