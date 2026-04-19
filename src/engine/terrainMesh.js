/**
 * Terrain from XYZ points (5.4): Delaunay triangulation, interpolation,
 * contours, zone slopes, FATO cut/fill estimate.
 */
import { Delaunay } from "d3-delaunay";
import { zoneCentroid } from "./geometry.js";
import { calcGeom } from "../data/models.js";

/** CSV / paste: X,Y,Z columns (Northing/Easting/Elevation variants). */
export function parseElevationCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) throw new Error("Need a header and at least one point row.");
  const head = lines[0].split(/[,;\t]/).map((c) =>
    String(c || "")
      .trim()
      .toLowerCase()
  );
  let ix = head.findIndex((h) => /\bx\b|easting|east|e\b/.test(h));
  let iy = head.findIndex((h) => /\by\b|northing|north|n\b/.test(h));
  let iz = head.findIndex((h) => /z|elev|height|rl|amsl/.test(h));
  if (ix < 0) ix = 0;
  if (iy < 0) iy = 1;
  if (iz < 0) iz = 2;
  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const c = lines[r].split(/[,;\t]/).map((s) => s.trim());
    if (c.length < 3) continue;
    const x = parseFloat(c[ix]);
    const y = parseFloat(c[iy]);
    const z = parseFloat(c[iz]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) out.push({ x, y, z });
  }
  if (out.length < 3) throw new Error("Need at least 3 valid X,Y,Z points.");
  return out;
}

export function buildTerrainContext(rawPoints) {
  const valid = rawPoints.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  if (valid.length < 3) return null;
  const coords = new Float64Array(valid.length * 2);
  for (let i = 0; i < valid.length; i++) {
    coords[i * 2] = valid[i].x;
    coords[i * 2 + 1] = valid[i].y;
  }
  const delaunay = Delaunay.from(coords);
  return { delaunay, points: valid, coords };
}

function barycentricZ(px, py, ax, ay, za, bx, by, zb, cx, cy, zc) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const den = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(den) < 1e-18) return null;
  const inv = 1 / den;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) {
    const w = 1 - u - v;
    return w * za + v * zb + u * zc;
  }
  return null;
}

export function interpolateZ(ctx, x, y) {
  if (!ctx) return NaN;
  const { delaunay, points, coords } = ctx;
  const { triangles } = delaunay;
  for (let i = 0; i < triangles.length; i += 3) {
    const ia = triangles[i];
    const ib = triangles[i + 1];
    const ic = triangles[i + 2];
    const ax = coords[ia * 2];
    const ay = coords[ia * 2 + 1];
    const bx = coords[ib * 2];
    const by = coords[ib * 2 + 1];
    const cx = coords[ic * 2];
    const cy = coords[ic * 2 + 1];
    const z = barycentricZ(x, y, ax, ay, points[ia].z, bx, by, points[ib].z, cx, cy, points[ic].z);
    if (z != null) return z;
  }
  return NaN;
}

function gridSamples(ctx, site, nx = 48, ny = 48) {
  const zmin = Math.min(...ctx.points.map((p) => p.z));
  const zmax = Math.max(...ctx.points.map((p) => p.z));
  const gw = site.sw / nx;
  const gh = site.sh / ny;
  const z = [];
  for (let j = 0; j <= ny; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx) * site.sw;
      const y = (j / ny) * site.sh;
      let v = interpolateZ(ctx, x, y);
      if (!Number.isFinite(v)) v = (zmin + zmax) / 2;
      row.push(v);
    }
    z.push(row);
  }
  return { z, nx, ny, gw, gh, zmin, zmax };
}

/** Polylines in site XY (m) for contour levels */
export function computeContours(ctx, site, nLevels = 6) {
  const g = gridSamples(ctx, site, 40, 40);
  const step = (g.zmax - g.zmin) / (nLevels + 1);
  const levels = [];
  for (let k = 1; k <= nLevels; k++) levels.push(g.zmin + step * k);
  const polylines = [];
  for (const L of levels) {
    const segs = [];
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const x0 = (i / g.nx) * site.sw;
        const y0 = (j / g.ny) * site.sh;
        const x1 = ((i + 1) / g.nx) * site.sw;
        const y1 = ((j + 1) / g.ny) * site.sh;
        const z00 = g.z[j][i];
        const z10 = g.z[j][i + 1];
        const z11 = g.z[j + 1][i + 1];
        const z01 = g.z[j + 1][i];
        const interpEdge = (xa, ya, za, xb, yb, zb) => {
          if (Math.abs(za - zb) < 1e-9) return null;
          const t = (L - za) / (zb - za);
          if (t < 0 || t > 1) return null;
          return { x: xa + t * (xb - xa), y: ya + t * (yb - ya) };
        };
        const e = [
          interpEdge(x0, y0, z00, x1, y0, z10),
          interpEdge(x1, y0, z10, x1, y1, z11),
          interpEdge(x1, y1, z11, x0, y1, z01),
          interpEdge(x0, y1, z01, x0, y0, z00),
        ].filter(Boolean);
        if (e.length >= 2) segs.push([e[0], e[1]]);
      }
    }
    polylines.push({ level: L, segs });
  }
  return polylines;
}

export function zoneSlopeFromMesh(ctx, z, site, stepM = 12) {
  const c = zoneCentroid(z);
  const z0 = interpolateZ(ctx, c.x, c.y);
  const zx = interpolateZ(ctx, Math.min(c.x + stepM, site.sw - 0.01), c.y);
  const zy = interpolateZ(ctx, c.x, Math.min(c.y + stepM, site.sh - 0.01));
  if (!Number.isFinite(z0) || !Number.isFinite(zx) || !Number.isFinite(zy)) {
    return { slopePct: z.ter.slope || 0, dirDeg: z.ter.slopeDir || 0 };
  }
  const dzdx = (zx - z0) / stepM;
  const dzdy = (zy - z0) / stepM;
  const grad = Math.hypot(dzdx, dzdy);
  const slopePct = Math.round(grad * 10000) / 100;
  let dirDeg = (Math.atan2(dzdy, dzdx) * 180) / Math.PI;
  dirDeg = (90 - dirDeg + 360) % 360;
  return { slopePct, dirDeg };
}

export function estimateFatoCutFill(ctx, z, site, proj) {
  const G = calcGeom(proj);
  const c = zoneCentroid(z);
  const half = G.fato / 2;
  const cell = Math.max(2, G.fato / 16);
  let sumZ = 0;
  let n = 0;
  for (let x = c.x - half; x <= c.x + half; x += cell) {
    for (let y = c.y - half; y <= c.y + half; y += cell) {
      if (x < 0 || y < 0 || x > site.sw || y > site.sh) continue;
      const zz = interpolateZ(ctx, x, y);
      if (Number.isFinite(zz)) {
        sumZ += zz;
        n++;
      }
    }
  }
  if (!n) return { targetElev: 0, cutFillM3: 0 };
  const target = sumZ / n;
  let vol = 0;
  for (let x = c.x - half; x <= c.x + half; x += cell) {
    for (let y = c.y - half; y <= c.y + half; y += cell) {
      if (x < 0 || y < 0 || x > site.sw || y > site.sh) continue;
      const zz = interpolateZ(ctx, x, y);
      if (Number.isFinite(zz)) vol += (zz - target) * cell * cell;
    }
  }
  return { targetElev: Math.round(target * 100) / 100, cutFillM3: Math.round(vol / 10) / 100 };
}

/** Full analysis payload for site + zones */
export function computeTerrainAnalysis(site, zones, proj) {
  const pts = site.elevationPoints || [];
  const ctx = buildTerrainContext(pts);
  if (!ctx) {
    return { contours: [], zoneSlopes: [], cutFillByZone: {}, error: "Need ≥3 XYZ points on site." };
  }
  const contours = computeContours(ctx, site, 5);
  const zoneSlopes = [];
  const cutFillByZone = {};
  for (const z of zones) {
    if (!z.on) continue;
    const sl = zoneSlopeFromMesh(ctx, z, site);
    zoneSlopes.push({ zoneId: z.id, lb: z.lb, ...sl });
    cutFillByZone[z.id] = estimateFatoCutFill(ctx, z, site, proj);
  }
  return { contours, zoneSlopes, cutFillByZone, zmin: Math.min(...pts.map((p) => p.z)), zmax: Math.max(...pts.map((p) => p.z)), nPts: pts.length };
}
