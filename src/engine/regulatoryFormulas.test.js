import { describe, it, expect } from "vitest";
import {
  TLOF_DIAMETER_FACTOR,
  helipadFootprintMetres,
  maxObstacleHeightAtDistance,
  DEFAULT_APPROACH_GRADIENT,
} from "./regulatoryFormulas.js";

describe("regulatoryFormulas", () => {
  it("helipadFootprintMetres matches legacy PC-1 example (D=17.1)", () => {
    const pc = { fatoMin: 1, sa: 0.25 };
    const D = 17.1;
    const { fato, sa, tlof, tot } = helipadFootprintMetres(D, pc);
    expect(fato).toBeCloseTo(D, 6);
    expect(sa).toBeCloseTo(Math.max(D * 0.25, 3), 6);
    expect(tlof).toBeCloseTo(D * TLOF_DIAMETER_FACTOR, 6);
    expect(tot).toBeCloseTo(fato + 2 * sa, 6);
  });

  it("maxObstacleHeightAtDistance uses linear gradient (1:22.22)", () => {
    expect(maxObstacleHeightAtDistance(80, DEFAULT_APPROACH_GRADIENT)).toBeCloseTo(80 / 22.22, 6);
  });
});
