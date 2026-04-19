import { describe, it, expect } from "vitest";
import { calcResponseTime } from "./responseTime.js";

describe("calcResponseTime", () => {
  it("returns null when distance cannot be determined", () => {
    expect(calcResponseTime({ distKm: 0, lat: 0, lng: 0 }, 0, 0)).toBeNull();
    expect(calcResponseTime({ distKm: -1, lat: 0, lng: 0 }, 1, 1)).toBeNull();
  });

  it("uses distKm when provided", () => {
    const r = calcResponseTime({ distKm: 50, cruiseKt: 120, groundMin: 0, maxMinutes: 999 }, 0, 0);
    expect(r).not.toBeNull();
    expect(r.distKm).toBe(50);
    expect(r.totalMin).toBeGreaterThan(r.flightMin);
    expect(r.meetsReq).toBe(true);
  });

  it("computes haversine when lat/lng set", () => {
    const dest = { distKm: 0, lat: 24.7136, lng: 46.6753, cruiseKt: 100, groundMin: 2, maxMinutes: 60 };
    const r = calcResponseTime(dest, 24.65, 46.71);
    expect(r).not.toBeNull();
    expect(r.distKm).toBeGreaterThan(0);
    expect(r.flightMin).toBeGreaterThan(0);
  });

  it("respects maxMinutes requirement", () => {
    const r = calcResponseTime({ distKm: 200, cruiseKt: 80, groundMin: 0, maxMinutes: 5 }, 0, 0);
    expect(r.meetsReq).toBe(false);
  });
});
