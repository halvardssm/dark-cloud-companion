/// <reference lib="webworker" />
import { planPath, type PlanProgress, type PlanRequest, type PlanResult } from "./plan";
import type { Template } from "./solve";
import { generateTemplates, type TemplateOptions } from "./templates";

export type WorkerRequest =
  | { id: number; kind: "plan"; req: PlanRequest }
  | { id: number; kind: "templates"; opts: TemplateOptions };
export type WorkerResponse =
  | { id: number; progress: PlanProgress }
  | { id: number; result: PlanResult }
  | { id: number; templates: Template[] }
  | { id: number; error: string };

const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.kind === "plan") {
      const result = await planPath(msg.req, (progress) => post({ id: msg.id, progress }));
      post({ id: msg.id, result });
    } else {
      post({ id: msg.id, templates: await generateTemplates(msg.opts) });
    }
  } catch (err) {
    post({ id: msg.id, error: String(err) });
  }
};
