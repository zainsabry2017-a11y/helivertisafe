import { describe, it, expect } from "vitest";
import { xy2db, db2xy, autoCalcCoords } from "./coords.js";

describe("autoCalcCoords bidirectional", () => {
  it("updates d and br when x,y change", () => {
    const o = { id: "1", x: 0, y: 0, d: 0, br: 0 };
    const r = autoCalcCoords(o, "x", 30);
    const r2 = autoCalcCoords({ ...r, y: 40 }, "y", 40);
    expect(r2.d).toBeCloseTo(50, 5);
    expect(typeof r2.br).toBe("number");
  });

  it("updates x,y when d,br change", () => {
    const o = { id: "1", x: 0, y: 0, d: 100, br: 0 };
    const r = autoCalcCoords(o, "d", 100);
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(100, 5);
  });

  it("supports dist key instead of d", () => {
    const o = { id: "1", x: 3, y: 4, dist: 0, br: 0 };
    const r = autoCalcCoords(o, "dist", 5);
    expect(xy2db(r.x, r.y).d).toBeCloseTo(5, 5);
  });

  it("returns unchanged object for unrelated field", () => {
    const o = { id: "1", x: 1, y: 2, d: 0, br: 0, nm: "a" };
    const r = autoCalcCoords(o, "nm", "b");
    expect(r.nm).toBe("b");
  });
});

describe("xy2db / db2xy edge cases", () => {
  it("handles zero values", () => {
    expect(xy2db(0, 0).d).toBe(0);
    expect(db2xy(0, 0).x).toBe(0);
    expect(db2xy(0, 0).y).toBe(0);
  });

  it("handles negative coordinates", () => {
    const { d, br } = xy2db(-3, -4);
    expect(d).toBe(5);
    expect(typeof br).toBe("number");
  });
});
