import { describe, it, expect } from "vitest";
import { calculateDownwash } from "./downwash.js";

describe("downwash engine", () => {
  it("computes reasonable downwash values for Bell 412", () => {
    const heli = { nm: "Bell 412", mtow: 5398, rtr: 14.0, D: 17.1 };
    const res = calculateDownwash(heli, 0);

    expect(res.discAreaM2).toBeCloseTo(Math.PI * 7 * 7, 1);
    expect(res.discLoadingKgM2).toBeGreaterThan(25);
    expect(res.discLoadingKgM2).toBeLessThan(45);
    expect(res.viMs).toBeGreaterThan(10);
    expect(res.viMs).toBeLessThan(25);
    expect(res.vMaxKt).toBeGreaterThan(30);
    expect(res.hazardRadii.r30Kt).toBeGreaterThan(res.rotorRadiusM);
    expect(res.hazardRadii.r15Kt).toBeGreaterThan(res.hazardRadii.r30Kt);
  });

  it("evaluates radial velocity decay correctly", () => {
    const heli = { nm: "S-92", mtow: 12565, rtr: 17.2, D: 20.9 };
    const res = calculateDownwash(heli, 0);

    const vNear = res.getVelocityAtDistance(res.peakRadiusM);
    const vFar = res.getVelocityAtDistance(50);

    expect(vNear.kt).toBeGreaterThan(vFar.kt);
    expect(res.severity).toBe("severe");
  });
});
