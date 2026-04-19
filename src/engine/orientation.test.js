import { describe, it, expect } from "vitest";
import { calcOrientation } from "./orientation.js";
import { mkProj, mkSite, mkZone } from "../data/models.js";

describe("calcOrientation", () => {
  const proj = mkProj({ dh: "h145", pc: "pc2" });
  const site = mkSite({ sw: 300, sh: 300, gr: 2, gc: 2 });

  it("returns no-wind sentinel when primary and secondary speeds are zero", () => {
    const z = mkZone(0, 0, site);
    const o = calcOrientation(z, proj);
    expect(o.ok).toBe(true);
    expect(o.reason).toMatch(/no wind/i);
  });

  it("computes best heading with known wind data", () => {
    const z = mkZone(0, 0, site);
    z.wind = {
      pd: 90,
      ps: 18,
      pf: 40,
      sd: 0,
      ss: 0,
      sf: 0,
      calm: 20,
      seasonal: "none",
      roseBins: undefined,
    };
    const o = calcOrientation(z, proj);
    expect(o.all.length).toBeGreaterThan(10);
    expect(typeof o.hp).toBe("string");
    expect(o.hp).toMatch(/\d{2}\/\d{2}/);
    expect(o.us).toBeGreaterThanOrEqual(0);
    expect(o.us).toBeLessThanOrEqual(100);
    expect(typeof o.xm).toBe("number");
  });
});
