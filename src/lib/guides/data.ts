import guidesJson from "@/data/guides.json";
import { guide, type Guide } from "./types";
import { z } from "zod";

export const curatedGuides: Guide[] = z.array(guide).parse(guidesJson);
export const curatedGuideById = new Map(curatedGuides.map((g) => [g.id, g]));

/** Check id for a guide step, stored in the profile's `checks`. */
export const stepCheckId = (guideId: string, stepId: string) => `guide:${guideId}:${stepId}`;
