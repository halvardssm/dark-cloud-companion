import type { PlanRequest, PlanResult } from "./plan";
import type { WorkerRequest, WorkerResponse } from "./worker";

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (r: PlanResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.result) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error ?? "planner failed"));
    };
  }
  return worker;
}

/** Runs the planner off the main thread. */
export function runPlanner(req: PlanRequest): Promise<PlanResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, req } satisfies WorkerRequest);
  });
}

/** Drops the worker (e.g. to cancel a long solve); pending promises reject. */
export function cancelPlanner() {
  worker?.terminate();
  worker = undefined;
  for (const p of pending.values()) p.reject(new Error("cancelled"));
  pending.clear();
}
