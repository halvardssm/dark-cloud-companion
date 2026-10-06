import type { PlanProgress, PlanRequest, PlanResult } from "./plan";
import type { Template } from "./solve";
import type { TemplateOptions } from "./templates";
import type { WorkerRequest, WorkerResponse } from "./worker";

let worker: Worker | undefined;
let nextId = 1;
interface Pending {
  resolve: (r: never) => void;
  reject: (e: Error) => void;
  onProgress?: (p: PlanProgress) => void;
}
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      const p = pending.get(m.id);
      if (!p) return;
      if ("progress" in m) {
        p.onProgress?.(m.progress);
        return;
      }
      pending.delete(m.id);
      if ("result" in m) p.resolve(m.result as never);
      else if ("templates" in m) p.resolve(m.templates as never);
      else p.reject(new Error(m.error));
    };
  }
  return worker;
}

type RequestBody = WorkerRequest extends infer U
  ? U extends { id: number }
    ? Omit<U, "id">
    : never
  : never;

function send<T>(msg: RequestBody, onProgress?: (p: PlanProgress) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve: resolve as (r: never) => void, reject, onProgress });
    getWorker().postMessage({ ...msg, id } as WorkerRequest);
  });
}

/** Runs the planner off the main thread, reporting coarse progress. */
export const runPlanner = (req: PlanRequest, onProgress?: (p: PlanProgress) => void) =>
  send<PlanResult>({ kind: "plan", req }, onProgress);

/** Sphere-weapon templates for an option set (cached in the worker), e.g. for the guide editor. */
export const loadTemplates = (opts: TemplateOptions) =>
  send<Template[]>({ kind: "templates", opts });

/** Drops the worker (e.g. to cancel a long solve); pending promises reject. */
export function cancelPlanner() {
  worker?.terminate();
  worker = undefined;
  for (const p of pending.values()) p.reject(new Error("cancelled"));
  pending.clear();
}
