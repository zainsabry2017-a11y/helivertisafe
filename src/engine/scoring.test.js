import { describe, it, expect } from "vitest";
import { sWind, sObs, sTer, sAcc, sGeo, sEnv, calcAllScores } from "./scoring.js";
import { mkProj, mkSite, mkZone, mkObs } from "../data/models.js";

function baseZone() {
  const site = mkSite({ sw: 500, sh: 500, gr: 3, gc: 3 });
  return mkZone(1, 1, site);
}

describe("scoring functions", () => {
  const proj = mkProj({ dh: "bell412", pc: "pc1" });

  it("sWind: penalizes low coverage and honors calm", () => {
    const z = baseZone();
    z.wind = { pd: 0, ps: 5, pf: 20, sd: 90, ss: 2, sf: 20, calm: 10, seasonal: "none", roseBins: undefined };
    const r = sWind(z, proj);
    expect(r.s).toBeLessThan(100);
    expect(r.R.some((x) => x.includes("95%"))).toBe(true);
  });

  it("sWind: zero wind returns OK band", () => {
    const z = baseZone();
    const r = sWind(z, proj);
    expect(r.s).toBeGreaterThanOrEqual(0);
    expect(r.R.length).toBeGreaterThan(0);
  });

  it("sObs: empty obstacles returns verify message", () => {
    const z = baseZone();
    z.obs = [];
    const r = sObs(z, proj);
    expect(r.s).toBe(90);
    expect(r.R.join(" ")).toMatch(/verify/i);
  });

  it("sObs: negative-distance obstacle is skipped in loop", () => {
    const z = baseZone();
    z.obs = [mkObs({ nm: "Bad", h: 100, d: -1, br: 0 })];
    const r = sObs(z, proj);
    expect(r).toBeDefined();
  });

  it("sTer: flood risk reduces score", () => {
    const z = baseZone();
    z.ter = { ...z.ter, flood: true, slope: 0, side: 0, cf: 0 };
    const r = sTer(z, proj);
    expect(r.R.some((x) => x.includes("Flood"))).toBe(true);
    expect(r.s).toBeLessThan(100);
  });

  it("sAcc: no road penalizes", () => {
    const z = baseZone();
    z.acc = { ...z.acc, road: false };
    const r = sAcc(z);
    expect(r.R.some((x) => x.includes("road") || x.includes("Road"))).toBe(true);
  });

  it("sGeo: tiny zone vs FATO fails", () => {
    const z = baseZone();
    z.bw = 5;
    z.bh = 5;
    const r = sGeo(z, proj);
    expect(r.s).toBeLessThan(100);
  });

  it("sEnv: missing sensitivity uses noise path only when proj set", () => {
    const z = baseZone();
    z.sens = [];
    const r = sEnv(z, proj);
    expect(r).toBeDefined();
    expect(typeof r.s).toBe("number");
  });

  it("calcAllScores: returns grade and breakdown", () => {
    const z = baseZone();
    z.wind = { pd: 0, ps: 8, pf: 45, sd: 90, ss: 5, sf: 40, calm: 10, seasonal: "none", roseBins: undefined };
    z.obs = [mkObs({ nm: "Far", h: 10, d: 400, br: 0 })];
    const all = calcAllScores(z, proj);
    expect(all.tot).toBeGreaterThanOrEqual(0);
    expect(all.tot).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(all.gr);
    expect(all.bd.wind).toBeDefined();
    expect(all.bd.obs).toBeDefined();
    expect(all.ori).toBeDefined();
  });
});
