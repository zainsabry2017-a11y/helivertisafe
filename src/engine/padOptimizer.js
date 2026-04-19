import { calcGeom, getPc } from "../data/models.js";
import { pointInPolygon, zoneCentroid } from "./geometry.js";
import { calcOrientation } from "./orientation.js";
import { evaluateObstacleOLS } from "./olsEngine.js";

function bboxFromCorners(corners) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function hasAbsoluteXY(o) {
  return Number.isFinite(o?.x) && Number.isFinite(o?.y) && !(o.x === 0 && o.y === 0);
}

/**
 * Heuristic "best pad location" search inside a manual zone polygon.
 * Safe by design:
 * - Only moves the reference point; it does NOT alter obstacles or zone geometry.
 * - Only considers obstacles with absolute XY or polygon corners (distance/bearing-only obs are skipped).
 */
export function optimizePadCenter(zone, proj, opts = {}) {
  if (!zone?.corners || zone.corners.length < 3) return null;

  const G = calcGeom(proj);
  const pc = getPc(proj);
  const ori = calcOrientation(zone, proj);
  const useDirectional = ori.reason !== "No wind data" && (zone.wind.pf + zone.wind.sf + zone.wind.calm) > 0;

  const margin = (opts.marginM ?? G.tot / 2);
  const step = Math.max(opts.stepM ?? 15, 5);

  const { minX, maxX, minY, maxY } = bboxFromCorners(zone.corners);
  const cx0 = zoneCentroid(zone);

  let best = null;
  let bestPenalty = Infinity;

  for (let x = minX + margin; x <= maxX - margin; x += step) {
    for (let y = minY + margin; y <= maxY - margin; y += step) {
      if (!pointInPolygon(x, y, zone.corners)) continue;

      let penalty = 0;
      for (const o of zone.obs || []) {
        const usable = (o.corners && o.corners.length >= 3) || hasAbsoluteXY(o) || (o.d > 0 && (o.x === 0 && o.y === 0));
        // If the obstacle is distance/bearing-only, it is relative to the reference point.
        // We can't relocate it meaningfully while moving the reference, so skip it.
        if (!((o.corners && o.corners.length >= 3) || hasAbsoluteXY(o))) continue;
        void usable;

        const ev = evaluateObstacleOLS(o, { x, y }, ori.oh, G, pc, useDirectional);
        if (!Number.isFinite(ev?.dist) || ev.dist <= 0) continue;

        if (ev.pIH) penalty += 80;
        if (ev.p18) penalty += 120 + Math.min(50, (ev.ex || 0) * 4);
        else if (ev.p12) penalty += 30;

        // proximity penalty
        if (ev.dist < G.D * 2) penalty += 12;
      }

      // tiny tie-breaker: prefer being closer to the geometric centroid
      const dCent = Math.hypot(x - cx0.x, y - cx0.y);
      penalty += dCent * 0.001;

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      }
    }
  }

  if (!best) return null;
  return {
    mode: "optimized",
    x: best.x,
    y: best.y,
    marginM: Math.round(margin * 10) / 10,
    stepM: step,
    penalty: Math.round(bestPenalty * 100) / 100,
  };
}

