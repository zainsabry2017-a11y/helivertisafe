/**
 * Obstacle survey import (5.3): Excel headers, PNEZD, drone classification CSV.
 */
import * as XLSX from "xlsx";
import { mkObs } from "../data/models.js";
import { OBS_TYPES } from "../data/constants.js";
import { latLngToLocal } from "../utils/mapGeo.js";

const HDR = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

function normType(s) {
  const t = String(s || "")
    .toLowerCase()
    .trim();
  if (!t) return "building";
  if (OBS_TYPES.includes(t)) return t;
  const map = {
    bldg: "building",
    building: "building",
    tower: "tower",
    tree: "tree",
    trees: "tree",
    vegetation: "tree",
    ant: "antenna",
    antenna: "antenna",
    comms: "antenna",
    crane: "crane",
    line: "powerline",
    power: "powerline",
    fence: "fence",
    ground: "terrain_high",
    topo: "terrain_high",
    vehicle: "other",
    structure: "building",
  };
  for (const [k, v] of Object.entries(map)) if (t.includes(k)) return v;
  return "other";
}

export function classificationToObsType(classification) {
  return normType(classification);
}

/** Map header keys (normalized) to column index */
function headerIndexMap(headerRow) {
  const m = {};
  headerRow.forEach((h, i) => {
    m[HDR(h)] = i;
  });
  return m;
}

function pick(m, keys) {
  for (const k of keys) {
    const hk = HDR(k);
    if (m[hk] != null) return m[hk];
  }
  for (const name of Object.keys(m)) {
    for (const k of keys) {
      if (name.includes(HDR(k))) return m[name];
    }
  }
  return -1;
}

export function parseObstacleXlsxArrayBuffer(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length < 2) throw new Error("Excel sheet empty.");
  const h = headerIndexMap(rows[0].map((c) => String(c)));
  const ix = pick(h, ["x", "easting", "east"]);
  const iy = pick(h, ["y", "northing", "north"]);
  const iz = pick(h, ["z", "elevation", "elev", "height_amsl", "rl"]);
  const ih = pick(h, ["height", "height_agl", "h", "agl", "obstacle_height"]);
  const inm = pick(h, ["name", "description", "desc", "id", "point"]);
  const itp = pick(h, ["type", "category", "classification", "class"]);
  if (ix < 0 || iy < 0) throw new Error("Excel needs X/Easting and Y/Northing columns.");
  const obs = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const x = parseFloat(row[ix]);
    const y = parseFloat(row[iy]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const zAm = iz >= 0 ? parseFloat(row[iz]) : 0;
    const hAgl = ih >= 0 ? parseFloat(row[ih]) : 8;
    const nm = inm >= 0 ? String(row[inm] || "Imported") : "Imported";
    const tpRaw = itp >= 0 ? row[itp] : "";
    obs.push(
      mkObs({
        nm,
        tp: classificationToObsType(tpRaw),
        x,
        y,
        elevAMSL: Number.isFinite(zAm) ? zAm : 0,
        h: Number.isFinite(hAgl) ? hAgl : 8,
        confidence: 85,
        srcTag: "survey_xlsx",
      })
    );
  }
  if (!obs.length) throw new Error("No valid rows with X/Y in spreadsheet.");
  return obs;
}

/** PNEZD: Point, Northing, Easting, Z, Description — tab or comma */
export function parsePnezdText(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() && !l.toLowerCase().startsWith("p,"));
  const obs = [];
  for (const line of lines) {
    const p = line.split(/[,;\t]+/).map((s) => s.trim());
    if (p.length < 5) continue;
    const en = parseFloat(p[2]);
    const nn = parseFloat(p[1]);
    const zz = parseFloat(p[3]);
    const desc = p.slice(4).join(" ");
    if (!Number.isFinite(en) || !Number.isFinite(nn)) continue;
    obs.push(
      mkObs({
        nm: desc || p[0] || "TS",
        tp: classificationToObsType(desc),
        x: en,
        y: nn,
        elevAMSL: Number.isFinite(zz) ? zz : 0,
        h: 10,
        confidence: 80,
        srcTag: "survey_pnezd",
      })
    );
  }
  if (!obs.length) throw new Error("No PNEZD rows (expect: ID, N, E, Z, Description).");
  return obs;
}

/** Drone / point cloud summary: X,Y,Z,Classification */
export function parseDroneClassificationCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0].split(/[,;\t]/).map(HDR);
  let ix = head.findIndex((h) => h === "x" || h.endsWith("_x"));
  let iy = head.findIndex((h) => h === "y" || h.endsWith("_y"));
  let iz = head.findIndex((h) => h === "z" || h === "z_m" || h.includes("elev"));
  let ic = head.findIndex((h) => h.includes("class") || h === "label" || h === "type");
  if (ix < 0) ix = 0;
  if (iy < 0) iy = 1;
  if (iz < 0) iz = 2;
  if (ic < 0) ic = 3;
  const obs = [];
  for (let r = 1; r < lines.length; r++) {
    const c = lines[r].split(/[,;\t]/);
    const x = parseFloat(c[ix]);
    const y = parseFloat(c[iy]);
    const z = parseFloat(c[iz]);
    const cls = ic >= 0 ? c[ic] : "building";
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const tp = classificationToObsType(cls);
    const isGround = tp === "terrain_high" && String(cls).toLowerCase().includes("ground");
    obs.push(
      mkObs({
        nm: String(cls || "pt"),
        tp: isGround ? "terrain_high" : tp,
        x,
        y,
        elevAMSL: Number.isFinite(z) ? z : 0,
        h: isGround ? 0 : Math.max(3, Math.abs(z) * 0.01),
        confidence: 70,
        srcTag: "drone_csv",
      })
    );
  }
  if (!obs.length) throw new Error("No valid X,Y rows in drone CSV.");
  return obs;
}

function parseBoolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  if (["1", "true", "yes", "y", "t"].includes(s)) return true;
  if (["0", "false", "no", "n", "f"].includes(s)) return false;
  return false;
}

/**
 * OLS export CSV (lat/lng) import.
 * Expected headers (case-insensitive, tolerant):
 * - ID
 * - Latitude
 * - Longitude / Logitude
 * - TYPE
 * - height_agl
 * - elev_is_base (optional; can be 0/1, true/false)
 * - elevation_t / elevation_top / elevation_total / elevation (optional)
 *
 * Converts lat/lng to site-local meters (x east, y south).
 */
export function parseOlsCsv(text, site) {
  const lines = String(text || "")
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) throw new Error("OLS CSV is empty (need header + at least 1 row).");

  const header = lines[0].split(/[,;\t]/).map((h) => String(h ?? "").trim());
  const hmap = headerIndexMap(header);
  const iId = pick(hmap, ["id", "name", "obstacle_id"]);
  const iLat = pick(hmap, ["latitude", "lat"]);
  const iLng = pick(hmap, ["longitude", "logitude", "lng", "lon"]);
  const iType = pick(hmap, ["type", "classification", "class", "category"]);
  const iH = pick(hmap, ["height_agl", "agl", "height", "h"]);
  const iIsBase = pick(hmap, ["elev_is_base", "elev_is_ba", "is_base", "base"]);
  const iElev = pick(hmap, ["elevation_t", "elevation_top", "elevation_total", "elevation", "elev", "z"]);

  if (iLat < 0 || iLng < 0) throw new Error("OLS CSV needs Latitude and Longitude columns.");
  if (iH < 0) throw new Error("OLS CSV needs height_agl column.");

  const obs = [];
  for (let r = 1; r < lines.length; r++) {
    const c = lines[r].split(/[,;\t]/).map((x) => String(x ?? "").trim());
    const lat = parseFloat(c[iLat]);
    const lng = parseFloat(c[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const id = iId >= 0 ? String(c[iId] || "").trim() : "";
    const tpRaw = iType >= 0 ? c[iType] : "";
    const hAgl = parseFloat(c[iH]);
    if (!Number.isFinite(hAgl)) continue;

    const elevRaw = iElev >= 0 ? parseFloat(c[iElev]) : 0;
    const elevIsBase = iIsBase >= 0 ? parseBoolish(c[iIsBase]) : true; // default to base elevation
    const baseElev = Number.isFinite(elevRaw)
      ? (elevIsBase ? elevRaw : Math.max(0, elevRaw - hAgl))
      : 0;

    const { x, y } = latLngToLocal(site, lat, lng);
    obs.push(
      mkObs({
        nm: id || "OLS",
        tp: classificationToObsType(tpRaw),
        x,
        y,
        elevAMSL: baseElev,
        h: Math.max(0, hAgl),
        confidence: 85,
        srcTag: "ols_csv",
      })
    );
  }

  if (!obs.length) throw new Error("No valid rows found in OLS CSV (check lat/lng and height_agl).");
  return obs;
}
