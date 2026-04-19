import { describe, it, expect } from "vitest";
import { evaluateObstacleOLS } from "./olsEngine.js";
import { mkObs } from "../data/models.js";

describe("evaluateObstacleOLS", () => {
  const centroid = { x: 0, y: 0 };
  const pc = {
    innerG: 0.5, outerG: 1 / 22.22, innerLenFactor: 5, outerLenM: 260,
    appG: 1 / 22.22, transG: 1 / 2, splay: 0.1,
  };
  const G = {
    D: 17.1, fato: 17.1, sa: 4.275, tlof: 14.193, tot: 25.65,
    appG: 1 / 22.22, transG: 1 / 2, innerG: 0.5, outerG: 1 / 22.22,
    innerLenM: 5 * 17.1, outerLenM: 260, ih: 45, ihR: 3000,
  };

  it("omni mode uses radial 1:22.22 limit", () => {
    const o = mkObs({ nm: "T", h: 3, d: 80, br: 0 });
    const ev = evaluateObstacleOLS(o, centroid, 0, G, pc, false);
    expect(ev.mode).toBe("omni");
    expect(ev.a18).toBeCloseTo(80 / 22.22, 6);
    expect(ev.p18).toBe(false);
  });

  it("detects IHS penetration when tall and within radius", () => {
    const o = mkObs({ nm: "Hi", h: 50, d: 100, br: 0 });
    const ev = evaluateObstacleOLS(o, centroid, 0, G, pc, false);
    expect(ev.pIH).toBe(false);
  });
});
