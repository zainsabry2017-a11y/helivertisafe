/**
 * One-time extractor: slices src/helivertisafe.jsx into modules.
 * Run: node scripts/phase1-extract.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "src", "helivertisafe.jsx");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

function slice(a, b) {
  return lines.slice(a - 1, b).join("\n");
}

const out = [];

function write(rel, content) {
  const p = path.join(root, "src", rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.trim() + "\n", "utf8");
  out.push(rel);
}

// --- utils/coords.js ---
write(
  "utils/coords.js",
  `// Auto-extracted from helivertisafe.jsx
${slice(53, 83).replace(/^const DEG/, "export const DEG").replace(/^const uid/, "export const uid").replace(/^const clamp/, "export const clamp").replace(/^const xy2db/, "export const xy2db").replace(/^const db2xy/, "export const db2xy").replace(/^function autoCalcCoords/, "export function autoCalcCoords")}`,
);

// --- utils/theme.js ---
write(
  "utils/theme.js",
  `// Auto-extracted
export const K = { bg: "#050a12", sf: "#0b1120", pn: "#101d30", rs: "#152236", bd: "#1a2d4a", bl: "#2563eb", cy: "#06b6d4", gn: "#10b981", am: "#f59e0b", rd: "#ef4444", or: "#f97316", pu: "#a78bfa", tx: "#e1e7ef", dm: "#8896ab", mu: "#4e6380" };
export const gradeCol = (g) => ({ A: K.gn, B: K.bl, C: K.am, D: K.or, F: K.rd }[g] || K.mu);
export const scoreCol = (s) => s >= 80 ? K.gn : s >= 65 ? K.bl : s >= 50 ? K.am : s >= 35 ? K.or : K.rd;
`,
);

// --- data/constants.js ---
write(
  "data/constants.js",
  `// Auto-extracted
${slice(85, 120)
  .split(/\r?\n/)
  .map((line) => line.replace(/^const (PC_DATA|HELIS|OBS_TYPES|SOIL_DATA|PROJ_TYPES|FACILITY_TYPES|MODES|COORD_SYS|ELEV_REF|SENS_TYPES|SENS_LEVELS)\b/, "export const $1"))
  .join("\n")}

export const WT = { wind: 0.20, obs: 0.20, ter: 0.15, acc: 0.15, geo: 0.20, env: 0.10 };

export const STEPS_DEF = [{ l: "Project", i: "📋" }, { l: "Site", i: "📍" }, { l: "Zones", i: "⬚" }, { l: "Data", i: "📊" }, { l: "Score", i: "⚡" }, { l: "Results", i: "🏆" }];

export const SRC_LEVELS = {
  survey: { label: "Survey/Measured", weight: 1.0, color: "#10b981", icon: "✓" },
  documented: { label: "Documented/Published", weight: 0.85, color: "#2563eb", icon: "◉" },
  estimated: { label: "Estimated/Calculated", weight: 0.6, color: "#f59e0b", icon: "~" },
  assumed: { label: "Assumed/Default", weight: 0.3, color: "#ef4444", icon: "?" },
};
export const SRC_OPTIONS = Object.entries(SRC_LEVELS).map(([k, v]) => ({ v: k, l: v.label }));
`,
);

// --- data/models.js ---
write(
  "data/models.js",
  `import { uid, xy2db, db2xy } from "../utils/coords.js";
import { HELIS, PC_DATA, WT } from "./constants.js";

${slice(122, 126).replace(/^const getD/, "export const getD").replace(/^const getHeli/, "export const getHeli").replace(/^const getPc/, "export const getPc").replace(/^const getXwLim/, "export const getXwLim")}

${slice(127, 132).replace(/^function calcGeom/, "export function calcGeom")}

${slice(134, 145)
  .replace(/^const WORKFLOW_STATES/, "export const WORKFLOW_STATES")
  .replace(/^const mkProj/, "export const mkProj")
  .replace(/^const mkLog/, "export const mkLog")
  .replace(/^const mkSite/, "export const mkSite")
  .replace(/^const mkExclusion/, "export const mkExclusion")
  .replace(/^const mkTerrainFeature/, "export const mkTerrainFeature")}

${slice(335, 365).replace(/^function mkZone/, "export function mkZone").replace(/^function mkManualZone/, "export function mkManualZone")}

${slice(366, 437)
  .replace(/^const mkObs/, "export const mkObs")
  .replace(/^const mkSens/, "export const mkSens")
  .replace(/^const mkAccNode/, "export const mkAccNode")
  .replace(/^const mkDest/, "export const mkDest")}
`,
);

// --- engine/geometry.js ---
write(
  "engine/geometry.js",
  `import { DEG } from "../utils/coords.js";

export function angDiff(a, b) { let d = ((b - a) % 360 + 360) % 360; return d > 180 ? 360 - d : d; }

${slice(383, 427).replace(/^function obsNearestDist/, "export function obsNearestDist").replace(/^function zoneCentroid/, "export function zoneCentroid").replace(/^function zoneArea/, "export function zoneArea").replace(/^function decomposeSlope/, "export function decomposeSlope")}
`,
);

// --- engine/orientation.js ---
write(
  "engine/orientation.js",
  `import { DEG } from "../utils/coords.js";
import { getXwLim } from "../data/models.js";
import { angDiff } from "./geometry.js";

export const xwComp = (ws, wd, h) => Math.abs(ws * Math.sin(angDiff(wd, h) * DEG));
export const hwComp = (ws, wd, h) => ws * Math.cos(angDiff(wd, h) * DEG);

${slice(878, 900).replace(/^function calcOrientation/, "export function calcOrientation")}
`,
);

// --- engine/scoring.js ---
write(
  "engine/scoring.js",
  `import { clamp, DEG } from "../utils/coords.js";
import { SOIL_DATA, WT } from "../data/constants.js";
import { getHeli, getPc, getXwLim, calcGeom } from "../data/models.js";
import { obsNearestDist, zoneCentroid, angDiff, decomposeSlope } from "./geometry.js";
import { xwComp, hwComp, calcOrientation } from "./orientation.js";

${slice(905, 1085)
  .replace(/^function sWind/, "export function sWind")
  .replace(/^function sObs/, "export function sObs")
  .replace(/^function sTer/, "export function sTer")
  .replace(/^function sAcc/, "export function sAcc")
  .replace(/^function sGeo/, "export function sGeo")
  .replace(/^function sEnv/, "export function sEnv")
  .replace(/^function calcAllScores/, "export function calcAllScores")
  .replace(/^function makeRecs/, "export function makeRecs")}
`,
);

// Fix scoring: calcGeom should import from data/models - already have calcGeom in models - use import { calcGeom } from "../data/models.js" - duplicate calcGeom in models - good

// --- engine/compliance.js ---
write(
  "engine/compliance.js",
  `import { SOIL_DATA } from "../data/constants.js";
import { calcGeom, getHeli, getPc } from "../data/models.js";

${slice(1089, 1191).replace(/^function checkCompliance/, "export function checkCompliance")}
`,
);

// --- engine/confidence.js ---
write(
  "engine/confidence.js",
  `import { clamp } from "../utils/coords.js";
import { SRC_LEVELS } from "../data/constants.js";

${slice(1202, 1259).replace(/^function calcConfidence/, "export function calcConfidence")}
`,
);

// --- engine/responseTime.js ---
write(
  "engine/responseTime.js",
  `import { DEG } from "../utils/coords.js";

${slice(441, 459).replace(/^function calcResponseTime/, "export function calcResponseTime")}
`,
);

// --- engine/suggestions.js ---
write(
  "engine/suggestions.js",
  `import { calcGeom, getHeli, getXwLim } from "../data/models.js";

${slice(1891, 1933).replace(/^function genSuggestions/, "export function genSuggestions")}
`,
);

// --- parsers/dxf.js ---
write(
  "parsers/dxf.js",
  `import { DEG } from "../utils/coords.js";
import { mkManualZone, mkObs } from "../data/models.js";

${slice(462, 620).replace(/^function parseDXF/, "export function parseDXF").replace(/^function dxfToData/, "export function dxfToData")}
`,
);

// --- parsers/geojson.js ---
write(
  "parsers/geojson.js",
  slice(149, 172).replace(/^function parseGeoJSON/, "export function parseGeoJSON"),
);

// --- parsers/kml.js ---
write("parsers/kml.js", slice(175, 198).replace(/^function parseKML/, "export function parseKML"));

// --- parsers/csv.js ---
write("parsers/csv.js", slice(201, 232).replace(/^function parseCSV/, "export function parseCSV"));

// --- parsers/wkt.js ---
write("parsers/wkt.js", slice(235, 243).replace(/^function parseWKT/, "export function parseWKT"));

// --- parsers/universal.js ---
write(
  "parsers/universal.js",
  `import { parseDXF } from "./dxf.js";
import { parseGeoJSON } from "./geojson.js";
import { parseKML } from "./kml.js";
import { parseCSV } from "./csv.js";
import { parseWKT } from "./wkt.js";
import { mkObs, mkManualZone } from "../data/models.js";

${slice(246, 332)
  .replace(/^function parseAnyFile/, "export function parseAnyFile")
  .replace(/^function importFileData/, "export function importFileData")}
`,
);

// --- data/demo.js ---
write(
  "data/demo.js",
  `import { mkProj, mkLog, mkSite, mkExclusion, mkZone, mkObs, mkSens, mkAccNode, mkDest } from "./models.js";

${slice(1261, 1325).replace(/^function loadDemo/, "export function loadDemo")}
`,
);

// --- state/reducer.js ---
write(
  "state/reducer.js",
  `import { uid, autoCalcCoords } from "../utils/coords.js";
import { mkProj, mkSite, mkObs, mkSens, mkAccNode, mkDest, mkExclusion, mkLog } from "../data/models.js";
import { calcAllScores, makeRecs } from "../engine/scoring.js";
import { loadDemo } from "../data/demo.js";

const SKIP_UNDO = ["STEP", "TAB", "SEL"];
const MAX_UNDO = 30;

function reducer(state, action) {
${slice(1352, 1447)}
}

${slice(1334, 1349).replace(/^function undoReducer/, "export function undoReducer")}

export { reducer };
`,
);

// --- state/autoSave.js ---
write(
  "state/autoSave.js",
  `import { useRef, useEffect } from "react";

${slice(27, 51).replace(/^function useAutoSave/, "export function useAutoSave").replace(/^async function loadAutoSave/, "export async function loadAutoSave")}
`,
);

// --- components/App.jsx (UI only: no engine/parsers/reducer bodies) ---
const appHeader = `import React, { useState, useEffect, useCallback, useMemo, useReducer, useRef, Component } from "react";
import * as THREE from "three";
import { K, gradeCol, scoreCol } from "../utils/theme.js";
import { DEG } from "../utils/coords.js";
import {
  PC_DATA, HELIS, OBS_TYPES, SOIL_DATA, PROJ_TYPES, FACILITY_TYPES, MODES, COORD_SYS, ELEV_REF,
  SENS_TYPES, SENS_LEVELS, STEPS_DEF, WT, SRC_OPTIONS, SRC_LEVELS,
} from "../data/constants.js";
import {
  getD, getHeli, getPc, getXwLim, calcGeom, WORKFLOW_STATES,
  mkProj, mkSite, mkZone, mkObs, mkSens, mkAccNode, mkDest, mkExclusion, mkTerrainFeature, mkLog,
} from "../data/models.js";
import { parseAnyFile, importFileData } from "../parsers/universal.js";
import { checkCompliance } from "../engine/compliance.js";
import { calcConfidence } from "../engine/confidence.js";
import { calcResponseTime } from "../engine/responseTime.js";
import { genSuggestions } from "../engine/suggestions.js";
import { zoneCentroid } from "../engine/geometry.js";
import { useAutoSave, loadAutoSave } from "../state/autoSave.js";
import { undoReducer } from "../state/reducer.js";
`;

write(
  "components/App.jsx",
  `${appHeader}

${slice(5, 25)}

${slice(624, 872)}

${slice(1455, 1890)}

${slice(1934, 2058)}

${slice(2062, 4325)}
`,
);

console.log("Written:", out.join(", "));
console.log("Also: components/App.jsx, state/autoSave.js");
