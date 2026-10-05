/// <reference lib="webworker" />
import { planPath, type PlanRequest, type PlanResult } from "./plan";

export type WorkerRequest = { id: number; req: PlanRequest };
export type WorkerResponse = { id: number; result?: PlanResult; error?: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, req } = e.data;
  try {
    const result = await planPath(req);
    (self as unknown as Worker).postMessage({ id, result } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) } satisfies WorkerResponse);
  }
};
