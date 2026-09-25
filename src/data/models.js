import { uid, xy2db, db2xy } from "../utils/coords.js";
import { HELIS, PC_DATA, WT } from "./constants.js";
import { helipadFootprintMetres } from "../engine/regulatoryFormulas.js";

export const getD = (p) => p.dh === "custom" ? (p.cdv || 15) : (HELIS.find(h => h.id === p.dh)?.D || 15);
export const getHeli = (p) => HELIS.find(h => h.id === p.dh) || HELIS[0];
export const getPc = (p) => PC_DATA[p.pc] || PC_DATA.pc1;
export const getXwLim = (p) => getHeli(p).xw || 15;


export function calcGeom(p) {
  const D = getD(p), pc = getPc(p);
  const { fato, sa, tlof, tot } = helipadFootprintMetres(D, pc);
  const innerLenM = pc.innerLenM ?? (pc.innerLenFactor * D);
  const ih = pc.ihHeightM ?? pc.ih;
  const ihR = pc.ihRadiusM ?? 3000;
  const maxWFactor = pc.maxWFactor ?? (p.pc === "pc1" ? 7 : p.pc === "pc2" ? 4 : 3);
  const maxWidth = Math.max(tot, D * maxWFactor);
  return {
    D, fato, sa, tlof, tot,
    appG: pc.appG, transG: pc.transG, innerG: pc.innerG, outerG: pc.outerG ?? pc.appG,
    splay: pc.splay, appLen: pc.appLen, innerLenM, outerLenM: pc.outerLenM,
    maxSlope: pc.maxSlope, maxSA: pc.maxSA,
    ih, ihR,
    maxWidth, maxWFactor,
    aIn: tot,
    aOut: Math.min(maxWidth, tot + 2 * pc.appLen * pc.splay),
  };
}

// ═══ DATA FACTORIES ═══
export const WORKFLOW_STATES = [{ v: "draft", l: "Draft", c: "#94a3b8" }, { v: "review", l: "In Review", c: "#f59e0b" }, { v: "approved", l: "Approved", c: "#10b981" }, { v: "issued", l: "Issued", c: "#2563eb" }];
export const mkProj = (o = {}) => ({ id: uid(), nm: "", cl: "", pt: "helipad", pc: "pc1", dh: "bell412", cdv: 0, mode: "feasibility", facility: "heliport", coordSys: "wgs84", elevRef: "amsl", desc: "", wt: { ...WT }, workflow: "draft", auditLog: [], ...o });
export const mkLog = (action, detail = "") => ({ id: uid(), ts: new Date().toISOString(), action, detail });
export const mkSite = (o = {}) => ({ id: uid(), nm: "", lat: 0, lng: 0, elev: 0, sw: 500, sh: 500, gc: 3, gr: 3, md: 0, rt: 35, exclusions: [], zoneMode: "grid",
  boundary: [],
  terrainFeatures: [],
  /** XYZ ground model (site metres, AMSL in z) for contours / slopes */
  elevationPoints: [],
  /** { contours, zoneSlopes, cutFillByZone, zmin, zmax, nPts } */
  terrainAnalysis: null,
  destinations: [], // Response time destinations [{id, nm, tp, lat, lng, distKm, cruiseKt, groundMin, required, maxMinutes}]
  ...o });
/** Optional corners: [{x,y}] site metres — true polygon; else axis-aligned x,y,w,h. */
export const mkExclusion = (o = {}) => ({ id: uid(), nm: "Restricted Area", reason: "", x: 0, y: 0, w: 50, h: 50, corners: undefined, areaM2: undefined, ...o });
export const mkTerrainFeature = (o = {}) => ({ id: uid(), nm: "Feature", tp: "hill", points: [], elevPeak: 0, elevBase: 0, radius: 50, ...o });


export function mkZone(r, c, s) {
  const w = s.sw / s.gc, h = s.sh / s.gr;
  const x0 = c * w, y0 = r * h;
  return { id: "Z-" + r + "-" + c, lb: String.fromCharCode(65 + r) + (c + 1), r, c, bw: w, bh: h, on: true,
    corners: [{ x: x0, y: y0, z: s.elev || 0 }, { x: x0 + w, y: y0, z: s.elev || 0 }, { x: x0 + w, y: y0 + h, z: s.elev || 0 }, { x: x0, y: y0 + h, z: s.elev || 0 }],
    wind: { pd: 0, ps: 0, pf: 0, sd: 0, ss: 0, sf: 0, calm: 0, seasonal: "none", roseBins: undefined },
    obs: [],
    ter: { slope: 0, slopeDir: 0, side: 0, soil: "firm", cf: 0, flood: false, elevMin: 0, elevMax: 0, elevAvg: 0, elevPts: 0 },
    acc: { road: true, rd: 0, bd: 0, emer: true, util: true, nodes: [] },
    sens: [],
    vport: { pads: 1, charging: false, chargePoints: 0, turnaround: 10, paxFlow: "walk", terminal: false },
    src: { wind: "assumed", obstacles: "assumed", terrain: "assumed", access: "assumed" },
    sc: null };
}

export function mkManualZone(label, corners) {
  // corners = [{x,y,z}, ...]
  const xs = corners.map(c => c.x), ys = corners.map(c => c.y), zs = corners.map(c => c.z || 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { id: uid(), lb: label, r: 0, c: 0, bw: maxX - minX, bh: maxY - minY, on: true,
    corners: corners.map(c => ({ x: c.x, y: c.y, z: c.z || 0 })),
    ter: { slope: 0, slopeDir: 0, side: 0, soil: "firm", cf: 0, flood: false, elevMin: Math.min(...zs), elevMax: Math.max(...zs), elevAvg: Math.round(zs.reduce((a,b)=>a+b,0)/zs.length*10)/10, elevPts: zs.length },
    wind: { pd: 0, ps: 0, pf: 0, sd: 0, ss: 0, sf: 0, calm: 0, seasonal: "none", roseBins: undefined },
    obs: [],
    acc: { road: true, rd: 0, bd: 0, emer: true, util: true, nodes: [] },
    sens: [],
    vport: { pads: 1, charging: false, chargePoints: 0, turnaround: 10, paxFlow: "walk", terminal: false },
    src: { wind: "assumed", obstacles: "assumed", terrain: "assumed", access: "assumed" },
    sc: null };
}


// Obstacle with 4 corners (building footprint)
export const mkObs = (o = {}) => {
  const obs = {
    id: uid(), nm: "Obstacle", tp: "building",
    h: 0, d: 0, br: 0, w: 0, l: 0,
    corners: [],
    elevAMSL: 0,
    x: 0, y: 0,
    perm: true, lit: false, verified: false, confidence: 50,
    startDate: "", endDate: "", ...o
  };
  if (obs.d > 0 && obs.x === 0 && obs.y === 0) { const p = db2xy(obs.d, obs.br); obs.x = p.x; obs.y = p.y; }
  if (obs.x !== 0 && obs.y !== 0 && obs.d === 0) { const p = xy2db(obs.x, obs.y); obs.d = p.d; obs.br = p.br; }
  return obs;
};

export const mkSens = (o = {}) => {
  const s = { id: uid(), nm: "Zone", tp: "residential", level: "medium", dist: 0, br: 0, x: 0, y: 0, ...o };
  if (s.dist > 0 && (s.x === 0 && s.y === 0)) { const p = db2xy(s.dist, s.br); s.x = p.x; s.y = p.y; }
  return s;
};
export const mkAccNode = (o = {}) => {
  const n = { id: uid(), nm: "Access Point", tp: "road", importance: 3, dist: 0, br: 0, x: 0, y: 0, ...o };
  if (n.dist > 0 && (n.x === 0 && n.y === 0)) { const p = db2xy(n.dist, n.br); n.x = p.x; n.y = p.y; }
  return n;
};
export const mkDest = (o = {}) => ({ id: uid(), nm: "Destination", tp: "hospital", lat: 0, lng: 0, distKm: 0, cruiseKt: 120, groundMin: 0, required: false, maxMinutes: 0, ...o });
