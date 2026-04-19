import { describe, it, expect } from "vitest";
import { checkCompliance } from "./compliance.js";
import { calcAllScores } from "./scoring.js";
import { mkProj, mkSite, mkZone, mkObs } from "../data/models.js";

/** Zone + project that exercise every compliance branch (orientation requires sc.ori). */
function complianceFixture() {
  const site = mkSite({ sw: 800, sh: 800, gr: 1, gc: 1 });
  const z = mkZone(0, 0, site);
  z.bw = 500;
  z.bh = 500;
  z.wind = {
    pd: 0,
    ps: 10,
    pf: 38,
    sd: 90,
    ss: 8,
    sf: 37,
    calm: 20,
    seasonal: "none",
    roseBins: undefined,
  };
  z.ter = { slope: 1, slopeDir: 0, side: 1, soil: "firm", cf: 1, flood: false, elevMin: 0, elevMax: 2, elevAvg: 1, elevPts: 3 };
  z.acc = { road: true, rd: 40, bd: 45, emer: true, util: true, nodes: [] };
  z.obs = [mkObs({ nm: "Remote", h: 8, d: 600, br: 0, lit: true, perm: true })];
  const proj = mkProj({ dh: "bell412", pc: "pc1" });
  z.sc = calcAllScores(z, proj);
  return { zone: z, proj, site };
}

describe("checkCompliance", () => {
  it("returns structured checks with PASS/FAIL/WARN/N/A statuses", () => {
    const { zone, proj, site } = complianceFixture();
    const comp = checkCompliance(zone, proj, site);
    expect(comp.checks.length).toBeGreaterThanOrEqual(18);
    for (const c of comp.checks) {
      expect(c).toHaveProperty("cat");
      expect(c).toHaveProperty("ref");
      expect(c).toHaveProperty("rule");
      expect(c).toHaveProperty("status");
      expect(c).toHaveProperty("detail");
      expect(["PASS", "FAIL", "WARN", "N/A"]).toContain(c.status);
    }
    expect(comp.summary.total).toBe(comp.checks.length);
    expect(comp.summary.passed + comp.summary.failed + comp.summary.warned).toBeGreaterThan(0);
    expect(typeof comp.compliant).toBe("boolean");
  });

  it("marks compliant only when there are zero FAIL results", () => {
    const { zone, proj, site } = complianceFixture();
    const comp = checkCompliance(zone, proj, site);
    const fails = comp.checks.filter((c) => c.status === "FAIL").length;
    expect(comp.compliant).toBe(fails === 0);
  });
});
