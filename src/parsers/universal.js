import { parseDXF } from "./dxf.js";
import { parseGeoJSON } from "./geojson.js";
import { parseKML } from "./kml.js";
import { parseCSV } from "./csv.js";
import { parseWKT } from "./wkt.js";
import { mkObs, mkManualZone } from "../data/models.js";

export function parseAnyFile(text, filename) {
  const ext = (filename || "").toLowerCase().split(".").pop();
  let result = { polys: [], pts: [], points: [], count: 0, format: "unknown" };
  try {
    if (ext === "dxf") { const p = parseDXF(text); result = { polys: p.closed.map(c => ({ vertices: c.verts })), pts: [], points: [], count: p.count, format: "DXF" }; }
    else if (ext === "geojson" || ext === "json") { const p = parseGeoJSON(text); result = { ...p, points: [], format: "GeoJSON" }; }
    else if (ext === "kml") { const p = parseKML(text); result = { ...p, points: [], format: "KML" }; }
    else if (ext === "csv" || ext === "txt") { const p = parseCSV(text); result = { polys: [], pts: [], points: p.points, count: p.count, format: "CSV" }; }
    else if (ext === "wkt") { const p = parseWKT(text); result = { ...p, pts: [], points: [], format: "WKT" }; }
    else {
      // Try auto-detect
      if (text.trim().startsWith("{")) { const p = parseGeoJSON(text); result = { ...p, points: [], format: "GeoJSON (auto)" }; }
      else if (text.trim().startsWith("<?xml") || text.includes("<kml")) { const p = parseKML(text); result = { ...p, points: [], format: "KML (auto)" }; }
      else if (text.includes("POLYGON")) { const p = parseWKT(text); result = { ...p, pts: [], points: [], format: "WKT (auto)" }; }
      else if (text.includes("ENTITIES")) { const p = parseDXF(text); result = { polys: p.closed.map(c => ({ vertices: c.verts })), pts: [], points: [], count: p.count, format: "DXF (auto)" }; }
      else { const p = parseCSV(text); result = { polys: [], pts: [], points: p.points, count: p.count, format: "CSV (auto)" }; }
    }
  } catch (e) { console.error("Parse error:", e); }
  return result;
}

// Convert parsed data to site boundary / zones / obstacles / terrain points
export function importFileData(parsed, siteW, siteH) {
  const allPts = [];
  (parsed.polys || []).forEach(p => p.vertices.forEach(v => allPts.push(v)));
  (parsed.pts || []).forEach(p => allPts.push(p));
  (parsed.points || []).forEach(p => allPts.push(p));
  if (!allPts.length) return { boundary: [], zones: [], obstacles: [], terrainPts: [] };

  const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
  const oX = Math.min(...xs), oY = Math.min(...ys);
  const transform = (v) => ({ x: Math.round((v.x - oX) * 100) / 100, y: Math.round((v.y - oY) * 100) / 100, z: v.z || 0 });

  const threshArea = siteW * siteH * 0.02;
  const boundary = [], zones = [], obstacles = [], terrainPts = [];

  for (const poly of (parsed.polys || [])) {
    const pts = poly.vertices.map(transform);
    let area = 0;
    for (let j = 0; j < pts.length; j++) { const k = (j + 1) % pts.length; area += pts[j].x * pts[k].y - pts[k].x * pts[j].y; }
    area = Math.abs(area) / 2;

    const pxs = pts.map(p => p.x), pys = pts.map(p => p.y);
    const spanX = Math.max(...pxs) - Math.min(...pxs), spanY = Math.max(...pys) - Math.min(...pys);

    if (area > siteW * siteH * 0.5) {
      boundary.push(...pts); // Likely site boundary
    } else if (area > threshArea) {
      const label = "D" + (zones.length + 1);
      zones.push(mkManualZone(label, pts.length >= 4 ? pts.slice(0, Math.min(pts.length, 20)) : [...pts, pts[0]]));
    } else {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      obstacles.push(mkObs({
        nm: poly.props?.name || "Obj_" + (obstacles.length + 1),
        corners: pts, x: cx, y: cy, w: spanX, l: spanY,
        d: Math.sqrt(cx * cx + cy * cy), br: Math.round(Math.atan2(cx, cy) * 180 / Math.PI)
      }));
    }
  }

  // CSV/point data → terrain points or obstacles
  const obsTypes = ["building","tower","antenna","crane","tree","pole","wall","chimney","tank","other","obs","obstacle"];
  for (const pt of (parsed.points || [])) {
    const tp = transform(pt);
    const isObs = pt.obsH > 0 || obsTypes.some(t => (pt.type || "").toLowerCase().includes(t));
    if (isObs) {
      const dist = pt.dist > 0 ? pt.dist : Math.sqrt(tp.x * tp.x + tp.y * tp.y);
      const bear = pt.bearing > 0 ? pt.bearing : Math.round(Math.atan2(tp.x, tp.y) * 180 / Math.PI);
      obstacles.push(mkObs({
        nm: pt.name || "Obs_" + (obstacles.length + 1),
        tp: pt.type || "building",
        h: pt.obsH || 0,
        w: pt.obsW || 0,
        l: pt.obsL || 0,
        x: tp.x, y: tp.y,
        elevAMSL: tp.z,
        d: dist,
        br: bear
      }));
    } else {
      terrainPts.push({ x: tp.x, y: tp.y, z: tp.z, name: pt.name });
    }
  }

  return { boundary, zones, obstacles, terrainPts };
}
