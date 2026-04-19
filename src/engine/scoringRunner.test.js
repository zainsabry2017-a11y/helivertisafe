import { describe, it, expect } from "vitest";
import { runScoring, SCORING_WORKER_THRESHOLD } from "./scoringRunner.js";
import { mkProj, mkSite, mkZone } from "../data/models.js";

describe("runScoring", () => {
  it("scores on main thread when active zone count ≤ threshold (Node has no Worker)", async () => {
    const site = mkSite({ sw: 200, sh: 200, gr: 5, gc: 5 });
    const zones = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        zones.push(mkZone(r, c, site));
      }
    }
    expect(zones.filter((z) => z.on).length).toBe(25);
    const proj = mkProj({ dh: "bell412", pc: "pc1" });
    let progressCalls = 0;
    const { zones: scored } = await runScoring({
      zones,
      proj,
      onProgress: () => {
        progressCalls += 1;
      },
    });
    expect(scored.length).toBe(zones.length);
    expect(scored.filter((z) => z.sc).length).toBeGreaterThan(0);
    expect(progressCalls).toBeGreaterThan(0);
  });

  it("exports worker threshold constant", () => {
    expect(SCORING_WORKER_THRESHOLD).toBe(50);
  });
});
