import { calcAllScores } from "../engine/scoring.js";

const PROGRESS_EVERY = 4;

self.onmessage = (e) => {
  try {
    const { zones, proj } = e.data;
    if (!Array.isArray(zones) || !proj) {
      self.postMessage({ type: "error", message: "Invalid scoring payload" });
      return;
    }
    const total = zones.length;
    const out = new Array(total);
    for (let i = 0; i < total; i++) {
      const z = zones[i];
      out[i] = { ...z, sc: z.on ? calcAllScores(z, proj) : null };
      if (i % PROGRESS_EVERY === 0 || i === total - 1) {
        self.postMessage({ type: "progress", current: i + 1, total });
      }
    }
    self.postMessage({ type: "done", zones: out });
  } catch (err) {
    self.postMessage({ type: "error", message: err?.message || String(err) });
  }
};
