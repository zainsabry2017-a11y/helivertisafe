import { DEG, db2xy } from "../utils/coords.js";

export function angDiff(a, b) { let d = ((b - a) % 360 + 360) % 360; return d > 180 ? 360 - d : d; }

/** Helipad reference point (FATO center) for computations. Defaults to zone centroid. */
export function zonePadCenter(z) {
  const x = z?.pad?.x;
  const y = z?.pad?.y;
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  return zoneCentroid(z);
}

export function obsNearestDist(obs, zoneCx, zoneCy) {
  const v = obsNearestVector(obs, zoneCx, zoneCy);
  return v.d;
}

/** Obstacle offset from reference point; uses nearest corner for polygons, else polar x,y. */
export function obsNearestVector(obs, zoneCx, zoneCy) {
  if (obs.corners && obs.corners.length >= 3) {
    let minD = Infinity;
    let best = { dx: 0, dy: 0 };
    for (const c of obs.corners) {
      const dx = c.x - zoneCx, dy = c.y - zoneCy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minD) {
        minD = d;
        best = { dx, dy };
      }
    }
    return { ...best, d: minD };
  }
  let ox = obs.x, oy = obs.y;
  if (ox === 0 && oy === 0 && obs.d > 0) {
    const p = db2xy(obs.d, obs.br || 0);
    // Distance/bearing inputs are defined relative to the reference point, not absolute coords.
    return { dx: p.x, dy: p.y, d: obs.d };
  }
  const dx = ox - zoneCx, dy = oy - zoneCy;
  const d = Math.sqrt(dx * dx + dy * dy);
  return { dx, dy, d: d > 0 ? d : obs.d };
}

// Calculate zone centroid from corners
export function zoneCentroid(z) {
  if (z.corners && z.corners.length >= 3) {
    const cx = z.corners.reduce((s, c) => s + c.x, 0) / z.corners.length;
    const cy = z.corners.reduce((s, c) => s + c.y, 0) / z.corners.length;
    return { x: cx, y: cy };
  }
  return { x: z.bw / 2, y: z.bh / 2 };
}

/** Point-in-polygon (ray casting). corners: [{x,y}, ...] site local metres. */
export function pointInPolygon(x, y, corners) {
  if (!corners || corners.length < 3) return false;
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const xi = corners[i].x;
    const yi = corners[i].y;
    const xj = corners[j].x;
    const yj = corners[j].y;
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Zone area from corners (Shoelace formula)
export function zoneArea(z) {
  if (z.corners && z.corners.length >= 3) {
    let area = 0;
    const n = z.corners.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += z.corners[i].x * z.corners[j].y;
      area -= z.corners[j].x * z.corners[i].y;
    }
    return Math.abs(area) / 2;
  }
  return z.bw * z.bh;
}

// Decompose slope into longitudinal (along FATO heading) and transverse (cross)
export function decomposeSlope(slopePct, slopeDir, fatoHeading) {
  const diff = angDiff(slopeDir, fatoHeading);
  const longitudinal = Math.abs(slopePct * Math.cos(diff * DEG));
  const transverse = Math.abs(slopePct * Math.sin(diff * DEG));
  return { longitudinal: Math.round(longitudinal * 100) / 100, transverse: Math.round(transverse * 100) / 100 };
}
