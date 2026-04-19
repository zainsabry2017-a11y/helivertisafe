import { calcAllScores } from "./scoring.js";

/** Active zones above this count use a Web Worker so the main thread stays responsive. */
export const SCORING_WORKER_THRESHOLD = 50;

function activeZoneCount(zones) {
  return zones.filter((z) => z.on).length;
}

/**
 * Score all zones (sync on main thread or in a worker when many active zones).
 * @param {{ zones: object[], proj: object, onProgress?: (current: number, total: number) => void }} opts
 * @returns {Promise<{ zones: object[] }>}
 */
export function runScoring(opts) {
  const { zones, proj, onProgress } = opts;
  const n = zones.length;
  const active = activeZoneCount(zones);

  if (active <= SCORING_WORKER_THRESHOLD) {
    const out = zones.map((z, i) => {
      const scored = { ...z, sc: z.on ? calcAllScores(z, proj) : null };
      if (onProgress && (i % 4 === 0 || i === n - 1)) onProgress(i + 1, n);
      return scored;
    });
    return Promise.resolve({ zones: out });
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/scoring.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg.type === "progress") onProgress?.(msg.current, msg.total);
      if (msg.type === "done") {
        worker.terminate();
        resolve({ zones: msg.zones });
      }
      if (msg.type === "error") {
        worker.terminate();
        reject(new Error(msg.message || "Worker scoring failed"));
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err.error || new Error(err.message || "Worker load error"));
    };
    try {
      worker.postMessage({ zones, proj });
    } catch (err) {
      worker.terminate();
      reject(err);
    }
  });
}
