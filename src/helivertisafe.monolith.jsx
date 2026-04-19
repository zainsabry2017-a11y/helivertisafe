import React, { useState, useEffect, useCallback, useMemo, useReducer, useRef, Component } from "react";
import * as THREE from "three";

// ═══ REACT ERROR BOUNDARY (class component — only way to catch render errors) ═══
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) {
      return React.createElement("div", { style: { padding: 16, background: "#0b1120", borderRadius: 8, border: "1px solid #ef444440", margin: 8 } },
        React.createElement("div", { style: { color: "#ef4444", fontSize: 12, fontWeight: 700, marginBottom: 4 } }, "⚠ " + (this.props.label || "Section") + " Error"),
        React.createElement("div", { style: { color: "#8896ab", fontSize: 10, marginBottom: 8 } }, this.state.error.message),
        React.createElement("button", { onClick: () => this.setState({ error: null }), style: { padding: "4px 12px", borderRadius: 4, fontSize: 10, background: "#1a2d4a", color: "#e1e7ef", border: "1px solid #2a3a52", cursor: "pointer" } }, "Retry")
      );
    }
    return this.props.children;
  }
}

// Tooltip wrapper
function Tip({ text, children }) {
  return React.createElement("span", { title: text, style: { cursor: "help", borderBottom: text ? "1px dotted #4e6380" : "none" } }, children);
}

// Auto-save hook using window.storage
function useAutoSave(key, state, mode) {
  const saveTimer = useRef(null);
  useEffect(() => {
    if (mode !== "app") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (window.storage) {
          await window.storage.set(key, JSON.stringify({ ts: Date.now(), proj: state.proj, site: state.site, zones: state.zones.map(z => ({ ...z, sc: null })), scenarios: state.scenarios }));
        }
      } catch (e) { /* storage unavailable */ }
    }, 3000); // save 3s after last change
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state.proj, state.site, state.zones, state.scenarios, mode, key]);
}

// Load auto-saved state
async function loadAutoSave(key) {
  try {
    if (!window.storage) return null;
    const result = await window.storage.get(key);
    if (result?.value) { const d = JSON.parse(result.value); if (d.proj && d.site) return d; }
  } catch (e) { /* ignore */ }
  return null;
}

const DEG = Math.PI / 180;
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══ BIDIRECTIONAL COORDINATE CONVERSION ═══
// X,Y → Distance,Bearing (from origin 0,0)
const xy2db = (x, y) => ({
  d: Math.round(Math.sqrt(x * x + y * y) * 10) / 10,
  br: Math.round(((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360)
});
// Distance,Bearing → X,Y
const db2xy = (d, br) => ({
  x: Math.round(d * Math.sin(br * Math.PI / 180) * 10) / 10,
  y: Math.round(d * Math.cos(br * Math.PI / 180) * 10) / 10
});
// Auto-calc: when one pair changes, update the other
function autoCalcCoords(obj, fld, val) {
  const updated = { ...obj, [fld]: val };
  // Determine which distance field this object uses (d or dist)
  const dKey = "dist" in updated ? "dist" : "d";
  if (fld === "x" || fld === "y") {
    const { d, br } = xy2db(updated.x || 0, updated.y || 0);
    return { ...updated, [dKey]: d, br };
  }
  if (fld === "d" || fld === "dist" || fld === "br") {
    const distVal = updated[dKey] || 0;
    const { x, y } = db2xy(distVal, updated.br || 0);
    return { ...updated, x, y };
  }
  return updated;
}

// ═══ STANDARDS ═══
const PC_DATA = {
  pc1: { label: "PC-1", fatoMin: 1, sa: 0.25, maxSlope: 2, maxSA: 4, splay: 0.10, appLen: 245, appG: 1/8, transG: 1/2, ih: 45 },
  pc2: { label: "PC-2", fatoMin: 1, sa: 0.25, maxSlope: 3, maxSA: 4, splay: 0.15, appLen: 245, appG: 1/8, transG: 1/2, ih: 45 },
  pc3: { label: "PC-3", fatoMin: 1, sa: 0.25, maxSlope: 3, maxSA: 4, splay: 0.15, appLen: 245, appG: 1/8, transG: 1/2, ih: 45 },
};
const HELIS = [
  { id: "s92", nm: "Sikorsky S-92", D: 20.9, mtow: 12565, cat: "heavy", xw: 25, tp: "heli", len: 20.9, wid: 3.2, rtr: 17.2, dw: "high" },
  { id: "s76d", nm: "Sikorsky S-76D", D: 13.4, mtow: 5300, cat: "medium", xw: 20, tp: "heli", len: 13.4, wid: 2.4, rtr: 13.4, dw: "medium" },
  { id: "s76cpp", nm: "Sikorsky S-76C++", D: 13.4, mtow: 5300, cat: "medium", xw: 20, tp: "heli", len: 13.4, wid: 2.4, rtr: 13.4, dw: "medium" },
  { id: "uh60", nm: "Sikorsky S-70 / UH-60 Black Hawk", D: 16.4, mtow: 9980, cat: "medium", xw: 22, tp: "heli", len: 16.4, wid: 2.4, rtr: 16.4, dw: "high" },
  { id: "ch53k", nm: "Sikorsky CH-53K King Stallion", D: 24.0, mtow: 39600, cat: "heavy", xw: 28, tp: "heli", len: 24.0, wid: 4.9, rtr: 24.0, dw: "high" },
  { id: "mh60", nm: "Sikorsky MH-60 Seahawk", D: 16.4, mtow: 10000, cat: "medium", xw: 22, tp: "heli", len: 16.4, wid: 2.4, rtr: 16.4, dw: "high" },
  { id: "aw139", nm: "Leonardo AW139", D: 16.6, mtow: 7000, cat: "medium", xw: 20, tp: "heli", len: 16.6, wid: 2.9, rtr: 13.8, dw: "high" },
  { id: "aw169", nm: "Leonardo AW169", D: 14.6, mtow: 4800, cat: "medium", xw: 20, tp: "heli", len: 14.6, wid: 2.8, rtr: 12.1, dw: "medium" },
  { id: "aw189", nm: "Leonardo AW189", D: 15.9, mtow: 8300, cat: "medium", xw: 22, tp: "heli", len: 15.9, wid: 3.0, rtr: 14.0, dw: "high" },
  { id: "aw101", nm: "Leonardo AW101 Merlin", D: 18.6, mtow: 14600, cat: "heavy", xw: 25, tp: "heli", len: 18.6, wid: 3.5, rtr: 18.6, dw: "high" },
  { id: "aw109", nm: "Leonardo AW109 GrandNew", D: 11.0, mtow: 3175, cat: "light", xw: 17, tp: "heli", len: 11.0, wid: 2.0, rtr: 11.0, dw: "medium" },
  { id: "aw119kx", nm: "Leonardo AW119Kx", D: 10.8, mtow: 3150, cat: "light", xw: 17, tp: "heli", len: 10.8, wid: 1.9, rtr: 10.8, dw: "medium" },
  { id: "aw609", nm: "Leonardo AW609", D: 11.0, mtow: 7600, cat: "medium", xw: 20, tp: "heli", len: 17.2, wid: 2.7, rtr: 11.0, dw: "medium" },
  { id: "h175", nm: "Airbus H175", D: 14.8, mtow: 7800, cat: "medium", xw: 22, tp: "heli", len: 14.8, wid: 2.8, rtr: 14.8, dw: "high" },
  { id: "h160", nm: "Airbus H160", D: 13.5, mtow: 6050, cat: "medium", xw: 20, tp: "heli", len: 13.5, wid: 2.6, rtr: 13.5, dw: "medium" },
  { id: "h155", nm: "Airbus H155 (EC155)", D: 12.5, mtow: 4850, cat: "medium", xw: 18, tp: "heli", len: 12.5, wid: 2.4, rtr: 12.5, dw: "medium" },
  { id: "h145", nm: "Airbus H145 (EC145)", D: 13.6, mtow: 3800, cat: "light", xw: 15, tp: "heli", len: 13.6, wid: 2.4, rtr: 11.0, dw: "medium" },
  { id: "h135", nm: "Airbus H135 (EC135)", D: 12.2, mtow: 2980, cat: "light", xw: 15, tp: "heli", len: 12.2, wid: 2.2, rtr: 10.2, dw: "low" },
  { id: "h130", nm: "Airbus H130 (EC130)", D: 11.0, mtow: 2500, cat: "light", xw: 15, tp: "heli", len: 11.0, wid: 2.1, rtr: 11.0, dw: "low" },
  { id: "h125", nm: "Airbus H125 (AS350)", D: 11.0, mtow: 2250, cat: "light", xw: 15, tp: "heli", len: 11.0, wid: 2.1, rtr: 11.0, dw: "low" },
  { id: "h120", nm: "Airbus H120 (EC120)", D: 10.2, mtow: 1715, cat: "light", xw: 15, tp: "heli", len: 10.2, wid: 2.0, rtr: 10.2, dw: "low" },
  { id: "h215", nm: "Airbus H215 (Super Puma)", D: 15.1, mtow: 9300, cat: "medium", xw: 22, tp: "heli", len: 15.1, wid: 3.0, rtr: 15.1, dw: "high" },
  { id: "h225", nm: "Airbus H225 (EC225)", D: 16.2, mtow: 11200, cat: "heavy", xw: 25, tp: "heli", len: 16.2, wid: 3.2, rtr: 16.2, dw: "high" },
  { id: "bell505", nm: "Bell 505 Jet Ranger X", D: 10.7, mtow: 1678, cat: "light", xw: 15, tp: "heli", len: 10.7, wid: 2.0, rtr: 10.7, dw: "low" },
  { id: "bell407", nm: "Bell 407", D: 11.3, mtow: 1270, cat: "light", xw: 15, tp: "heli", len: 11.3, wid: 2.0, rtr: 11.3, dw: "low" },
  { id: "bell407gxi", nm: "Bell 407GXi", D: 11.3, mtow: 1270, cat: "light", xw: 15, tp: "heli", len: 11.3, wid: 2.0, rtr: 11.3, dw: "low" },
  { id: "bell412", nm: "Bell 412EP / EPi", D: 17.1, mtow: 5398, cat: "medium", xw: 20, tp: "heli", len: 17.1, wid: 2.8, rtr: 14.0, dw: "high" },
  { id: "bell429", nm: "Bell 429", D: 14.0, mtow: 3402, cat: "light", xw: 17, tp: "heli", len: 14.0, wid: 2.4, rtr: 11.0, dw: "medium" },
  { id: "bell429wlg", nm: "Bell 429WLG", D: 14.0, mtow: 3402, cat: "light", xw: 17, tp: "heli", len: 14.0, wid: 2.4, rtr: 11.0, dw: "medium" },
  { id: "bell430", nm: "Bell 430", D: 12.8, mtow: 2041, cat: "light", xw: 17, tp: "heli", len: 12.8, wid: 2.3, rtr: 12.8, dw: "medium" },
  { id: "bell525", nm: "Bell 525 Relentless", D: 15.9, mtow: 9100, cat: "medium", xw: 22, tp: "heli", len: 15.9, wid: 2.9, rtr: 15.9, dw: "high" },
  { id: "bell_ah1z", nm: "Bell AH-1Z Viper", D: 14.6, mtow: 8390, cat: "medium", xw: 22, tp: "heli", len: 14.6, wid: 2.4, rtr: 14.6, dw: "high" },
  { id: "bell_uh1y", nm: "Bell UH-1Y Venom", D: 14.6, mtow: 8390, cat: "medium", xw: 22, tp: "heli", len: 14.6, wid: 2.4, rtr: 14.6, dw: "high" },
  { id: "bell206b", nm: "Bell 206B JetRanger", D: 10.2, mtow: 726, cat: "light", xw: 12, tp: "heli", len: 10.2, wid: 1.8, rtr: 10.2, dw: "low" },
  { id: "bell206l", nm: "Bell 206L LongRanger", D: 11.3, mtow: 1157, cat: "light", xw: 15, tp: "heli", len: 11.3, wid: 2.0, rtr: 11.3, dw: "low" },
  { id: "bell222", nm: "Bell 222 / 230", D: 12.8, mtow: 3629, cat: "light", xw: 17, tp: "heli", len: 12.8, wid: 2.3, rtr: 12.8, dw: "medium" },
  { id: "md500e", nm: "MD 500E", D: 8.0, mtow: 1361, cat: "light", xw: 12, tp: "heli", len: 8.0, wid: 1.4, rtr: 8.0, dw: "low" },
  { id: "md520n", nm: "MD 520N", D: 8.4, mtow: 1361, cat: "light", xw: 12, tp: "heli", len: 8.4, wid: 1.4, rtr: 8.4, dw: "low" },
  { id: "md530f", nm: "MD 530F", D: 8.4, mtow: 1519, cat: "light", xw: 12, tp: "heli", len: 8.4, wid: 1.4, rtr: 8.4, dw: "low" },
  { id: "md600n", nm: "MD 600N", D: 8.4, mtow: 2132, cat: "light", xw: 15, tp: "heli", len: 8.4, wid: 1.5, rtr: 8.4, dw: "low" },
  { id: "md902", nm: "MD 902 Explorer", D: 10.0, mtow: 3130, cat: "light", xw: 17, tp: "heli", len: 10.0, wid: 1.8, rtr: 10.0, dw: "medium" },
  { id: "r22", nm: "Robinson R22", D: 7.7, mtow: 635, cat: "light", xw: 10, tp: "heli", len: 7.7, wid: 1.1, rtr: 7.7, dw: "low" },
  { id: "r44", nm: "Robinson R44", D: 10.1, mtow: 1134, cat: "light", xw: 12, tp: "heli", len: 10.1, wid: 1.3, rtr: 10.1, dw: "low" },
  { id: "r66", nm: "Robinson R66", D: 10.1, mtow: 1270, cat: "light", xw: 12, tp: "heli", len: 10.1, wid: 1.3, rtr: 10.1, dw: "low" },
  { id: "enstrom480b", nm: "Enstrom 480B", D: 9.4, mtow: 1225, cat: "light", xw: 12, tp: "heli", len: 9.4, wid: 1.5, rtr: 9.4, dw: "low" },
  { id: "ch47f", nm: "Boeing CH-47F Chinook", D: 18.3, mtow: 22680, cat: "heavy", xw: 25, tp: "heli", len: 30.2, wid: 3.5, rtr: 18.3, dw: "high" },
  { id: "ah64e", nm: "Boeing AH-64E Apache", D: 14.6, mtow: 10000, cat: "medium", xw: 22, tp: "heli", len: 14.6, wid: 2.4, rtr: 14.6, dw: "high" },
  { id: "nh90", nm: "NHI NH90", D: 16.2, mtow: 10600, cat: "heavy", xw: 25, tp: "heli", len: 16.2, wid: 3.2, rtr: 16.2, dw: "high" },
  { id: "ka32", nm: "Kamov Ka-32", D: 15.9, mtow: 12700, cat: "medium", xw: 22, tp: "heli", len: 15.9, wid: 3.5, rtr: 15.9, dw: "high" },
  { id: "ka62", nm: "Kamov Ka-62", D: 15.2, mtow: 6800, cat: "medium", xw: 20, tp: "heli", len: 15.2, wid: 2.8, rtr: 15.2, dw: "medium" },
  { id: "mi8_17", nm: "Mi-8 / Mi-17", D: 21.2, mtow: 13000, cat: "heavy", xw: 25, tp: "heli", len: 21.2, wid: 3.2, rtr: 21.2, dw: "high" },
  { id: "mi171a2", nm: "Mi-171A2", D: 21.2, mtow: 13000, cat: "heavy", xw: 25, tp: "heli", len: 21.2, wid: 3.2, rtr: 21.2, dw: "high" },
  { id: "mi38", nm: "Mi-38", D: 21.2, mtow: 15600, cat: "heavy", xw: 25, tp: "heli", len: 21.2, wid: 3.3, rtr: 21.2, dw: "high" },
  { id: "kazan_ansat", nm: "Kazan Ansat", D: 11.5, mtow: 3600, cat: "light", xw: 17, tp: "heli", len: 11.5, wid: 2.0, rtr: 11.5, dw: "medium" },
  { id: "hal_dhruv", nm: "HAL Dhruv ALH", D: 13.2, mtow: 5750, cat: "medium", xw: 18, tp: "heli", len: 13.2, wid: 2.4, rtr: 13.2, dw: "medium" },
  { id: "kai_surion", nm: "KAI Surion", D: 13.2, mtow: 8709, cat: "medium", xw: 20, tp: "heli", len: 13.2, wid: 2.5, rtr: 13.2, dw: "medium" },
  { id: "avic_ac313", nm: "AVIC AC313", D: 18.9, mtow: 13000, cat: "heavy", xw: 25, tp: "heli", len: 18.9, wid: 3.5, rtr: 18.9, dw: "high" },
  { id: "avic_z15", nm: "AVIC Z-15", D: 14.8, mtow: 7000, cat: "medium", xw: 20, tp: "heli", len: 14.8, wid: 2.8, rtr: 14.8, dw: "medium" },
  { id: "ehang216", nm: "EHang 216", D: 6.0, mtow: 600, cat: "light", xw: 10, tp: "evtol", len: 5.6, wid: 5.6, rtr: 0, dw: "low", pax: 2 },
  { id: "joby_s4", nm: "Joby S4", D: 10.7, mtow: 2177, cat: "light", xw: 12, tp: "evtol", len: 10.7, wid: 7.0, rtr: 0, dw: "low", pax: 4 },
  { id: "lilium_jet", nm: "Lilium Jet", D: 13.9, mtow: 3175, cat: "light", xw: 15, tp: "evtol", len: 13.9, wid: 8.5, rtr: 0, dw: "low", pax: 6 },
  { id: "custom", nm: "Custom (enter D-value)", D: 0, mtow: 0, cat: "medium", xw: 15, tp: "heli", len: 0, wid: 0, rtr: 0, dw: "medium" },
];
const OBS_TYPES = ["building","tower","tree","antenna","crane","powerline","terrain_high","other"];
const SOIL_DATA = [
  { value: "rock", label: "Rock", cbr: 80 },
  { value: "firm", label: "Firm", cbr: 50 },
  { value: "compacted", label: "Compacted", cbr: 30 },
  { value: "mixed", label: "Mixed", cbr: 15 },
  { value: "soft", label: "Soft/Clay", cbr: 5 },
  { value: "sand", label: "Sand", cbr: 8 },
];
const PROJ_TYPES = ["helipad","heliport","hospital","rooftop","offshore","military","private"];
const FACILITY_TYPES = [{ v: "heliport", l: "Heliport" }, { v: "hospital_pad", l: "Hospital Pad" }, { v: "vertiport", l: "Vertiport" }];
const MODES = [{ v: "feasibility", l: "Feasibility" }, { v: "hybrid", l: "Hybrid" }, { v: "compliance", l: "Compliance" }, { v: "vertiport", l: "Vertiport" }];
const COORD_SYS = [{ v: "wgs84", l: "WGS 84" }, { v: "utm", l: "UTM" }, { v: "local", l: "Local Grid" }];
const ELEV_REF = [{ v: "amsl", l: "AMSL" }, { v: "agl", l: "AGL" }];
const SENS_TYPES = [{ v: "residential", l: "Residential" }, { v: "fuel", l: "Fuel Storage" }, { v: "school", l: "School" }, { v: "hospital_zone", l: "Hospital" }, { v: "sensitive", l: "Other Sensitive" }];
const SENS_LEVELS = ["low", "medium", "high"];

// ═══ HELPERS ═══
const getD = (p) => p.dh === "custom" ? (p.cdv || 15) : (HELIS.find(h => h.id === p.dh)?.D || 15);
const getHeli = (p) => HELIS.find(h => h.id === p.dh) || HELIS[0];
const getPc = (p) => PC_DATA[p.pc] || PC_DATA.pc1;
const getXwLim = (p) => getHeli(p).xw || 15;

function calcGeom(p) {
  const D = getD(p), pc = getPc(p);
  const fato = D * pc.fatoMin, sa = Math.max(D * pc.sa, 3), tlof = D * 0.83;
  const tot = fato + 2 * sa;
  return { D, fato, sa, tlof, tot, appG: pc.appG, transG: pc.transG, splay: pc.splay, appLen: pc.appLen, maxSlope: pc.maxSlope, maxSA: pc.maxSA, ih: pc.ih, aIn: tot, aOut: tot + 2 * pc.appLen * pc.splay };
}

// ═══ DATA FACTORIES ═══
const WORKFLOW_STATES = [{ v: "draft", l: "Draft", c: "#94a3b8" }, { v: "review", l: "In Review", c: "#f59e0b" }, { v: "approved", l: "Approved", c: "#10b981" }, { v: "issued", l: "Issued", c: "#2563eb" }];
const mkProj = (o = {}) => ({ id: uid(), nm: "", cl: "", pt: "helipad", pc: "pc1", dh: "bell412", cdv: 0, mode: "feasibility", facility: "heliport", coordSys: "wgs84", elevRef: "amsl", desc: "", wt: { ...WT }, workflow: "draft", auditLog: [], ...o });
const mkLog = (action, detail = "") => ({ id: uid(), ts: new Date().toISOString(), action, detail });
const mkSite = (o = {}) => ({ id: uid(), nm: "", lat: 0, lng: 0, elev: 0, sw: 500, sh: 500, gc: 3, gr: 3, md: 0, rt: 35, exclusions: [], zoneMode: "grid",
  boundary: [],
  terrainFeatures: [],
  destinations: [], // Response time destinations [{id, nm, tp, lat, lng, distKm, cruiseKt, groundMin, required, maxMinutes}]
  ...o });
const mkExclusion = (o = {}) => ({ id: uid(), nm: "Restricted Area", reason: "", x: 0, y: 0, w: 50, h: 50, ...o });
const mkTerrainFeature = (o = {}) => ({ id: uid(), nm: "Feature", tp: "hill", points: [], elevPeak: 0, elevBase: 0, radius: 50, ...o });

// ═══ MULTI-FORMAT FILE PARSERS ═══

// GeoJSON → polygons + points
function parseGeoJSON(text) {
  const gj = JSON.parse(text);
  const polys = [], pts = [];
  const extract = (geom, props) => {
    if (geom.type === "Polygon") {
      const ring = geom.coordinates[0].map(c => ({ x: c[0], y: c[1], z: c[2] || 0 }));
      polys.push({ vertices: ring, props: props || {} });
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach(poly => {
        const ring = poly[0].map(c => ({ x: c[0], y: c[1], z: c[2] || 0 }));
        polys.push({ vertices: ring, props: props || {} });
      });
    } else if (geom.type === "Point") {
      pts.push({ x: geom.coordinates[0], y: geom.coordinates[1], z: geom.coordinates[2] || 0, props: props || {} });
    } else if (geom.type === "LineString") {
      const ring = geom.coordinates.map(c => ({ x: c[0], y: c[1], z: c[2] || 0 }));
      polys.push({ vertices: ring, props: props || {}, open: true });
    }
  };
  if (gj.type === "FeatureCollection") gj.features.forEach(f => extract(f.geometry, f.properties));
  else if (gj.type === "Feature") extract(gj.geometry, gj.properties);
  else if (gj.geometry) extract(gj.geometry, {});
  return { polys, pts, count: polys.length + pts.length };
}

// KML → polygons + points
function parseKML(text) {
  const polys = [], pts = [];
  // Strip namespaces for easier parsing
  const clean = text.replace(/xmlns\s*=\s*"[^"]*"/g, "").replace(/kml:/g, "");
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, "text/xml");
  const parseCoordsStr = (str) => str.trim().split(/[\s\n]+/).filter(Boolean).map(s => { const p = s.split(","); return { x: parseFloat(p[0]) || 0, y: parseFloat(p[1]) || 0, z: parseFloat(p[2]) || 0 }; }).filter(p => !isNaN(p.x) && (p.x !== 0 || p.y !== 0));
  const getCoords = (parent, tag) => {
    const el = parent.getElementsByTagName(tag)[0];
    if (!el) return null;
    const coords = el.getElementsByTagName("coordinates")[0];
    return coords ? parseCoordsStr(coords.textContent) : null;
  };
  doc.querySelectorAll("Placemark").forEach(pm => {
    const nm = pm.querySelector("name")?.textContent || pm.querySelector("description")?.textContent || "";
    const polyCoords = getCoords(pm, "Polygon");
    const ptCoords = getCoords(pm, "Point");
    const lsCoords = getCoords(pm, "LineString");
    if (polyCoords && polyCoords.length >= 3) polys.push({ vertices: polyCoords, props: { name: nm } });
    if (lsCoords && lsCoords.length >= 2) polys.push({ vertices: lsCoords, props: { name: nm }, open: true });
    if (ptCoords && ptCoords.length) pts.push({ ...ptCoords[0], props: { name: nm } });
  });
  return { polys, pts, count: polys.length + pts.length };
}

// CSV → points (X,Y,Z,Name,Type,Height columns)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return { points: [], count: 0 };
  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const xi = header.findIndex(h => ["x","easting","lon","longitude","e"].includes(h));
  const yi = header.findIndex(h => ["y","northing","lat","latitude","n"].includes(h));
  const zi = header.findIndex(h => ["z","elevation","elev","alt","amsl"].includes(h));
  const ni = header.findIndex(h => ["name","label","id","desc"].includes(h));
  const ti = header.findIndex(h => ["type","category","class","kind"].includes(h));
  const hi = header.findIndex(h => ["height","h","agl","obs_height","ht"].includes(h));
  const wi = header.findIndex(h => ["width","w","obs_width"].includes(h));
  const li = header.findIndex(h => ["length","l","obs_length","depth"].includes(h));
  const di = header.findIndex(h => ["distance","dist","d","range"].includes(h));
  const bi = header.findIndex(h => ["bearing","br","azimuth","az","direction"].includes(h));
  if (xi < 0 || yi < 0) return { points: [], count: 0 };
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length <= xi || cols.length <= yi) continue;
    if (!cols[xi] && !cols[yi]) continue;
    points.push({
      x: parseFloat(cols[xi]) || 0, y: parseFloat(cols[yi]) || 0, z: zi >= 0 ? parseFloat(cols[zi]) || 0 : 0,
      name: ni >= 0 ? cols[ni] : "P" + i, type: ti >= 0 ? cols[ti] : "",
      obsH: hi >= 0 ? parseFloat(cols[hi]) || 0 : 0,
      obsW: wi >= 0 ? parseFloat(cols[wi]) || 0 : 0,
      obsL: li >= 0 ? parseFloat(cols[li]) || 0 : 0,
      dist: di >= 0 ? parseFloat(cols[di]) || 0 : 0,
      bearing: bi >= 0 ? parseFloat(cols[bi]) || 0 : 0,
    });
  }
  return { points, count: points.length };
}

// WKT → polygon
function parseWKT(text) {
  const polys = [];
  const matches = text.matchAll(/POLYGON\s*\(\(([\d\s.,\-]+)\)\)/gi);
  for (const m of matches) {
    const verts = m[1].split(",").map(s => { const p = s.trim().split(/\s+/); return { x: parseFloat(p[0]) || 0, y: parseFloat(p[1]) || 0, z: parseFloat(p[2]) || 0 }; });
    polys.push({ vertices: verts });
  }
  return { polys, count: polys.length };
}

// Universal file handler — detect format and parse
function parseAnyFile(text, filename) {
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
function importFileData(parsed, siteW, siteH) {
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

// Zone corner: { x, y } in meters from site origin (SW corner)
function mkZone(r, c, s) {
  const w = s.sw / s.gc, h = s.sh / s.gr;
  const x0 = c * w, y0 = r * h;
  return { id: "Z" + r + c, lb: String.fromCharCode(65 + r) + (c + 1), r, c, bw: w, bh: h, on: true,
    corners: [{ x: x0, y: y0, z: s.elev || 0 }, { x: x0 + w, y: y0, z: s.elev || 0 }, { x: x0 + w, y: y0 + h, z: s.elev || 0 }, { x: x0, y: y0 + h, z: s.elev || 0 }],
    wind: { pd: 0, ps: 0, pf: 0, sd: 0, ss: 0, sf: 0, calm: 0, seasonal: "none" },
    obs: [],
    ter: { slope: 0, slopeDir: 0, side: 0, soil: "firm", cf: 0, flood: false, elevMin: 0, elevMax: 0, elevAvg: 0, elevPts: 0 },
    acc: { road: true, rd: 0, bd: 0, emer: true, util: true, nodes: [] },
    sens: [],
    vport: { pads: 1, charging: false, chargePoints: 0, turnaround: 10, paxFlow: "walk", terminal: false },
    src: { wind: "assumed", obstacles: "assumed", terrain: "assumed", access: "assumed" },
    sc: null };
}

function mkManualZone(label, corners) {
  // corners = [{x,y,z}, ...]
  const xs = corners.map(c => c.x), ys = corners.map(c => c.y), zs = corners.map(c => c.z || 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { id: uid(), lb: label, r: 0, c: 0, bw: maxX - minX, bh: maxY - minY, on: true,
    corners: corners.map(c => ({ x: c.x, y: c.y, z: c.z || 0 })),
    ter: { slope: 0, slopeDir: 0, side: 0, soil: "firm", cf: 0, flood: false, elevMin: Math.min(...zs), elevMax: Math.max(...zs), elevAvg: Math.round(zs.reduce((a,b)=>a+b,0)/zs.length*10)/10, elevPts: zs.length },
    wind: { pd: 0, ps: 0, pf: 0, sd: 0, ss: 0, sf: 0, calm: 0, seasonal: "none" },
    obs: [],
    acc: { road: true, rd: 0, bd: 0, emer: true, util: true, nodes: [] },
    sens: [],
    vport: { pads: 1, charging: false, chargePoints: 0, turnaround: 10, paxFlow: "walk", terminal: false },
    src: { wind: "assumed", obstacles: "assumed", terrain: "assumed", access: "assumed" },
    sc: null };
}

// Obstacle with 4 corners (building footprint)
const mkObs = (o = {}) => {
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

// Calculate nearest corner distance for OLS check (critical fix)
function obsNearestDist(obs, zoneCx, zoneCy) {
  if (obs.corners && obs.corners.length >= 3) {
    let minD = Infinity;
    for (const c of obs.corners) {
      const dx = c.x - zoneCx, dy = c.y - zoneCy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minD) minD = d;
    }
    return minD;
  }
  return obs.d; // fallback to simple distance
}

// Calculate zone centroid from corners
function zoneCentroid(z) {
  if (z.corners && z.corners.length >= 3) {
    const cx = z.corners.reduce((s, c) => s + c.x, 0) / z.corners.length;
    const cy = z.corners.reduce((s, c) => s + c.y, 0) / z.corners.length;
    return { x: cx, y: cy };
  }
  return { x: z.bw / 2, y: z.bh / 2 };
}

// Zone area from corners (Shoelace formula)
function zoneArea(z) {
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
function decomposeSlope(slopePct, slopeDir, fatoHeading) {
  const diff = angDiff(slopeDir, fatoHeading);
  const longitudinal = Math.abs(slopePct * Math.cos(diff * DEG));
  const transverse = Math.abs(slopePct * Math.sin(diff * DEG));
  return { longitudinal: Math.round(longitudinal * 100) / 100, transverse: Math.round(transverse * 100) / 100 };
}
const mkSens = (o = {}) => {
  const s = { id: uid(), nm: "Zone", tp: "residential", level: "medium", dist: 0, br: 0, x: 0, y: 0, ...o };
  if (s.dist > 0 && (s.x === 0 && s.y === 0)) { const p = db2xy(s.dist, s.br); s.x = p.x; s.y = p.y; }
  return s;
};
const mkAccNode = (o = {}) => {
  const n = { id: uid(), nm: "Access Point", tp: "road", importance: 3, dist: 0, br: 0, x: 0, y: 0, ...o };
  if (n.dist > 0 && (n.x === 0 && n.y === 0)) { const p = db2xy(n.dist, n.br); n.x = p.x; n.y = p.y; }
  return n;
};
const mkDest = (o = {}) => ({ id: uid(), nm: "Destination", tp: "hospital", lat: 0, lng: 0, distKm: 0, cruiseKt: 120, groundMin: 0, required: false, maxMinutes: 0, ...o });

// Response time calculator
function calcResponseTime(dest, siteLat, siteLng) {
  let distKm = dest.distKm;
  if (distKm <= 0 && dest.lat && dest.lng && siteLat && siteLng) {
    // Haversine approximation
    const R = 6371;
    const dLat = (dest.lat - siteLat) * DEG, dLng = (dest.lng - siteLng) * DEG;
    const a = Math.sin(dLat/2)**2 + Math.cos(siteLat*DEG) * Math.cos(dest.lat*DEG) * Math.sin(dLng/2)**2;
    distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  if (distKm <= 0) return null;
  const speedKmh = (dest.cruiseKt || 120) * 1.852; // kt to km/h
  const flightMin = (distKm / speedKmh) * 60;
  const startupMin = 3; // engine start + liftoff
  const approachMin = 2; // approach + landing
  const groundMin = dest.groundMin || 0; // ground transport at destination
  const totalMin = startupMin + flightMin + approachMin + groundMin;
  const meetsReq = dest.maxMinutes > 0 ? totalMin <= dest.maxMinutes : true;
  return { distKm: Math.round(distKm * 10) / 10, flightMin: Math.round(flightMin * 10) / 10, totalMin: Math.round(totalMin * 10) / 10, startupMin, approachMin, groundMin, speedKmh: Math.round(speedKmh), meetsReq, maxMinutes: dest.maxMinutes };
}

// ═══ DXF PARSER (Full — LWPOLYLINE, POLYLINE, LINE, ARC, CIRCLE, ELLIPSE, SPLINE, INSERT, 3DFACE, HATCH) ═══
function parseDXF(text) {
  const lines = text.split(/\r?\n/), entities = [];
  let i = 0;
  // Skip to ENTITIES
  while (i < lines.length) { if (lines[i++].trim() === "ENTITIES") break; }

  // Also extract BLOCKS for INSERT resolution
  const blocks = {};
  { let bi = 0;
    while (bi < lines.length) { if (lines[bi++].trim() === "BLOCKS") break; }
    let bName = null, bEnts = [];
    while (bi < lines.length - 1) {
      const bc = parseInt(lines[bi++].trim()), bv = lines[bi++].trim();
      if (bc === 0 && bv === "BLOCK") { bName = null; bEnts = []; }
      else if (bc === 2 && bName === null) bName = bv;
      else if (bc === 0 && bv === "ENDBLK") { if (bName) blocks[bName] = bEnts; bName = null; bEnts = []; }
      else if (bc === 0 && bv === "ENDSEC") break;
    }
  }

  let cur = null, verts = [], pr = {}, splinePts = [];

  const saveEntity = () => {
    if (cur === "LWPOLYLINE" && verts.length >= 2) entities.push({ type: "poly", verts: [...verts], closed: pr.cl, layer: pr.ly || "" });
    else if (cur === "POLYLINE" && verts.length >= 2) entities.push({ type: "poly", verts: [...verts], closed: pr.cl, layer: pr.ly || "" });
    else if (cur === "LINE") entities.push({ type: "line", x1: pr.x1||0, y1: pr.y1||0, z1: pr.z1||0, x2: pr.x2||0, y2: pr.y2||0, z2: pr.z2||0, layer: pr.ly||"" });
    else if (cur === "CIRCLE") entities.push({ type: "circ", cx: pr.cx||0, cy: pr.cy||0, cz: pr.cz||0, r: pr.r||0, layer: pr.ly||"" });
    else if (cur === "ARC") {
      // Convert arc to polyline approximation
      const cx=pr.cx||0, cy=pr.cy||0, cz=pr.cz||0, r=pr.r||1, sa=pr.sa||0, ea=pr.ea||360;
      const pts = [];
      let a = sa; const step = 5;
      const end = ea < sa ? ea + 360 : ea;
      while (a <= end) { pts.push({ x: cx + r * Math.cos(a * DEG), y: cy + r * Math.sin(a * DEG), z: cz }); a += step; }
      if (pts.length >= 2) entities.push({ type: "poly", verts: pts, closed: false, layer: pr.ly || "", fromArc: true });
    }
    else if (cur === "ELLIPSE") {
      const cx=pr.cx||0, cy=pr.cy||0, cz=pr.cz||0, mx=pr.mx||1, my=pr.my||0, ratio=pr.ratio||1, sa=pr.sa||0, ea=pr.ea||Math.PI*2;
      const majLen = Math.sqrt(mx*mx + my*my), majAng = Math.atan2(my, mx);
      const pts = [];
      for (let t = sa; t <= ea; t += 0.1) {
        const px = majLen * Math.cos(t), py = majLen * ratio * Math.sin(t);
        pts.push({ x: cx + px * Math.cos(majAng) - py * Math.sin(majAng), y: cy + px * Math.sin(majAng) + py * Math.cos(majAng), z: cz });
      }
      if (pts.length >= 3) entities.push({ type: "poly", verts: pts, closed: Math.abs(ea - sa - Math.PI*2) < 0.01, layer: pr.ly || "", fromEllipse: true });
    }
    else if (cur === "SPLINE" && splinePts.length >= 2) {
      // Approximate spline: use control/fit points directly
      entities.push({ type: "poly", verts: [...splinePts], closed: pr.cl, layer: pr.ly || "", fromSpline: true });
    }
    else if (cur === "3DFACE") {
      const pts = [];
      if (pr.x1 !== undefined) pts.push({ x: pr.x1, y: pr.y1||0, z: pr.z1||0 });
      if (pr.x2 !== undefined) pts.push({ x: pr.x2, y: pr.y2||0, z: pr.z2||0 });
      if (pr.x3 !== undefined) pts.push({ x: pr.x3, y: pr.y3||0, z: pr.z3||0 });
      if (pr.x4 !== undefined) pts.push({ x: pr.x4, y: pr.y4||0, z: pr.z4||0 });
      if (pts.length >= 3) entities.push({ type: "poly", verts: pts, closed: true, layer: pr.ly || "", from3DFace: true });
    }
    else if (cur === "HATCH") {
      // HATCH boundary paths — already collected as verts
      if (verts.length >= 3) entities.push({ type: "poly", verts: [...verts], closed: true, layer: pr.ly || "", fromHatch: true });
    }
    else if (cur === "INSERT") {
      // Block reference — resolve from blocks table
      const bk = blocks[pr.blockName];
      if (bk) entities.push({ type: "block", name: pr.blockName, x: pr.bx||0, y: pr.by||0, z: pr.bz||0, layer: pr.ly||"", scaleX: pr.sx||1, scaleY: pr.sy||1, rotation: pr.rot||0 });
    }
  };

  while (i < lines.length - 1) {
    const c = parseInt(lines[i++].trim()), val = lines[i++].trim();
    if (c === 0) {
      saveEntity();
      cur = val; verts = []; pr = {}; splinePts = [];
      if (val === "VERTEX") { /* POLYLINE vertex — handled below */ }
      if (val === "SEQEND" && entities.length && entities[entities.length-1]?.collecting) { entities[entities.length-1].collecting = false; }
      if (val === "ENDSEC") break;
    } else if (cur === "LWPOLYLINE") {
      if (c===8) pr.ly=val; else if (c===70) pr.cl=parseInt(val)&1;
      else if (c===10) verts.push({x:parseFloat(val),y:0,z:0});
      else if (c===20&&verts.length) verts[verts.length-1].y=parseFloat(val);
      else if (c===30&&verts.length) verts[verts.length-1].z=parseFloat(val);
    } else if (cur === "POLYLINE") {
      if (c===8) pr.ly=val; else if (c===70) pr.cl=parseInt(val)&1;
    } else if (cur === "VERTEX") {
      if (c===10) verts.push({x:parseFloat(val),y:0,z:0});
      else if (c===20&&verts.length) verts[verts.length-1].y=parseFloat(val);
      else if (c===30&&verts.length) verts[verts.length-1].z=parseFloat(val);
    } else if (cur === "LINE") {
      if(c===8) pr.ly=val;
      else if(c===10) pr.x1=parseFloat(val); else if(c===20) pr.y1=parseFloat(val); else if(c===30) pr.z1=parseFloat(val);
      else if(c===11) pr.x2=parseFloat(val); else if(c===21) pr.y2=parseFloat(val); else if(c===31) pr.z2=parseFloat(val);
    } else if (cur === "CIRCLE" || cur === "ARC") {
      if(c===8) pr.ly=val; else if(c===10) pr.cx=parseFloat(val); else if(c===20) pr.cy=parseFloat(val); else if(c===30) pr.cz=parseFloat(val);
      else if(c===40) pr.r=parseFloat(val);
      else if(c===50) pr.sa=parseFloat(val); else if(c===51) pr.ea=parseFloat(val);
    } else if (cur === "ELLIPSE") {
      if(c===8) pr.ly=val; else if(c===10) pr.cx=parseFloat(val); else if(c===20) pr.cy=parseFloat(val); else if(c===30) pr.cz=parseFloat(val);
      else if(c===11) pr.mx=parseFloat(val); else if(c===21) pr.my=parseFloat(val);
      else if(c===40) pr.ratio=parseFloat(val); else if(c===41) pr.sa=parseFloat(val); else if(c===42) pr.ea=parseFloat(val);
    } else if (cur === "SPLINE") {
      if(c===8) pr.ly=val; else if(c===70) pr.cl=parseInt(val)&1;
      else if(c===11) splinePts.push({x:parseFloat(val),y:0,z:0}); // fit points
      else if(c===21&&splinePts.length) splinePts[splinePts.length-1].y=parseFloat(val);
      else if(c===31&&splinePts.length) splinePts[splinePts.length-1].z=parseFloat(val);
      else if(c===10&&!splinePts.length) splinePts.push({x:parseFloat(val),y:0,z:0}); // control points fallback
      else if(c===20&&splinePts.length&&!splinePts[splinePts.length-1].y) splinePts[splinePts.length-1].y=parseFloat(val);
    } else if (cur === "3DFACE") {
      if(c===8) pr.ly=val;
      else if(c===10) pr.x1=parseFloat(val); else if(c===20) pr.y1=parseFloat(val); else if(c===30) pr.z1=parseFloat(val);
      else if(c===11) pr.x2=parseFloat(val); else if(c===21) pr.y2=parseFloat(val); else if(c===31) pr.z2=parseFloat(val);
      else if(c===12) pr.x3=parseFloat(val); else if(c===22) pr.y3=parseFloat(val); else if(c===32) pr.z3=parseFloat(val);
      else if(c===13) pr.x4=parseFloat(val); else if(c===23) pr.y4=parseFloat(val); else if(c===33) pr.z4=parseFloat(val);
    } else if (cur === "HATCH") {
      if(c===8) pr.ly=val;
      else if(c===10) verts.push({x:parseFloat(val),y:0,z:0});
      else if(c===20&&verts.length) verts[verts.length-1].y=parseFloat(val);
    } else if (cur === "INSERT") {
      if(c===8) pr.ly=val; else if(c===2) pr.blockName=val;
      else if(c===10) pr.bx=parseFloat(val); else if(c===20) pr.by=parseFloat(val); else if(c===30) pr.bz=parseFloat(val);
      else if(c===41) pr.sx=parseFloat(val); else if(c===42) pr.sy=parseFloat(val); else if(c===50) pr.rot=parseFloat(val);
    }
  }
  saveEntity();

  const closed = entities.filter(e => e.type==="poly" && e.closed && e.verts.length>=3);
  const open = entities.filter(e => e.type==="poly" && !e.closed);
  const allLines = entities.filter(e => e.type==="line");
  const circles = entities.filter(e => e.type==="circ");
  const blockRefs = entities.filter(e => e.type==="block");
  const layers = [...new Set(entities.map(e => e.layer).filter(Boolean))];

  return { entities, closed, open, allLines, circles, blockRefs, layers, count: entities.length };
}

function dxfToData(parsed, siteW, siteH) {
  const zones = [], obs = [];
  const allPts = []; parsed.closed.forEach(p => p.verts.forEach(v => allPts.push(v)));
  if (!allPts.length) return { zones, obs };
  const xs = allPts.map(p=>p.x), ys = allPts.map(p=>p.y);
  const oX = Math.min(...xs), oY = Math.min(...ys);
  const threshArea = siteW * siteH * 0.02;
  for (const poly of parsed.closed) {
    const pts = poly.verts.map(v => ({ x: v.x - oX, y: v.y - oY, z: v.z || 0 }));
    let area = 0;
    for (let j=0;j<pts.length;j++) { const k=(j+1)%pts.length; area += pts[j].x*pts[k].y - pts[k].x*pts[j].y; }
    area = Math.abs(area)/2;
    if (area > threshArea) {
      zones.push(mkManualZone("D" + (zones.length+1), pts.length>=4 ? pts.slice(0,4) : [...pts, pts[pts.length-1]]));
    } else {
      const cx = pts.reduce((s,p)=>s+p.x,0)/pts.length, cy = pts.reduce((s,p)=>s+p.y,0)/pts.length;
      const pxs = pts.map(p=>p.x), pys = pts.map(p=>p.y);
      obs.push(mkObs({ nm: poly.layer||"DXF_"+(obs.length+1), corners: pts.length>=4?pts.slice(0,4):[...pts,pts[0]],
        x: cx, y: cy, w: Math.max(...pxs)-Math.min(...pxs), l: Math.max(...pys)-Math.min(...pys),
        d: Math.sqrt(cx*cx+cy*cy), br: Math.round(Math.atan2(cx,cy)*180/Math.PI) }));
    }
  }
  return { zones, obs };
}

// ═══ SVG: 3D ISOMETRIC OBSTACLE VIEW ═══
// ═══ THREE.JS 3D OBSTACLE VIEW ═══
function Obs3D({ zone, proj, size = 460 }) {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const dragRef = useRef({ active: false, px: 0, py: 0, rotX: 0.6, rotY: 0.5, zoom: 1.0 });
  const [error, setError] = useState(null);

  const G = useMemo(() => calcGeom(proj), [proj]);
  const cent = useMemo(() => zone ? zoneCentroid(zone) : { x: 0, y: 0 }, [zone]);

  useEffect(() => {
    if (!mountRef.current || !zone || !zone.obs || !zone.obs.length || !THREE) return;
    let animId = null;
    try {

    const w = size, h = size;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050a12);
    scene.fog = new THREE.FogExp2(0x050a12, 0.003);

    const camera = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
    const maxDist = Math.max(...zone.obs.map(o => o.d || 50), 100);
    const maxH = Math.max(...zone.obs.map(o => o.h || 10), 25);
    const camDist = maxDist * 2;
    camera.position.set(camDist * 0.7, camDist * 0.5, camDist * 0.7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    const amb = new THREE.AmbientLight(0x4488cc, 0.5);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(maxDist, maxDist * 1.5, maxDist * 0.5);
    dir.castShadow = true;
    scene.add(dir);
    const pt = new THREE.PointLight(0x2563eb, 0.3, maxDist * 4);
    pt.position.set(0, maxDist * 0.3, 0);
    scene.add(pt);

    // Ground grid
    const gridH = new THREE.GridHelper(maxDist * 2, 20, 0x1a2d4a, 0x0b1120);
    scene.add(gridH);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(maxDist * 2, maxDist * 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0b1120, transparent: true, opacity: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // FATO
    const fatoGeo = new THREE.BoxGeometry(G.fato, 0.3, G.fato);
    const fatoMat = new THREE.MeshStandardMaterial({ color: 0x10b981, transparent: true, opacity: 0.35, emissive: 0x10b981, emissiveIntensity: 0.2 });
    const fato = new THREE.Mesh(fatoGeo, fatoMat);
    fato.position.y = 0.15;
    scene.add(fato);

    // FATO edge glow
    const fatoEdge = new THREE.EdgesGeometry(fatoGeo);
    const fatoLine = new THREE.LineSegments(fatoEdge, new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 }));
    fatoLine.position.y = 0.15;
    scene.add(fatoLine);

    // Safety area wireframe
    const saGeo = new THREE.BoxGeometry(G.tot, 0.05, G.tot);
    const saEdge = new THREE.EdgesGeometry(saGeo);
    const saLine = new THREE.LineSegments(saEdge, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 1 }));
    saLine.position.y = 0.05;
    scene.add(saLine);

    // 1:8 Approach surface (transparent planes — both directions)
    const appLen = Math.min(G.appLen * 0.6, maxDist * 0.8);
    const appH = appLen * G.appG;
    const innerW = G.tot / 2;
    const outerW = innerW + appLen * G.splay;
    // Front approach
    const appGeo1 = new THREE.BufferGeometry();
    appGeo1.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-innerW,0.5,0, innerW,0.5,0, outerW,appH,-appLen, -outerW,appH,-appLen]), 3));
    appGeo1.setIndex([0,1,2, 0,2,3]);
    appGeo1.computeVertexNormals();
    scene.add(new THREE.Mesh(appGeo1, new THREE.MeshStandardMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.06, side: THREE.DoubleSide, emissive: 0xf59e0b, emissiveIntensity: 0.08 })));
    // Back approach
    const appGeo2 = new THREE.BufferGeometry();
    appGeo2.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-innerW,0.5,0, innerW,0.5,0, outerW,appH,appLen, -outerW,appH,appLen]), 3));
    appGeo2.setIndex([0,1,2, 0,2,3]);
    appGeo2.computeVertexNormals();
    scene.add(new THREE.Mesh(appGeo2, new THREE.MeshStandardMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.06, side: THREE.DoubleSide, emissive: 0xf59e0b, emissiveIntensity: 0.08 })));
    // 1:8 wireframe edges
    const appEdgePts1 = [new THREE.Vector3(-innerW,0.5,0), new THREE.Vector3(-outerW,appH,-appLen), new THREE.Vector3(outerW,appH,-appLen), new THREE.Vector3(innerW,0.5,0)];
    const appEdgePts2 = [new THREE.Vector3(-innerW,0.5,0), new THREE.Vector3(-outerW,appH,appLen), new THREE.Vector3(outerW,appH,appLen), new THREE.Vector3(innerW,0.5,0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(appEdgePts1), new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.4 })));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(appEdgePts2), new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.4 })));

    // 1:2 Transitional surface (left and right sides)
    const transLen = Math.min(maxDist * 0.4, 80);
    const transH = transLen * G.transG;
    const tMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.05, side: THREE.DoubleSide, emissive: 0x06b6d4, emissiveIntensity: 0.06 });
    // Left side
    const tGeo1 = new THREE.BufferGeometry();
    tGeo1.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-innerW,0.5,-appLen, -innerW,0.5,appLen, -innerW-transLen,transH,appLen, -innerW-transLen,transH,-appLen]), 3));
    tGeo1.setIndex([0,1,2, 0,2,3]); tGeo1.computeVertexNormals();
    scene.add(new THREE.Mesh(tGeo1, tMat));
    // Right side
    const tGeo2 = new THREE.BufferGeometry();
    tGeo2.setAttribute("position", new THREE.BufferAttribute(new Float32Array([innerW,0.5,-appLen, innerW,0.5,appLen, innerW+transLen,transH,appLen, innerW+transLen,transH,-appLen]), 3));
    tGeo2.setIndex([0,1,2, 0,2,3]); tGeo2.computeVertexNormals();
    scene.add(new THREE.Mesh(tGeo2, tMat));
    // Transitional wireframe
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-innerW,0.5,0), new THREE.Vector3(-innerW-transLen,transH,0)]), new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.4 })));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(innerW,0.5,0), new THREE.Vector3(innerW+transLen,transH,0)]), new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.4 })));

    // Inner Horizontal Surface (IH) at 45m
    const ihH = Math.min(G.ih, maxH * 0.9);
    const ihSize = maxDist * 1.2;
    const ihGeo = new THREE.PlaneGeometry(ihSize, ihSize);
    const ihMat = new THREE.MeshStandardMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.04, side: THREE.DoubleSide, emissive: 0xa78bfa, emissiveIntensity: 0.05 });
    const ihMesh = new THREE.Mesh(ihGeo, ihMat);
    ihMesh.rotation.x = -Math.PI / 2;
    ihMesh.position.y = ihH;
    scene.add(ihMesh);
    // IH wireframe ring
    const ihRingPts = [];
    for (let a = 0; a <= 360; a += 15) ihRingPts.push(new THREE.Vector3(Math.cos(a * DEG) * ihSize/2, ihH, Math.sin(a * DEG) * ihSize/2));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ihRingPts), new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.25 })));

    // Obstacles
    zone.obs.forEach((o) => {
      if (o.d <= 0 && (!o.corners || !o.corners.length)) return;
      const a18 = o.d > 0 ? o.d * G.appG : 0;
      const pen18 = o.d > 0 ? o.h > a18 : false;
      const a12 = o.d > 0 ? o.d * G.transG : 0;
      const pen12 = o.d > 0 ? o.h > a12 : false;
      const penIH = o.h > ihH;
      const pen = pen18 || penIH;
      const color = pen ? 0xef4444 : pen12 ? 0xf59e0b : 0x10b981;
      const emissive = color;
      let ox, oz;
      if (o.corners && o.corners.length >= 4) {
        ox = o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length - cent.x;
        oz = o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length - cent.y;
      } else {
        const rad = (o.br - 90) * DEG;
        ox = Math.cos(rad) * o.d;
        oz = Math.sin(rad) * o.d;
      }
      const bw = o.w || Math.max(4, o.h * 0.3);
      const bl = o.l || bw;
      const bh = Math.max(o.h, 1);

      // Main building body
      const geo = new THREE.BoxGeometry(bw, bh, bl);
      const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.6, emissive, emissiveIntensity: pen ? 0.25 : 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ox, bh / 2, oz);
      mesh.castShadow = true;
      scene.add(mesh);

      // Edge wireframe
      const edge = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color }));
      line.position.set(ox, bh / 2, oz);
      scene.add(line);

      // Height line from ground to top
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ox, 0, oz), new THREE.Vector3(ox, bh, oz)]), new THREE.LineBasicMaterial({ color: 0x8896ab })));

      // Penetration marker — red ring at 1:8 allowable height
      if (o.d > 0 && pen18) {
        const penRingGeo = new THREE.RingGeometry(bw * 0.3, bw * 0.5, 16);
        const penRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const penRing = new THREE.Mesh(penRingGeo, penRingMat);
        penRing.rotation.x = -Math.PI / 2;
        penRing.position.set(ox, a18, oz);
        scene.add(penRing);
        // Line showing excess penetration
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ox, a18, oz), new THREE.Vector3(ox, bh, oz)]), new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 })));
      }

      // Connection line to FATO center
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(ox, 0.2, oz)]), new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.15 })));
    });

    // Animation + rotation
    const dr = dragRef.current;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const r = dr.rotY, el = dr.rotX, z = dr.zoom;
      const d = camDist * z;
      camera.position.x = d * Math.sin(r) * Math.cos(el);
      camera.position.y = d * Math.sin(el);
      camera.position.z = d * Math.cos(r) * Math.cos(el);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    // Mouse drag rotation
    const el = renderer.domElement;
    const onDown = (e) => { dr.active = true; dr.px = e.clientX; dr.py = e.clientY; };
    const onMove = (e) => { if (!dr.active) return; dr.rotY += (e.clientX - dr.px) * 0.005; dr.rotX = clamp(dr.rotX + (e.clientY - dr.py) * 0.005, 0.1, 1.4); dr.px = e.clientX; dr.py = e.clientY; };
    const onUp = () => { dr.active = false; };
    const onWheel = (e) => { e.preventDefault(); dr.zoom = clamp(dr.zoom + (e.deltaY > 0 ? 0.08 : -0.08), 0.3, 3.0); };
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    } catch(e) { setError(e); return; }

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, [zone, proj, size, G, cent]);

  if (error) return <div style={{ color: K.rd, textAlign: "center", padding: 16, fontSize: 10 }}>3D Error: {error.message}</div>;
  if (!zone || !zone.obs.length) return <div style={{ color: K.dm, textAlign: "center", padding: 20, fontSize: 11 }}>No obstacles to render in 3D</div>;

  return (
    <div style={{ position: "relative" }}>
      <div ref={mountRef} style={{ width: size, height: size, borderRadius: 8, overflow: "hidden", cursor: "grab" }} />
      <div style={{ position: "absolute", bottom: 8, left: 8, fontSize: 8, color: K.dm, background: K.bg + "dd", padding: "4px 8px", borderRadius: 6, backdropFilter: "blur(8px)", border: "1px solid " + K.bd }}>
        Drag to rotate | Scroll to zoom
      </div>
      <div style={{ position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 700, color: K.cy, background: K.bg + "dd", padding: "4px 10px", borderRadius: 6, backdropFilter: "blur(8px)", border: "1px solid " + K.bd }}>
        3D OLS View — {zone.lb} | {zone.obs.length} obstacles
      </div>
      <div style={{ position: "absolute", top: 8, right: 8, fontSize: 8, background: K.bg + "dd", padding: "6px 8px", borderRadius: 6, backdropFilter: "blur(8px)", border: "1px solid " + K.bd }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}><div style={{ width: 10, height: 3, background: "#10b981", borderRadius: 1 }} /><span style={{ color: K.dm }}>FATO</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}><div style={{ width: 10, height: 3, background: "#f59e0b", borderRadius: 1 }} /><span style={{ color: K.dm }}>1:8 Approach</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}><div style={{ width: 10, height: 3, background: "#06b6d4", borderRadius: 1 }} /><span style={{ color: K.dm }}>1:2 Transitional</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}><div style={{ width: 10, height: 3, background: "#a78bfa", borderRadius: 1 }} /><span style={{ color: K.dm }}>Inner Horizontal ({G.ih}m)</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}><div style={{ width: 6, height: 6, background: "#10b981", borderRadius: 1 }} /><span style={{ color: K.dm }}>Clear</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}><div style={{ width: 6, height: 6, background: "#f59e0b", borderRadius: 1 }} /><span style={{ color: K.dm }}>Pen 1:2</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, background: "#ef4444", borderRadius: 1 }} /><span style={{ color: K.dm }}>Pen 1:8</span></div>
      </div>
    </div>
  );
}


// ═══ ORIENTATION ═══
function angDiff(a, b) { let d = ((b - a) % 360 + 360) % 360; return d > 180 ? 360 - d : d; }
const xwComp = (ws, wd, h) => Math.abs(ws * Math.sin(angDiff(wd, h) * DEG));
const hwComp = (ws, wd, h) => ws * Math.cos(angDiff(wd, h) * DEG);

function calcOrientation(z, p) {
  const { pd, ps, pf, sd, ss, sf, calm } = z.wind;
  const lim = getXwLim(p);
  if (ps === 0 && ss === 0) return { oh: 0, hp: "00/18", us: 100, xm: 0, lim, hwP: 0, hwS: 0, tw: false, ok: true, all: [], reason: "No wind data" };
  const res = [];
  for (let h = 0; h < 180; h += 5) {
    const h2 = h + 180;
    const hP = Math.max(hwComp(ps, pd, h), hwComp(ps, pd, h2));
    const xP = xwComp(ps, pd, h);
    const hS = Math.max(hwComp(ss, sd, h), hwComp(ss, sd, h2));
    const xS = xwComp(ss, sd, h);
    const tw = Math.min(hwComp(ps, pd, h), hwComp(ps, pd, h2)) < -5;
    let us = calm;
    if (xP <= lim) us += pf;
    if (xS <= lim) us += sf;
    const ac = pf + sf + calm;
    if (ac < 100) us += (100 - ac) * 0.5;
    res.push({ h, hp: String(Math.round(h/10)).padStart(2,"0") + "/" + String(Math.round(h2/10)).padStart(2,"0"), us: Math.min(100, Math.round(us*10)/10), xP: Math.round(xP*10)/10, xS: Math.round(xS*10)/10, xm: Math.round(Math.max(xP,xS)*10)/10, hwP: Math.round(hP*10)/10, hwS: Math.round(hS*10)/10, tw });
  }
  res.sort((a,b) => b.us !== a.us ? b.us - a.us : a.xm !== b.xm ? a.xm - b.xm : (b.hwP+b.hwS) - (a.hwP+a.hwS));
  const best = res[0];
  return { oh: best.h, hp: best.hp, us: best.us, xm: best.xm, lim, hwP: best.hwP, hwS: best.hwS, tw: best.tw, ok: best.us >= 95, all: res, reason: best.us >= 95 ? best.hp + " — " + best.us + "% usability, XW " + best.xm + "kt" : "Best " + best.hp + " — only " + best.us + "%" };
}

// ═══ SCORING ═══
const WT = { wind: 0.20, obs: 0.20, ter: 0.15, acc: 0.15, geo: 0.20, env: 0.10 };

function sWind(z, p) {
  const { ps, ss, pf, sf, calm, pd, sd } = z.wind;
  const lim = getXwLim(p);
  let s = 100; const R = [];
  const tf = pf + sf + calm;
  if (tf > 0 && tf < 95) { s -= 15; R.push("Coverage " + tf + "% < 95%"); }
  if (ps > 30) { s -= 35; R.push("Severe " + ps + "kt"); }
  else if (ps > 20) { s -= 20; R.push("Strong " + ps + "kt"); }
  else if (ps > 12) { s -= 8; R.push("Moderate " + ps + "kt"); }
  const xa = angDiff(pd, sd);
  if (xa > 60 && xa < 120 && ss > lim) { s -= 25; R.push("XW " + ss + "kt > " + lim + "kt limit"); }
  else if (xa > 45 && ss > lim * 0.7) { s -= 12; R.push("XW near limit"); }
  if (calm > 30) { s += 5; R.push("High calm %"); }
  if (!R.length) R.push("Wind OK");
  return { s: clamp(s, 0, 100), R };
}

function sObs(z, p) {
  const G = calcGeom(p);
  const cent = zoneCentroid(z);
  let s = 100; const R = []; const pens = [];
  if (!z.obs.length) { R.push("No obstacles — verify"); return { s: 90, R, pens }; }
  for (const o of z.obs) {
    // Use nearest corner if polygon, else simple distance
    const dist = obsNearestDist(o, cent.x, cent.y);
    if (dist <= 0) continue;
    const a18 = dist * G.appG;
    const ratio = o.h / dist;
    const p18 = o.h > a18;
    const a12 = dist * G.transG;
    const p12 = o.h > a12;
    const ex = Math.max(0, o.h - a18);
    const hasCorners = o.corners && o.corners.length >= 3;
    pens.push({ nm: o.nm, h: o.h, d: Math.round(dist * 10) / 10, br: o.br, ratio: Math.round(ratio * 10000) / 10000, a18: Math.round(a18 * 10) / 10, p18, p12, ex: Math.round(ex * 10) / 10, polygon: hasCorners });
    if (p18) {
      if (ex / Math.max(a18, 1) > 0.5) { s -= 35; R.push(o.nm + ": CRITICAL +" + ex.toFixed(1) + "m above 1:8" + (hasCorners ? " (nearest corner)" : "")); }
      else { s -= 20; R.push(o.nm + ": pen 1:8 (" + o.h + "m@" + dist.toFixed(0) + "m)"); }
    } else if (p12) { s -= 10; R.push(o.nm + ": pen 1:2 transitional"); }
    else if (ratio > 0.1) { s -= 5; R.push(o.nm + ": marginal ratio " + ratio.toFixed(3)); }
    if (dist < G.D * 2) { s -= 10; R.push(o.nm + ": within 2D (" + (G.D * 2).toFixed(0) + "m)"); }
    if (!o.perm) s += 3;
  }
  if (!R.length) R.push("All clear");
  return { s: clamp(s, 0, 100), R, pens };
}

function sTer(z, p) {
  const pc = getPc(p), hl = getHeli(p);
  let s = 100; const R = [];

  // Decompose slope relative to FATO heading if orientation available
  const ori = z.sc?.ori;
  const fatoHdg = ori ? ori.oh : 0;
  const slopeDir = z.ter.slopeDir || 0;
  const totalSlope = z.ter.slope || 0;

  let longSlope, transSlope;
  if (totalSlope > 0 && slopeDir > 0) {
    const decomp = decomposeSlope(totalSlope, slopeDir, fatoHdg);
    longSlope = decomp.longitudinal;
    transSlope = decomp.transverse;
    R.push("Slope " + totalSlope + "% at " + slopeDir + "° → longitudinal " + longSlope + "% / transverse " + transSlope + "% (vs FATO " + fatoHdg + "°)");
  } else {
    longSlope = totalSlope;
    transSlope = z.ter.side || 0;
  }

  // Longitudinal slope check
  if (longSlope > pc.maxSlope * 2) { s -= 40; R.push("Long. slope " + longSlope + "% >> " + pc.maxSlope + "% limit"); }
  else if (longSlope > pc.maxSlope) { s -= 25; R.push("Long. slope " + longSlope + "% > " + pc.maxSlope + "%"); }
  else if (longSlope > pc.maxSlope * 0.75) { s -= 8; R.push("Long. slope near limit"); }

  // Transverse (side) slope check — this is the critical cross-slope
  if (transSlope > pc.maxSlope) { s -= 20; R.push("Cross slope " + transSlope + "% > " + pc.maxSlope + "% — FATO alignment issue"); }
  else if (transSlope > pc.maxSlope * 0.75) { s -= 8; R.push("Cross slope " + transSlope + "% near limit"); }

  // Safety area slope
  if (totalSlope > pc.maxSA) { s -= 10; R.push("Exceeds SA limit " + pc.maxSA + "%"); }

  const soil = SOIL_DATA.find(x => x.value === z.ter.soil);
  const need = hl.mtow > 5000 ? 30 : 15;
  if (soil && soil.cbr < need) { s -= 20; R.push(soil.label + " CBR~" + soil.cbr + " < " + need); }
  if (Math.abs(z.ter.cf) > 5) { s -= 25; R.push("Earthworks " + Math.abs(z.ter.cf) + "m"); }
  else if (Math.abs(z.ter.cf) > 2) { s -= 12; R.push("Earthworks " + Math.abs(z.ter.cf) + "m"); }
  if (z.ter.flood) { s -= 15; R.push("Flood risk"); }
  const elevRange = (z.ter.elevMax || 0) - (z.ter.elevMin || 0);
  if (elevRange > 8) { s -= 15; R.push("Elev range " + elevRange.toFixed(1) + "m — significant"); }
  else if (elevRange > 4) { s -= 5; R.push("Elev range " + elevRange.toFixed(1) + "m"); }
  else if (elevRange > 0 && elevRange <= 2) { s += 3; R.push("Flat terrain"); }
  if (!R.length) R.push("Terrain OK");
  return { s: clamp(s, 0, 100), R };
}

function sAcc(z) {
  let s = 100; const R = [];
  if (!z.acc.road) { s -= 25; R.push("No road"); }
  else if (z.acc.rd > 500) { s -= 15; R.push("Road " + z.acc.rd + "m"); }
  else if (z.acc.rd > 200) { s -= 8; R.push("Road " + z.acc.rd + "m"); }
  if (z.acc.bd > 0 && z.acc.bd < 30) { s -= 30; R.push("Buildings " + z.acc.bd + "m < 30m"); }
  else if (z.acc.bd > 0 && z.acc.bd < 60) { s -= 15; R.push("Buildings " + z.acc.bd + "m"); }
  if (!z.acc.emer) { s -= 15; R.push("No emergency access"); }
  if (!z.acc.util) { s -= 8; R.push("No utilities"); }
  // Access nodes scoring
  const nodes = z.acc.nodes || [];
  if (nodes.length > 0) {
    const emergNodes = nodes.filter(n => n.tp === "emergency" || n.tp === "hospital");
    if (emergNodes.length > 0) {
      const closest = Math.min(...emergNodes.map(n => n.dist));
      if (closest < 50) { s += 5; R.push("Emergency access " + closest + "m — excellent"); }
      else if (closest > 200) { s -= 8; R.push("Nearest emergency node " + closest + "m"); }
    }
    const highPri = nodes.filter(n => n.importance >= 4);
    if (highPri.length === 0 && nodes.length > 0) { s -= 5; R.push("No high-priority access points"); }
    else if (highPri.length >= 2) { s += 3; R.push(highPri.length + " high-priority access points"); }
  }
  if (!R.length) R.push("Access OK");
  return { s: clamp(s, 0, 100), R };
}

function sGeo(z, p) {
  const G = calcGeom(p);
  let s = 100; const R = [];
  const mn = Math.min(z.bw, z.bh);
  const vp = z.vport || {};
  const pads = vp.pads || 1;
  // For vertiport with multiple pads, need more space
  const reqMin = pads > 1 ? G.tot * (1 + (pads - 1) * 0.8) : G.tot;
  if (mn < reqMin) { s -= 40; R.push("Zone " + mn.toFixed(0) + "m < " + reqMin.toFixed(1) + "m needed" + (pads > 1 ? " (" + pads + " pads)" : "")); }
  else if (mn < reqMin * 1.5) { s -= 15; R.push("Tight: " + mn.toFixed(0) + "m vs " + reqMin.toFixed(1) + "m"); }
  const rat = Math.min(z.bw, z.bh) / Math.max(z.bw, z.bh);
  if (rat < 0.4) { s -= 15; R.push("Very elongated"); }
  else if (rat < 0.6) { s -= 5; R.push("Elongated"); }
  // Vertiport charging infrastructure space
  if (vp.charging && vp.chargePoints > 0 && mn < reqMin + vp.chargePoints * 5) {
    s -= 8; R.push("Charging infrastructure needs additional " + (vp.chargePoints * 5) + "m");
  }
  // Terminal connection bonus
  if (vp.terminal && z.acc.nodes?.some(n => n.tp === "hospital" || n.tp === "gate")) {
    s += 3; R.push("Terminal connection feasible via existing access");
  }
  if (!R.length) R.push("Geometry OK");
  return { s: clamp(s, 0, 100), R };
}

function sEnv(z) {
  const sens = z.sens || [];
  let s = 100; const R = [];
  if (!sens.length) { R.push("No sensitivity zones defined"); return { s: 95, R }; }
  for (const sz of sens) {
    const sev = sz.level === "high" ? 3 : sz.level === "medium" ? 2 : 1;
    if (sz.dist > 0 && sz.dist < 100) { s -= sev * 12; R.push(sz.nm + " (" + sz.tp + ") at " + sz.dist + "m — " + sz.level + " sensitivity"); }
    else if (sz.dist > 0 && sz.dist < 250) { s -= sev * 5; R.push(sz.nm + " (" + sz.tp + ") at " + sz.dist + "m — within buffer"); }
    else if (sz.dist > 0 && sz.dist < 500) { s -= sev * 2; R.push(sz.nm + " at " + sz.dist + "m — monitor"); }
  }
  if (!R.length) R.push("No sensitive areas nearby");
  return { s: clamp(s, 0, 100), R };
}

function calcAllScores(z, p) {
  const wind = sWind(z, p), obs = sObs(z, p), ter = sTer(z, p), acc = sAcc(z), geo = sGeo(z, p), env = sEnv(z);
  const ori = calcOrientation(z, p);
  const w = p.wt || WT;
  const tot = Math.round((wind.s * w.wind + obs.s * w.obs + ter.s * w.ter + acc.s * w.acc + geo.s * w.geo + env.s * w.env) * 10) / 10;
  const gr = tot >= 80 ? "A" : tot >= 65 ? "B" : tot >= 50 ? "C" : tot >= 35 ? "D" : "F";
  const recMap = { A: "Highly Suitable", B: "Suitable — minor mods", C: "Marginal", D: "Poor", F: "Not Recommended" };
  return { tot, gr, rec: recMap[gr], bd: { wind, obs, ter, acc, geo, env }, ori };
}

function makeRecs(zones, p) {
  const rk = zones.filter(z => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
  if (!rk.length) return [];
  const b = rk[0]; const R = [];
  R.push({ icon: "🏆", text: "Recommended: " + b.lb + " — " + b.sc.tot + "/100 (" + b.sc.gr + ")", detail: b.sc.rec });
  if (b.sc.ori) R.push({ icon: "🧭", text: "FATO heading: " + b.sc.ori.hp + " (" + b.sc.ori.us + "% usability)", detail: b.sc.ori.ok ? "✓ ICAO 95%" : "⚠ Below 95%" });
  if (b.sc.bd.wind.s < 70) R.push({ icon: "💨", text: "Align FATO " + b.wind.pd + "°", detail: b.sc.bd.wind.R.join("; ") });
  if (b.sc.bd.obs.s < 70) R.push({ icon: "🚧", text: "Obstacle issue", detail: b.sc.bd.obs.R.join("; ") });
  if (b.sc.bd.ter.s < 70) R.push({ icon: "⛰", text: "Grading needed", detail: b.sc.bd.ter.R.join("; ") });
  if (b.sc.bd.env.s < 70) R.push({ icon: "🏘", text: "Sensitivity concern", detail: b.sc.bd.env.R.join("; ") });
  if (rk.length >= 2 && rk[0].sc.tot - rk[1].sc.tot < 5) R.push({ icon: "⚖️", text: "Close match: " + rk[0].lb + " vs " + rk[1].lb, detail: "" });
  return R;
}

// ═══ COMPLIANCE ENGINE ═══
// Checks GACAR Part 138 / ICAO Annex 14 Vol II requirements
function checkCompliance(zone, proj, site) {
  const G = calcGeom(proj);
  const pc = getPc(proj);
  const hl = getHeli(proj);
  const ori = zone.sc?.ori;
  const checks = [];

  const pass = (cat, ref, rule, detail) => checks.push({ cat, ref, rule, status: "PASS", detail });
  const fail = (cat, ref, rule, detail) => checks.push({ cat, ref, rule, status: "FAIL", detail });
  const warn = (cat, ref, rule, detail) => checks.push({ cat, ref, rule, status: "WARN", detail });
  const na = (cat, ref, rule, detail) => checks.push({ cat, ref, rule, status: "N/A", detail });

  // ── FATO DIMENSIONS ──
  const zoneMin = Math.min(zone.bw, zone.bh);
  if (zoneMin >= G.tot) pass("FATO", "ICAO 3.1.3", "FATO size ≥ 1.0D with safety area", "Zone " + zoneMin.toFixed(0) + "m ≥ " + G.tot.toFixed(1) + "m required");
  else fail("FATO", "ICAO 3.1.3", "FATO size ≥ 1.0D with safety area", "Zone " + zoneMin.toFixed(0) + "m < " + G.tot.toFixed(1) + "m required");

  // TLOF within FATO
  if (G.tlof <= G.fato) pass("FATO", "ICAO 3.2.1", "TLOF ≥ 0.83D within FATO", "TLOF " + G.tlof.toFixed(1) + "m within FATO " + G.fato.toFixed(1) + "m");
  else fail("FATO", "ICAO 3.2.1", "TLOF ≥ 0.83D within FATO", "TLOF exceeds FATO");

  // Safety Area ≥ 3m or 0.25D
  if (G.sa >= 3) pass("FATO", "ICAO 3.3.2", "Safety area ≥ 3m or 0.25D", "SA = " + G.sa.toFixed(1) + "m");
  else fail("FATO", "ICAO 3.3.2", "Safety area ≥ 3m or 0.25D", "SA = " + G.sa.toFixed(1) + "m < 3m");

  // ── SLOPES ──
  if (zone.ter.slope <= pc.maxSlope) pass("Slopes", "GACAR 138.107", "FATO longitudinal slope ≤ " + pc.maxSlope + "%", "Slope " + zone.ter.slope + "%");
  else fail("Slopes", "GACAR 138.107", "FATO longitudinal slope ≤ " + pc.maxSlope + "%", "Slope " + zone.ter.slope + "% exceeds limit");

  if (zone.ter.side <= pc.maxSlope) pass("Slopes", "GACAR 138.107", "FATO transverse (side) slope ≤ " + pc.maxSlope + "%", "Side slope " + zone.ter.side + "%");
  else fail("Slopes", "GACAR 138.107", "FATO transverse (side) slope ≤ " + pc.maxSlope + "%", "Side slope " + zone.ter.side + "% exceeds limit");

  if (zone.ter.slope <= pc.maxSA) pass("Slopes", "ICAO 3.3.6", "Safety area slope ≤ " + pc.maxSA + "% (downward)", "Ground slope " + zone.ter.slope + "%");
  else warn("Slopes", "ICAO 3.3.6", "Safety area slope ≤ " + pc.maxSA + "%", "Slope " + zone.ter.slope + "% — verify SA grading");

  // ── WIND ──
  const tf = zone.wind.pf + zone.wind.sf + zone.wind.calm;
  if (tf >= 95) pass("Wind", "ICAO 1.1.14", "Wind data coverage ≥ 95%", "Coverage " + tf + "%");
  else if (tf > 0) warn("Wind", "ICAO 1.1.14", "Wind data coverage ≥ 95%", "Coverage " + tf + "% — additional data recommended");
  else warn("Wind", "ICAO 1.1.14", "Wind data coverage ≥ 95%", "No wind data entered");

  if (ori && ori.ok) pass("Wind", "ICAO 3.1.10", "FATO orientation provides ≥ 95% usability", "Heading " + ori.hp + " = " + ori.us + "%");
  else if (ori) fail("Wind", "ICAO 3.1.10", "FATO orientation provides ≥ 95% usability", "Best heading " + ori.hp + " = " + ori.us + "%");

  if (ori && ori.xm <= ori.lim) pass("Wind", "GACAR 138.205", "Max crosswind ≤ " + ori.lim + "kt (" + hl.cat + ")", "XW " + ori.xm + "kt");
  else if (ori) fail("Wind", "GACAR 138.205", "Max crosswind ≤ " + ori.lim + "kt (" + hl.cat + ")", "XW " + ori.xm + "kt exceeds limit");

  // ── OLS / OBSTACLES ──
  const pens18 = (zone.sc?.bd?.obs?.pens || []).filter(p => p.p18);
  const pens12 = (zone.sc?.bd?.obs?.pens || []).filter(p => p.p12 && !p.p18);

  if (pens18.length === 0 && zone.obs.length > 0) pass("OLS", "ICAO 4.2.1", "No penetrations of 1:8 approach/departure surface", "All " + zone.obs.length + " obstacles clear");
  else if (pens18.length > 0) fail("OLS", "ICAO 4.2.1", "No penetrations of 1:8 approach/departure surface", pens18.length + " obstacle(s) penetrate: " + pens18.map(p => p.nm + " (+" + p.ex + "m)").join(", "));
  else if (zone.obs.length === 0) warn("OLS", "ICAO 4.2.1", "No penetrations of 1:8 approach/departure surface", "No obstacles entered — survey required");

  if (pens12.length === 0 && zone.obs.length > 0) pass("OLS", "ICAO 4.2.6", "No penetrations of 1:2 transitional surface", "Clear");
  else if (pens12.length > 0) warn("OLS", "ICAO 4.2.6", "No penetrations of 1:2 transitional surface", pens12.length + " obstacle(s) in transitional zone");

  // Obstacles within 2D
  const close = zone.obs.filter(o => o.d > 0 && o.d < G.D * 2);
  if (close.length === 0) pass("OLS", "GACAR 138.305", "No fixed obstacles within 2D of FATO center", "Clear within " + (G.D * 2).toFixed(0) + "m");
  else fail("OLS", "GACAR 138.305", "No fixed obstacles within 2D of FATO center", close.length + " obstacle(s): " + close.map(o => o.nm + " at " + o.d + "m").join(", "));

  // Lit/marked obstacles
  const unlitPen = zone.obs.filter(o => o.d > 0 && o.h > o.d / 8 && !o.lit);
  if (unlitPen.length === 0) pass("OLS", "ICAO 5.3.6", "Penetrating obstacles marked/lit", "All penetrating obstacles lit or no penetrations");
  else warn("OLS", "ICAO 5.3.6", "Penetrating obstacles marked/lit", unlitPen.length + " unlit penetrating obstacle(s)");

  // ── ACCESS ──
  if (zone.acc.emer) pass("Access", "GACAR 138.405", "Emergency vehicle access provided", "Available");
  else fail("Access", "GACAR 138.405", "Emergency vehicle access provided", "No emergency vehicle access");

  if (zone.acc.bd >= 30 || zone.acc.bd === 0) pass("Access", "GACAR 138.109", "Minimum 30m clearance from occupied buildings", zone.acc.bd > 0 ? zone.acc.bd + "m" : "Not specified — verify");
  else fail("Access", "GACAR 138.109", "Minimum 30m clearance from occupied buildings", zone.acc.bd + "m < 30m minimum");

  if (zone.acc.road) pass("Access", "GACAR 138.407", "Ground access road to helipad", "Road at " + zone.acc.rd + "m");
  else warn("Access", "GACAR 138.407", "Ground access road to helipad", "No road access — consider access road");

  // ── TERRAIN ──
  const soil = SOIL_DATA.find(s => s.value === zone.ter.soil);
  const needCBR = hl.mtow > 5000 ? 30 : 15;
  if (soil && soil.cbr >= needCBR) pass("Terrain", "SBC 301", "Soil bearing adequate for " + hl.mtow + "kg MTOW", soil.label + " CBR ~" + soil.cbr);
  else if (soil) warn("Terrain", "SBC 301", "Soil bearing adequate for " + hl.mtow + "kg MTOW", soil.label + " CBR ~" + soil.cbr + " — geotechnical study needed");

  if (!zone.ter.flood) pass("Terrain", "GACAR 138.103", "No flood risk at FATO location", "No flood risk reported");
  else fail("Terrain", "GACAR 138.103", "No flood risk at FATO location", "Flood risk identified — drainage required");

  if (Math.abs(zone.ter.cf) <= 2) pass("Terrain", "ICAO 3.1.7", "Minimal earthworks for FATO construction", "Cut/Fill " + Math.abs(zone.ter.cf) + "m");
  else warn("Terrain", "ICAO 3.1.7", "Minimal earthworks for FATO construction", "Cut/Fill " + Math.abs(zone.ter.cf) + "m — significant grading");

  // ── SUMMARY ──
  const total = checks.length;
  const passed = checks.filter(c => c.status === "PASS").length;
  const failed = checks.filter(c => c.status === "FAIL").length;
  const warned = checks.filter(c => c.status === "WARN").length;

  return {
    checks,
    summary: { total, passed, failed, warned },
    compliant: failed === 0,
    categories: [...new Set(checks.map(c => c.cat))],
  };
}

// ═══ CONFIDENCE ENGINE ═══
const SRC_LEVELS = {
  survey: { label: "Survey/Measured", weight: 1.0, color: "#10b981", icon: "✓" },
  documented: { label: "Documented/Published", weight: 0.85, color: "#2563eb", icon: "◉" },
  estimated: { label: "Estimated/Calculated", weight: 0.6, color: "#f59e0b", icon: "~" },
  assumed: { label: "Assumed/Default", weight: 0.3, color: "#ef4444", icon: "?" },
};
const SRC_OPTIONS = Object.entries(SRC_LEVELS).map(([k, v]) => ({ v: k, l: v.label }));

function calcConfidence(zone) {
  const cats = ["wind", "obstacles", "terrain", "access"];
  const weights = { wind: 0.30, obstacles: 0.30, terrain: 0.25, access: 0.15 };
  let totalConf = 0;
  const details = {};

  for (const cat of cats) {
    const srcKey = zone.src?.[cat] || "assumed";
    const srcLevel = SRC_LEVELS[srcKey] || SRC_LEVELS.assumed;
    let dataQuality = srcLevel.weight;

    // Bonus for having actual data entered
    if (cat === "wind") {
      const hasData = zone.wind.ps > 0 || zone.wind.ss > 0 || zone.wind.calm > 0;
      if (!hasData) dataQuality *= 0.3; // penalize empty data heavily
      const coverage = zone.wind.pf + zone.wind.sf + zone.wind.calm;
      if (coverage >= 95) dataQuality = Math.min(1, dataQuality * 1.1);
      else if (coverage < 50 && coverage > 0) dataQuality *= 0.7;
    }
    if (cat === "obstacles") {
      if (zone.obs.length === 0) dataQuality *= 0.5; // no survey = low confidence
      else {
        const allHaveData = zone.obs.every(o => o.h > 0 && o.d > 0);
        if (!allHaveData) dataQuality *= 0.7;
      }
    }
    if (cat === "terrain") {
      const hasSlope = zone.ter.slope > 0 || zone.ter.side > 0;
      if (!hasSlope && srcKey !== "survey") dataQuality *= 0.5;
      const hasElev = (zone.ter.elevMin || 0) > 0 || (zone.ter.elevMax || 0) > 0;
      if (hasElev) dataQuality = Math.min(1, dataQuality * 1.15); // bonus for elevation data
      if ((zone.ter.elevPts || 0) >= 10) dataQuality = Math.min(1, dataQuality * 1.1); // bonus for survey points
    }
    if (cat === "access") {
      const hasDist = zone.acc.rd > 0 || zone.acc.bd > 0;
      if (!hasDist) dataQuality *= 0.6;
      const nodes = zone.acc.nodes || [];
      if (nodes.length >= 2) dataQuality = Math.min(1, dataQuality * 1.15); // bonus for detailed node data
      else if (nodes.length === 0 && hasDist) dataQuality *= 0.85; // slight penalty for no nodes
    }

    const score = Math.round(clamp(dataQuality * 100, 0, 100));
    details[cat] = { src: srcKey, srcLabel: srcLevel.label, score, color: srcLevel.color, icon: srcLevel.icon };
    totalConf += score * weights[cat];
  }

  const overall = Math.round(totalConf);
  const grade = overall >= 80 ? "HIGH" : overall >= 55 ? "MEDIUM" : overall >= 30 ? "LOW" : "VERY LOW";
  const gradeColor = overall >= 80 ? "#10b981" : overall >= 55 ? "#2563eb" : overall >= 30 ? "#f59e0b" : "#ef4444";

  const flags = [];
  if (details.wind.score < 30) flags.push("Wind data unreliable — obtain meteorological study");
  if (details.obstacles.score < 30) flags.push("Obstacle data incomplete — topographic survey required");
  if (details.terrain.score < 30) flags.push("Terrain data insufficient — geotechnical investigation needed");
  if (overall < 40) flags.push("Overall data confidence too low for decision-making");

  return { overall, grade, gradeColor, details, flags };
}

function loadDemo() {
  const p = mkProj({ nm: "Al Arab Hospital Helipad", cl: "Ministry of Health", pt: "hospital", pc: "pc2", dh: "h145", mode: "feasibility", facility: "hospital_pad", desc: "Rooftop helipad feasibility study for EMS operations", workflow: "draft", auditLog: [mkLog("Project Created", "Al Arab Hospital Helipad")] });
  const s = mkSite({ nm: "Hospital Rooftop", lat: 21.5433, lng: 39.1728, elev: 48, sw: 300, sh: 300, gc: 3, gr: 3, md: 2.5, rt: 42,
    exclusions: [mkExclusion({ nm: "Mechanical Plant", reason: "Heavy equipment below deck", x: 200, y: 200, w: 80, h: 80 }), mkExclusion({ nm: "Parking Structure", reason: "Occupied structure", x: 0, y: 200, w: 100, h: 100 })],
    destinations: [
      mkDest({ nm: "King Fahd Hospital", tp: "hospital", lat: 21.4858, lng: 39.1925, cruiseKt: 120, groundMin: 5, required: true, maxMinutes: 20 }),
      mkDest({ nm: "KAMC Jeddah", tp: "hospital", lat: 21.5782, lng: 39.1644, cruiseKt: 120, groundMin: 3, required: true, maxMinutes: 15 }),
      mkDest({ nm: "King Abdulaziz Airport", tp: "airport", lat: 21.6796, lng: 39.1565, cruiseKt: 130, groundMin: 0, required: false, maxMinutes: 30 }),
    ]
  });
  const zs = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) zs.push(mkZone(r, c, s));

  Object.assign(zs[0].wind, { pd: 340, ps: 12, pf: 45, sd: 160, ss: 8, sf: 25, calm: 20 });
  zs[0].obs = [mkObs({ nm: "Water Tank", tp: "building", h: 6, d: 120, br: 15, w: 8, l: 8 }), mkObs({ nm: "AC Units", tp: "other", h: 3, d: 85, br: 270, w: 12, l: 4 })];
  Object.assign(zs[0].ter, { slope: 1.2, side: 0.8, soil: "firm", elevMin: 46, elevMax: 49, elevAvg: 47.5, elevPts: 12 });
  Object.assign(zs[0].acc, { rd: 50, bd: 80, nodes: [mkAccNode({ nm: "Main Gate", tp: "gate", dist: 50, importance: 5 }), mkAccNode({ nm: "ER Entrance", tp: "hospital", dist: 80, importance: 5 })] });
  zs[0].src = { wind: "documented", obstacles: "survey", terrain: "survey", access: "survey" };
  zs[0].sens = [mkSens({ nm: "Staff Housing", tp: "residential", level: "medium", dist: 200, br: 90 })];

  Object.assign(zs[1].wind, { pd: 340, ps: 14, pf: 40, sd: 75, ss: 16, sf: 30, calm: 15 });
  zs[1].obs = [mkObs({ nm: "Elevator Shaft", tp: "building", h: 12, d: 65, br: 45, w: 6, l: 6 }), mkObs({ nm: "Antenna", tp: "antenna", h: 18, d: 110, br: 350, w: 2, l: 2 }), mkObs({ nm: "Stairwell", tp: "building", h: 4, d: 40, br: 180, w: 8, l: 5 })];
  Object.assign(zs[1].ter, { slope: 2.5, side: 1.8, soil: "compacted", cf: -0.5, elevMin: 45, elevMax: 50, elevAvg: 47, elevPts: 8 });
  Object.assign(zs[1].acc, { rd: 120, bd: 45 });
  zs[1].src = { wind: "documented", obstacles: "estimated", terrain: "estimated", access: "survey" };
  zs[1].sens = [mkSens({ nm: "ICU Wing", tp: "hospital_zone", level: "high", dist: 80, br: 180 }), mkSens({ nm: "Pharmacy", tp: "sensitive", level: "low", dist: 150, br: 45 })];

  Object.assign(zs[2].wind, { pd: 340, ps: 14, pf: 42, sd: 250, ss: 10, sf: 28, calm: 15 });
  zs[2].obs = [mkObs({ nm: "Tower Block", tp: "building", h: 28, d: 90, br: 20, w: 25, l: 35 }), mkObs({ nm: "Crane", tp: "crane", h: 35, d: 150, br: 310, w: 3, l: 3, perm: false, startDate: "2025-01", endDate: "2026-06" })];
  Object.assign(zs[2].ter, { slope: 4.5, side: 3.2, soil: "mixed", cf: -2.5, elevMin: 42, elevMax: 52, elevAvg: 46, elevPts: 4 });
  Object.assign(zs[2].acc, { road: false, rd: 350, bd: 25, emer: false, util: false });
  zs[2].src = { wind: "estimated", obstacles: "estimated", terrain: "assumed", access: "assumed" };
  zs[2].sens = [mkSens({ nm: "School", tp: "school", level: "high", dist: 120, br: 270 }), mkSens({ nm: "Fuel Tank", tp: "fuel", level: "high", dist: 60, br: 150 })];

  Object.assign(zs[3].wind, { pd: 340, ps: 11, pf: 48, sd: 200, ss: 7, sf: 22, calm: 25 });
  zs[3].obs = [mkObs({ nm: "Light Pole", tp: "other", h: 4, d: 140, br: 90, w: 1, l: 1 })];
  Object.assign(zs[3].ter, { slope: 0.8, side: 0.5, soil: "rock", elevMin: 47, elevMax: 49, elevAvg: 48, elevPts: 16 });
  Object.assign(zs[3].acc, { rd: 30, bd: 120, nodes: [mkAccNode({ nm: "Staff Parking", tp: "road", dist: 30, importance: 4 }), mkAccNode({ nm: "Emergency Bay", tp: "emergency", dist: 40, importance: 5 })] });
  zs[3].src = { wind: "survey", obstacles: "survey", terrain: "survey", access: "survey" };
  zs[3].sens = [mkSens({ nm: "Staff Residence", tp: "residential", level: "low", dist: 300, br: 45 })];

  Object.assign(zs[4].wind, { pd: 340, ps: 13, pf: 44, sd: 90, ss: 11, sf: 26, calm: 18 });
  zs[4].obs = [mkObs({ nm: "Parking", tp: "building", h: 9, d: 70, br: 200, w: 30, l: 40 }), mkObs({ nm: "Trees", tp: "tree", h: 8, d: 95, br: 120 })];
  Object.assign(zs[4].ter, { slope: 1.8, side: 1.2, soil: "firm", cf: -0.3, elevMin: 46, elevMax: 50, elevAvg: 48, elevPts: 10 });
  Object.assign(zs[4].acc, { rd: 80, bd: 70 });
  zs[4].src = { wind: "documented", obstacles: "survey", terrain: "estimated", access: "documented" };
  zs[4].sens = [mkSens({ nm: "Hospital Garden", tp: "hospital_zone", level: "medium", dist: 60, br: 90 }), mkSens({ nm: "Visitor Parking", tp: "residential", level: "low", dist: 140, br: 220 })];

  zs[5].on = false;

  Object.assign(zs[6].wind, { pd: 340, ps: 12, pf: 46, sd: 180, ss: 9, sf: 24, calm: 22 });
  zs[6].obs = [mkObs({ nm: "Generator", tp: "building", h: 5, d: 55, br: 260, w: 8, l: 12 })];
  Object.assign(zs[6].ter, { slope: 2.2, side: 1.5, soil: "compacted", cf: -1 });
  Object.assign(zs[6].acc, { rd: 150, bd: 55, util: false });
  zs[6].sens = [mkSens({ nm: "Oxygen Storage", tp: "fuel", level: "high", dist: 45, br: 180 }), mkSens({ nm: "Ambulance Bay", tp: "hospital_zone", level: "medium", dist: 90, br: 0 })];

  Object.assign(zs[7].wind, { pd: 340, ps: 15, pf: 43, sd: 60, ss: 18, sf: 27, calm: 12 });
  zs[7].obs = [mkObs({ nm: "Hospital Wing", tp: "building", h: 22, d: 80, br: 330, w: 40, l: 60 }), mkObs({ nm: "HVAC", tp: "other", h: 7, d: 50, br: 140, w: 10, l: 10 })];
  Object.assign(zs[7].ter, { slope: 3, side: 2.5, soil: "soft", cf: -1.5 });
  Object.assign(zs[7].acc, { rd: 200, bd: 35, emer: false });
  zs[7].sens = [mkSens({ nm: "Maternity Ward", tp: "hospital_zone", level: "high", dist: 35, br: 330 }), mkSens({ nm: "Mosque", tp: "sensitive", level: "medium", dist: 180, br: 90 })];

  zs[8].on = false;
  return { p, s, zs };
}

// ═══ STATE ═══
// Demo loaded on demand via DEMO action

// ═══ UNDO/REDO WRAPPER ═══
const SKIP_UNDO = ["STEP", "TAB", "SEL"]; // these don't create undo points
const MAX_UNDO = 30;

function undoReducer(historyState, action) {
  if (action.type === "UNDO") {
    if (historyState.past.length === 0) return historyState;
    const prev = historyState.past[historyState.past.length - 1];
    return { past: historyState.past.slice(0, -1), present: prev, future: [historyState.present, ...historyState.future].slice(0, MAX_UNDO) };
  }
  if (action.type === "REDO") {
    if (historyState.future.length === 0) return historyState;
    const next = historyState.future[0];
    return { past: [...historyState.past, historyState.present].slice(-MAX_UNDO), present: next, future: historyState.future.slice(1) };
  }
  const newPresent = reducer(historyState.present, action);
  if (newPresent === historyState.present) return historyState;
  if (SKIP_UNDO.includes(action.type)) return { ...historyState, present: newPresent };
  return { past: [...historyState.past, historyState.present].slice(-MAX_UNDO), present: newPresent, future: [] };
}

function reducer(state, action) {
  const { type, payload } = action;
  switch (type) {
    case "STEP": return { ...state, step: payload };
    case "TAB": return { ...state, tab: payload };
    case "UP": return { ...state, proj: { ...state.proj, ...payload }, scored: false };
    case "US": return { ...state, site: { ...state.site, ...payload }, scored: false };
    case "SZ": return { ...state, zones: payload, sel: payload[0]?.id || null, scored: false };
    case "SEL": return { ...state, sel: payload };
    case "ZF": {
      const { zid, sec, fld, val } = payload;
      return { ...state, zones: state.zones.map(z => z.id !== zid ? z : (sec ? { ...z, [sec]: { ...z[sec], [fld]: val }, sc: null } : { ...z, [fld]: val, sc: null })), scored: false };
    }
    case "AO": return { ...state, zones: state.zones.map(z => z.id !== payload ? z : { ...z, obs: [...z.obs, mkObs()], sc: null }), scored: false };
    case "UO": {
      const { zid, oid, fld, val } = payload;
      return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, obs: z.obs.map(o => o.id === oid ? autoCalcCoords(o, fld, val) : o), sc: null }), scored: false };
    }
    case "DO": {
      const { zid, oid } = payload;
      return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, obs: z.obs.filter(o => o.id !== oid), sc: null }), scored: false };
    }
    case "TOG": return { ...state, zones: state.zones.map(z => z.id === payload ? { ...z, on: !z.on, sc: null } : z), scored: false };
    case "ASENS": return { ...state, zones: state.zones.map(z => z.id !== payload ? z : { ...z, sens: [...(z.sens || []), mkSens()], sc: null }), scored: false };
    case "USENS": { const { zid, sid, fld, val } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, sens: (z.sens || []).map(s => s.id === sid ? autoCalcCoords(s, fld, val) : s), sc: null }), scored: false }; }
    case "DSENS": { const { zid, sid } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, sens: (z.sens || []).filter(s => s.id !== sid), sc: null }), scored: false }; }
    case "ANODE": { const { zid } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, acc: { ...z.acc, nodes: [...(z.acc.nodes || []), mkAccNode()] }, sc: null }), scored: false }; }
    case "UNODE": { const { zid, nid, fld, val } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, acc: { ...z.acc, nodes: (z.acc.nodes || []).map(n => n.id === nid ? autoCalcCoords(n, fld, val) : n) }, sc: null }), scored: false }; }
    case "DNODE": { const { zid, nid } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, acc: { ...z.acc, nodes: (z.acc.nodes || []).filter(n => n.id !== nid) }, sc: null }), scored: false }; }
    case "AEXCL": return { ...state, site: { ...state.site, exclusions: [...(state.site.exclusions || []), mkExclusion()] } };
    case "UEXCL": { const { eid, fld, val } = payload; return { ...state, site: { ...state.site, exclusions: (state.site.exclusions || []).map(e => e.id === eid ? { ...e, [fld]: val } : e) } }; }
    case "DEXCL": return { ...state, site: { ...state.site, exclusions: (state.site.exclusions || []).filter(e => e.id !== payload) } };
    case "ADEST": return { ...state, site: { ...state.site, destinations: [...(state.site.destinations || []), mkDest()] } };
    case "UDEST": { const { did, fld, val } = payload; return { ...state, site: { ...state.site, destinations: (state.site.destinations || []).map(d => d.id === did ? { ...d, [fld]: val } : d) } }; }
    case "DDEST": return { ...state, site: { ...state.site, destinations: (state.site.destinations || []).filter(d => d.id !== payload) } };
    case "RUN": {
      const zones = state.zones.map(z => ({ ...z, sc: z.on ? calcAllScores(z, state.proj) : null }));
      const log = [...(state.proj.auditLog || []), mkLog("Analysis Run", zones.filter(z => z.sc).length + " zones scored")];
      return { ...state, zones, recs: makeRecs(zones, state.proj), scored: true, step: 5, tab: "overview", proj: { ...state.proj, auditLog: log } };
    }
    case "SAVE_SCENARIO": {
      const snap = {
        id: uid(), name: payload, savedAt: new Date().toISOString(),
        proj: JSON.parse(JSON.stringify(state.proj)),
        site: JSON.parse(JSON.stringify(state.site)),
        zones: JSON.parse(JSON.stringify(state.zones)),
        recs: state.recs,
        bestZone: (() => { const rk = state.zones.filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot); return rk[0] || null; })(),
      };
      const log = [...(state.proj.auditLog || []), mkLog("Scenario Saved", payload)];
      return { ...state, scenarios: [...state.scenarios, snap], proj: { ...state.proj, auditLog: log } };
    }
    case "WORKFLOW": {
      const log = [...(state.proj.auditLog || []), mkLog("Status Changed", state.proj.workflow + " → " + payload)];
      return { ...state, proj: { ...state.proj, workflow: payload, auditLog: log } };
    }
    case "DEL_SCENARIO": return { ...state, scenarios: state.scenarios.filter(s => s.id !== payload) };
    case "DUP_SCENARIO": {
      const src = state.scenarios.find(s => s.id === payload);
      if (!src) return state;
      const dup = { ...JSON.parse(JSON.stringify(src)), id: uid(), name: src.name + " (copy)", savedAt: new Date().toISOString() };
      return { ...state, scenarios: [...state.scenarios, dup] };
    }
    case "LOAD_SCENARIO": {
      const snap = state.scenarios.find(s => s.id === payload);
      if (!snap) return state;
      return { ...state, proj: JSON.parse(JSON.stringify(snap.proj)), site: JSON.parse(JSON.stringify(snap.site)), zones: JSON.parse(JSON.stringify(snap.zones)), recs: snap.recs, scored: true, sel: snap.zones[0]?.id || null, step: 5, tab: "overview" };
    }
    case "WHATIF": {
      // Quick re-score with different helicopter or PC
      const newProj = { ...state.proj, ...payload };
      const zones = state.zones.map(z => ({ ...z, sc: z.on ? calcAllScores(z, newProj) : null }));
      return { ...state, proj: newProj, zones, recs: makeRecs(zones, newProj), scored: true };
    }
    case "DEMO": { const d = loadDemo(); return { step: 0, proj: d.p, site: d.s, zones: d.zs, sel: d.zs[0].id, recs: [], scored: false, tab: "overview", scenarios: state.scenarios || [] }; }
    case "IMPORT": {
      const d = payload;
      const log = [...(d.proj?.auditLog || []), mkLog("Project Imported", d.proj?.nm || "")];
      return { step: 0, proj: { ...d.proj, auditLog: log }, site: d.site, zones: d.zones, sel: d.zones[0]?.id || null, recs: [], scored: false, tab: "overview", scenarios: d.scenarios || state.scenarios || [] };
    }
    case "RESET": { return { step: 0, proj: mkProj(), site: mkSite(), zones: [], sel: null, recs: [], scored: false, tab: "overview", scenarios: state.scenarios || [] }; }
    case "APPLY_ALL": {
      // Apply section data from selected zone to all other zones
      const { section, fromZid } = payload;
      const src = state.zones.find(z => z.id === fromZid);
      if (!src) return state;
      return { ...state, zones: state.zones.map(z => {
        if (z.id === fromZid || !z.on) return z;
        if (section === "wind") return { ...z, wind: { ...src.wind }, src: { ...z.src, wind: src.src?.wind || z.src?.wind }, sc: null };
        if (section === "terrain") return { ...z, ter: { ...src.ter }, src: { ...z.src, terrain: src.src?.terrain || z.src?.terrain }, sc: null };
        if (section === "access") return { ...z, acc: { ...src.acc, nodes: JSON.parse(JSON.stringify(src.acc.nodes || [])) }, src: { ...z.src, access: src.src?.access || z.src?.access }, sc: null };
        return z;
      }), scored: false };
    }
    default: return state;
  }
}

// ═══ THEME ═══
const K = { bg: "#050a12", sf: "#0b1120", pn: "#101d30", rs: "#152236", bd: "#1a2d4a", bl: "#2563eb", cy: "#06b6d4", gn: "#10b981", am: "#f59e0b", rd: "#ef4444", or: "#f97316", pu: "#a78bfa", tx: "#e1e7ef", dm: "#8896ab", mu: "#4e6380" };
const gradeCol = (g) => ({ A: K.gn, B: K.bl, C: K.am, D: K.or, F: K.rd }[g] || K.mu);
const scoreCol = (s) => s >= 80 ? K.gn : s >= 65 ? K.bl : s >= 50 ? K.am : s >= 35 ? K.or : K.rd;

// ═══ SVG: WIND ROSE ═══
function WindRose({ zone, ori, size = 190 }) {
  const cx = size / 2, cy = size / 2, R = size * 0.36;
  const { pd, ps, pf, sd, ss, sf } = zone.wind;
  const mx = Math.max(ps, ss, 1);
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];

  function arrow(dir, spd, freq, col) {
    if (!spd) return null;
    const rd = (dir - 90) * DEG;
    const tx = cx + Math.cos(rd) * R, ty = cy + Math.sin(rd) * R;
    return (
      <g>
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={col} strokeWidth={1} opacity={0.25} strokeDasharray="2,2" />
        <line x1={tx} y1={ty} x2={tx - Math.cos(rd) * R * 0.3 * spd / mx} y2={ty - Math.sin(rd) * R * 0.3 * spd / mx} stroke={col} strokeWidth={Math.max(2, spd / 4)} strokeLinecap="round" opacity={0.8} />
        <text x={tx + Math.cos(rd) * 14} y={ty + Math.sin(rd) * 14} fill={col} fontSize={7} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{spd}kt</text>
      </g>
    );
  }

  const or1 = ori ? (ori.oh - 90) * DEG : 0;
  const or2 = ori ? (ori.oh + 90) * DEG : 0;

  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
      {[0.25, 0.5, 0.75, 1].map(f => <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke={K.bd} strokeWidth={0.5} />)}
      {[0, 45, 90, 135].map(a => { const r = (a - 90) * DEG; return <line key={a} x1={cx - Math.cos(r) * R} y1={cy - Math.sin(r) * R} x2={cx + Math.cos(r) * R} y2={cy + Math.sin(r) * R} stroke={K.bd} strokeWidth={0.3} />; })}
      {dirs.map((d, i) => { const a = (i * 45 - 90) * DEG; return <text key={d} x={cx + Math.cos(a) * (R + 12)} y={cy + Math.sin(a) * (R + 12)} fill={K.dm} fontSize={8} fontWeight={d.length === 1 ? 700 : 500} textAnchor="middle" dominantBaseline="middle">{d}</text>; })}
      {ori && <line x1={cx + Math.cos(or1) * R * 0.85} y1={cy + Math.sin(or1) * R * 0.85} x2={cx + Math.cos(or2) * R * 0.85} y2={cy + Math.sin(or2) * R * 0.85} stroke={K.gn} strokeWidth={2.5} opacity={0.7} strokeDasharray="5,3" />}
      {ori && <text x={cx + Math.cos(or1) * (R * 0.85 + 10)} y={cy + Math.sin(or1) * (R * 0.85 + 10)} fill={K.gn} fontSize={7} fontWeight={800} textAnchor="middle">{ori.hp}</text>}
      {arrow(pd, ps, pf, K.cy)}
      {arrow(sd, ss, sf, K.am)}
      <circle cx={cx} cy={cy} r={3} fill={K.tx} />
    </svg>
  );
}

// ═══ SVG: OLS SECTION ═══
function OLSChart({ zone, proj, width = 560, height = 240 }) {
  const G = calcGeom(proj);
  const obs = zone.obs.filter(o => o.d > 0 && o.h > 0);
  if (!obs.length) return <div style={{ width, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: K.rs, borderRadius: 6, fontSize: 10, color: K.mu }}>Add obstacles to see OLS</div>;

  const mxD = Math.max(...obs.map(o => o.d), 200);
  const mxH = Math.max(...obs.map(o => o.h), mxD * G.appG + 5);
  const P = { t: 24, r: 20, b: 36, l: 44 };
  const PW = width - P.l - P.r, PH = height - P.t - P.b;
  const sx = (d) => P.l + (d / mxD) * PW;
  const sy = (v) => P.t + PH - (v / mxH) * PH;

  const s18 = [];
  for (let d = 0; d <= mxD; d += mxD / 80) s18.push(sx(d) + "," + sy(d * G.appG));
  const s12 = [];
  for (let d = 0; d <= mxD; d += mxD / 80) { const v = d * G.transG; if (v <= mxH) s12.push(sx(d) + "," + sy(v)); }

  return (
    <svg width={width} height={height} viewBox={"0 0 " + width + " " + height}>
      <rect x={P.l} y={P.t} width={PW} height={PH} fill={K.pn} rx={2} />
      {Array.from({ length: 6 }, (_, i) => { const v = (mxH / 5) * i; return <g key={"h" + i}><line x1={P.l} y1={sy(v)} x2={P.l + PW} y2={sy(v)} stroke={K.bd} strokeWidth={0.3} /><text x={P.l - 4} y={sy(v)} fill={K.mu} fontSize={7} textAnchor="end" dominantBaseline="middle">{Math.round(v)}</text></g>; })}
      {Array.from({ length: 6 }, (_, i) => { const d = (mxD / 5) * i; return <g key={"v" + i}><line x1={sx(d)} y1={P.t} x2={sx(d)} y2={P.t + PH} stroke={K.bd} strokeWidth={0.3} /><text x={sx(d)} y={P.t + PH + 12} fill={K.mu} fontSize={7} textAnchor="middle">{Math.round(d)}</text></g>; })}
      <line x1={P.l} y1={sy(0)} x2={P.l + PW} y2={sy(0)} stroke="#4a7a4a" strokeWidth={1.5} />
      <rect x={sx(0)} y={sy(0) - 6} width={Math.max(8, sx(G.tot) - sx(0))} height={6} fill={K.gn} rx={2} opacity={0.7} />
      <text x={sx(G.tot / 2)} y={sy(0) + 14} fill={K.gn} fontSize={7} fontWeight={700} textAnchor="middle">FATO+SA {G.tot.toFixed(0)}m</text>
      <polygon points={sx(0) + "," + sy(0) + " " + s18.join(" ") + " " + sx(mxD) + "," + sy(0)} fill={K.am} fillOpacity={0.06} />
      <polyline points={s18.join(" ")} fill="none" stroke={K.am} strokeWidth={2} strokeDasharray="6,3" />
      <text x={P.l + PW - 2} y={sy(mxD * G.appG) - 6} fill={K.am} fontSize={8} fontWeight={700} textAnchor="end">1:8</text>
      {s12.length > 2 && <polyline points={s12.join(" ")} fill="none" stroke={K.cy} strokeWidth={1.2} strokeDasharray="3,3" opacity={0.7} />}
      {G.ih <= mxH && <line x1={P.l} y1={sy(G.ih)} x2={P.l + PW} y2={sy(G.ih)} stroke={K.pu} strokeWidth={1} strokeDasharray="8,4" opacity={0.5} />}
      {obs.map((o, i) => {
        const x = sx(o.d), yt = sy(o.h), yb = sy(0);
        const a18 = o.d * G.appG, pen = o.h > a18, col = pen ? K.rd : K.gn;
        return (
          <g key={i}>
            <line x1={x} y1={yb} x2={x} y2={yt} stroke={col} strokeWidth={3} strokeLinecap="round" />
            <rect x={x - 5} y={yt - 2} width={10} height={4} rx={1} fill={col} />
            <text x={x} y={yt - 10} fill={col} fontSize={8} fontWeight={700} textAnchor="middle">{o.h}m</text>
            <text x={x} y={yt - 20} fill={K.tx} fontSize={7} textAnchor="middle" opacity={0.6}>{o.nm}</text>
            <line x1={x - 8} y1={sy(a18)} x2={x + 8} y2={sy(a18)} stroke={K.am} strokeWidth={1} opacity={0.5} />
            {pen && <text x={x + 10} y={yt + 2} fill={K.rd} fontSize={7} fontWeight={700}>+{(o.h - a18).toFixed(1)}m</text>}
            <text x={x} y={yb + 10} fill={K.mu} fontSize={6} textAnchor="middle">{o.d}m</text>
          </g>
        );
      })}
      <text x={P.l + PW / 2} y={height - 4} fill={K.dm} fontSize={8} textAnchor="middle">Distance (m)</text>
    </svg>
  );
}

// ═══ SVG: RADAR ═══
function ScoreRadar({ scores, size = 160 }) {
  if (!scores) return null;
  const cats = [{ k: "wind", l: "Wind", c: K.cy }, { k: "obs", l: "OBS", c: K.am }, { k: "ter", l: "Terrain", c: K.gn }, { k: "acc", l: "Access", c: K.bl }, { k: "geo", l: "Geo", c: K.pu }, { k: "env", l: "Env", c: K.or }];
  const cx = size / 2, cy = size / 2, R = size * 0.35, n = cats.length;
  const pts = cats.map((c, i) => {
    const a = (i * 360 / n - 90) * DEG;
    const v = (scores.bd[c.k]?.s || 0) / 100;
    return { x: cx + Math.cos(a) * R * v, y: cy + Math.sin(a) * R * v, lx: cx + Math.cos(a) * (R + 16), ly: cy + Math.sin(a) * (R + 16), l: c.l, s: scores.bd[c.k]?.s || 0, c: c.c };
  });
  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
      {[0.25, 0.5, 0.75, 1].map(f => <polygon key={f} points={cats.map((_, i) => { const a = (i * 360 / n - 90) * DEG; return (cx + Math.cos(a) * R * f) + "," + (cy + Math.sin(a) * R * f); }).join(" ")} fill="none" stroke={K.bd} strokeWidth={0.5} />)}
      <polygon points={pts.map(p => p.x + "," + p.y).join(" ")} fill={K.bl} fillOpacity={0.15} stroke={K.bl} strokeWidth={1.5} />
      {pts.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={3} fill={p.c} /><text x={p.lx} y={p.ly} fill={p.c} fontSize={7} fontWeight={600} textAnchor="middle" dominantBaseline="middle">{p.l} {p.s}</text></g>)}
    </svg>
  );
}

// ═══ ZONE GRID ═══
// ═══ SVG: SITE PLAN VIEW ═══
function SitePlan({ zones, proj, site, selId, onSel, onAddObs, size = 480 }) {
  const G = calcGeom(proj);
  const pad = 40;
  const plotSize = size - 2 * pad;
  const scaleX = (v) => pad + (v / site.sw) * plotSize;
  const scaleY = (v) => pad + (v / site.sh) * plotSize;
  const scaleD = (v) => (v / Math.max(site.sw, site.sh)) * plotSize;
  const unscaleX = (px) => ((px - pad) / plotSize) * site.sw;
  const unscaleY = (py) => ((py - pad) / plotSize) * site.sh;

  const bestZ = [...zones].filter(z => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0];
  const ori = bestZ?.sc?.ori;
  const [hover, setHover] = useState(null);
  const [windT, setWindT] = useState(0);

  // Animate wind particles
  useEffect(() => {
    const timer = setInterval(() => setWindT(t => (t + 1) % 200), 80);
    return () => clearInterval(timer);
  }, []);

  const selZone = zones.find(z => z.id === selId);
  const windDir = selZone?.wind?.pd || bestZ?.wind?.pd || 0;
  const windSpd = selZone?.wind?.ps || bestZ?.wind?.ps || 0;

  // Click on empty space = add obstacle at that position
  const handleClick = (e) => {
    if (!onAddObs || !selId) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = unscaleX((e.clientX - rect.left) * (size / rect.width));
    const y = unscaleY((e.clientY - rect.top) * (size / rect.height));
    if (x >= 0 && x <= site.sw && y >= 0 && y <= site.sh) onAddObs(x, y);
  };

  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{ display: "block", cursor: onAddObs ? "crosshair" : "default" }} onDoubleClick={handleClick}>
      <defs>
        <pattern id="gridP" width={plotSize / site.gc} height={plotSize / site.gr} patternUnits="userSpaceOnUse" x={pad} y={pad}>
          <rect width={plotSize / site.gc} height={plotSize / site.gr} fill="none" stroke={K.bd} strokeWidth={0.5} />
        </pattern>
        <marker id="arrowM" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={K.am} opacity={0.7} /></marker>
      </defs>
      {/* Background */}
      <rect x={pad} y={pad} width={plotSize} height={plotSize} fill={K.pn} rx={4} />
      <rect x={pad} y={pad} width={plotSize} height={plotSize} fill="url(#gridP)" />

      {/* Zone fills */}
      {zones.map(z => {
        const isSel = z.id === selId;
        const isBest = bestZ && z.id === bestZ.id;
        const sc = z.sc?.tot;
        const col = !z.on ? K.mu : sc != null ? scoreCol(sc) : K.bd;
        const op = !z.on ? 0.08 : sc != null ? 0.15 + (sc / 100) * 0.25 : 0.06;
        // Use corners for polygon rendering, fallback to grid rect
        const hasCorners = z.corners && z.corners.length >= 3;
        const pts = hasCorners ? z.corners.map(c => scaleX(c.x) + "," + scaleY(c.y)).join(" ") : null;
        const cent = zoneCentroid(z);
        const cx = scaleX(cent.x), cy = scaleY(cent.y);
        if (hasCorners) {
          return (
            <g key={z.id} onClick={() => onSel(z.id)} onMouseEnter={() => setHover(z.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <polygon points={pts} fill={col} opacity={op} stroke={isSel ? "#fff" : isBest ? K.gn : "transparent"} strokeWidth={isSel ? 2 : isBest ? 1.5 : 0} />
              <text x={cx} y={cy + (sc != null ? -6 : 0)} fill={"#ffffff" + (z.on ? "cc" : "44")} fontSize={10} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{z.lb}</text>
              {sc != null && <text x={cx} y={cy + 6} fill={col} fontSize={14} fontWeight={800} textAnchor="middle" dominantBaseline="middle">{sc}</text>}
              {z.sc && <text x={cx} y={cy + 18} fill={gradeCol(z.sc.gr)} fontSize={8} fontWeight={700} textAnchor="middle">{z.sc.gr}</text>}
            </g>
          );
        }
        const x = scaleX((z.c || 0) * site.sw / site.gc);
        const y = scaleY((z.r || 0) * site.sh / site.gr);
        const w = scaleD(z.bw);
        const h = scaleD(z.bh);
        return (
          <g key={z.id} onClick={() => onSel(z.id)} onMouseEnter={() => setHover(z.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={w} height={h} fill={col} opacity={op} stroke={isSel ? "#fff" : isBest ? K.gn : "transparent"} strokeWidth={isSel ? 2 : isBest ? 1.5 : 0} rx={2} />
            <text x={x + w / 2} y={y + (sc != null ? h / 2 - 6 : h / 2)} fill={"#ffffff" + (z.on ? "cc" : "44")} fontSize={10} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{z.lb}</text>
            {sc != null && <text x={x + w / 2} y={y + h / 2 + 6} fill={col} fontSize={14} fontWeight={800} textAnchor="middle" dominantBaseline="middle">{sc}</text>}
            {z.sc && <text x={x + w / 2} y={y + h / 2 + 18} fill={gradeCol(z.sc.gr)} fontSize={8} fontWeight={700} textAnchor="middle">{z.sc.gr}</text>}
          </g>
        );
      })}

      {/* FATO rectangle on best zone */}
      {bestZ && (() => {
        const bx = scaleX((bestZ.c || 0) * site.sw / site.gc);
        const by = scaleY((bestZ.r || 0) * site.sh / site.gr);
        const bw = scaleD(bestZ.bw);
        const bh = scaleD(bestZ.bh);
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const fatoW = scaleD(G.fato);
        const saW = scaleD(G.sa);
        const totW = scaleD(G.tot);

        // Approach corridors
        const heading = ori ? ori.oh : 0;
        const rad1 = (heading - 90) * DEG;
        const rad2 = (heading + 90) * DEG;
        const appLen = scaleD(Math.min(G.appLen * 0.6, Math.max(site.sw, site.sh) * 0.35));

        return (
          <g>
            {/* Safety Area */}
            <rect x={cx - totW / 2} y={cy - totW / 2} width={totW} height={totW} fill="none" stroke={K.am} strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            {/* FATO */}
            <rect x={cx - fatoW / 2} y={cy - fatoW / 2} width={fatoW} height={fatoW} fill={K.gn} fillOpacity={0.2} stroke={K.gn} strokeWidth={1.5} rx={1} />
            {/* TLOF circle */}
            <circle cx={cx} cy={cy} r={scaleD(G.tlof) / 2} fill="none" stroke={K.gn} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
            {/* H marking */}
            <text x={cx} y={cy + 1} fill={K.gn} fontSize={Math.max(8, fatoW * 0.4)} fontWeight={800} textAnchor="middle" dominantBaseline="middle" opacity={0.5}>H</text>
            {/* Approach corridors */}
            <line x1={cx} y1={cy} x2={cx + Math.cos(rad1) * appLen} y2={cy + Math.sin(rad1) * appLen} stroke={K.cy} strokeWidth={1.5} strokeDasharray="6,3" opacity={0.5} markerEnd="url(#arrowM)" />
            <line x1={cx} y1={cy} x2={cx + Math.cos(rad2) * appLen} y2={cy + Math.sin(rad2) * appLen} stroke={K.cy} strokeWidth={1.5} strokeDasharray="6,3" opacity={0.5} markerEnd="url(#arrowM)" />
            {/* Approach labels */}
            {ori && <text x={cx + Math.cos(rad1) * (appLen + 12)} y={cy + Math.sin(rad1) * (appLen + 12)} fill={K.cy} fontSize={7} fontWeight={700} textAnchor="middle">{ori.hp.split("/")[0]}</text>}
            {ori && <text x={cx + Math.cos(rad2) * (appLen + 12)} y={cy + Math.sin(rad2) * (appLen + 12)} fill={K.cy} fontSize={7} fontWeight={700} textAnchor="middle">{ori.hp.split("/")[1]}</text>}
          </g>
        );
      })()}

      {/* Obstacles on selected zone */}
      {(() => {
        const sz = zones.find(z => z.id === selId);
        if (!sz || !sz.obs.length) return null;
        const cent = zoneCentroid(sz);
        const cx = scaleX(cent.x), cy = scaleY(cent.y);
        return sz.obs.map((o, i) => {
          const hasCorn = o.corners && o.corners.length >= 3;
          const pen = o.d > 0 ? o.h > o.d / 8 : false;
          const col = pen ? K.rd : K.gn;
          if (hasCorn) {
            // Render building footprint as polygon
            const pts = o.corners.map(c => scaleX(c.x) + "," + scaleY(c.y)).join(" ");
            const centObs = { x: o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length, y: o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length };
            return (
              <g key={i}>
                <line x1={cx} y1={cy} x2={scaleX(centObs.x)} y2={scaleY(centObs.y)} stroke={col} strokeWidth={0.5} opacity={0.3} strokeDasharray="2,2" />
                <polygon points={pts} fill={col} opacity={0.2} stroke={col} strokeWidth={1} />
                <text x={scaleX(centObs.x)} y={scaleY(centObs.y) - 7} fill={col} fontSize={7} fontWeight={600} textAnchor="middle">{o.nm}</text>
              </g>
            );
          }
          // Fallback: point obstacle
          if (o.d <= 0) return null;
          const dist = scaleD(Math.min(o.d, Math.max(sz.bw, sz.bh)));
          const rad = (o.br - 90) * DEG;
          const ox = cx + Math.cos(rad) * dist;
          const oy = cy + Math.sin(rad) * dist;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={ox} y2={oy} stroke={col} strokeWidth={0.5} opacity={0.3} strokeDasharray="2,2" />
              <circle cx={ox} cy={oy} r={4} fill={col} opacity={0.8} />
              <text x={ox} y={oy - 7} fill={col} fontSize={7} fontWeight={600} textAnchor="middle">{o.nm}</text>
            </g>
          );
        });
      })()}

      {/* Exclusion zones */}
      {(site.exclusions || []).map((ex, i) => {
        const x = scaleX(ex.x || 0);
        const y = scaleY(ex.y || 0);
        const w = scaleD(ex.w || 50);
        const h = scaleD(ex.h || 50);
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={K.rd} opacity={0.12} stroke={K.rd} strokeWidth={1} strokeDasharray="4,2" rx={2} />
            <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={K.rd} strokeWidth={0.5} opacity={0.3} />
            <line x1={x + w} y1={y} x2={x} y2={y + h} stroke={K.rd} strokeWidth={0.5} opacity={0.3} />
            <text x={x + w / 2} y={y + h / 2} fill={K.rd} fontSize={7} fontWeight={600} textAnchor="middle" dominantBaseline="middle" opacity={0.7}>{ex.nm}</text>
          </g>
        );
      })}

      {/* Scale bar */}
      {(() => {
        const barM = Math.round(site.sw / 5 / 10) * 10;
        const barPx = scaleD(barM);
        return (
          <g>
            <line x1={pad + 4} y1={size - 14} x2={pad + 4 + barPx} y2={size - 14} stroke={K.dm} strokeWidth={1.5} />
            <line x1={pad + 4} y1={size - 18} x2={pad + 4} y2={size - 10} stroke={K.dm} strokeWidth={1} />
            <line x1={pad + 4 + barPx} y1={size - 18} x2={pad + 4 + barPx} y2={size - 10} stroke={K.dm} strokeWidth={1} />
            <text x={pad + 4 + barPx / 2} y={size - 6} fill={K.dm} fontSize={7} textAnchor="middle">{barM}m</text>
          </g>
        );
      })()}

      {/* Site boundary (if imported) */}
      {site.boundary && site.boundary.length >= 3 && (() => {
        const pts = site.boundary.map(p => scaleX(p.x) + "," + scaleY(p.y)).join(" ");
        return <polygon points={pts} fill="none" stroke={K.cy} strokeWidth={2} strokeDasharray="8,4" opacity={0.6} />;
      })()}

      {/* Terrain features */}
      {(site.terrainFeatures || []).filter(tf => tf.elevPeak > 0 && tf.radius > 0).map((tf, i) => {
        const cx = tf.points?.length ? scaleX(tf.points.reduce((s, p) => s + p.x, 0) / tf.points.length) : scaleX(site.sw / 2);
        const cy = tf.points?.length ? scaleY(tf.points.reduce((s, p) => s + p.y, 0) / tf.points.length) : scaleY(site.sh / 2);
        const r = scaleD(tf.radius);
        return <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={K.am} fillOpacity={0.08} stroke={K.am} strokeWidth={0.5} strokeDasharray="2,2" />
          <text x={cx} y={cy} fill={K.am} fontSize={7} fontWeight={600} textAnchor="middle">{tf.nm} {tf.elevPeak}m</text>
        </g>;
      })}

      {/* North arrow */}
      <g transform={"translate(" + (size - pad + 14) + "," + (pad + 20) + ")"}>
        <line x1={0} y1={15} x2={0} y2={-15} stroke={K.dm} strokeWidth={1.5} />
        <polygon points="0,-15 -4,-8 4,-8" fill={K.dm} />
        <text x={0} y={-19} fill={K.dm} fontSize={8} fontWeight={700} textAnchor="middle">N</text>
      </g>

      {/* Legend */}
      <text x={pad} y={pad - 8} fill={K.dm} fontSize={9} fontWeight={600}>{site.sw}m × {site.sh}m — {site.gc}×{site.gr} Grid</text>
      <text x={size - pad} y={pad - 8} fill={K.dm} fontSize={8} textAnchor="end">D={G.D}m | FATO={G.fato.toFixed(0)}m</text>

      {/* WIND PARTICLES */}
      {windSpd > 0 && Array.from({ length: 12 }, (_, i) => {
        const rad = (windDir - 90) * DEG;
        const t = ((windT + i * 17) % 200) / 200;
        const startX = pad + plotSize * (0.1 + Math.random() * 0.02 + i * 0.07);
        const startY = pad + plotSize * (0.15 + (i % 3) * 0.3);
        const px = startX + Math.cos(rad) * plotSize * 0.7 * t;
        const py = startY + Math.sin(rad) * plotSize * 0.7 * t;
        if (px < pad || px > pad + plotSize || py < pad || py > pad + plotSize) return null;
        return <circle key={i} cx={px} cy={py} r={1.5} fill={K.cy} opacity={0.15 + (1 - t) * 0.2} />;
      })}

      {/* HOVER TOOLTIP */}
      {hover && (() => {
        const hz = zones.find(z => z.id === hover);
        if (!hz) return null;
        const cent = zoneCentroid(hz);
        const tx = Math.min(scaleX(cent.x), size - 120);
        const ty = Math.max(scaleY(cent.y) - 50, 10);
        return (
          <g>
            <rect x={tx - 4} y={ty - 2} width={115} height={46} rx={4} fill={K.bg} fillOpacity={0.92} stroke={K.cy} strokeWidth={0.5} />
            <text x={tx + 2} y={ty + 10} fill={K.tx} fontSize={10} fontWeight={700}>{hz.lb} {hz.sc ? "— " + hz.sc.tot + "/100 " + hz.sc.gr : ""}</text>
            <text x={tx + 2} y={ty + 22} fill={K.dm} fontSize={8}>{hz.bw.toFixed(0)}×{hz.bh.toFixed(0)}m | {hz.obs.length} obs</text>
            <text x={tx + 2} y={ty + 32} fill={K.dm} fontSize={8}>{hz.sc?.ori ? "Hdg " + hz.sc.ori.hp + " | " + hz.sc.ori.us + "%" : hz.on ? "Not scored" : "Excluded"}</text>
            {hz.sc && <text x={tx + 2} y={ty + 42} fill={hz.sc.tot >= 70 ? K.gn : hz.sc.tot >= 50 ? K.am : K.rd} fontSize={8} fontWeight={600}>W:{hz.sc.bd.wind?.s} O:{hz.sc.bd.obs?.s} T:{hz.sc.bd.ter?.s} A:{hz.sc.bd.acc?.s} G:{hz.sc.bd.geo?.s}</text>}
          </g>
        );
      })()}

      {/* Interactive hint */}
      {onAddObs && <text x={size / 2} y={size - 3} fill={K.cy} fontSize={8} textAnchor="middle" opacity={0.5}>Double-click to add obstacle at position</text>}
    </svg>
  );
}

// ═══ CONFETTI EFFECT ═══
function Confetti({ active }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (!active) { setParticles([]); return; }
    const ps = Array.from({ length: 50 }, (_, i) => ({
      id: i, x: 50 + Math.random() * 0, y: 0,
      vx: (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 6,
      color: ["#10b981", "#06b6d4", "#f59e0b", "#2563eb", "#a78bfa", "#ef4444"][i % 6],
      size: 4 + Math.random() * 4, rot: Math.random() * 360,
    }));
    setParticles(ps);
    const timer = setTimeout(() => setParticles([]), 3000);
    return () => clearTimeout(timer);
  }, [active]);
  if (!particles.length) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      <style>{`@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
      {particles.map(p => <div key={p.id} style={{ position: "absolute", left: (50 + p.vx * 10) + "%", top: -10, width: p.size, height: p.size * 0.6, background: p.color, borderRadius: 1, animation: "confettiFall " + (2 + Math.random()) + "s ease-out forwards", animationDelay: Math.random() * 0.5 + "s", transform: "rotate(" + p.rot + "deg)" }} />)}
    </div>
  );
}

// ═══ ANIMATED SCORE COUNTER ═══
function AnimScore({ value, color, size = 32 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (typeof value !== "number") { setDisplay(value); return; }
    let start = 0;
    const duration = 800;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <span style={{ fontSize: size, fontWeight: 800, color, transition: "color 0.3s" }}>{display}</span>;
}

// ═══ LIVE OLS PREVIEW BAR ═══
function OLSBar({ height, distance, style }) {
  if (!distance || distance <= 0) return null;
  const allowable = distance / 8; // 1:8 surface
  const pct = Math.min(height / allowable * 100, 150);
  const pen = height > allowable;
  const excess = pen ? (height - allowable).toFixed(1) : 0;
  return (
    <div style={{ ...style, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9 }}>
        <div style={{ flex: 1, height: 8, background: K.rs, borderRadius: 4, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: Math.min(pct, 100) + "%", background: pen ? "linear-gradient(90deg, " + K.am + ", " + K.rd + ")" : "linear-gradient(90deg, " + K.gn + "80, " + K.gn + ")", borderRadius: 4, transition: "width 0.3s" }} />
          {/* 1:8 limit marker */}
          <div style={{ position: "absolute", left: "100%", top: -2, width: 2, height: 12, background: K.am, transform: "translateX(-1px)" }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: pen ? K.rd : K.gn, minWidth: 55 }}>
          {pen ? "PEN +" + excess + "m" : "CLEAR " + (allowable - height).toFixed(1) + "m"}
        </span>
      </div>
      <div style={{ fontSize: 8, color: K.mu, display: "flex", justifyContent: "space-between" }}>
        <span>H={height}m</span>
        <span>1:8 limit={allowable.toFixed(1)}m</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ═══ SMART SUGGESTIONS ENGINE ═══
function genSuggestions(zones, proj, site) {
  const suggestions = [];
  const rk = zones.filter(z => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
  if (!rk.length) return suggestions;
  const best = rk[0];
  const G = calcGeom(proj);

  // Wind-based heading suggestion
  if (best.sc?.ori) {
    const ori = best.sc.ori;
    if (ori.us >= 95) suggestions.push({ icon: "🎯", type: "success", text: "Heading " + ori.hp + " achieves " + ori.us + "% wind coverage — ICAO compliant" });
    else suggestions.push({ icon: "⚠", type: "warning", text: "Best heading " + ori.hp + " only " + ori.us + "% coverage (need 95%). Consider rotating FATO or reviewing wind data." });
    if (ori.xm > getXwLim(proj)) suggestions.push({ icon: "🌪", type: "danger", text: "Max crosswind " + ori.xm + "kt exceeds " + getXwLim(proj) + "kt limit for " + getHeli(proj).nm + ". Consider different aircraft or heading." });
  }

  // OLS penetrations
  const pens = best.sc?.bd?.obs?.pens?.filter(p => p.p18) || [];
  if (pens.length > 0) {
    const worst = pens.sort((a, b) => (b.h - b.d/8) - (a.h - a.d/8))[0];
    suggestions.push({ icon: "🚧", type: "danger", text: pens.length + " OLS penetration(s). Worst: " + worst.nm + " at " + worst.h + "m (limit " + (worst.d/8).toFixed(1) + "m). Options: remove obstacle, lower it, or move FATO further." });
  } else if (best.obs?.length > 0) {
    suggestions.push({ icon: "✅", type: "success", text: "All obstacles clear of 1:8 OLS surface" });
  }

  // Slope check
  if (best.ter?.slope > G.maxSlope) suggestions.push({ icon: "⛰", type: "warning", text: "Slope " + best.ter.slope + "% exceeds " + G.maxSlope + "% limit for " + (proj.pc === "pc1" ? "PC1" : "PC2/3") + ". Earthworks required." });

  // Close match
  if (rk.length >= 2 && rk[0].sc.tot - rk[1].sc.tot < 5) suggestions.push({ icon: "⚖", type: "info", text: "Close match: " + rk[0].lb + " (" + rk[0].sc.tot + ") vs " + rk[1].lb + " (" + rk[1].sc.tot + "). Review both zones in detail before deciding." });

  // Score improvement
  const weakest = Object.entries(best.sc?.bd || {}).sort((a, b) => a[1].s - b[1].s)[0];
  if (weakest && weakest[1].s < 60) {
    const names = { wind: "Wind", obs: "Obstacles", ter: "Terrain", acc: "Access", geo: "Geometry", env: "Environment" };
    suggestions.push({ icon: "💡", type: "info", text: "Weakest category: " + (names[weakest[0]] || weakest[0]) + " (" + weakest[1].s + "/100). Improving this would have the biggest impact on overall score." });
  }

  // Sensitivity
  const highSens = (best.sens || []).filter(s => s.level === "high" && s.dist < 100);
  if (highSens.length) suggestions.push({ icon: "🏘", type: "warning", text: highSens.length + " high-sensitivity zone(s) within 100m: " + highSens.map(s => s.nm).join(", ") + ". Noise mitigation may be required." });

  return suggestions;
}
function RankingBars({ zones, width = 460, height = 180 }) {
  const ranked = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
  if (!ranked.length) return null;
  const P = { t: 16, r: 16, b: 20, l: 40 };
  const W = width - P.l - P.r, H = height - P.t - P.b;
  const barH = Math.min(20, H / ranked.length - 2);
  const maxS = 100;
  return (
    <svg width={width} height={height} viewBox={"0 0 " + width + " " + height}>
      {ranked.map((z, i) => {
        const y = P.t + i * (barH + 3);
        const bw = (z.sc.tot / maxS) * W;
        const col = scoreCol(z.sc.tot);
        return (
          <g key={z.id}>
            <text x={P.l - 4} y={y + barH / 2 + 1} fill={K.dm} fontSize={9} fontWeight={600} textAnchor="end" dominantBaseline="middle">{z.lb}</text>
            <rect x={P.l} y={y} width={W} height={barH} fill={K.rs} rx={3} />
            <rect x={P.l} y={y} width={bw} height={barH} fill={col} rx={3} opacity={0.8} />
            <text x={P.l + bw + 4} y={y + barH / 2 + 1} fill={col} fontSize={9} fontWeight={700} dominantBaseline="middle">{z.sc.tot} ({z.sc.gr})</text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══ SVG: HEATMAP ═══
function Heatmap({ zones, cols, rows, width = 300, height = 300 }) {
  const scored = zones.filter(z => z.sc);
  if (!scored.length) return null;
  const maxS = 100;
  const P = 24;
  const cellW = (width - 2 * P) / cols;
  const cellH = (height - 2 * P) / rows;
  return (
    <svg width={width} height={height} viewBox={"0 0 " + width + " " + height}>
      <defs>
        <linearGradient id="hmLeg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={K.rd} /><stop offset="35%" stopColor={K.am} /><stop offset="65%" stopColor={K.bl} /><stop offset="100%" stopColor={K.gn} />
        </linearGradient>
      </defs>
      {zones.map(z => {
        const x = P + (z.c || 0) * cellW;
        const y = P + (z.r || 0) * cellH;
        if (!z.on) return <rect key={z.id} x={x + 1} y={y + 1} width={cellW - 2} height={cellH - 2} fill={K.mu} opacity={0.15} rx={3} />;
        const s = z.sc?.tot || 0;
        const t = s / maxS;
        const col = scoreCol(s);
        return (
          <g key={z.id}>
            <rect x={x + 1} y={y + 1} width={cellW - 2} height={cellH - 2} fill={col} opacity={0.2 + t * 0.6} rx={3} />
            <text x={x + cellW / 2} y={y + cellH / 2 - 5} fill="#fff" fontSize={9} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{z.lb}</text>
            {z.sc && <text x={x + cellW / 2} y={y + cellH / 2 + 8} fill="#fff" fontSize={13} fontWeight={800} textAnchor="middle" dominantBaseline="middle">{s}</text>}
          </g>
        );
      })}
      {/* Legend */}
      <rect x={P} y={height - 16} width={width - 2 * P} height={6} rx={3} fill="url(#hmLeg)" opacity={0.7} />
      <text x={P} y={height - 3} fill={K.mu} fontSize={7}>0</text>
      <text x={width - P} y={height - 3} fill={K.mu} fontSize={7} textAnchor="end">100</text>
    </svg>
  );
}

function ZGrid({ zones, sel, onSel, cols, rows, sm }) {
  const total = cols * rows;
  const isLarge = total > 64;
  const isHuge = total > 400;
  const cellH = isHuge ? 8 : isLarge ? 16 : sm ? 38 : 52;
  const gap = isHuge ? 1 : isLarge ? 1 : 3;
  const fontSize = isHuge ? 0 : isLarge ? 6 : sm ? 8 : 9;

  return (
    <div style={{ maxHeight: isLarge ? 200 : "auto", overflowY: isLarge ? "auto" : "visible", overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ", 1fr)", gap, padding: 2, minWidth: isLarge ? cols * (cellH + gap) : "auto" }}>
        {zones.map(z => {
          const s = z.sc?.tot, g = z.sc?.gr;
          const isActive = z.id === sel;
          const bg = !z.on ? K.mu : s != null ? scoreCol(s) : K.bd;
          const op = !z.on ? 0.12 : s != null ? 0.2 + (s / 100) * 0.5 : 0.12;
          return (
            <div key={z.id} onClick={() => onSel(z.id)} title={z.lb + (s != null ? " — " + s + "/100 (" + g + ")" : "")} style={{
              background: `rgba(${parseInt(bg.slice(1,3),16)},${parseInt(bg.slice(3,5),16)},${parseInt(bg.slice(5,7),16)},${op})`,
              border: isHuge ? "none" : "2px solid " + (isActive ? "#fff" : "transparent"),
              borderRadius: isHuge ? 1 : isLarge ? 3 : 6,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              cursor: "pointer", height: cellH, transition: "all 0.15s",
              boxShadow: isActive ? "0 0 8px " + bg + "50" : "none",
              outline: isHuge && isActive ? "1px solid #fff" : "none"
            }}>
              {fontSize > 0 && <span style={{ fontSize, fontWeight: 700, color: z.on ? "#ffffffcc" : "#ffffff44", lineHeight: 1 }}>{z.lb}</span>}
              {!isLarge && s != null && <span style={{ fontSize: sm ? 11 : 15, fontWeight: 800, color: "#fff", textShadow: "0 0 6px " + bg + "60" }}>{s}</span>}
              {!isLarge && g && <span style={{ fontSize: 9, fontWeight: 700, color: gradeCol(g) }}>{g}</span>}
            </div>
          );
        })}
      </div>
      {isLarge && <div style={{ fontSize: 8, color: K.mu, marginTop: 2, textAlign: "center" }}>{total} zones | Hover for details | Click to select</div>}
    </div>
  );
}

// ═══ SMALL COMPONENTS ═══
function Tag({ children, color = K.bl }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: color + "15", color, border: "1px solid " + color + "25", letterSpacing: 0.3, backdropFilter: "blur(4px)" }}>{children}</span>;
}

function ScoreBar({ label, score, weight, reasons }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: K.dm, fontWeight: 500 }}>{label} <span style={{ color: K.mu }}>({(weight * 100).toFixed(0)}%)</span></span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: scoreCol(score) }}>{score}</span>
          <span style={{ fontSize: 8, color: K.mu }}>/100</span>
        </div>
      </div>
      <div style={{ height: 6, background: K.rs, borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{ height: "100%", width: score + "%", background: "linear-gradient(90deg, " + scoreCol(score) + "cc, " + scoreCol(score) + ")", borderRadius: 3, transition: "width .5s ease-out", boxShadow: "0 0 8px " + scoreCol(score) + "40" }} />
      </div>
      {reasons && reasons.map((r, i) => <div key={i} style={{ fontSize: 9, color: K.mu, paddingLeft: 8, borderLeft: "2px solid " + scoreCol(score) + "30", marginTop: 3, lineHeight: 1.4 }}>{r}</div>)}
    </div>
  );
}

// ═══ MAIN ═══
const STEPS_DEF = [{ l: "Project", i: "📋" }, { l: "Site", i: "📍" }, { l: "Zones", i: "⬚" }, { l: "Data", i: "📊" }, { l: "Score", i: "⚡" }, { l: "Results", i: "🏆" }];

export default function App() {
  const [mode, setMode] = useState("welcome"); // "welcome" | "app"
  const emptyState = { step: 0, proj: mkProj(), site: mkSite(), zones: [], sel: null, recs: [], scored: false, tab: "overview", scenarios: [] };
  const [historyState, dp] = useReducer(undoReducer, { past: [], present: emptyState, future: [] });
  const state = historyState.present;
  const canUndo = historyState.past.length > 0;
  const canRedo = historyState.future.length > 0;
  const { step, proj, site, zones, sel, recs, scored, tab, scenarios } = state;
  const [scenarioName, setScenarioName] = useState("");
  const [compareId, setCompareId] = useState(null);
  const [obsView, setObsView] = useState("card"); // "card" | "table"

  const selZ = useMemo(() => zones.find(z => z.id === sel), [zones, sel]);

  // Auto-save
  useAutoSave("hvs-autosave", state, mode);

  // Check for auto-saved data on mount
  const [hasAutoSave, setHasAutoSave] = useState(false);
  useEffect(() => {
    loadAutoSave("hvs-autosave").then(d => { if (d) setHasAutoSave(true); });
  }, []);

  // Keyboard shortcuts: Ctrl+Z = Undo, Ctrl+Y/Ctrl+Shift+Z = Redo, Arrows = zone nav
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); dp({ type: "UNDO" }); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); dp({ type: "REDO" }); }
      // Arrow keys to navigate zones (only in data/results steps)
      if (step >= 3 && step <= 5 && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "SELECT" && document.activeElement?.tagName !== "TEXTAREA") {
        const activeZones = zones.filter(z => z.on);
        const idx = activeZones.findIndex(z => z.id === sel);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); if (idx < activeZones.length - 1) dp({ type: "SEL", payload: activeZones[idx + 1].id }); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); if (idx > 0) dp({ type: "SEL", payload: activeZones[idx - 1].id }); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, zones, sel]);
  const D = useMemo(() => getD(proj), [proj]);
  const hl = useMemo(() => getHeli(proj), [proj]);
  const G = useMemo(() => calcGeom(proj), [proj]);

  const genGrid = useCallback(() => {
    const nz = [];
    const excls = site.exclusions || [];
    for (let r = 0; r < site.gr; r++) {
      for (let c = 0; c < site.gc; c++) {
        const z = mkZone(r, c, site);
        // Check if zone center overlaps any exclusion area
        const zCx = c * z.bw + z.bw / 2;
        const zCy = r * z.bh + z.bh / 2;
        for (const ex of excls) {
          if (zCx >= (ex.x || 0) && zCx <= (ex.x || 0) + (ex.w || 0) && zCy >= (ex.y || 0) && zCy <= (ex.y || 0) + (ex.h || 0)) {
            z.on = false;
            z.excludeReason = "Overlaps: " + ex.nm;
            break;
          }
        }
        nz.push(z);
      }
    }
    dp({ type: "SZ", payload: nz });
  }, [site]);

  const canNext = useMemo(() => {
    if (step === 0) return proj.nm.trim().length > 0;
    if (step === 1) return site.nm.trim().length > 0;
    if (step === 2) return zones.length > 0;
    return true;
  }, [step, proj, site, zones]);

  const prevStep = useRef(step);
  useEffect(() => {
    if (step === 2 && prevStep.current !== 2 && zones.length === 0) genGrid();
    prevStep.current = step;
  }, [step, zones.length, genGrid]);

  const zf = (sec, fld, val) => dp({ type: "ZF", payload: { zid: sel, sec, fld, val } });
  const inp = (type, value, onChange, extra = {}) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input type={type} value={value} onChange={e => onChange(type === "number" ? (e.target.value === "" ? 0 : parseFloat(e.target.value)) : e.target.value)} min={extra.min} max={extra.max} step={extra.step} placeholder={extra.ph}
        style={{ flex: 1, background: "rgba(21,34,54,0.6)", border: "1px solid " + K.bd, borderRadius: 6, padding: "7px 10px", color: K.tx, fontSize: 13, outline: "none", transition: "border-color 0.2s, box-shadow 0.2s", backdropFilter: "blur(4px)" }}
        onFocus={e => { e.target.style.borderColor = K.cy; e.target.style.boxShadow = "0 0 0 2px " + K.cy + "20"; }}
        onBlur={e => { e.target.style.borderColor = K.bd; e.target.style.boxShadow = "none"; }} />
      {extra.suffix && <span style={{ fontSize: 11, color: K.cy, fontWeight: 600, minWidth: 16 }}>{extra.suffix}</span>}
    </div>
  );
  const sel_ = (value, onChange, options) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", background: "rgba(21,34,54,0.6)", border: "1px solid " + K.bd, borderRadius: 6, padding: "7px 10px", color: K.tx, fontSize: 13, outline: "none", cursor: "pointer", backdropFilter: "blur(4px)" }}>
      {options.map(o => <option key={typeof o === "string" ? o : o.v} value={typeof o === "string" ? o : o.v}>{typeof o === "string" ? o : o.l}</option>)}
    </select>
  );
  const lbl = (text) => {
    const isMandatory = text.includes("*");
    return <div style={{ fontSize: 10, fontWeight: 700, color: K.dm, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>{text.replace(" *", "")}{isMandatory && <span style={{ color: K.rd, marginLeft: 2 }}>*</span>}</div>;
  };
  const btn = (text, onClick, variant = "primary", disabled = false) => {
    const vs = {
      primary: { bg: "linear-gradient(135deg, #2563eb, #1d4ed8)", c: "#fff", shadow: "0 2px 8px rgba(37,99,235,0.3)" },
      accent: { bg: "linear-gradient(135deg, #10b981, #059669)", c: "#fff", shadow: "0 2px 8px rgba(16,185,129,0.3)" },
      ghost: { bg: "rgba(26,45,74,0.3)", c: K.dm, border: "1px solid " + K.bd, shadow: "none" }
    };
    const v = vs[variant] || vs.primary;
    return <button className="hvs-btn" disabled={disabled} onClick={disabled ? undefined : onClick} style={{ padding: "7px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1, background: v.bg, color: v.c, border: v.border || "none", boxShadow: disabled ? "none" : v.shadow, letterSpacing: 0.3 }}>{text}</button>;
  };
  const chk = (checked, onChange, label) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: checked ? K.tx : K.dm, transition: "color 0.2s" }}>
      <div onClick={() => onChange(!checked)} style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "linear-gradient(135deg, " + K.gn + ", #059669)" : K.bd, position: "relative", cursor: "pointer", transition: "background 0.2s", boxShadow: checked ? "0 0 6px " + K.gn + "40" : "none" }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2, left: checked ? 16 : 2, transition: "left .15s ease-out", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </div>{label}
    </label>
  );

  // ═══ STEP RENDERS ═══
  const renderProject = () => (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: K.tx, margin: "0 0 20px", paddingBottom: 10, borderBottom: "2px solid " + K.cy + "30" }}>Project Setup</h2>
      <div style={{ marginBottom: 12 }}>{lbl("Project Name *")}{inp("text", proj.nm, v => dp({ type: "UP", payload: { nm: v } }), { ph: "e.g. Hospital Helipad" })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>{lbl("Client")}{inp("text", proj.cl, v => dp({ type: "UP", payload: { cl: v } }))}</div>
        <div>{lbl("Description")}{inp("text", proj.desc, v => dp({ type: "UP", payload: { desc: v } }), { ph: "Notes..." })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>{lbl("Mode")}{sel_(proj.mode, v => dp({ type: "UP", payload: { mode: v } }), MODES)}</div>
        <div>{lbl("Facility Type")}{sel_(proj.facility, v => dp({ type: "UP", payload: { facility: v } }), FACILITY_TYPES)}</div>
        <div>{lbl("Project Type")}{sel_(proj.pt, v => dp({ type: "UP", payload: { pt: v } }), PROJ_TYPES.map(t => ({ v: t, l: t })))}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>{lbl("Performance Class")}{sel_(proj.pc, v => dp({ type: "UP", payload: { pc: v } }), Object.entries(PC_DATA).map(([k, v]) => ({ v: k, l: v.label })))}</div>
        <div>{lbl("Coord System")}{sel_(proj.coordSys, v => dp({ type: "UP", payload: { coordSys: v } }), COORD_SYS)}</div>
        <div>{lbl("Elevation Ref")}{sel_(proj.elevRef, v => dp({ type: "UP", payload: { elevRef: v } }), ELEV_REF)}</div>
      </div>
      <div style={{ marginBottom: 12 }}>{lbl("Design Aircraft")}{sel_(proj.dh, v => dp({ type: "UP", payload: { dh: v } }), HELIS.map(h => ({ v: h.id, l: h.id === "custom" ? "Custom" : h.nm + " (D=" + h.D + "m, " + h.tp + ")" })))}</div>
      {proj.dh === "custom" && <div style={{ marginBottom: 12 }}>{lbl("Custom D-Value")}{inp("number", proj.cdv, v => dp({ type: "UP", payload: { cdv: v } }), { suffix: "m", min: 3 })}</div>}
      <div style={{ background: K.pn, borderRadius: 6, padding: 10, fontSize: 11, color: K.tx }}>
        <div style={{ fontWeight: 700, color: K.dm, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>GEOMETRY (auto)</div>
        <div>FATO: {G.fato.toFixed(1)}m | TLOF: {G.tlof.toFixed(1)}m | SA: {G.sa.toFixed(1)}m | Total: {G.tot.toFixed(1)}m</div>
        <div>Approach splay: {(G.splay * 100)}% | XW limit: {getXwLim(proj)}kt ({hl.cat})</div>
        <div>Max slopes: FATO {G.maxSlope}% | SA {G.maxSA}% | Aircraft: {hl.tp === "evtol" ? "eVTOL" : "Helicopter"} {hl.len > 0 ? hl.len + "m×" + hl.wid + "m" : ""}</div>
      </div>
      {/* WORKFLOW STATUS */}
      <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.bd, marginTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 8 }}>WORKFLOW STATUS</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {WORKFLOW_STATES.map(ws => {
            const active = (proj.workflow || "draft") === ws.v;
            return (
              <div key={ws.v} onClick={() => dp({ type: "WORKFLOW", payload: ws.v })}
                style={{ flex: 1, padding: "8px 4px", borderRadius: 4, textAlign: "center", cursor: "pointer", background: active ? ws.c + "20" : K.rs, border: "2px solid " + (active ? ws.c : "transparent"), transition: "all .15s" }}>
                <div style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? ws.c : K.mu }}>{ws.l}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 9, color: K.mu }}>Click to update project status. Changes are logged automatically.</div>
      </div>
      {/* AUDIT LOG */}
      <div className="hvs-card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 6 }}>AUDIT LOG ({(proj.auditLog || []).length})</div>
        <div style={{ maxHeight: 120, overflowY: "auto" }}>
          {(proj.auditLog || []).length === 0 && <div style={{ fontSize: 9, color: K.mu, textAlign: "center", padding: 8 }}>No actions logged yet. Run analysis to start logging.</div>}
          {[...(proj.auditLog || [])].reverse().map((log, i) => (
            <div key={log.id || i} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid " + K.bd, fontSize: 9 }}>
              <span style={{ color: K.mu, minWidth: 110 }}>{new Date(log.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ color: K.cy, fontWeight: 600, minWidth: 100 }}>{log.action}</span>
              <span style={{ color: K.dm }}>{log.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSite = () => (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: K.tx, margin: "0 0 20px", paddingBottom: 10, borderBottom: "2px solid " + K.cy + "30" }}>Site Definition</h2>
      <div style={{ marginBottom: 12 }}>{lbl("Site Name *")}{inp("text", site.nm, v => dp({ type: "US", payload: { nm: v } }))}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>{lbl("Lat")}{inp("number", site.lat, v => dp({ type: "US", payload: { lat: v } }), { suffix: "°", step: 0.0001 })}</div>
        <div>{lbl("Lng")}{inp("number", site.lng, v => dp({ type: "US", payload: { lng: v } }), { suffix: "°", step: 0.0001 })}</div>
        <div>{lbl("Elev")}{inp("number", site.elev, v => dp({ type: "US", payload: { elev: v } }), { suffix: "m" })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>{lbl("Width")}{inp("number", site.sw, v => dp({ type: "US", payload: { sw: v } }), { suffix: "m", min: 30 })}</div>
        <div>{lbl("Height")}{inp("number", site.sh, v => dp({ type: "US", payload: { sh: v } }), { suffix: "m", min: 30 })}</div>
        <div>{lbl("Mag Decl")}{inp("number", site.md, v => dp({ type: "US", payload: { md: v } }), { suffix: "°" })}</div>
        <div>{lbl("Ref Temp")}{inp("number", site.rt, v => dp({ type: "US", payload: { rt: v } }), { suffix: "°C" })}</div>
      </div>
      {/* EXCLUSION ZONES */}
      <div className="hvs-card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: K.rd }}>🚫 Exclusion Zones ({(site.exclusions || []).length})</span>
          {btn("+ Add", () => dp({ type: "AEXCL" }), "ghost")}
        </div>
        {(site.exclusions || []).map((ex, i) => (
          <div key={ex.id} style={{ background: K.rs, borderRadius: 4, padding: 8, marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: K.rd }}>#{i + 1}</span>
              <button onClick={() => dp({ type: "DEXCL", payload: ex.id })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "1px 4px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div>{lbl("Name")}{inp("text", ex.nm, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "nm", val: v } }))}</div>
              <div>{lbl("Reason")}{inp("text", ex.reason, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "reason", val: v } }), { ph: "e.g. Parking structure" })}</div>
              <div>{lbl("Offset X")}{inp("number", ex.x, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "x", val: v } }), { suffix: "m" })}</div>
              <div>{lbl("Offset Y")}{inp("number", ex.y, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "y", val: v } }), { suffix: "m" })}</div>
              <div>{lbl("Width")}{inp("number", ex.w, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "w", val: v } }), { suffix: "m" })}</div>
              <div>{lbl("Height")}{inp("number", ex.h, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "h", val: v } }), { suffix: "m" })}</div>
            </div>
          </div>
        ))}
        {!(site.exclusions || []).length && <div style={{ fontSize: 9, color: K.mu, textAlign: "center", padding: 8 }}>No exclusion zones. Add restricted/no-build areas here.</div>}
      </div>
      {/* FILE IMPORT (multi-format) */}
      <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.cy + "33", marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: K.cy, marginBottom: 6 }}>📂 Import Site Data</div>
        <div style={{ fontSize: 9, color: K.dm, marginBottom: 6 }}>Supported: <strong>DXF</strong> (AutoCAD), <strong>GeoJSON</strong>, <strong>KML</strong> (Google Earth), <strong>CSV</strong> (X,Y,Z,Name,Type,Height,Width,Length), <strong>WKT</strong></div>
        <div style={{ fontSize: 8, color: K.mu, marginBottom: 4 }}>CSV columns: X,Y required | Z,Name,Type,Height,Width,Length optional | Distance,Bearing auto-calculated from X,Y</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {btn("📋 CSV Template", () => {
            const tmpl = "X,Y,Z,Name,Type,Height,Width,Length\n# ── OBSTACLES (rows with Height > 0) ──\n150.0,200.0,48.0,Water Tank,building,8,8,8\n320.0,180.0,47.5,Antenna Mast,antenna,22,2,2\n80.0,290.0,48.2,AC Plant,building,4,12,6\n400.0,150.0,47.0,Light Pole,pole,6,1,1\n250.0,350.0,46.5,Tree Line,tree,10,5,20\n# ── TERRAIN POINTS (no Height) ──\n0.0,0.0,48.5,NW Corner,,,\n500.0,0.0,47.0,NE Corner,,,\n500.0,400.0,46.0,SE Corner,,,\n0.0,400.0,47.5,SW Corner,,,\n250.0,200.0,47.8,Center,,,\n# Distance and Bearing columns are optional - auto-calculated from X,Y";
            const blob = new Blob([tmpl], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "hvs_template.csv"; a.click();
          }, "ghost")}
          {btn("📋 GeoJSON Template", () => {
            const tmpl = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Site Boundary" }, geometry: { type: "Polygon", coordinates: [[[0,0,48],[300,0,48],[300,300,47],[0,300,47.5],[0,0,48]]] } }, { type: "Feature", properties: { name: "Building A", height: 12 }, geometry: { type: "Polygon", coordinates: [[[100,100],[120,100],[120,115],[100,115],[100,100]]] } }] }, null, 2);
            const blob = new Blob([tmpl], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "hvs_template.geojson"; a.click();
          }, "ghost")}
        </div>
        <div style={{ fontSize: 8, color: K.mu, marginBottom: 8, background: K.pn, padding: "4px 6px", borderRadius: 3 }}>
          Closed polygons → site boundary (largest) / zones (medium) / obstacles (small). Points with Height column → obstacles. Points without → terrain elevation data. Auto-detects format.
        </div>
        {btn("📁 Upload File", () => {
          const input = document.createElement("input"); input.type = "file"; input.accept = ".dxf,.geojson,.json,.kml,.csv,.txt,.wkt";
          input.onchange = (e) => { const f = e.target.files[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              try {
                const parsed = parseAnyFile(ev.target.result, f.name);
                const result = importFileData(parsed, site.sw, site.sh);
                const summary = { format: parsed.format, total: parsed.count, boundary: result.boundary.length, zones: result.zones.length, obs: result.obstacles.length, terrain: result.terrainPts.length };

                // Apply boundary
                if (result.boundary.length >= 3) dp({ type: "US", payload: { boundary: result.boundary } });

                // Apply terrain
                if (result.terrainPts.length) dp({ type: "US", payload: { terrainFeatures: [...(site.terrainFeatures || []), mkTerrainFeature({ nm: "Imported terrain", tp: "surface", points: result.terrainPts, elevPeak: Math.max(...result.terrainPts.map(p => p.z)), elevBase: Math.min(...result.terrainPts.map(p => p.z)) })] } });

                // Apply zones WITH obstacles attached
                if (result.zones.length) {
                  const newZones = result.zones.map((z, i) => {
                    // Distribute obstacles to nearest zone
                    if (i === 0 && result.obstacles.length) {
                      return { ...z, obs: result.obstacles };
                    }
                    return z;
                  });
                  dp({ type: "SZ", payload: newZones });
                } else if (result.obstacles.length && zones.length) {
                  // No new zones but have obstacles — add to selected/first zone
                  const targetZ = sel || zones[0]?.id;
                  if (targetZ) {
                    const existingZ = zones.find(z => z.id === targetZ);
                    if (existingZ) {
                      const updatedZones = zones.map(z => z.id === targetZ ? { ...z, obs: [...z.obs, ...result.obstacles] } : z);
                      dp({ type: "SZ", payload: updatedZones });
                    }
                  }
                }

                dp({ type: "US", payload: { importResult: summary } });
              } catch(err) { console.error("Import error:", err); dp({ type: "US", payload: { importResult: { format: "Error", total: 0, boundary: 0, zones: 0, obs: 0, terrain: 0, error: err.message } } }); }
            };
            reader.readAsText(f);
          };
          input.click();
        }, "accent")}
        {site.importResult && <div style={{ fontSize: 9, color: site.importResult.error ? K.rd : K.gn, marginTop: 4 }}>{site.importResult.error ? "✗ Error: " + site.importResult.error : "✓ " + site.importResult.format + ": " + site.importResult.total + " items → " + (site.importResult.boundary > 0 ? site.importResult.boundary + " boundary pts, " : "") + site.importResult.zones + " zones, " + site.importResult.obs + " obstacles" + (site.importResult.terrain > 0 ? ", " + site.importResult.terrain + " terrain pts" : "")}</div>}
      </div>
      {/* SITE BOUNDARY (N-point polygon) */}
      {(site.boundary || []).length >= 3 && (
        <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.gn + "33", marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: K.gn }}>🗺 Site Boundary ({site.boundary.length} points)</span>
            {btn("Clear", () => dp({ type: "US", payload: { boundary: [] } }), "ghost")}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 60, overflowY: "auto" }}>
            {site.boundary.map((p, i) => <span key={i} style={{ fontSize: 8, color: K.dm, background: K.rs, borderRadius: 2, padding: "1px 4px" }}>{p.x.toFixed(1)},{p.y.toFixed(1)}{p.z ? "," + p.z.toFixed(1) : ""}</span>)}
          </div>
        </div>
      )}
      {/* TERRAIN FEATURES */}
      <div className="hvs-card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: K.gn }}>⛰ Terrain Features ({(site.terrainFeatures || []).length})</span>
          {btn("+ Add", () => dp({ type: "US", payload: { terrainFeatures: [...(site.terrainFeatures || []), mkTerrainFeature()] } }), "ghost")}
        </div>
        <div style={{ fontSize: 8, color: K.mu, marginBottom: 4 }}>Hills, ridges, valleys — add manually or imported from file. Peak elevation used for obstacle analysis.</div>
        {(site.terrainFeatures || []).map((tf, i) => (
          <div key={tf.id} style={{ background: K.rs, borderRadius: 4, padding: 6, marginBottom: 3 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 4, alignItems: "end" }}>
              <div>{lbl("Name")}{inp("text", tf.nm, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], nm: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); })}</div>
              <div>{lbl("Type")}{sel_(tf.tp, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], tp: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, [{ v: "hill", l: "Hill" }, { v: "ridge", l: "Ridge" }, { v: "valley", l: "Valley" }, { v: "slope", l: "Slope" }, { v: "cliff", l: "Cliff" }, { v: "surface", l: "Surface" }])}</div>
              <div>{lbl("Peak (m)")}{inp("number", tf.elevPeak, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], elevPeak: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, { suffix: "m" })}</div>
              <div>{lbl("Base (m)")}{inp("number", tf.elevBase, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], elevBase: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, { suffix: "m" })}</div>
              <div>{lbl("Radius")}{inp("number", tf.radius, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], radius: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, { suffix: "m" })}</div>
              <button onClick={() => { const nf = (site.terrainFeatures || []).filter((_, j) => j !== i); dp({ type: "US", payload: { terrainFeatures: nf } }); }} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "4px 6px", cursor: "pointer", marginBottom: 12 }}>✕</button>
            </div>
            {tf.points?.length > 0 && <div style={{ fontSize: 8, color: K.cy, marginTop: 2 }}>{tf.points.length} elevation points imported | Peak: {tf.elevPeak}m | Base: {tf.elevBase}m | Rise: {(tf.elevPeak - tf.elevBase).toFixed(1)}m</div>}
          </div>
        ))}
      </div>
    </div>
  );

  const renderZones = () => (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: K.tx, margin: "0 0 16px", paddingBottom: 10, borderBottom: "2px solid " + K.cy + "30" }}>Zones</h2>
      {/* ZONE MODE SELECTOR */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[{ v: "grid", l: "Grid (auto)", desc: "Split site into equal cells" }, { v: "manual", l: "Manual (coordinates)", desc: "Define each zone with 4 corner points" }].map(m => (
          <div key={m.v} onClick={() => dp({ type: "US", payload: { zoneMode: m.v } })}
            style={{ flex: 1, padding: 10, borderRadius: 6, cursor: "pointer", background: (site.zoneMode || "grid") === m.v ? K.bl + "18" : K.sf, border: "2px solid " + ((site.zoneMode || "grid") === m.v ? K.bl : K.bd) }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: (site.zoneMode || "grid") === m.v ? K.bl : K.dm }}>{m.l}</div>
            <div style={{ fontSize: 9, color: K.mu }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* GRID MODE */}
      {(site.zoneMode || "grid") === "grid" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, maxWidth: 400, marginBottom: 8 }}>
          <div>{lbl("Cols")}{inp("number", site.gc, v => dp({ type: "US", payload: { gc: clamp(v, 1, 100) } }), { min: 1, max: 100 })}</div>
          <div>{lbl("Rows")}{inp("number", site.gr, v => dp({ type: "US", payload: { gr: clamp(v, 1, 100) } }), { min: 1, max: 100 })}</div>
          <div>{lbl("Cell Size (m)")}{inp("number", Math.round(site.sw / site.gc), v => {
            if (v > 0) {
              const newGc = Math.max(1, Math.round(site.sw / v));
              const newGr = Math.max(1, Math.round(site.sh / v));
              dp({ type: "US", payload: { gc: newGc, gr: newGr } });
            }
          }, { suffix: "m", min: 5 })}</div>
        </div>
        <div style={{ fontSize: 9, color: K.dm, marginBottom: 4 }}>
          Site: {site.sw}m × {site.sh}m = {(site.sw * site.sh / 1e6).toFixed(3)} km² | Grid: {site.gc}×{site.gr} = {site.gc * site.gr} zones | Cell: {(site.sw / site.gc).toFixed(0)}m × {(site.sh / site.gr).toFixed(0)}m = {((site.sw / site.gc) * (site.sh / site.gr)).toFixed(0)} m²
        </div>
        {site.gc * site.gr > 100 && <div style={{ fontSize: 9, color: K.am, marginBottom: 4 }}>⚠ {site.gc * site.gr} zones — analysis may be slow. Consider larger cells or manual mode for targeted analysis.</div>}
        {site.gc * site.gr > 400 && <div style={{ fontSize: 9, color: K.rd, marginBottom: 4 }}>⚠ {site.gc * site.gr} zones — not recommended. Use Cell Size ≥ {Math.ceil(Math.max(site.sw, site.sh) / 20)}m or manual mode.</div>}
        {btn("⟳ Generate " + site.gc + "×" + site.gr + " (" + (site.gc * site.gr) + " zones)", genGrid, "ghost")}
      </>}

      {/* MANUAL MODE */}
      {(site.zoneMode || "grid") === "manual" && <>
        <div style={{ fontSize: 10, color: K.dm, marginBottom: 8 }}>Define zones by 4 corner coordinates (m from site origin). For large sites (km-scale), each zone = candidate area.</div>
        {btn("+ Add Manual Zone", () => {
          const n = zones.length;
          const label = "M" + (n + 1);
          const newZ = mkManualZone(label, [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }]);
          dp({ type: "SZ", payload: [...zones, newZ] });
        }, "ghost")}
      </>}

      <div style={{ maxWidth: 360, margin: "12px 0" }}><ZGrid zones={zones} sel={sel} onSel={v => dp({ type: "SEL", payload: v })} cols={site.gc} rows={site.gr} /></div>

      {/* ZONE LIST + CORNER EDITOR */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {zones.map(z => <div key={z.id} onClick={() => dp({ type: "TOG", payload: z.id })} style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, cursor: "pointer", background: z.on ? K.gn + "18" : K.rd + "18", color: z.on ? K.gn : K.rd }}>{z.lb} {z.on ? "✓" : "✗"} {z.bw.toFixed(0)}×{z.bh.toFixed(0)}m</div>)}
      </div>

      {/* SELECTED ZONE CORNER EDITOR */}
      {selZ && selZ.corners && selZ.corners.length >= 4 && (
        <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.bd, maxWidth: 520 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: K.cy, marginBottom: 6 }}>📐 Zone {selZ.lb} — Corner Coordinates</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {selZ.corners.map((cn, ci) => (
              <div key={ci} style={{ background: K.rs, borderRadius: 4, padding: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: K.dm, marginBottom: 2 }}>Corner {ci + 1}</div>
                <div style={{ marginBottom: 2 }}>{lbl("X (m)")}{inp("number", cn.x, v => {
                  const nc = [...selZ.corners]; nc[ci] = { ...nc[ci], x: v };
                  const xs = nc.map(c => c.x), ys = nc.map(c => c.y);
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "corners", val: nc } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bw", val: Math.max(...xs) - Math.min(...xs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bh", val: Math.max(...ys) - Math.min(...ys) } });
                })}</div>
                <div style={{ marginBottom: 2 }}>{lbl("Y (m)")}{inp("number", cn.y, v => {
                  const nc = [...selZ.corners]; nc[ci] = { ...nc[ci], y: v };
                  const xs = nc.map(c => c.x), ys = nc.map(c => c.y);
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "corners", val: nc } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bw", val: Math.max(...xs) - Math.min(...xs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bh", val: Math.max(...ys) - Math.min(...ys) } });
                })}</div>
                <div>{lbl("Z (elev m)")}{inp("number", cn.z || 0, v => {
                  const nc = [...selZ.corners]; nc[ci] = { ...nc[ci], z: v };
                  const zs = nc.map(c => c.z || 0);
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "corners", val: nc } });
                  dp({ type: "ZF", payload: { zid: selZ.id, sec: "ter", fld: "elevMin", val: Math.min(...zs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, sec: "ter", fld: "elevMax", val: Math.max(...zs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, sec: "ter", fld: "elevAvg", val: Math.round(zs.reduce((a,b)=>a+b,0)/zs.length*10)/10 } });
                })}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: K.mu, marginTop: 4 }}>Area: {zoneArea(selZ).toFixed(0)} m² ({(zoneArea(selZ) / 1e6).toFixed(3)} km²) | Min side: {Math.min(selZ.bw, selZ.bh).toFixed(0)}m | FATO+SA: {G.tot.toFixed(1)}m needed{selZ.corners.some(c => c.z) ? " | Elev: " + Math.min(...selZ.corners.map(c => c.z || 0)).toFixed(1) + "–" + Math.max(...selZ.corners.map(c => c.z || 0)).toFixed(1) + "m AMSL (Δ" + (Math.max(...selZ.corners.map(c => c.z || 0)) - Math.min(...selZ.corners.map(c => c.z || 0))).toFixed(1) + "m)" : ""}</div>
        </div>
      )}
    </div>
  );

  const [dataTab, setDataTab] = useState("wind"); // wind | obs | terrain | access | sens

  // Zone data completeness checker
  const zoneCompleteness = (z) => {
    const checks = {
      wind: z.wind.ps > 0,
      obs: z.obs.length > 0,
      terrain: z.ter.slope > 0 || z.ter.elevPts > 0,
      access: z.acc.rd > 0 || (z.acc.nodes || []).length > 0,
      sens: (z.sens || []).length > 0,
    };
    const filled = Object.values(checks).filter(Boolean).length;
    return { ...checks, pct: Math.round(filled / 5 * 100), filled, total: 5 };
  };

  const renderData = () => {
    if (!selZ) return <div className="hvs-card" style={{ padding: 20, textAlign: "center" }}><p style={{ color: K.dm }}>Select a zone to begin data input</p></div>;
    const z = selZ;
    const comp = zoneCompleteness(z);
    const dataTabs = [
      { id: "wind", l: "💨 Wind", done: comp.wind },
      { id: "obs", l: "🚧 Obstacles", done: comp.obs },
      { id: "terrain", l: "⛰ Terrain", done: comp.terrain },
      { id: "access", l: "🛣 Access", done: comp.access },
      { id: "sens", l: "🏘 Sensitivity", done: comp.sens },
    ];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px", letterSpacing: -0.3 }}>Data Input</h2>
          {/* ZONE GRID WITH COMPLETENESS */}
          <div style={{ marginBottom: 10 }}>
            <ZGrid zones={zones} sel={sel} onSel={v => dp({ type: "SEL", payload: v })} cols={site.gc} rows={site.gr} sm />
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
              {zones.filter(zz => zz.on).map(zz => {
                const c = zoneCompleteness(zz);
                return <div key={zz.id} onClick={() => dp({ type: "SEL", payload: zz.id })} style={{ padding: "2px 5px", borderRadius: 3, fontSize: 9, cursor: "pointer", background: zz.id === sel ? K.cy + "20" : c.pct === 100 ? K.gn + "12" : c.pct > 0 ? K.am + "12" : K.rd + "08", color: c.pct === 100 ? K.gn : c.pct > 0 ? K.am : K.mu, fontWeight: zz.id === sel ? 700 : 400, border: zz.id === sel ? "1px solid " + K.cy : "1px solid transparent" }}>{zz.lb} {c.pct}%</div>;
              })}
            </div>
          </div>
          {/* SELECTED ZONE INFO */}
          <div className="hvs-card" style={{ padding: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>{z.lb}</div>
            <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>{z.bw.toFixed(0)}×{z.bh.toFixed(0)}m | {zoneArea(z).toFixed(0)} m²</div>
            <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
              <Tag color={z.on ? K.gn : K.rd}>{z.on ? "CANDIDATE" : "EXCLUDED"}</Tag>
              <Tag color={comp.pct === 100 ? K.gn : comp.pct > 0 ? K.am : K.rd}>{comp.filled}/{comp.total}</Tag>
            </div>
            {z.excludeReason && <div style={{ fontSize: 9, color: K.rd, marginTop: 3 }}>{z.excludeReason}</div>}
            {/* Quick actions */}
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
              {zones.filter(zz => zz.on).length > 1 && comp.filled > 0 && btn("📋 Fill ALL zones from " + z.lb, () => {
                ["wind", "terrain", "access"].forEach(sec => dp({ type: "APPLY_ALL", payload: { section: sec, fromZid: z.id } }));
              }, "ghost")}
              {zones.filter(zz => zz.on && zz.id !== z.id && zoneCompleteness(zz).pct > comp.pct).length > 0 && (() => {
                const best = zones.filter(zz => zz.on && zz.id !== z.id).sort((a, b) => zoneCompleteness(b).pct - zoneCompleteness(a).pct)[0];
                return best && zoneCompleteness(best).pct > 0 ? btn("⬇ Copy from " + best.lb + " (" + zoneCompleteness(best).pct + "%)", () => {
                  ["wind", "terrain", "access"].forEach(sec => {
                    const src = best;
                    if (sec === "wind") { Object.keys(src.wind).forEach(k => zf("wind", k, src.wind[k])); zf("src", "wind", src.src?.wind || "assumed"); }
                    if (sec === "terrain") { Object.keys(src.ter).forEach(k => zf("ter", k, src.ter[k])); zf("src", "terrain", src.src?.terrain || "assumed"); }
                    if (sec === "access") { Object.keys(src.acc).forEach(k => { if (k !== "nodes") zf("acc", k, src.acc[k]); }); zf("src", "access", src.src?.access || "assumed"); }
                  });
                }, "ghost") : null;
              })()}
            </div>
            {/* Data checklist */}
            <div style={{ marginTop: 6 }}>
              {dataTabs.map(t => (
                <div key={t.id} onClick={() => setDataTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", cursor: "pointer", fontSize: 10, color: dataTab === t.id ? K.cy : K.dm }}>
                  <span style={{ color: t.done ? K.gn : K.rd }}>{t.done ? "✓" : "○"}</span>
                  <span>{t.l}</span>
                </div>
              ))}
            </div>
          </div>
          {/* CONFIDENCE */}
          {(() => {
            const conf = calcConfidence(z);
            return (
              <div className="hvs-card" style={{ padding: 10, marginTop: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: K.dm, letterSpacing: 1.2, marginBottom: 4 }}>DATA CONFIDENCE</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: conf.gradeColor, textShadow: "0 0 10px " + conf.gradeColor + "30" }}>{conf.overall}%</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: conf.gradeColor }}>{conf.grade}</span>
                </div>
                <div style={{ height: 4, background: K.rs, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: conf.overall + "%", background: conf.gradeColor, borderRadius: 2 }} />
                </div>
                {["wind", "obstacles", "terrain", "access"].map(cat => {
                  const d = conf.details[cat];
                  return (
                    <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", fontSize: 9 }}>
                      <span style={{ color: K.dm, textTransform: "capitalize" }}>{cat}</span>
                      <span style={{ color: d.color, fontWeight: 600 }}>{d.icon} {d.srcLabel.split("/")[0]}</span>
                    </div>
                  );
                })}
                {conf.flags.length > 0 && <div style={{ marginTop: 4 }}>{conf.flags.map((f, i) => <div key={i} style={{ fontSize: 8, color: K.rd, marginTop: 2 }}>⚠ {f}</div>)}</div>}
              </div>
            );
          })()}
        </div>
        <div style={{ maxHeight: "68vh", overflowY: "auto", paddingRight: 4 }}>
          {/* SECTION TABS */}
          <div style={{ display: "flex", gap: 2, marginBottom: 10, background: K.pn, borderRadius: 6, padding: 2, position: "sticky", top: 0, zIndex: 10 }}>
            {[
              { id: "wind", l: "💨 Wind", done: comp.wind },
              { id: "obs", l: "🚧 Obstacles", done: comp.obs, count: z.obs.length },
              { id: "terrain", l: "⛰ Terrain", done: comp.terrain },
              { id: "access", l: "🛣 Access", done: comp.access },
              { id: "sens", l: "🏘 Sens", done: comp.sens, count: (z.sens || []).length },
            ].map(t => (
              <div key={t.id} onClick={() => setDataTab(t.id)} style={{ flex: 1, padding: "6px 4px", borderRadius: 4, fontSize: 10, fontWeight: dataTab === t.id ? 700 : 400, cursor: "pointer", background: dataTab === t.id ? K.bl : "transparent", color: dataTab === t.id ? "#fff" : K.dm, textAlign: "center", transition: "all 0.15s", position: "relative" }}>
                {t.l}{t.count > 0 ? " (" + t.count + ")" : ""}
                <div style={{ position: "absolute", top: 2, right: 4, width: 6, height: 6, borderRadius: 3, background: t.done ? K.gn : K.rd + "40" }} />
              </div>
            ))}
          </div>

          {/* WIND TAB */}
          {dataTab === "wind" && <>
          <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: K.cy }}>💨 Wind</span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {zones.filter(zz => zz.on && zz.id !== z.id && zz.wind.ps > 0).length > 0 && <>
                  <select onChange={e => { if (!e.target.value) return; const src = zones.find(zz => zz.id === e.target.value); if (src) { Object.keys(src.wind).forEach(k => zf("wind", k, src.wind[k])); zf("src", "wind", src.src?.wind || "assumed"); } e.target.value = ""; }} style={{ background: K.rs, border: "1px solid " + K.bd, borderRadius: 4, padding: "3px 6px", color: K.tx, fontSize: 9, cursor: "pointer" }}>
                    <option value="">Copy from...</option>
                    {zones.filter(zz => zz.on && zz.id !== z.id && zz.wind.ps > 0).map(zz => <option key={zz.id} value={zz.id}>{zz.lb}</option>)}
                  </select>
                </>}
                {zones.filter(zz => zz.on).length > 1 && btn("📋 Apply to all zones", () => dp({ type: "APPLY_ALL", payload: { section: "wind", fromZid: z.id } }), "ghost")}
              </div>
            </div>
            <div style={{ fontSize: 8, color: K.mu, marginBottom: 6 }}>Wind data is typically the same across all zones on a single site. Fill once then "Apply to all zones".</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: K.dm }}>Data Source:</span>
              {sel_(z.src?.wind || "assumed", v => zf("src", "wind", v), SRC_OPTIONS)}
            </div>
            <div style={{ fontSize: 10, color: K.cy, fontWeight: 600, marginBottom: 4 }}>PRIMARY WIND <Tip text="The wind direction that occurs most frequently at this site. Direction = where the wind comes FROM, measured clockwise from North. E.g. 340° = from the NNW.">(most frequent direction)</Tip></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div>{lbl("Direction (°from N) *")}<Tip text="Compass bearing where wind blows FROM. 0°=North, 90°=East, 180°=South, 270°=West">{inp("number", z.wind.pd, v => zf("wind", "pd", v), { suffix: "°", min: 0, max: 360 })}</Tip></div>
              <div>{lbl("Speed (knots) *")}<Tip text="Average wind speed in knots. 1 knot = 1.852 km/h = 0.514 m/s">{inp("number", z.wind.ps, v => zf("wind", "ps", v), { suffix: "kt" })}</Tip></div>
              <div>{lbl("Frequency (%) *")}<Tip text="Percentage of time wind blows from this direction. E.g. 45% means the primary wind occurs 45% of the year.">{inp("number", z.wind.pf, v => zf("wind", "pf", v), { suffix: "%" })}</Tip></div>
            </div>
            <div style={{ fontSize: 10, color: K.am, fontWeight: 600, marginBottom: 4 }}>SECONDARY WIND (second most frequent)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div>{lbl("Direction (°from N)")}{inp("number", z.wind.sd, v => zf("wind", "sd", v), { suffix: "°", min: 0, max: 360 })}</div>
              <div>{lbl("Speed (knots)")}{inp("number", z.wind.ss, v => zf("wind", "ss", v), { suffix: "kt" })}</div>
              <div>{lbl("Frequency (%)")}{inp("number", z.wind.sf, v => zf("wind", "sf", v), { suffix: "%" })}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div>{lbl("Calm (no wind) %")}{inp("number", z.wind.calm, v => zf("wind", "calm", v), { suffix: "%" })}</div>
              <div>{lbl("Seasonal Variation")}{sel_(z.wind.seasonal || "none", v => zf("wind", "seasonal", v), [{ v: "none", l: "None — constant year-round" }, { v: "mild", l: "Mild — minor seasonal shift" }, { v: "moderate", l: "Moderate — notable changes" }, { v: "strong", l: "Strong — major seasonal reversal" }])}</div>
            </div>
            {z.wind.seasonal && z.wind.seasonal !== "none" && <div style={{ fontSize: 9, color: K.am, marginTop: 4, padding: "3px 6px", background: K.am + "10", borderRadius: 3 }}>⚠ Seasonal variation noted — consider separate summer/winter analysis for detailed design</div>}
            {(() => {
              const total = (z.wind.pf || 0) + (z.wind.sf || 0) + (z.wind.calm || 0);
              if (total > 0 && Math.abs(total - 100) > 5) return <div style={{ fontSize: 10, color: total > 100 ? K.rd : K.am, marginTop: 4, padding: "4px 8px", background: (total > 100 ? K.rd : K.am) + "10", borderRadius: 3 }}>{total > 100 ? "⚠ Frequencies exceed 100%: " : "⚠ Frequencies sum to only "}{total.toFixed(0)}% (Primary {z.wind.pf}% + Secondary {z.wind.sf}% + Calm {z.wind.calm}%){total < 100 ? ". Remaining " + (100 - total).toFixed(0) + "% is unaccounted wind from other directions." : ". Please check values."}</div>;
              return null;
            })()}
            {/* WIND VISUAL SUMMARY */}
            {z.wind.ps > 0 && (() => {
              const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
              const pdIdx = Math.round(z.wind.pd / 22.5) % 16;
              const sdIdx = z.wind.ss > 0 ? Math.round(z.wind.sd / 22.5) % 16 : -1;
              const coverage = (z.wind.pf || 0) + (z.wind.sf || 0) + (z.wind.calm || 0);
              return (
                <div style={{ marginTop: 8, padding: "8px 10px", background: K.pn, borderRadius: 6 }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    {/* Mini compass */}
                    <svg width={70} height={70} viewBox="0 0 70 70">
                      <circle cx={35} cy={35} r={30} fill="none" stroke={K.bd} strokeWidth={1} />
                      {["N","E","S","W"].map((d, i) => <text key={d} x={35 + 28 * Math.sin(i * Math.PI/2)} y={35 - 28 * Math.cos(i * Math.PI/2) + 3} fill={K.mu} fontSize={7} textAnchor="middle">{d}</text>)}
                      {/* Primary wind arrow */}
                      <line x1={35} y1={35} x2={35 + 22 * Math.sin(z.wind.pd * DEG)} y2={35 - 22 * Math.cos(z.wind.pd * DEG)} stroke={K.cy} strokeWidth={2.5} markerEnd="url(#arrowP)" />
                      {/* Secondary wind arrow */}
                      {z.wind.ss > 0 && <line x1={35} y1={35} x2={35 + 16 * Math.sin(z.wind.sd * DEG)} y2={35 - 16 * Math.cos(z.wind.sd * DEG)} stroke={K.am} strokeWidth={1.5} strokeDasharray="3,2" />}
                      <defs><marker id="arrowP" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4Z" fill={K.cy} /></marker></defs>
                    </svg>
                    {/* Summary text */}
                    <div style={{ flex: 1, fontSize: 11 }}>
                      <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                        <div><span style={{ color: K.cy, fontWeight: 700 }}>Primary:</span> <span style={{ color: K.tx }}>{dirs[pdIdx]} ({z.wind.pd}°)</span> at <strong>{z.wind.ps}kt</strong> — {z.wind.pf}% of time</div>
                      </div>
                      {z.wind.ss > 0 && <div style={{ marginBottom: 4 }}>
                        <span style={{ color: K.am, fontWeight: 700 }}>Secondary:</span> <span style={{ color: K.tx }}>{dirs[sdIdx]} ({z.wind.sd}°)</span> at <strong>{z.wind.ss}kt</strong> — {z.wind.sf}% of time
                      </div>}
                      <div style={{ color: K.dm }}>Calm: {z.wind.calm}% | Coverage: <span style={{ color: coverage >= 95 ? K.gn : coverage >= 85 ? K.am : K.rd, fontWeight: 700 }}>{coverage}%</span> {coverage >= 95 ? "✓ ICAO compliant" : coverage >= 85 ? "⚠ Near limit" : "✗ Below 95% minimum"}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          </>}

          {/* OBSTACLES TAB */}
          {dataTab === "obs" && <>
          {/* OBSTACLES */}
          <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: K.am }}>🚧 Obstacles ({z.obs.length})</span>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <div style={{ display: "flex", background: K.pn, borderRadius: 4, padding: 1 }}>
                  {[{ v: "card", l: "Cards" }, { v: "table", l: "Table" }].map(m => (
                    <div key={m.v} onClick={() => setObsView(m.v)} style={{ padding: "3px 8px", borderRadius: 3, fontSize: 10, fontWeight: obsView === m.v ? 700 : 400, cursor: "pointer", background: obsView === m.v ? K.bl : "transparent", color: obsView === m.v ? "#fff" : K.dm }}>{m.l}</div>
                  ))}
                </div>
                {btn("+ Add", () => dp({ type: "AO", payload: z.id }), "ghost")}
                {btn("📋 Paste", async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (!text.trim()) return;
                    const lines = text.trim().split(/\r?\n/).filter(l => l.trim() && !l.trim().toLowerCase().startsWith("name") && !l.trim().toLowerCase().startsWith("x,"));
                    for (const line of lines) {
                      const c = line.split(/\t|,/).map(s => s.trim());
                      if (c.length < 3) continue;
                      const isXY = !isNaN(parseFloat(c[0])) && !isNaN(parseFloat(c[1])) && c.length >= 6;
                      const o = isXY
                        ? mkObs({ x: parseFloat(c[0])||0, y: parseFloat(c[1])||0, elevAMSL: parseFloat(c[2])||0, nm: c[3]||"Obs", tp: c[4]||"building", h: parseFloat(c[5])||0, w: parseFloat(c[6])||0, l: parseFloat(c[7])||0 })
                        : mkObs({ nm: c[0]||"Obs", tp: c[1]||"building", h: parseFloat(c[2])||0, w: parseFloat(c[3])||0, l: parseFloat(c[4])||0, x: parseFloat(c[5])||0, y: parseFloat(c[6])||0 });
                      dp({ type: "SZ", payload: zones.map(zz => zz.id !== z.id ? zz : { ...zz, obs: [...zz.obs, o] }) });
                    }
                  } catch(e) { console.error("Paste:", e); }
                }, "ghost")}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: K.dm }}>Source:</span>
                {sel_(z.src?.obstacles || "assumed", v => zf("src", "obstacles", v), SRC_OPTIONS)}
              </div>
            </div>
            {z.obs.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, background: K.pn, borderRadius: 8 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🚧</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>No obstacles added</div>
                <div style={{ fontSize: 10, color: K.dm, marginBottom: 10, lineHeight: 1.5 }}>
                  Add obstacles one by one, or <strong>paste from Excel</strong>:<br/>
                  Copy rows in format: <span style={{ color: K.cy, fontFamily: "monospace" }}>Name, Type, Height, Width, Length, X, Y</span><br/>
                  or: <span style={{ color: K.cy, fontFamily: "monospace" }}>X, Y, Z, Name, Type, Height, W, L</span>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  {btn("+ Add Obstacle", () => dp({ type: "AO", payload: z.id }), "primary")}
                  {btn("+ Add 5 Empty", () => { for (let i = 0; i < 5; i++) dp({ type: "AO", payload: z.id }); }, "ghost")}
                </div>
              </div>
            )}

            {/* TABLE MODE */}
            {obsView === "table" && z.obs.length > 0 && (
              <div style={{ overflowX: "auto", marginBottom: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid " + K.bd }}>
                      {["#", "Name", "Type", "H (m)", "W", "L", "X", "Y", "Dist", "Brg", "AMSL", "Perm", "Conf", ""].map(h => (
                        <th key={h} style={{ padding: "4px 4px", textAlign: "left", color: K.dm, fontWeight: 700, fontSize: 8, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {z.obs.map((o, i) => {
                      const uo = (fld, val) => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld, val } });
                      const cellSt = { padding: "2px 2px", borderBottom: "1px solid " + K.bd };
                      const miniInp = (val, fld, w) => <input type="number" value={val} onChange={e => uo(fld, e.target.value === "" ? 0 : parseFloat(e.target.value))} style={{ width: w || 45, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "3px 4px", color: K.tx, fontSize: 10, outline: "none" }} />;
                      const pen = o.d > 0 ? o.h > o.d / 8 : false;
                      return (
                        <tr key={o.id} style={{ background: pen ? K.rd + "08" : "transparent" }}>
                          <td style={cellSt}><span style={{ fontSize: 9, color: K.mu }}>{i + 1}</span></td>
                          <td style={cellSt}><input type="text" value={o.nm} onChange={e => uo("nm", e.target.value)} style={{ width: 80, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "3px 4px", color: K.tx, fontSize: 10, outline: "none" }} /></td>
                          <td style={cellSt}><select value={o.tp} onChange={e => uo("tp", e.target.value)} style={{ width: 65, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "3px 2px", color: K.tx, fontSize: 9 }}>{OBS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                          <td style={{ ...cellSt, fontWeight: 700, color: pen ? K.rd : K.gn }}>{miniInp(o.h, "h", 40)}</td>
                          <td style={cellSt}>{miniInp(o.w || 0, "w", 35)}</td>
                          <td style={cellSt}>{miniInp(o.l || 0, "l", 35)}</td>
                          <td style={cellSt}>{miniInp(o.x || 0, "x", 45)}</td>
                          <td style={cellSt}>{miniInp(o.y || 0, "y", 45)}</td>
                          <td style={cellSt}><span style={{ fontSize: 9, color: K.cy }}>{o.d?.toFixed(0) || 0}</span></td>
                          <td style={cellSt}><span style={{ fontSize: 9, color: K.cy }}>{o.br || 0}°</span></td>
                          <td style={cellSt}>{miniInp(o.elevAMSL || 0, "elevAMSL", 40)}</td>
                          <td style={cellSt}><input type="checkbox" checked={o.perm} onChange={e => uo("perm", e.target.checked)} /></td>
                          <td style={cellSt}><select value={String(o.confidence || 50)} onChange={e => uo("confidence", parseInt(e.target.value))} style={{ width: 42, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "2px 1px", color: K.tx, fontSize: 9 }}>{["100","80","50","20"].map(v => <option key={v} value={v}>{v}%</option>)}</select></td>
                          <td style={cellSt}><button onClick={() => dp({ type: "DO", payload: { zid: z.id, oid: o.id } })} style={{ background: "none", color: K.rd, border: "none", fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 8, color: K.mu, marginTop: 4 }}>Dist/Brg auto-calculated from X,Y. Edit X or Y to update. Red rows = penetrates 1:8 OLS.</div>
              </div>
            )}

            {/* CARD MODE */}
            {obsView === "card" && <>
            {z.obs.map((o, i) => (
              <div key={o.id} style={{ background: K.rs, borderRadius: 4, padding: 8, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700 }}>#{i + 1}</span>
                  <button onClick={() => dp({ type: "DO", payload: { zid: z.id, oid: o.id } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "1px 4px", cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  <div>{lbl("Name *")}{inp("text", o.nm, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "nm", val: v } }))}</div>
                  <div>{lbl("Type *")}{sel_(o.tp, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "tp", val: v } }), OBS_TYPES.map(t => ({ v: t, l: t })))}</div>
                  <div>{lbl("Confidence")}{sel_(String(o.confidence || 50), v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "confidence", val: parseInt(v) } }), ["100","80","50","20"].map(v => ({ v, l: v + "%" })))}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 4 }}>
                  <div>{lbl("Height AGL *")}<Tip text="Height Above Ground Level in meters. This is the obstacle's height from its base, NOT its elevation. Critical for OLS penetration check.">{inp("number", o.h, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "h", val: v } }), { suffix: "m" })}</Tip></div>
                  <div>{lbl("Elev AMSL")}{inp("number", o.elevAMSL || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "elevAMSL", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Total Height")}<div style={{ padding: "6px 8px", background: K.pn, borderRadius: 4, color: K.cy, fontSize: 12, fontWeight: 700 }}>{((o.elevAMSL || 0) + o.h).toFixed(1)}m AMSL</div></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 4 }}>
                  <div>{lbl("Width")}{inp("number", o.w || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "w", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Length")}{inp("number", o.l || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "l", val: v } }), { suffix: "m" })}</div>
                  <div style={{ paddingTop: 12, fontSize: 9, color: K.dm }}>{o.w > 0 && o.l > 0 ? "Footprint: " + (o.w * o.l).toFixed(0) + " m²" : "Set W×L for 3D view"}</div>
                </div>
                <div style={{ background: K.cy + "06", border: "1px solid " + K.cy + "15", borderRadius: 4, padding: 6, marginTop: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: K.cy, marginBottom: 4, letterSpacing: 0.5 }}>📍 POSITION (auto-linked: edit either pair)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    <div>{lbl("X (m)")}{inp("number", o.x || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "x", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Y (m)")}{inp("number", o.y || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "y", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Distance")}{inp("number", o.d, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "d", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Bearing (°N)")}{inp("number", o.br, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "br", val: v } }), { suffix: "°" })}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {chk(o.perm, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "perm", val: v } }), "Permanent")}
                    {chk(o.lit || false, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "lit", val: v } }), "Lit/Marked")}
                    {chk(o.verified || false, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "verified", val: v } }), "Verified")}
                  </div>
                </div>
                {/* POLYGON CORNERS (for building footprint — nearest corner used for OLS) */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: K.dm }}>Building Footprint (4 corners — optional, uses nearest corner for OLS)</span>
                    {!o.corners?.length && <button onClick={() => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: [{ x: (o.x || 0) - 10, y: (o.y || 0) - 10 }, { x: (o.x || 0) + 10, y: (o.y || 0) - 10 }, { x: (o.x || 0) + 10, y: (o.y || 0) + 10 }, { x: (o.x || 0) - 10, y: (o.y || 0) + 10 }] } })} style={{ background: K.cy + "18", color: K.cy, border: "1px solid " + K.cy + "33", borderRadius: 3, fontSize: 8, padding: "2px 6px", cursor: "pointer" }}>+ Add 4 Corners</button>}
                    {o.corners?.length >= 4 && <button onClick={() => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: [] } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "2px 6px", cursor: "pointer" }}>Clear Corners</button>}
                  </div>
                  {o.corners && o.corners.length >= 4 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 3, marginTop: 4 }}>
                      {o.corners.map((cn, ci) => (
                        <div key={ci} style={{ background: K.pn, borderRadius: 3, padding: "3px 4px" }}>
                          <div style={{ fontSize: 8, color: K.dm, fontWeight: 700, marginBottom: 2 }}>C{ci + 1}</div>
                          {inp("number", cn.x, v => { const nc = [...o.corners]; nc[ci] = { ...nc[ci], x: v }; dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: nc } }); }, { suffix: "x", ph: "X" })}
                          <div style={{ height: 2 }} />
                          {inp("number", cn.y, v => { const nc = [...o.corners]; nc[ci] = { ...nc[ci], y: v }; dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: nc } }); }, { suffix: "y", ph: "Y" })}
                        </div>
                      ))}
                    </div>
                  )}
                  {o.corners && o.corners.length >= 4 && (() => {
                    const cent = zoneCentroid(z);
                    const nd = obsNearestDist(o, cent.x, cent.y);
                    return <div style={{ fontSize: 8, color: K.cy, marginTop: 2 }}>Nearest corner: {nd.toFixed(1)}m from zone center (this distance used for OLS check)</div>;
                  })()}
                </div>
                {!o.perm && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                  <div>{lbl("Start Date")}{inp("text", o.startDate || "", v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "startDate", val: v } }), { ph: "YYYY-MM" })}</div>
                  <div>{lbl("End Date")}{inp("text", o.endDate || "", v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "endDate", val: v } }), { ph: "YYYY-MM" })}</div>
                </div>}
                {o.d > 0 && <>
                  <OLSBar height={o.h} distance={o.d} />
                  <div style={{ fontSize: 9, color: K.mu, display: "flex", gap: 8, marginTop: 2 }}>
                    <span>H/D: {(o.h / o.d).toFixed(4)}</span>
                    <span>Total: {((o.elevAMSL || 0) + o.h).toFixed(1)}m AMSL</span>
                    {o.verified ? <span style={{ color: K.gn }}>✓ Verified</span> : <span style={{ color: K.am }}>? Unverified</span>}
                  </div>
                </>}
              </div>
            ))}
            </>}
          </div>
          </>}

          {/* TERRAIN TAB */}
          {dataTab === "terrain" && <>
          {/* TERRAIN */}
          <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: K.gn }}>⛰ Terrain</span>
              {zones.filter(zz => zz.on).length > 1 && btn("📋 Apply to all", () => dp({ type: "APPLY_ALL", payload: { section: "terrain", fromZid: z.id } }), "ghost")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: K.dm }}>Data Source:</span>
              {sel_(z.src?.terrain || "assumed", v => zf("src", "terrain", v), SRC_OPTIONS)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div>{lbl("Slope * (%)")}<Tip text="Maximum ground slope across the zone as percentage. ICAO limit: 2% for PC1, 3% for PC2/3. Measured by survey or estimated from contour maps.">{inp("number", z.ter.slope, v => zf("ter", "slope", v), { suffix: "%" })}</Tip></div>
              <div>{lbl("Slope Dir (°)")}<Tip text="Direction of maximum slope, clockwise from North. E.g. 180° = slope falls toward south.">{inp("number", z.ter.slopeDir || 0, v => zf("ter", "slopeDir", v), { suffix: "°", min: 0, max: 360 })}</Tip></div>
              <div>{lbl("Side Slope (%)")}{inp("number", z.ter.side, v => zf("ter", "side", v), { suffix: "%" })}</div>
              <div>{lbl("Cut/Fill")}{inp("number", z.ter.cf, v => zf("ter", "cf", v), { suffix: "m" })}</div>
            </div>
            {z.ter.slope > 0 && (z.ter.slopeDir || 0) > 0 && (() => {
              const d = decomposeSlope(z.ter.slope, z.ter.slopeDir, 0);
              return <div style={{ fontSize: 9, color: K.cy, background: K.cy + "10", padding: "4px 6px", borderRadius: 3, marginBottom: 6 }}>
                Slope {z.ter.slope}% at {z.ter.slopeDir}° → Long: {d.longitudinal}% | Trans: {d.transverse}% (relative to N, recalculated at scoring vs FATO heading) | Max FATO: {G.maxSlope}%
              </div>;
            })()}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div>{lbl("Elev Min")}{inp("number", z.ter.elevMin || 0, v => zf("ter", "elevMin", v), { suffix: "m" })}</div>
              <div>{lbl("Elev Max")}{inp("number", z.ter.elevMax || 0, v => zf("ter", "elevMax", v), { suffix: "m" })}</div>
              <div>{lbl("Elev Avg")}{inp("number", z.ter.elevAvg || 0, v => zf("ter", "elevAvg", v), { suffix: "m" })}</div>
              <div>{lbl("Data Pts")}{inp("number", z.ter.elevPts || 0, v => zf("ter", "elevPts", v))}</div>
            </div>
            {(z.ter.elevMin > 0 || z.ter.elevMax > 0) && <div style={{ fontSize: 9, color: K.mu, background: K.pn, padding: "3px 6px", borderRadius: 3, marginBottom: 6 }}>
              Elevation range: {z.ter.elevMin}–{z.ter.elevMax}m ({(z.ter.elevMax - z.ter.elevMin).toFixed(1)}m diff) | Avg: {z.ter.elevAvg}m{z.ter.elevPts > 0 ? " | " + z.ter.elevPts + " survey points" : ""}
            </div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div>{lbl("Soil")}{sel_(z.ter.soil, v => zf("ter", "soil", v), SOIL_DATA.map(s => ({ v: s.value, l: s.label + " (CBR " + s.cbr + ")" })))}</div>
              <div style={{ paddingTop: 12 }}>{chk(z.ter.flood, v => zf("ter", "flood", v), "Flood Risk")}</div>
            </div>
          </div>
          </>}

          {/* ACCESS TAB */}
          {dataTab === "access" && <>
          {/* ACCESS */}
          <div className="hvs-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: K.bl }}>🛣 Access</span>
              {zones.filter(zz => zz.on).length > 1 && btn("📋 Apply to all", () => dp({ type: "APPLY_ALL", payload: { section: "access", fromZid: z.id } }), "ghost")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: K.dm }}>Data Source:</span>
              {sel_(z.src?.access || "assumed", v => zf("src", "access", v), SRC_OPTIONS)}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              {chk(z.acc.road, v => zf("acc", "road", v), "Road")}
              {chk(z.acc.emer, v => zf("acc", "emer", v), "Emergency")}
              {chk(z.acc.util, v => zf("acc", "util", v), "Utilities")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div>{lbl("Road Dist")}{inp("number", z.acc.rd, v => zf("acc", "rd", v), { suffix: "m" })}</div>
              <div>{lbl("Building Dist")}{inp("number", z.acc.bd, v => zf("acc", "bd", v), { suffix: "m" })}</div>
            </div>
            {/* ACCESS NODES */}
            <div style={{ marginTop: 8, borderTop: "1px solid " + K.bd, paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: K.cy }}>Access Points ({(z.acc.nodes || []).length})</span>
                {btn("+ Add", () => dp({ type: "ANODE", payload: { zid: z.id } }), "ghost")}
              </div>
              {(z.acc.nodes || []).map((n, i) => (
                <div key={n.id} style={{ background: K.rs, borderRadius: 4, padding: 6, marginBottom: 3 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 4, alignItems: "end" }}>
                    <div>{lbl("Name")}{inp("text", n.nm, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "nm", val: v } }))}</div>
                    <div>{lbl("Type")}{sel_(n.tp, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "tp", val: v } }), [{ v: "road", l: "Road" }, { v: "gate", l: "Gate" }, { v: "hospital", l: "Hospital" }, { v: "emergency", l: "Emergency" }])}</div>
                    <div>{lbl("Priority")}{sel_(String(n.importance || 3), v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "importance", val: parseInt(v) } }), ["1", "2", "3", "4", "5"].map(v => ({ v, l: v })))}</div>
                    <button onClick={() => dp({ type: "DNODE", payload: { zid: z.id, nid: n.id } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "4px 6px", cursor: "pointer", marginBottom: 12 }}>✕</button>
                  </div>
                  <div style={{ background: K.cy + "06", border: "1px solid " + K.cy + "15", borderRadius: 4, padding: 5, marginTop: 3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: K.cy, marginBottom: 2 }}>📍 POSITION (auto-linked)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                      <div>{lbl("X")}{inp("number", n.x || 0, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "x", val: v } }), { suffix: "m" })}</div>
                      <div>{lbl("Y")}{inp("number", n.y || 0, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "y", val: v } }), { suffix: "m" })}</div>
                      <div>{lbl("Dist")}{inp("number", n.dist, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "dist", val: v } }), { suffix: "m" })}</div>
                      <div>{lbl("Bearing")}{inp("number", n.br || 0, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "br", val: v } }), { suffix: "°" })}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!(z.acc.nodes || []).length && <div style={{ fontSize: 9, color: K.mu, textAlign: "center", padding: 4 }}>Add specific access points (gates, hospital entries, etc.)</div>}
            </div>
          </div>
          {/* RESPONSE TIME DESTINATIONS */}
          <div className="hvs-card" style={{ padding: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: K.pu }}>🕐 Response Time Destinations ({(site.destinations || []).length})</span>
              {btn("+ Add Destination", () => dp({ type: "ADEST" }), "ghost")}
            </div>
            <div style={{ fontSize: 9, color: K.dm, marginBottom: 8, background: K.pn, padding: "4px 8px", borderRadius: 4 }}>
              Define target locations (hospital, HQ, base) — the system calculates flight time from helipad. Use for EMS response time compliance or client requirements.
            </div>
            {(site.destinations || []).map((d, i) => {
              const rt = calcResponseTime(d, site.lat, site.lng);
              return (
                <div key={d.id} style={{ background: K.rs, borderRadius: 6, padding: 10, marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>#{i + 1} {d.nm}</span>
                    <button onClick={() => dp({ type: "DDEST", payload: d.id })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "1px 6px", cursor: "pointer" }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 4, marginBottom: 4 }}>
                    <div>{lbl("Name *")}{inp("text", d.nm, v => dp({ type: "UDEST", payload: { did: d.id, fld: "nm", val: v } }))}</div>
                    <div>{lbl("Type")}{sel_(d.tp, v => dp({ type: "UDEST", payload: { did: d.id, fld: "tp", val: v } }), [{ v: "hospital", l: "Hospital" }, { v: "hq", l: "HQ / Base" }, { v: "airport", l: "Airport" }, { v: "military", l: "Military" }, { v: "offshore", l: "Offshore" }, { v: "city", l: "City Center" }, { v: "custom", l: "Custom" }])}</div>
                    <div>{lbl("Required")}{chk(d.required, v => dp({ type: "UDEST", payload: { did: d.id, fld: "required", val: v } }), "Must meet")}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: 4 }}>
                    <div>{lbl("Lat")}{inp("number", d.lat, v => dp({ type: "UDEST", payload: { did: d.id, fld: "lat", val: v } }), { suffix: "°", step: 0.001 })}</div>
                    <div>{lbl("Lng")}{inp("number", d.lng, v => dp({ type: "UDEST", payload: { did: d.id, fld: "lng", val: v } }), { suffix: "°", step: 0.001 })}</div>
                    <div>{lbl("OR Distance")}{inp("number", d.distKm, v => dp({ type: "UDEST", payload: { did: d.id, fld: "distKm", val: v } }), { suffix: "km" })}</div>
                    <div>{lbl("Max Time")}{inp("number", d.maxMinutes, v => dp({ type: "UDEST", payload: { did: d.id, fld: "maxMinutes", val: v } }), { suffix: "min" })}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
                    <div>{lbl("Cruise Speed")}{inp("number", d.cruiseKt, v => dp({ type: "UDEST", payload: { did: d.id, fld: "cruiseKt", val: v } }), { suffix: "kt" })}</div>
                    <div>{lbl("Ground Time")}{inp("number", d.groundMin, v => dp({ type: "UDEST", payload: { did: d.id, fld: "groundMin", val: v } }), { suffix: "min" })}</div>
                  </div>
                  {/* RESULT */}
                  {rt && (
                    <div style={{ background: rt.meetsReq ? K.gn + "10" : K.rd + "10", border: "1px solid " + (rt.meetsReq ? K.gn : K.rd) + "30", borderRadius: 4, padding: 8, marginTop: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>TOTAL RESPONSE TIME</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: rt.meetsReq ? K.gn : K.rd }}>{rt.totalMin} min</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {d.maxMinutes > 0 && <Tag color={rt.meetsReq ? K.gn : K.rd}>{rt.meetsReq ? "MEETS" : "EXCEEDS"} {d.maxMinutes}min</Tag>}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginTop: 6, fontSize: 9 }}>
                        <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Distance</div><div style={{ fontWeight: 700 }}>{rt.distKm} km</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Startup</div><div style={{ fontWeight: 700 }}>{rt.startupMin} min</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Flight</div><div style={{ fontWeight: 700, color: K.cy }}>{rt.flightMin} min</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Ground</div><div style={{ fontWeight: 700 }}>{rt.groundMin} min</div></div>
                      </div>
                      <div style={{ fontSize: 8, color: K.mu, marginTop: 4 }}>Breakdown: {rt.startupMin}min startup + {rt.flightMin}min flight ({rt.speedKmh} km/h) + {rt.approachMin}min approach + {rt.groundMin}min ground</div>
                    </div>
                  )}
                  {!rt && <div style={{ fontSize: 9, color: K.am, marginTop: 4 }}>Enter coordinates or distance to calculate response time</div>}
                </div>
              );
            })}
            {!(site.destinations || []).length && <div style={{ fontSize: 9, color: K.mu, textAlign: "center", padding: 8 }}>No destinations defined. Add hospital, HQ, or other response targets.</div>}
          </div>
          </>}

          {/* SENSITIVITY TAB */}
          {dataTab === "sens" && <>
          {/* SENSITIVITY */}
          <div className="hvs-card" style={{ padding: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: K.or }}>🏘 Sensitivity Zones ({(z.sens || []).length})</span>
              {btn("+ Add", () => dp({ type: "ASENS", payload: z.id }), "ghost")}
            </div>
            <div style={{ fontSize: 9, color: K.dm, marginBottom: 8, background: K.pn, padding: "4px 8px", borderRadius: 4 }}>
              Areas affected by noise, downwash, or safety risk. Types: <strong>Residential</strong> (housing), <strong>School</strong> (children), <strong>Hospital</strong> (patients), <strong>Fuel</strong> (fire risk), <strong>Sensitive</strong> (heritage/VIP). Distance = from zone center to nearest edge.
            </div>
            {(z.sens || []).map((s, i) => (
              <div key={s.id} style={{ background: K.rs, borderRadius: 4, padding: 8, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700 }}>#{i + 1}</span>
                  <button onClick={() => dp({ type: "DSENS", payload: { zid: z.id, sid: s.id } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "1px 4px", cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 4 }}>
                  <div>{lbl("Name *")}{inp("text", s.nm, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "nm", val: v } }))}</div>
                  <div>{lbl("Type")}{sel_(s.tp, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "tp", val: v } }), SENS_TYPES)}</div>
                  <div>{lbl("Level")}{sel_(s.level, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "level", val: v } }), SENS_LEVELS.map(l => ({ v: l, l: l })))}</div>
                </div>
                <div style={{ background: K.cy + "06", border: "1px solid " + K.cy + "15", borderRadius: 4, padding: 5, marginTop: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: K.cy, marginBottom: 3 }}>📍 POSITION (auto-linked)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    <div>{lbl("X (m)")}{inp("number", s.x || 0, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "x", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Y (m)")}{inp("number", s.y || 0, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "y", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Distance")}{inp("number", s.dist, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "dist", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Bearing")}{inp("number", s.br || 0, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "br", val: v } }), { suffix: "°" })}</div>
                  </div>
                </div>
                <div style={{ fontSize: 8, color: s.level === "high" ? K.rd : s.level === "medium" ? K.am : K.gn, marginTop: 4 }}>
                  {s.level === "high" ? "⚠ High sensitivity — significant noise/safety restrictions expected" : s.level === "medium" ? "⚠ Medium — operational restrictions may apply" : "Low — monitor only"}
                  {s.dist > 0 && s.dist < 100 ? " | CRITICAL: within 100m" : s.dist > 0 && s.dist < 250 ? " | Within buffer zone" : ""}
                </div>
              </div>
            ))}
            {!(z.sens || []).length && <div style={{ fontSize: 9, color: K.mu, textAlign: "center", padding: 8 }}>
              No sensitivity zones added. Consider adding nearby: residential areas, schools, hospitals, fuel storage, heritage sites, VIP facilities.
            </div>}
          </div>
          {/* VERTIPORT (conditional — inside sens tab) */}
          {(proj.mode === "vertiport" || proj.facility === "vertiport" || hl.tp === "evtol") && (
            <div style={{ background: K.sf, borderRadius: 8, padding: 16, border: "1px solid " + K.cy + "33", marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: K.cy, marginBottom: 8 }}>⚡ Vertiport / eVTOL</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                <div>{lbl("Pads")}{inp("number", z.vport?.pads || 1, v => zf("vport", "pads", Math.max(1, v)), { min: 1 })}</div>
                <div>{lbl("Turnaround")}{inp("number", z.vport?.turnaround || 10, v => zf("vport", "turnaround", v), { suffix: "min" })}</div>
                <div>{lbl("Pax Flow")}{sel_(z.vport?.paxFlow || "walk", v => zf("vport", "paxFlow", v), [{ v: "walk", l: "Walk-on" }, { v: "shuttle", l: "Shuttle" }, { v: "jet_bridge", l: "Jet Bridge" }])}</div>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
                {chk(z.vport?.charging || false, v => zf("vport", "charging", v), "Charging Required")}
                {chk(z.vport?.terminal || false, v => zf("vport", "terminal", v), "Terminal Connection")}
              </div>
              {(z.vport?.charging) && (
                <div style={{ marginBottom: 4 }}>{lbl("Charge Points")}{inp("number", z.vport?.chargePoints || 0, v => zf("vport", "chargePoints", v), { min: 0 })}</div>
              )}
              <div style={{ fontSize: 9, color: K.mu, background: K.pn, padding: "4px 6px", borderRadius: 3, marginTop: 4 }}>
                {(z.vport?.pads || 1)} pad(s) × D={D}m | Turnaround: {z.vport?.turnaround || 10}min | {z.vport?.charging ? z.vport.chargePoints + " charge pts" : "No charging"} | Throughput: ~{Math.round(60 / (z.vport?.turnaround || 10) * (z.vport?.pads || 1))} ops/hr
              </div>
            </div>
          )}
          </>}
        </div>
      </div>
    );
  };

  const renderScore = () => {
    const cc = zones.filter(z => z.on).length;
    const w = proj.wt || WT;
    const wSum = Object.values(w).reduce((a, b) => a + b, 0);
    const wLabels = { wind: "Wind", obs: "Obstacles", ter: "Terrain", acc: "Accessibility", geo: "Geometry", env: "Environment" };
    const wColors = { wind: K.cy, obs: K.am, ter: K.gn, acc: K.bl, geo: K.pu, env: K.or };
    const tooSmall = zones.filter(z => z.on && Math.min(z.bw, z.bh) < G.tot);

    // Data readiness check
    const activeZones = zones.filter(z => z.on);
    const readiness = activeZones.map(z => zoneCompleteness(z));
    const avgPct = readiness.length ? Math.round(readiness.reduce((s, r) => s + r.pct, 0) / readiness.length) : 0;
    const allWindFilled = readiness.every(r => r.wind);
    const anyObsFilled = readiness.some(r => r.obs);

    return (
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 20px", color: K.tx, paddingBottom: 10, borderBottom: "2px solid " + K.cy + "30" }}>Analysis Engine</h2>

        {/* DATA READINESS */}
        <div className="hvs-card" style={{ padding: 16, marginBottom: 12, textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>DATA READINESS</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: avgPct >= 80 ? K.gn : avgPct >= 40 ? K.am : K.rd }}>{avgPct}%</span>
          </div>
          <div style={{ height: 6, background: K.rs, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", width: avgPct + "%", background: avgPct >= 80 ? K.gn : avgPct >= 40 ? K.am : K.rd, borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(activeZones.length, 8) + ", 1fr)", gap: 4, marginBottom: 8 }}>
            {activeZones.slice(0, 16).map((z, i) => {
              const r = readiness[i];
              return <div key={z.id} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: K.dm, marginBottom: 2 }}>{z.lb}</div>
                <div style={{ height: 20, display: "flex", gap: 1 }}>
                  {["wind", "obs", "terrain", "access", "sens"].map(k => <div key={k} style={{ flex: 1, background: r[k] ? K.gn : K.rd + "30", borderRadius: 1 }} title={k + ": " + (r[k] ? "✓" : "missing")} />)}
                </div>
                <div style={{ fontSize: 8, color: r.pct === 100 ? K.gn : r.pct > 0 ? K.am : K.rd, fontWeight: 700 }}>{r.pct}%</div>
              </div>;
            })}
          </div>
          {!allWindFilled && <div style={{ fontSize: 10, color: K.am, padding: "4px 8px", background: K.am + "10", borderRadius: 4, marginBottom: 4 }}>⚠ Some zones missing wind data — go to Data Input step and use "Apply to all zones"</div>}
          {!anyObsFilled && <div style={{ fontSize: 10, color: K.am, padding: "4px 8px", background: K.am + "10", borderRadius: 4, marginBottom: 4 }}>⚠ No obstacles in any zone — analysis will assume clear OLS</div>}
          {avgPct < 40 && <div style={{ fontSize: 10, color: K.rd, padding: "4px 8px", background: K.rd + "10", borderRadius: 4 }}>⚠ Low data coverage — results may not be reliable. Consider filling at least Wind + Terrain for all zones.</div>}
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
            <span style={{ fontSize: 9, display: "flex", gap: 3, alignItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: 1, background: K.gn, display: "inline-block" }} /> Filled</span>
            <span style={{ fontSize: 9, display: "flex", gap: 3, alignItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: 1, background: K.rd + "30", display: "inline-block" }} /> Missing</span>
          </div>
        </div>
        <div style={{ background: K.sf, borderRadius: 8, padding: 16, border: "1px solid " + K.bd, textAlign: "left", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>SCORING WEIGHTS</span>
            <span style={{ fontSize: 9, color: Math.abs(wSum - 1) < 0.01 ? K.gn : K.rd, fontWeight: 700 }}>Total: {(wSum * 100).toFixed(0)}%{Math.abs(wSum - 1) > 0.01 ? " ⚠" : " ✓"}</span>
          </div>
          {Object.entries(wLabels).map(([k, label]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid " + K.bd }}>
              <span style={{ fontSize: 11, color: wColors[k], fontWeight: 600, width: 90 }}>{label}</span>
              <input type="range" min={0} max={40} value={Math.round((w[k] || 0) * 100)} onChange={e => dp({ type: "UP", payload: { wt: { ...w, [k]: parseInt(e.target.value) / 100 } } })} style={{ flex: 1, accentColor: wColors[k] }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: wColors[k], width: 32, textAlign: "right" }}>{Math.round((w[k] || 0) * 100)}%</span>
            </div>
          ))}
          {Math.abs(wSum - 1) > 0.01 && <div style={{ fontSize: 9, color: K.rd, marginTop: 4 }}>⚠ Weights should sum to 100%. Currently {(wSum * 100).toFixed(0)}%.</div>}
          {btn("Reset to Default", () => dp({ type: "UP", payload: { wt: { ...WT } } }), "ghost")}
        </div>
        <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.bd, textAlign: "left", marginBottom: 12, fontSize: 11 }}>
          <div>{hl.nm} (D={D}m) | {getPc(proj).label} | XW≤{getXwLim(proj)}kt</div>
          <div>Candidates: {cc}/{zones.length} | Footprint: {G.tot.toFixed(1)}m</div>
        </div>
        {tooSmall.length > 0 && (
          <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.am + "44", textAlign: "left", marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: K.am, marginBottom: 4 }}>⚠ {tooSmall.length} zone(s) too small for FATO+SA ({G.tot.toFixed(1)}m)</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tooSmall.map(z => <span key={z.id} style={{ fontSize: 9, color: K.am }}>{z.lb} ({Math.min(z.bw, z.bh).toFixed(0)}m)</span>)}
            </div>
            {btn("Auto-exclude these zones", () => { tooSmall.forEach(z => dp({ type: "TOG", payload: z.id })); }, "ghost")}
          </div>
        )}
        {/* DATA READINESS CHECK */}
        {(() => {
          const cands = zones.filter(z => z.on);
          const issues = [];
          for (const z of cands) {
            const zIss = [];
            if (z.wind.ps === 0 && z.wind.ss === 0 && z.wind.calm === 0) zIss.push("no wind");
            if (z.obs.length === 0) zIss.push("no obstacles");
            if (z.wind.pf + z.wind.sf + z.wind.calm > 100) zIss.push("freq >100%");
            if (z.obs.some(o => o.d <= 0 && o.h > 0)) zIss.push("obs missing distance");
            if (zIss.length) issues.push({ lb: z.lb, iss: zIss });
          }
          if (!issues.length) return (
            <div style={{ background: K.sf, borderRadius: 8, padding: 10, border: "1px solid " + K.gn + "44", textAlign: "left", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: K.gn }}>✓ All {cands.length} candidate zones have data — ready to analyze</div>
            </div>
          );
          return (
            <div style={{ background: K.sf, borderRadius: 8, padding: 10, border: "1px solid " + K.am + "44", textAlign: "left", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: K.am, marginBottom: 4 }}>⚠ Data warnings ({issues.length} zone{issues.length > 1 ? "s" : ""})</div>
              {issues.map((iss, i) => <div key={i} style={{ fontSize: 9, color: K.am, marginBottom: 1 }}>{iss.lb}: {iss.iss.join(", ")}</div>)}
              <div style={{ fontSize: 8, color: K.mu, marginTop: 4 }}>Analysis will proceed with defaults for missing data. Results may have lower confidence.</div>
            </div>
          );
        })()}
        {btn("⚡ Run Full Analysis", () => dp({ type: "RUN" }), "accent", cc === 0)}
      </div>
    );
  };

  const [showConfetti, setShowConfetti] = useState(false);
  const renderResults = () => {
    if (!scored) return <div className="hvs-card" style={{ padding: 16 }}><p style={{ color: K.dm, textAlign: "center" }}>Run analysis first</p></div>;
    const rk = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
    const best = rk[0];
    if (!best) return null;
    const tabs = [{ id: "overview", l: "Overview" }, { id: "siteplan", l: "Site Plan" }, { id: "orient", l: "Orientation" }, { id: "ols", l: "OLS Section" }, { id: "comply", l: "Compliance" }, { id: "scenarios", l: "Scenarios" }, { id: "report", l: "📄 Report" }];
    const suggestions = genSuggestions(zones, proj, site);

    return (
      <div>
        <Confetti active={showConfetti} />
        {/* SMART SUGGESTIONS BANNER */}
        {suggestions.length > 0 && tab === "overview" && (
          <div style={{ marginBottom: 10 }}>
            {suggestions.slice(0, 4).map((s, i) => (
              <div key={i} style={{ padding: "6px 12px", marginBottom: 3, borderRadius: 6, fontSize: 11, lineHeight: 1.4, display: "flex", gap: 8, alignItems: "flex-start", background: s.type === "danger" ? K.rd + "08" : s.type === "warning" ? K.am + "08" : s.type === "success" ? K.gn + "08" : K.cy + "08", border: "1px solid " + (s.type === "danger" ? K.rd : s.type === "warning" ? K.am : s.type === "success" ? K.gn : K.cy) + "20" }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                <span style={{ color: K.tx }}>{s.text}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Results</h2>
            <p style={{ fontSize: 11, color: K.dm, margin: "2px 0 0" }}>{proj.nm} — {hl.nm} {getPc(proj).label}</p>
          </div>
          <div style={{ display: "flex", gap: 2, background: K.pn, borderRadius: 6, padding: 2 }}>
            {tabs.map(t => <div key={t.id} onClick={() => dp({ type: "TAB", payload: t.id })} style={{ padding: "6px 12px", borderRadius: 4, fontSize: 10, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", background: tab === t.id ? K.bl : "transparent", color: tab === t.id ? "#fff" : K.dm, transition: "all 0.15s" }}>{t.l}</div>)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14 }}>
          <div>
            {/* RECOMMENDED ZONE — hero card */}
            <div className="hvs-card hvs-slide" style={{ padding: 16, marginBottom: 10, position: "relative", overflow: "hidden", borderColor: K.gn + "40" }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: "radial-gradient(circle at 100% 0%, " + K.gn + "15, transparent 70%)", pointerEvents: "none" }} />
              <div style={{ fontSize: 8, fontWeight: 700, color: K.gn, letterSpacing: 2.5, marginBottom: 4 }}>★ RECOMMENDED</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>{best.lb}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <AnimScore value={best.sc.tot} color={scoreCol(best.sc.tot)} size={32} />
                <span style={{ fontSize: 11, color: K.dm }}>/100</span>
                <Tag color={gradeCol(best.sc.gr)}>{best.sc.gr}</Tag>
              </div>
              <div style={{ fontSize: 10, color: K.dm, marginTop: 4, lineHeight: 1.4 }}>{best.sc.rec}</div>
              {best.sc.ori && <div style={{ marginTop: 8, padding: "6px 8px", background: "linear-gradient(135deg, " + K.pu + "10, " + K.pu + "05)", borderRadius: 6, border: "1px solid " + K.pu + "20" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: K.pu, letterSpacing: 1.5 }}>HEADING</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{best.sc.ori.hp}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: K.dm }}>{best.sc.ori.us}% usable</div>
                    <div style={{ fontSize: 10, color: best.sc.ori.xm <= best.sc.ori.lim ? K.gn : K.rd }}>XW {best.sc.ori.xm}kt</div>
                  </div>
                </div>
              </div>}
              {(() => { const c = calcConfidence(best); return (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: c.gradeColor + "08", borderRadius: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: c.gradeColor, letterSpacing: 1 }}>CONFIDENCE</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: c.gradeColor }}>{c.overall}%</span>
                  <span style={{ fontSize: 8, color: c.gradeColor }}>{c.grade}</span>
                </div>
              ); })()}
            </div>
            {/* RADAR */}
            <div className="hvs-card" style={{ padding: 10, marginBottom: 10, display: "flex", justifyContent: "center" }}>
              <ScoreRadar scores={selZ?.sc} size={160} />
            </div>
            {/* RANKING */}
            <div className="hvs-card" style={{ padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: K.dm, letterSpacing: 1.2, marginBottom: 6 }}>RANKING</div>
              {rk.map((z, i) => { const conf = calcConfidence(z); const isActive = z.id === sel; return <div key={z.id} onClick={() => dp({ type: "SEL", payload: z.id })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px", borderBottom: i < rk.length - 1 ? "1px solid " + K.bd : "none", cursor: "pointer", background: isActive ? K.bl + "10" : "transparent", borderRadius: isActive ? 4 : 0, transition: "background 0.15s" }}>
                <span style={{ width: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, background: i === 0 ? K.gn : K.pn, color: i === 0 ? "#fff" : K.mu }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{z.lb}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: scoreCol(z.sc.tot) }}>{z.sc.tot}</span>
                <Tag color={gradeCol(z.sc.gr)}>{z.sc.gr}</Tag>
                <span style={{ fontSize: 8, color: conf.gradeColor, fontWeight: 600 }}>{conf.overall}%</span>
              </div>; })}
            </div>
            <ZGrid zones={zones} sel={sel} onSel={v => dp({ type: "SEL", payload: v })} cols={site.gc} rows={site.gr} sm />
          </div>
          <div style={{ maxHeight: "72vh", overflowY: "auto", paddingRight: 6 }}>
            {tab === "overview" && <>
              {/* DASHBOARD METRICS */}
              {(() => {
                const comp = checkCompliance(best, proj, site);
                const conf = calcConfidence(best);
                const ori = best.sc.ori;
                const metrics = [
                  { label: "BEST SCORE", value: best.sc.tot, sub: best.lb + " — Grade " + best.sc.gr, color: scoreCol(best.sc.tot) },
                  { label: "HEADING", value: ori ? ori.hp : "—", sub: ori ? ori.us + "% usability" : "", color: K.pu },
                  { label: "MAX XW", value: ori ? ori.xm + "kt" : "—", sub: "limit " + getXwLim(proj) + "kt (" + hl.cat + ")", color: ori && ori.xm <= ori.lim ? K.gn : K.am },
                  { label: "COMPLIANCE", value: comp.compliant ? "PASS" : "FAIL", sub: comp.summary.passed + "/" + comp.summary.total + " checks", color: comp.compliant ? K.gn : K.rd },
                  { label: "CONFIDENCE", value: conf.overall + "%", sub: conf.grade, color: conf.gradeColor },
                  { label: "OLS", value: best.sc.bd.obs.pens?.filter(p => p.p18).length || 0, sub: best.sc.bd.obs.pens?.filter(p => p.p18).length > 0 ? "penetrations" : "all clear", color: (best.sc.bd.obs.pens?.filter(p => p.p18).length || 0) > 0 ? K.rd : K.gn },
                ];
                return (
                  <div className="hvs-slide" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 10 }}>
                    {metrics.map((m, i) => (
                      <div key={i} className="hvs-card" style={{ padding: "12px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                        <div className="hvs-shimmer" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }} />
                        <div style={{ fontSize: 9, fontWeight: 700, color: K.mu, letterSpacing: 1.2, marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: m.color, textShadow: "0 0 12px " + m.color + "40" }}>{typeof m.value === "number" ? <AnimScore value={m.value} color={m.color} size={20} /> : m.value}</div>
                        <div style={{ fontSize: 8, color: K.dm, marginTop: 3 }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* CHARTS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div className="hvs-card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 8 }}>SCORE HEATMAP</div>
                  <Heatmap zones={zones} cols={site.gc} rows={site.gr} width={260} height={220} />
                </div>
                <div className="hvs-card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 8 }}>ZONE RANKING</div>
                  <RankingBars zones={zones} width={280} height={220} />
                </div>
              </div>
              <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: K.gn, letterSpacing: 1, marginBottom: 8 }}>RECOMMENDATIONS</div>
                {recs.map((r, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, padding: 6, background: K.rs, borderRadius: 4 }}><span style={{ fontSize: 12 }}>{r.icon}</span><div><div style={{ fontSize: 10 }}>{r.text}</div>{r.detail && <div style={{ fontSize: 9, color: K.mu }}>{r.detail}</div>}</div></div>)}
              </div>
              {selZ?.sc && <div className="hvs-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}><span style={{ fontSize: 16, fontWeight: 800 }}>{selZ.lb}</span><span style={{ fontSize: 16, fontWeight: 800, color: scoreCol(selZ.sc.tot) }}>{selZ.sc.tot}</span><Tag color={gradeCol(selZ.sc.gr)}>Grade {selZ.sc.gr}</Tag></div>
                <ScoreBar label="Wind" score={selZ.sc.bd.wind.s} weight={(proj.wt || WT).wind} reasons={selZ.sc.bd.wind.R} />
                <ScoreBar label="Obstacles" score={selZ.sc.bd.obs.s} weight={(proj.wt || WT).obs} reasons={selZ.sc.bd.obs.R} />
                <ScoreBar label="Terrain" score={selZ.sc.bd.ter.s} weight={(proj.wt || WT).ter} reasons={selZ.sc.bd.ter.R} />
                <ScoreBar label="Access" score={selZ.sc.bd.acc.s} weight={(proj.wt || WT).acc} reasons={selZ.sc.bd.acc.R} />
                <ScoreBar label="Geometry" score={selZ.sc.bd.geo.s} weight={(proj.wt || WT).geo} reasons={selZ.sc.bd.geo.R} />
                <ScoreBar label="Environment" score={selZ.sc.bd.env.s} weight={(proj.wt || WT).env} reasons={selZ.sc.bd.env.R} />
                {/* Confidence */}
                {(() => {
                  const conf = calcConfidence(selZ);
                  return (
                    <div style={{ marginTop: 14, padding: 10, background: K.rs, borderRadius: 6, border: "1px solid " + conf.gradeColor + "33" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: K.dm }}>DATA CONFIDENCE</span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: conf.gradeColor }}>{conf.overall}%</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: conf.gradeColor }}>{conf.grade}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: K.pn, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ height: "100%", width: conf.overall + "%", background: conf.gradeColor, borderRadius: 2 }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        {["wind", "obstacles", "terrain", "access"].map(cat => {
                          const d = conf.details[cat];
                          return (
                            <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, padding: "2px 4px", background: d.color + "10", borderRadius: 3 }}>
                              <span style={{ color: K.dm, textTransform: "capitalize" }}>{cat}</span>
                              <span style={{ color: d.color, fontWeight: 600 }}>{d.icon} {d.score}%</span>
                            </div>
                          );
                        })}
                      </div>
                      {conf.flags.length > 0 && conf.flags.map((f, i) => <div key={i} style={{ fontSize: 8, color: K.rd, marginTop: 3 }}>⚠ {f}</div>)}
                    </div>
                  );
                })()}
              </div>}
              {/* ZONE QUICK COMPARE */}
              {selZ?.sc && (() => {
                const scored2 = zones.filter(z => z.sc && z.id !== selZ.id);
                const compZ = scored2.find(z => z.id === compareId) || scored2[0];
                if (!compZ) return null;
                const catLabels = { wind: "Wind", obs: "Obstacles", ter: "Terrain", acc: "Access", geo: "Geometry", env: "Environment" };
                return (
                  <div style={{ background: K.sf, borderRadius: 8, padding: 16, border: "1px solid " + K.bd, marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>ZONE COMPARE</span>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: K.dm }}>vs</span>
                        {sel_(compareId || compZ?.id || "", v => setCompareId(v), scored2.map(z => ({ v: z.id, l: z.lb + " (" + z.sc.tot + ")" })))}
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead><tr style={{ borderBottom: "2px solid " + K.bd }}>
                        <th style={{ padding: "4px 6px", textAlign: "left", color: K.dm }}>Criterion</th>
                        <th style={{ padding: "4px 6px", textAlign: "center", color: K.cy }}>{selZ.lb}</th>
                        <th style={{ padding: "4px 6px", textAlign: "center", color: K.am }}>{compZ.lb}</th>
                        <th style={{ padding: "4px 6px", textAlign: "center", color: K.dm }}>Δ</th>
                      </tr></thead>
                      <tbody>
                        {Object.entries(catLabels).map(([k, label]) => {
                          const s1 = selZ.sc.bd[k]?.s || 0, s2 = compZ.sc.bd[k]?.s || 0, delta = s1 - s2;
                          return (
                            <tr key={k} style={{ borderBottom: "1px solid " + K.bd }}>
                              <td style={{ padding: "5px 6px", color: K.dm }}>{label}</td>
                              <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: scoreCol(s1) }}>{s1}</td>
                              <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: scoreCol(s2) }}>{s2}</td>
                              <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: delta > 0 ? K.gn : delta < 0 ? K.rd : K.dm }}>{delta > 0 ? "+" : ""}{delta}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: K.rs }}>
                          <td style={{ padding: "5px 6px", fontWeight: 800 }}>TOTAL</td>
                          <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 800, color: scoreCol(selZ.sc.tot) }}>{selZ.sc.tot}</td>
                          <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 800, color: scoreCol(compZ.sc.tot) }}>{compZ.sc.tot}</td>
                          <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 800, color: selZ.sc.tot - compZ.sc.tot > 0 ? K.gn : K.rd }}>{selZ.sc.tot > compZ.sc.tot ? "+" : ""}{(selZ.sc.tot - compZ.sc.tot).toFixed(1)}</td>
                        </tr>
                        <tr><td style={{ padding: "5px 6px", color: K.dm }}>Heading</td><td style={{ padding: "5px 6px", textAlign: "center", color: K.pu }}>{selZ.sc.ori?.hp || "—"}</td><td style={{ padding: "5px 6px", textAlign: "center", color: K.pu }}>{compZ.sc.ori?.hp || "—"}</td><td></td></tr>
                        <tr><td style={{ padding: "5px 6px", color: K.dm }}>Confidence</td>{[selZ, compZ].map((z, i) => { const c = calcConfidence(z); return <td key={i} style={{ padding: "5px 6px", textAlign: "center", color: c.gradeColor, fontWeight: 600 }}>{c.overall}%</td>; })}<td></td></tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>}

            {tab === "siteplan" && (() => {
              const rankedForPlan = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
              const bestForPlan = rankedForPlan[0];
              return (
                <>
                  <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: K.cy, letterSpacing: 1 }}>SITE PLAN — TOP VIEW</div>
                        <div style={{ fontSize: 11, color: K.dm, marginTop: 2 }}>Click zones to select. FATO shown on recommended zone.</div>
                      </div>
                      <div style={{ display: "flex", gap: 10, fontSize: 9 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 10, background: K.gn, opacity: 0.3, display: "inline-block", borderRadius: 2, border: "1px solid " + K.gn }} /> FATO</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 1, background: K.am, display: "inline-block" }} /> Safety Area</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 1, background: K.cy, display: "inline-block" }} /> Approach</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: K.gn, display: "inline-block" }} /> Clear Obs</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: K.rd, display: "inline-block" }} /> Pen. Obs</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <SitePlan zones={zones} proj={proj} site={site} selId={sel} onSel={v => dp({ type: "SEL", payload: v })} onAddObs={(x, y) => {
                        if (!sel) return;
                        dp({ type: "SZ", payload: zones.map(z => z.id !== sel ? z : { ...z, obs: [...z.obs, mkObs({ nm: "Obs_" + (z.obs.length + 1), x, y, h: 10, tp: "building" })] }) });
                      }} size={500} />
                    </div>
                  </div>
                  {/* Selected zone info */}
                  {selZ?.sc && (
                    <div className="hvs-card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800 }}>{selZ.lb}</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: scoreCol(selZ.sc.tot) }}>{selZ.sc.tot}</span>
                          <Tag color={gradeCol(selZ.sc.gr)}>{selZ.sc.gr}</Tag>
                          {selZ.sc.ori && <span style={{ fontSize: 10, color: K.pu }}>Hdg {selZ.sc.ori.hp}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: K.dm }}>
                          {selZ.bw.toFixed(0)}×{selZ.bh.toFixed(0)}m | {selZ.obs.length} obstacles | slope {selZ.ter.slope}%
                        </div>
                      </div>
                      {selZ.obs.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {selZ.obs.map((o, i) => {
                            const pen = o.d > 0 && o.h > o.d / 8;
                            return (
                              <div key={i} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 9, background: pen ? K.rd + "15" : K.gn + "15", color: pen ? K.rd : K.gn, border: "1px solid " + (pen ? K.rd : K.gn) + "30" }}>
                                {o.nm}: {o.h}m @ {o.d}m / {o.br}° — {pen ? "PEN" : "CLEAR"}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {tab === "orient" && selZ?.sc?.ori && (() => {
              const o = selZ.sc.ori;
              return <>
                <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: K.pu, letterSpacing: 1 }}>ORIENTATION — {selZ.lb}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Optimal: {o.hp} ({o.oh}°/{o.oh + 180}°)</div>
                      <div style={{ fontSize: 11, color: K.dm, marginTop: 2 }}>{o.reason}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        <Tag color={o.ok ? K.gn : K.rd}>{o.ok ? "✓" : "✗"} ICAO 95%: {o.us}%</Tag>
                        <Tag color={o.xm <= o.lim ? K.gn : K.am}>XW: {o.xm}kt / {o.lim}kt</Tag>
                        {o.tw && <Tag color={K.am}>Tailwind risk</Tag>}
                      </div>
                    </div>
                    <WindRose zone={selZ} ori={o} size={170} />
                  </div>
                </div>
                <div className="hvs-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 6 }}>HEADING COMPARISON</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead><tr style={{ borderBottom: "1px solid " + K.bd }}>{["Hdg", "Usability", "XW Max", "HW Pri", "HW Sec", ""].map(h => <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: K.dm }}>{h}</th>)}</tr></thead>
                    <tbody>{o.all.slice(0, 10).map((h, i) => <tr key={i} style={{ borderBottom: "1px solid " + K.bd, background: i === 0 ? K.gn + "08" : "transparent" }}>
                      <td style={{ padding: "4px 6px", fontWeight: i === 0 ? 700 : 400, color: i === 0 ? K.gn : K.tx }}>{h.hp}</td>
                      <td style={{ padding: "4px 6px", color: h.us >= 95 ? K.gn : h.us >= 85 ? K.am : K.rd }}>{h.us}%</td>
                      <td style={{ padding: "4px 6px", color: h.xm <= o.lim ? K.gn : K.am }}>{h.xm}kt</td>
                      <td style={{ padding: "4px 6px" }}>{h.hwP}kt</td>
                      <td style={{ padding: "4px 6px" }}>{h.hwS}kt</td>
                      <td style={{ padding: "4px 6px" }}>{i === 0 ? <Tag color={K.gn}>OPTIMAL</Tag> : h.us >= 95 ? <Tag color={K.bl}>OK</Tag> : <Tag color={K.rd}>BELOW</Tag>}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </>;
            })()}

            {tab === "ols" && selZ?.sc && <>
              <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: K.am, letterSpacing: 1, marginBottom: 6 }}>OLS CROSS-SECTION — {selZ.lb}</div>
                <OLSChart zone={selZ} proj={proj} width={560} height={240} />
                <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, flexWrap: "wrap" }}>
                  <span>—<span style={{ color: K.am }}> 1:8 Approach</span></span>
                  <span>--<span style={{ color: K.cy }}> 1:2 Trans.</span></span>
                  <span>●<span style={{ color: K.gn }}> Clear</span></span>
                  <span>●<span style={{ color: K.rd }}> Penetrates</span></span>
                </div>
              </div>
              {selZ.sc.bd.obs.pens?.length > 0 && <div className="hvs-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 6 }}>OBSTACLE TABLE</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead><tr style={{ borderBottom: "1px solid " + K.bd }}>{["Name", "H", "Dist", "H/D", "Limit", "Status"].map(h => <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: K.dm }}>{h}</th>)}</tr></thead>
                  <tbody>{selZ.sc.bd.obs.pens.map((p, i) => <tr key={i} style={{ borderBottom: "1px solid " + K.bd }}>
                    <td style={{ padding: "4px 6px", fontWeight: 600 }}>{p.nm}</td>
                    <td style={{ padding: "4px 6px" }}>{p.h}m</td>
                    <td style={{ padding: "4px 6px" }}>{p.d}m</td>
                    <td style={{ padding: "4px 6px", fontFamily: "monospace" }}>{p.ratio}</td>
                    <td style={{ padding: "4px 6px" }}>{p.a18}m</td>
                    <td style={{ padding: "4px 6px" }}>{p.p18 ? <Tag color={K.rd}>PEN +{p.ex}m</Tag> : p.p12 ? <Tag color={K.am}>PEN 1:2</Tag> : <Tag color={K.gn}>CLEAR</Tag>}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
              {/* 3D ISOMETRIC VIEW */}
              <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.bd, marginTop: 8, display: "flex", justifyContent: "center" }}>
                <ErrorBoundary label="3D OLS View"><Obs3D zone={selZ} proj={proj} size={460} /></ErrorBoundary>
              </div>
            </>}

            {tab === "comply" && selZ?.sc && (() => {
              const comp = checkCompliance(selZ, proj, site);
              const sCol = { PASS: K.gn, FAIL: K.rd, WARN: K.am, "N/A": K.mu };
              const sIcon = { PASS: "✓", FAIL: "✗", WARN: "⚠", "N/A": "—" };
              const sBg = { PASS: K.gn + "10", FAIL: K.rd + "10", WARN: K.am + "10", "N/A": K.rs };
              return (
                <>
                  {/* Summary bar */}
                  <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: comp.compliant ? K.gn : K.rd, letterSpacing: 1 }}>
                          COMPLIANCE STATUS — {selZ.lb}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: comp.compliant ? K.gn : K.rd, marginTop: 2 }}>
                          {comp.compliant ? "COMPLIANT" : "NON-COMPLIANT"}
                        </div>
                        <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>
                          {comp.compliant ? "All mandatory requirements met" : comp.summary.failed + " requirement(s) not met"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: K.gn }}>{comp.summary.passed}</div>
                          <div style={{ fontSize: 8, color: K.dm, fontWeight: 600 }}>PASS</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: K.rd }}>{comp.summary.failed}</div>
                          <div style={{ fontSize: 8, color: K.dm, fontWeight: 600 }}>FAIL</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: K.am }}>{comp.summary.warned}</div>
                          <div style={{ fontSize: 8, color: K.dm, fontWeight: 600 }}>WARN</div>
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 8, background: K.rs, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                      <div style={{ width: (comp.summary.passed / comp.summary.total * 100) + "%", background: K.gn, transition: "width .3s" }} />
                      <div style={{ width: (comp.summary.warned / comp.summary.total * 100) + "%", background: K.am, transition: "width .3s" }} />
                      <div style={{ width: (comp.summary.failed / comp.summary.total * 100) + "%", background: K.rd, transition: "width .3s" }} />
                    </div>
                    <div style={{ fontSize: 9, color: K.mu, marginTop: 4 }}>{comp.summary.passed + comp.summary.warned + comp.summary.failed} / {comp.summary.total} checks evaluated</div>
                  </div>

                  {/* Per category */}
                  {comp.categories.map(cat => {
                    const catChecks = comp.checks.filter(c => c.cat === cat);
                    const catFails = catChecks.filter(c => c.status === "FAIL").length;
                    return (
                      <div key={cat} className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: catFails > 0 ? K.rd : K.gn }}>
                            {catFails > 0 ? "⚠" : "✓"} {cat}
                          </div>
                          <div style={{ fontSize: 9, color: K.dm }}>
                            {catChecks.filter(c => c.status === "PASS").length}/{catChecks.length} passed
                          </div>
                        </div>
                        {catChecks.map((c, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", marginBottom: 4, background: sBg[c.status], borderRadius: 4, borderLeft: "3px solid " + sCol[c.status] }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: sCol[c.status], minWidth: 16 }}>{sIcon[c.status]}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: K.tx }}>{c.rule}</div>
                              <div style={{ fontSize: 9, color: K.mu, marginTop: 1 }}>{c.detail}</div>
                            </div>
                            <div style={{ fontSize: 8, color: K.mu, whiteSpace: "nowrap" }}>{c.ref}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              );
            })()}

            {tab === "scenarios" && (() => {
              const rankedCurrent = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
              const currentBest = rankedCurrent[0];
              return (
                <>
                  {/* MULTI-SITE WORKFLOW GUIDE */}
                  <div style={{ background: "linear-gradient(135deg, " + K.cy + "08, " + K.pu + "05)", border: "1px solid " + K.cy + "25", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: K.cy, marginBottom: 6 }}>🗺 مقارنة مواقع مختلفة (Multi-Site Comparison)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, fontSize: 9, color: K.dm }}>
                      <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>1️⃣</div>
                        <div>Run Site A → <strong style={{ color: K.gn }}>Save</strong></div>
                      </div>
                      <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>2️⃣</div>
                        <div><strong style={{ color: K.am }}>New Site</strong> → Setup B → Run → Save</div>
                      </div>
                      <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>3️⃣</div>
                        <div>Repeat for Site C</div>
                      </div>
                      <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                        <div style={{ fontSize: 14, marginBottom: 2 }}>4️⃣</div>
                        <div><strong style={{ color: K.cy }}>Compare</strong> below</div>
                      </div>
                    </div>
                  </div>

                  {/* SAVE CURRENT */}
                  <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: K.cy, marginBottom: 4 }}>💾 Save Current Analysis</div>
                    <div style={{ fontSize: 9, color: K.dm, marginBottom: 8 }}>Site: <strong style={{ color: K.tx }}>{site.nm || "Unnamed"}</strong> | {site.lat.toFixed(4)}°, {site.lng.toFixed(4)}° | {site.sw}×{site.sh}m | {hl.nm} {getPc(proj).label}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {inp("text", scenarioName, setScenarioName, { ph: "e.g. Site A — Hospital Rooftop" })}
                      {btn("Save", () => { if (scenarioName.trim()) { dp({ type: "SAVE_SCENARIO", payload: scenarioName.trim() }); setScenarioName(""); } }, "accent", !scenarioName.trim() || !scored)}
                      {btn("🔄 New Site (Reset)", () => dp({ type: "RESET" }), "ghost")}
                    </div>
                    <div style={{ fontSize: 8, color: K.mu, marginTop: 4 }}>Saves EVERYTHING: site location, zones, obstacles, wind, scores. Use "New Site" to start a different location — saved scenarios are preserved.</div>
                  </div>

                  {/* WHAT-IF QUICK COMPARE */}
                  <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: K.pu, marginBottom: 10 }}>🔄 Quick What-If (same site, different aircraft/PC)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        {lbl("Helicopter")}
                        {sel_(proj.dh, v => dp({ type: "WHATIF", payload: { dh: v } }), HELIS.map(h => ({ v: h.id, l: h.id === "custom" ? "Custom" : h.nm + " (D=" + h.D + "m)" })))}
                      </div>
                      <div>
                        {lbl("Performance Class")}
                        {sel_(proj.pc, v => dp({ type: "WHATIF", payload: { pc: v } }), Object.entries(PC_DATA).map(([k, v]) => ({ v: k, l: v.label })))}
                      </div>
                    </div>
                    {currentBest && <div style={{ marginTop: 10, padding: "8px 10px", background: K.rs, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: K.tx }}>Current best: <strong>{currentBest.lb}</strong> — {currentBest.sc.tot}/100 ({currentBest.sc.gr})</span>
                      <Tag color={gradeCol(currentBest.sc.gr)}>{currentBest.sc.gr}</Tag>
                    </div>}
                  </div>

                  {/* SAVED SCENARIOS */}
                  <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: K.am, marginBottom: 10 }}>📋 Saved Scenarios ({scenarios.length})</div>
                    {scenarios.length === 0 && <div style={{ fontSize: 10, color: K.mu, textAlign: "center", padding: 16 }}>No scenarios saved. Run analysis then Save to start comparing sites.</div>}
                    {scenarios.map((sc, i) => {
                      const scBest = sc.zones.filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0];
                      const scHeli = HELIS.find(h => h.id === sc.proj.dh);
                      const scPc = PC_DATA[sc.proj.pc];
                      const scComp = scBest ? checkCompliance(scBest, sc.proj, sc.site) : null;
                      return (
                        <div key={sc.id} style={{ background: K.rs, borderRadius: 6, padding: 12, marginBottom: 6, borderLeft: "3px solid " + (scBest ? scoreCol(scBest.sc.tot) : K.bd) }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: K.tx }}>{sc.name}</div>
                              <div style={{ fontSize: 9, color: K.cy, marginTop: 2 }}>📍 {sc.site?.nm || "—"} | {sc.site?.lat?.toFixed(4) || 0}°, {sc.site?.lng?.toFixed(4) || 0}° | {sc.site?.sw || 0}×{sc.site?.sh || 0}m</div>
                              <div style={{ fontSize: 9, color: K.mu }}>{new Date(sc.savedAt).toLocaleString()} | {scHeli?.nm || "Custom"} | {scPc?.label || sc.proj.pc} | {sc.zones.filter(z => z.on).length} zones</div>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {btn("Load", () => dp({ type: "LOAD_SCENARIO", payload: sc.id }), "ghost")}
                              {btn("Dup", () => dp({ type: "DUP_SCENARIO", payload: sc.id }), "ghost")}
                              {btn("✕", () => dp({ type: "DEL_SCENARIO", payload: sc.id }), "ghost")}
                            </div>
                          </div>
                          {scBest && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: K.dm }}>Best: <strong style={{ color: K.tx }}>{scBest.lb}</strong></span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: scoreCol(scBest.sc.tot) }}>{scBest.sc.tot}</span>
                            <Tag color={gradeCol(scBest.sc.gr)}>{scBest.sc.gr}</Tag>
                            {scBest.sc.ori && <span style={{ fontSize: 9, color: K.dm }}>Hdg {scBest.sc.ori.hp}</span>}
                            {scComp && <Tag color={scComp.compliant ? K.gn : K.rd}>{scComp.compliant ? "PASS" : "FAIL"} {scComp.summary.passed}/{scComp.summary.total}</Tag>}
                          </div>}
                        </div>
                      );
                    })}
                  </div>

                  {/* SIDE-BY-SIDE COMPARISON */}
                  {scenarios.length > 0 && scored && <div className="hvs-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: K.gn, marginBottom: 10 }}>⚖️ Side-by-Side Comparison</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid " + K.bd }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", color: K.dm }}>Parameter</th>
                            <th style={{ padding: "6px 8px", textAlign: "center", color: K.cy, fontWeight: 700 }}>Current</th>
                            {scenarios.map(sc => <th key={sc.id} style={{ padding: "6px 8px", textAlign: "center", color: K.am, fontWeight: 700 }}>{sc.name}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const curBest = rankedCurrent[0];
                            const allBests = scenarios.map(sc => sc.zones.filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0]);
                            const rows = [
                              { label: "📍 Site Name", cur: site.nm || "Current", vals: scenarios.map(sc => sc.site?.nm || "—"), section: true },
                              { label: "Location", cur: site.lat.toFixed(4) + "°, " + site.lng.toFixed(4) + "°", vals: scenarios.map(sc => (sc.site?.lat?.toFixed(4) || 0) + "°, " + (sc.site?.lng?.toFixed(4) || 0) + "°") },
                              { label: "Site Area", cur: site.sw + "×" + site.sh + "m", vals: scenarios.map(sc => (sc.site?.sw || 0) + "×" + (sc.site?.sh || 0) + "m") },
                              { label: "Elevation", cur: site.elev + "m", vals: scenarios.map(sc => (sc.site?.elev || 0) + "m") },
                              { label: "Active Zones", cur: zones.filter(z => z.on).length + "/" + zones.length, vals: scenarios.map(sc => sc.zones.filter(z => z.on).length + "/" + sc.zones.length) },
                              { label: "Helicopter", cur: hl.nm, vals: scenarios.map(sc => HELIS.find(h => h.id === sc.proj.dh)?.nm || "Custom"), section: true },
                              { label: "D-value", cur: D + "m", vals: scenarios.map(sc => getD(sc.proj) + "m") },
                              { label: "Perf. Class", cur: getPc(proj).label, vals: scenarios.map(sc => PC_DATA[sc.proj.pc]?.label || "") },
                              { label: "FATO+SA", cur: G.tot.toFixed(1) + "m", vals: scenarios.map(sc => calcGeom(sc.proj).tot.toFixed(1) + "m") },
                              { label: "⭐ Best Zone", cur: curBest?.lb || "—", vals: allBests.map(b => b?.lb || "—"), section: true },
                              { label: "⭐ SCORE", cur: curBest?.sc?.tot || "—", vals: allBests.map(b => b?.sc?.tot || "—"), highlight: true },
                              { label: "Grade", cur: curBest?.sc?.gr || "—", vals: allBests.map(b => b?.sc?.gr || "—"), grade: true },
                              { label: "Heading", cur: curBest?.sc?.ori?.hp || "—", vals: allBests.map(b => b?.sc?.ori?.hp || "—") },
                              { label: "Usability", cur: curBest?.sc?.ori ? curBest.sc.ori.us + "%" : "—", vals: allBests.map(b => b?.sc?.ori ? b.sc.ori.us + "%" : "—") },
                              { label: "Max XW", cur: curBest?.sc?.ori ? curBest.sc.ori.xm + "kt" : "—", vals: allBests.map(b => b?.sc?.ori ? b.sc.ori.xm + "kt" : "—") },
                              { label: "Wind", cur: curBest?.sc?.bd?.wind?.s || "—", vals: allBests.map(b => b?.sc?.bd?.wind?.s || "—") },
                              { label: "OBS", cur: curBest?.sc?.bd?.obs?.s || "—", vals: allBests.map(b => b?.sc?.bd?.obs?.s || "—") },
                              { label: "Terrain", cur: curBest?.sc?.bd?.ter?.s || "—", vals: allBests.map(b => b?.sc?.bd?.ter?.s || "—") },
                              { label: "Access", cur: curBest?.sc?.bd?.acc?.s || "—", vals: allBests.map(b => b?.sc?.bd?.acc?.s || "—") },
                              { label: "Geometry", cur: curBest?.sc?.bd?.geo?.s || "—", vals: allBests.map(b => b?.sc?.bd?.geo?.s || "—") },
                              { label: "Environment", cur: curBest?.sc?.bd?.env?.s || "—", vals: allBests.map(b => b?.sc?.bd?.env?.s || "—") },
                              { label: "Compliance", cur: (() => { if (!curBest) return "—"; const c = checkCompliance(curBest, proj, site); return c.compliant ? "PASS " + c.summary.passed + "/" + c.summary.total : "FAIL " + c.summary.passed + "/" + c.summary.total; })(), vals: allBests.map((b, j) => { if (!b) return "—"; const sc = scenarios[j]; const c = checkCompliance(b, sc.proj, sc.site); return c.compliant ? "PASS " + c.summary.passed + "/" + c.summary.total : "FAIL " + c.summary.passed + "/" + c.summary.total; }) },
                            ];
                            return rows.map((r, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid " + K.bd, background: r.section ? K.cy + "05" : "transparent" }}>
                                <td style={{ padding: "5px 8px", color: r.section ? K.cy : K.dm, fontWeight: r.section ? 700 : 600, fontSize: r.section ? 10 : 9 }}>{r.label}</td>
                                <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: r.highlight ? 800 : 400, fontSize: r.highlight ? 14 : 10, color: r.highlight ? scoreCol(typeof r.cur === "number" ? r.cur : 0) : r.grade ? gradeCol(r.cur) : K.tx }}>{r.cur}</td>
                                {r.vals.map((v, j) => <td key={j} style={{ padding: "5px 8px", textAlign: "center", fontWeight: r.highlight ? 800 : 400, fontSize: r.highlight ? 14 : 10, color: r.highlight ? scoreCol(typeof v === "number" ? v : 0) : r.grade ? gradeCol(v) : K.tx }}>{v}</td>)}
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>}
                </>
              );
            })()}

            {tab === "report" && (() => {
              const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
              const pc = getPc(proj);
              const rankedAll = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
              const excluded = zones.filter(z => !z.on);
              const bestZ = rankedAll[0];
              if (!bestZ) return null;
              const bOri = bestZ.sc.ori;
              const bObs = bestZ.sc.bd.obs;

              const rSec = (title, children) => (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a2540", borderBottom: "2px solid #2563eb", paddingBottom: 4, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
                  {children}
                </div>
              );
              const rRow = (label, value, highlight) => (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: highlight || "#1f2937" }}>{value}</span>
                </div>
              );

              return (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, gap: 6 }}>
                    <button onClick={() => { const el = document.getElementById("hvs-report"); if (el) { const w = window.open("", "_blank"); w.document.write("<html><head><title>" + proj.nm + " — Feasibility Report</title><link href='https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap' rel='stylesheet'><style>@media print{body{margin:0}}</style></head><body>" + el.outerHTML + "</body></html>"); w.document.close(); setTimeout(() => w.print(), 500); } }} style={{ padding: "6px 14px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", background: K.bl, color: "#fff", border: "none" }}>🖨 Print Report</button>
                    <button onClick={() => { const el = document.getElementById("hvs-report"); if (el) { const blob = new Blob(["<html><head><meta charset='utf-8'><title>" + proj.nm + "</title><link href='https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap' rel='stylesheet'></head><body>" + el.outerHTML + "</body></html>"], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = proj.nm.replace(/\s+/g, "_") + "_Report.html"; a.click(); } }} style={{ padding: "6px 14px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "transparent", color: K.dm, border: "1px solid " + K.bd }}>📥 Download HTML</button>
                  </div>
                  <div id="hvs-report" style={{ background: "#fff", color: "#1f2937", borderRadius: 8, padding: "32px 36px", fontFamily: "'Outfit', 'Segoe UI', sans-serif", maxWidth: 700, lineHeight: 1.6 }}>
                  {/* HEADER */}
                  <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 20, borderBottom: "3px solid #2563eb" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", letterSpacing: 3, marginBottom: 4 }}>HELI-VERTISAFE SITE INTELLIGENCE</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>Helipad Feasibility Assessment</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{proj.nm}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Prepared for: {proj.cl || "—"} | Date: {today}</div>
                    <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>Ref: ICAO Annex 14 Vol II | GACAR Part 138 | {pc.label}</div>
                    {(() => { const wf = WORKFLOW_STATES.find(s => s.v === (proj.workflow || "draft")) || WORKFLOW_STATES[0]; return <div style={{ marginTop: 6 }}><span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, color: wf.c, background: wf.c + "18", border: "1px solid " + wf.c + "33" }}>Status: {wf.l}</span></div>; })()}
                  </div>

                  {/* EXECUTIVE SUMMARY */}
                  {rSec("1. Executive Summary", (
                    <div>
                      <p style={{ fontSize: 11, margin: "0 0 8px" }}>
                        This report presents the findings of a multi-criteria helipad site feasibility assessment for <strong>{proj.nm}</strong> at <strong>{site.nm}</strong> (Lat {site.lat.toFixed(4)}°, Lng {site.lng.toFixed(4)}°, Elev {site.elev}m AMSL). The study evaluated <strong>{rankedAll.length}</strong> candidate zone(s) across a {site.sw}m × {site.sh}m study area using the {hl.nm} (D-value = {D}m) as the design helicopter under {pc.label} operations.
                      </p>
                      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: 12, marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", letterSpacing: 1, marginBottom: 4 }}>RECOMMENDATION</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#14532d" }}>Zone {bestZ.lb} — Score {bestZ.sc.tot}/100 (Grade {bestZ.sc.gr})</div>
                        <div style={{ fontSize: 11, color: "#166534" }}>{bestZ.sc.rec}</div>
                        {bOri && <div style={{ fontSize: 11, color: "#166534", marginTop: 4 }}>Optimal FATO heading: {bOri.hp} ({bOri.us}% wind usability, max crosswind {bOri.xm}kt)</div>}
                      </div>
                      {excluded.length > 0 && <p style={{ fontSize: 10, color: "#6b7280" }}>{excluded.length} zone(s) were excluded from analysis.</p>}
                    </div>
                  ))}

                  {/* SITE DATA */}
                  {rSec("2. Site Information", (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        {rRow("Site Name", site.nm)}
                        {rRow("Coordinates", site.lat.toFixed(4) + "° / " + site.lng.toFixed(4) + "°")}
                        {rRow("Elevation", site.elev + "m AMSL")}
                        {rRow("Study Area", site.sw + "m × " + site.sh + "m")}
                      </div>
                      <div>
                        {rRow("Project Type", proj.pt)}
                        {rRow("Grid", site.gc + "×" + site.gr + " (" + zones.length + " zones)")}
                        {rRow("Mag. Declination", site.md + "°")}
                        {rRow("Ref. Temperature", site.rt + "°C")}
                      </div>
                    </div>
                  ))}

                  {/* RESPONSE TIMES */}
                  {(site.destinations || []).length > 0 && rSec("3. Response Time Analysis", (
                    <div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 8 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["Destination", "Type", "Distance", "Flight", "Total", "Requirement", "Status"].map(h => (
                              <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(site.destinations || []).map((d, i) => {
                            const rt = calcResponseTime(d, site.lat, site.lng);
                            return (
                              <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>{d.nm}</td>
                                <td style={{ padding: "4px 6px" }}>{d.tp}</td>
                                <td style={{ padding: "4px 6px" }}>{rt ? rt.distKm + " km" : "—"}</td>
                                <td style={{ padding: "4px 6px" }}>{rt ? rt.flightMin + " min" : "—"}</td>
                                <td style={{ padding: "4px 6px", fontWeight: 700, color: rt && !rt.meetsReq ? "#991b1b" : "#166534" }}>{rt ? rt.totalMin + " min" : "—"}</td>
                                <td style={{ padding: "4px 6px" }}>{d.maxMinutes > 0 ? "≤" + d.maxMinutes + " min" : "—"}</td>
                                <td style={{ padding: "4px 6px" }}>
                                  {rt && d.maxMinutes > 0 ? <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, color: rt.meetsReq ? "#166534" : "#991b1b", background: rt.meetsReq ? "#bbf7d0" : "#fecaca" }}>{rt.meetsReq ? "MEETS" : "EXCEEDS"}</span> : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ fontSize: 9, color: "#9ca3af" }}>Response time = startup (3min) + flight time ({hl.nm}) + approach (2min) + ground transport. Speed based on cruise at configured knots.</div>
                    </div>
                  ))}

                  {/* DESIGN PARAMETERS */}
                  {rSec((site.destinations || []).length > 0 ? "4" : "3" + ". Design Parameters", (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        {rRow("Design Helicopter", hl.nm)}
                        {rRow("D-value", D + "m")}
                        {rRow("MTOW", hl.mtow + " kg")}
                        {rRow("Category", hl.cat)}
                        {rRow("XW Limit", getXwLim(proj) + " kt")}
                      </div>
                      <div>
                        {rRow("Performance Class", pc.label)}
                        {rRow("FATO", G.fato.toFixed(1) + "m × " + G.fato.toFixed(1) + "m")}
                        {rRow("TLOF", G.tlof.toFixed(1) + "m")}
                        {rRow("Safety Area", G.sa.toFixed(1) + "m (min)")}
                        {rRow("Total Footprint", G.tot.toFixed(1) + "m × " + G.tot.toFixed(1) + "m")}
                      </div>
                    </div>
                  ))}

                  {/* ZONE COMPARISON */}
                  {rSec("4. Zone Comparison", (
                    <div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 8 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["#", "Zone", "Wind", "OBS", "Terrain", "Access", "Geo", "Env", "Total", "Grade", "Conf."].map(h => (
                              <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rankedAll.map((z, i) => (
                            <tr key={z.id} style={{ background: i === 0 ? "#f0fdf4" : i % 2 === 0 ? "#fafafa" : "#fff" }}>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, color: i === 0 ? "#166534" : "#6b7280" }}>{i + 1}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>{z.lb}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.wind.s}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.obs.s}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.ter.s}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.acc.s}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.geo.s}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.env.s}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: 800, color: i === 0 ? "#166534" : "#1f2937" }}>{z.sc.tot}</td>
                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>
                                <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: gradeCol(z.sc.gr) + "20", color: gradeCol(z.sc.gr) }}>{z.sc.gr}</span>
                              </td>
                              {(() => { const c = calcConfidence(z); return <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 9, fontWeight: 600, color: c.gradeColor }}>{c.overall}%</td>; })()}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ fontSize: 9, color: "#9ca3af" }}>Weights: Wind {(proj.wt || WT).wind * 100}% | Obstacles {(proj.wt || WT).obs * 100}% | Terrain {(proj.wt || WT).ter * 100}% | Access {(proj.wt || WT).acc * 100}% | Geometry {(proj.wt || WT).geo * 100}% | Environment {(proj.wt || WT).env * 100}%</div>
                    </div>
                  ))}

                  {/* RECOMMENDED ZONE DETAIL */}
                  {rSec("5. Recommended Zone — " + bestZ.lb, (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <div>
                          {rRow("Score", bestZ.sc.tot + " / 100", "#166534")}
                          {rRow("Grade", bestZ.sc.gr, gradeCol(bestZ.sc.gr))}
                          {rRow("Zone Size", bestZ.bw.toFixed(0) + "m × " + bestZ.bh.toFixed(0) + "m")}
                          {rRow("Slope", bestZ.ter.slope + "% (side: " + bestZ.ter.side + "%)")}
                          {rRow("Soil", bestZ.ter.soil)}
                        </div>
                        <div>
                          {bOri && rRow("Optimal Heading", bOri.hp + " (" + bOri.oh + "°/" + (bOri.oh + 180) + "°)")}
                          {bOri && rRow("Wind Usability", bOri.us + "%" + (bOri.ok ? " ✓" : " ⚠"), bOri.ok ? "#166534" : "#b91c1c")}
                          {bOri && rRow("Max Crosswind", bOri.xm + "kt (limit " + bOri.lim + "kt)")}
                          {rRow("Road Access", bestZ.acc.road ? "Yes (" + bestZ.acc.rd + "m)" : "No", bestZ.acc.road ? undefined : "#b91c1c")}
                          {rRow("Building Clearance", bestZ.acc.bd + "m", bestZ.acc.bd < 30 ? "#b91c1c" : undefined)}
                        </div>
                      </div>

                      {/* Score breakdown */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Score Breakdown</div>
                      {["wind", "obs", "ter", "acc", "geo", "env"].map(k => {
                        const label = { wind: "Wind Analysis", obs: "Obstacle Clearance", ter: "Terrain Suitability", acc: "Accessibility", geo: "Zone Geometry", env: "Environmental Sensitivity" }[k];
                        const sc = bestZ.sc.bd[k];
                        return (
                          <div key={k} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                              <span style={{ fontSize: 10, color: "#6b7280" }}>{label} ({((proj.wt || WT)[k] * 100).toFixed(0)}%)</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: scoreCol(sc.s) }}>{sc.s}/100</span>
                            </div>
                            <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden", marginBottom: 2 }}>
                              <div style={{ height: "100%", width: sc.s + "%", background: scoreCol(sc.s), borderRadius: 2 }} />
                            </div>
                            {sc.R.map((r, i) => <div key={i} style={{ fontSize: 9, color: "#9ca3af", paddingLeft: 8, borderLeft: "2px solid #e5e7eb", marginTop: 1 }}>{r}</div>)}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* OBSTACLE SUMMARY */}
                  {bObs.pens.length > 0 && rSec("6. Obstacle Analysis — " + bestZ.lb, (
                    <div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["Obstacle", "Type", "Height", "Distance", "Bearing", "H/D Ratio", "1:8 Limit", "Status"].map(h => (
                              <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bObs.pens.map((p, i) => (
                            <tr key={i} style={{ background: p.p18 ? "#fef2f2" : "#fff" }}>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontWeight: 600 }}>{p.nm}</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.nm}</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.h}m</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.d}m</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.br}°</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{p.ratio}</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.a18}m</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                                <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: p.p18 ? "#fecaca" : "#bbf7d0", color: p.p18 ? "#991b1b" : "#166534" }}>
                                  {p.p18 ? "PENETRATES (+" + p.ex + "m)" : p.p12 ? "PEN 1:2" : "CLEAR"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {/* RECOMMENDATIONS */}
                  {rSec((bObs.pens.length > 0 ? "7" : "6") + ". Recommendations & Actions", (
                    <div>
                      {recs.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 4, borderLeft: "3px solid " + (r.icon === "🏆" ? "#10b981" : r.icon === "🧭" ? "#a78bfa" : "#f59e0b") }}>
                          <span style={{ fontSize: 14 }}>{r.icon}</span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#1f2937" }}>{r.text}</div>
                            {r.detail && <div style={{ fontSize: 10, color: "#6b7280" }}>{r.detail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* DATA CONFIDENCE */}
                  {(() => {
                    const confSecNum = bObs.pens.length > 0 ? 8 : 7;
                    const confBest = calcConfidence(bestZ);
                    return rSec(confSecNum + ". Data Quality & Confidence", (
                      <div>
                        <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center" }}>
                          <div style={{ padding: "6px 12px", background: confBest.overall >= 55 ? "#f0fdf4" : "#fffbeb", border: "1px solid " + (confBest.overall >= 55 ? "#bbf7d0" : "#fde68a"), borderRadius: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: confBest.gradeColor }}>{confBest.overall}% — {confBest.grade}</div>
                            <div style={{ fontSize: 9, color: "#6b7280" }}>Overall data confidence for {bestZ.lb}</div>
                          </div>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 8 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc" }}>
                              {["Category", "Data Source", "Quality Score", "Status"].map(h => (
                                <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {["wind", "obstacles", "terrain", "access"].map(cat => {
                              const d = confBest.details[cat];
                              return (
                                <tr key={cat}>
                                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, textTransform: "capitalize" }}>{cat}</td>
                                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{d.srcLabel}</td>
                                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <div style={{ width: 60, height: 4, background: "#e5e7eb", borderRadius: 2 }}>
                                        <div style={{ width: d.score + "%", height: "100%", background: d.color, borderRadius: 2 }} />
                                      </div>
                                      <span style={{ fontWeight: 700, color: d.color }}>{d.score}%</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                                    <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, color: d.score >= 70 ? "#166534" : d.score >= 40 ? "#92400e" : "#991b1b", background: d.score >= 70 ? "#bbf7d0" : d.score >= 40 ? "#fde68a" : "#fecaca" }}>
                                      {d.score >= 70 ? "RELIABLE" : d.score >= 40 ? "VERIFY" : "INSUFFICIENT"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {confBest.flags.length > 0 && (
                          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, padding: 8, marginTop: 4 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>DATA QUALITY FLAGS</div>
                            {confBest.flags.map((f, i) => <div key={i} style={{ fontSize: 9, color: "#92400e" }}>⚠ {f}</div>)}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 6 }}>
                          Source levels: Survey (100%) → Documented (85%) → Estimated (60%) → Assumed (30%). Score adjusted for data completeness.
                        </div>
                      </div>
                    ));
                  })()}

                  {/* COMPLIANCE MATRIX */}
                  {(() => {
                    const comp = checkCompliance(bestZ, proj, site);
                    const secNum = bObs.pens.length > 0 ? 9 : 8;
                    const sCol = { PASS: "#166534", FAIL: "#991b1b", WARN: "#92400e", "N/A": "#6b7280" };
                    const sBg = { PASS: "#f0fdf4", FAIL: "#fef2f2", WARN: "#fffbeb", "N/A": "#f9fafb" };
                    return rSec(secNum + ". Regulatory Compliance Matrix", (
                      <div>
                        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                          <div style={{ padding: "6px 12px", background: comp.compliant ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (comp.compliant ? "#bbf7d0" : "#fecaca"), borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: comp.compliant ? "#166534" : "#991b1b" }}>{comp.compliant ? "COMPLIANT" : "NON-COMPLIANT"}</div>
                            <div style={{ fontSize: 9, color: "#6b7280" }}>{comp.summary.passed} pass | {comp.summary.failed} fail | {comp.summary.warned} warn</div>
                          </div>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc" }}>
                              {["Status", "Category", "Reference", "Requirement", "Finding"].map(h => (
                                <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {comp.checks.map((c, i) => (
                              <tr key={i} style={{ background: sBg[c.status] }}>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                                  <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, color: sCol[c.status], background: c.status === "PASS" ? "#bbf7d0" : c.status === "FAIL" ? "#fecaca" : c.status === "WARN" ? "#fde68a" : "#e5e7eb" }}>{c.status}</span>
                                </td>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>{c.cat}</td>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", whiteSpace: "nowrap" }}>{c.ref}</td>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", color: "#1f2937" }}>{c.rule}</td>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>{c.detail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}

                  {/* VERTIPORT SECTION (conditional) */}
                  {(proj.mode === "vertiport" || proj.facility === "vertiport" || getHeli(proj).tp === "evtol") && (() => {
                    const vz = bestZ;
                    const vp = vz.vport || {};
                    const secN = bObs.pens.length > 0 ? 10 : 9;
                    return rSec(secN + ". Vertiport / eVTOL Assessment", (
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Aircraft Type</span><span style={{ fontSize: 11, fontWeight: 600 }}>{getHeli(proj).tp === "evtol" ? "eVTOL" : "Helicopter"}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Number of Pads</span><span style={{ fontSize: 11, fontWeight: 600 }}>{vp.pads || 1}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Charging</span><span style={{ fontSize: 11, fontWeight: 600 }}>{vp.charging ? "Yes (" + (vp.chargePoints || 0) + " points)" : "No"}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Turnaround</span><span style={{ fontSize: 11, fontWeight: 600 }}>{vp.turnaround || 10} min</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Passenger Flow</span><span style={{ fontSize: 11, fontWeight: 600 }}>{vp.paxFlow || "walk"}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Terminal</span><span style={{ fontSize: 11, fontWeight: 600 }}>{vp.terminal ? "Connected" : "Standalone"}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Est. Throughput</span><span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb" }}>{Math.round(60 / (vp.turnaround || 10) * (vp.pads || 1))} ops/hr</span></div>
                          {getHeli(proj).pax && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Pax/Flight</span><span style={{ fontSize: 11, fontWeight: 600 }}>{getHeli(proj).pax}</span></div>}
                        </div>
                      </div>
                    ));
                  })()}

                  {/* AUDIT LOG in report */}
                  {(proj.auditLog || []).length > 0 && (() => {
                    const secN = (bObs.pens.length > 0 ? 10 : 9) + ((proj.mode === "vertiport" || proj.facility === "vertiport" || getHeli(proj).tp === "evtol") ? 1 : 0);
                    return rSec(secN + ". Project Audit Trail", (
                      <div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                          <thead><tr style={{ background: "#f8fafc" }}>
                            {["Date/Time", "Action", "Details"].map(h => <th key={h} style={{ padding: "4px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {(proj.auditLog || []).map((log, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "3px 6px", color: "#6b7280", whiteSpace: "nowrap" }}>{new Date(log.ts).toLocaleString("en-GB")}</td>
                                <td style={{ padding: "3px 6px", fontWeight: 600, color: "#1f2937" }}>{log.action}</td>
                                <td style={{ padding: "3px 6px", color: "#6b7280" }}>{log.detail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}

                  {/* ASSUMPTIONS */}
                  {rSec((bObs.pens.length > 0 ? 11 : 10) + ((proj.mode === "vertiport" || proj.facility === "vertiport" || getHeli(proj).tp === "evtol") ? 1 : 0) + ((proj.auditLog || []).length > 0 ? 1 : 0) + ". Assumptions & Limitations", (
                    <div style={{ fontSize: 10, color: "#6b7280" }}>
                      <p style={{ margin: "0 0 4px" }}>• Wind data based on input frequencies; full wind rose study recommended for detailed design.</p>
                      <p style={{ margin: "0 0 4px" }}>• Obstacle positions are approximate; topographic survey required to confirm distances and heights.</p>
                      <p style={{ margin: "0 0 4px" }}>• Terrain slopes are estimated; geotechnical investigation required for foundation design.</p>
                      <p style={{ margin: "0 0 4px" }}>• OLS analysis uses simplified 2D cross-section; full 3D OLS assessment per ICAO Annex 14 Vol II required.</p>
                      <p style={{ margin: "0 0 4px" }}>• Scoring weights may be adjusted based on project-specific priorities.</p>
                      <p style={{ margin: "0 0 4px" }}>• This assessment does not replace formal authority approval per GACAR Part 138.</p>
                    </div>
                  ))}

                  {/* FOOTER */}
                  <div style={{ marginTop: 28, paddingTop: 12, borderTop: "2px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9ca3af" }}>
                    <span>Generated by Heli-VertiSafe v4.2 — Site Intelligence Platform</span>
                    <span>{today}</span>
                  </div>
                </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const views = [renderProject, renderSite, renderZones, renderData, renderScore, renderResults];

  // ═══ WELCOME SCREEN ═══
  if (mode === "welcome") {
    const templates = [
      { id: "hospital", icon: "🏥", nm: "Hospital Helipad", desc: "EMS rooftop or ground-level helipad", dh: "h145", pc: "pc2", facility: "hospital_pad", sw: 300, sh: 300 },
      { id: "offshore", icon: "🛢", nm: "Offshore Platform", desc: "Oil & gas platform helideck", dh: "s92", pc: "pc2", facility: "heliport", sw: 200, sh: 200 },
      { id: "military", icon: "🎖", nm: "Military / Government", desc: "Military base or government compound", dh: "bell412", pc: "pc1", facility: "heliport", sw: 500, sh: 500 },
      { id: "corporate", icon: "🏢", nm: "Corporate / Private", desc: "Office rooftop or estate helipad", dh: "aw139", pc: "pc2", facility: "heliport", sw: 400, sh: 400 },
      { id: "vertiport", icon: "⚡", nm: "eVTOL Vertiport", desc: "Urban air mobility vertiport", dh: "joby_s4", pc: "pc1", facility: "vertiport", md: "vertiport", sw: 250, sh: 250 },
      { id: "custom", icon: "📐", nm: "Custom Project", desc: "Blank project — configure everything", dh: "bell412", pc: "pc2", facility: "heliport", sw: 500, sh: 500 },
    ];
    const startProject = (t) => {
      dp({ type: "RESET" });
      if (t.id !== "custom") {
        dp({ type: "UP", payload: { dh: t.dh, pc: t.pc, facility: t.facility, mode: t.md || "feasibility" } });
        dp({ type: "US", payload: { sw: t.sw, sh: t.sh } });
      }
      setMode("app");
    };
    return (
      <div style={{ background: "linear-gradient(180deg, #030810 0%, #050a12 30%, #0a1628 100%)", minHeight: "100vh", color: K.tx, fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          @keyframes gradShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          .w-card { background: rgba(11,17,32,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(26,45,74,0.5); border-radius: 12px; padding: 20px; cursor: pointer; transition: all 0.25s; }
          .w-card:hover { border-color: #06b6d4; transform: translateY(-3px); box-shadow: 0 8px 30px rgba(6,182,212,0.15); }
          .w-btn { background: rgba(11,17,32,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(26,45,74,0.5); border-radius: 12px; cursor: pointer; transition: all 0.25s; color: #e1e7ef; font-family: inherit; }
          .w-btn:hover { border-color: #10b981; transform: translateY(-2px); box-shadow: 0 4px 20px rgba(16,185,129,0.15); }
        `}</style>
        <div style={{ textAlign: "center", marginBottom: 40, animation: "fadeUp 0.6s ease-out" }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: "linear-gradient(135deg, #2563eb, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 14px", boxShadow: "0 8px 32px rgba(37,99,235,0.3)", animation: "float 3s ease-in-out infinite" }}>🚁</div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.5, margin: "0 0 4px" }}>Heli-<span style={{ background: "linear-gradient(135deg, #06b6d4, #2563eb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundSize: "200% 200%", animation: "gradShift 3s ease infinite" }}>VertiSafe</span></h1>
          <p style={{ fontSize: 12, color: K.cy, fontWeight: 600, letterSpacing: 3, margin: "0 0 8px" }}>SITE INTELLIGENCE PLATFORM</p>
          <p style={{ fontSize: 13, color: K.dm, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>Helipad & vertiport feasibility analysis — ICAO Annex 14 Vol II / GACAR Part 138 compliant. Score zones, check OLS, generate reports.</p>
        </div>
        <div style={{ maxWidth: 860, width: "100%", animation: "fadeUp 0.8s ease-out" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: K.mu, letterSpacing: 2, textAlign: "center", marginBottom: 14 }}>START A NEW PROJECT</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            {templates.map(t => (
              <div key={t.id} className="w-card" onClick={() => startProject(t)}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{t.nm}</div>
                <div style={{ fontSize: 10, color: K.dm, lineHeight: 1.4, marginBottom: 8 }}>{t.desc}</div>
                {t.id !== "custom" && <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: K.cy + "15", color: K.cy }}>{HELIS.find(h => h.id === t.dh)?.nm}</span>
                  <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: K.pu + "15", color: K.pu }}>{PC_DATA[t.pc]?.label}</span>
                </div>}
              </div>
            ))}
          </div>
          {/* RESUME / DEMO / IMPORT */}
          {hasAutoSave && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <button onClick={async () => {
                const d = await loadAutoSave("hvs-autosave");
                if (d) { dp({ type: "IMPORT", payload: d }); setMode("app"); }
              }} className="w-btn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 28px", border: "1px solid " + K.cy + "40", width: "100%", maxWidth: 420 }}>
                <span style={{ fontSize: 22 }}>🔄</span>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: K.cy }}>Resume Last Session</div>
                  <div style={{ fontSize: 10, color: K.dm }}>Auto-saved project found — continue where you left off</div>
                </div>
              </button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={() => { dp({ type: "DEMO" }); setMode("app"); }} className="w-btn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px" }}>
              <span style={{ fontSize: 20 }}>🎮</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: K.gn }}>Explore Demo</div>
                <div style={{ fontSize: 9, color: K.dm }}>Al Arab Hospital — 9 zones, obstacles, wind, sensitivity</div>
              </div>
            </button>
            <button onClick={() => {
              const input = document.createElement("input"); input.type = "file"; input.accept = ".json,.hvs.json";
              input.onchange = (e) => { const f = e.target.files[0]; if (!f) return;
                const r = new FileReader(); r.onload = (ev) => { try { dp({ type: "IMPORT", payload: JSON.parse(ev.target.result) }); setMode("app"); } catch(err) { console.error(err); } }; r.readAsText(f);
              }; input.click();
            }} className="w-btn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px" }}>
              <span style={{ fontSize: 20 }}>📂</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Import Project</div>
                <div style={{ fontSize: 9, color: K.dm }}>Load a saved .hvs.json file</div>
              </div>
            </button>
          </div>
          <div style={{ textAlign: "center", padding: "14px 0", borderTop: "1px solid " + K.bd }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 6 }}>
              {["ICAO Annex 14 Vol II", "GACAR Part 138", "Saudi Building Code", "FAA AC 150/5390"].map(s => <span key={s} style={{ fontSize: 8, color: K.mu }}>{s}</span>)}
            </div>
            <p style={{ fontSize: 8, color: K.bd }}>v4.5 — Built for aviation professionals</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "linear-gradient(180deg, #030810 0%, #050a12 30%, #0a1628 100%)", minHeight: "100vh", color: K.tx, fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 4px rgba(37,99,235,0.3); } 50% { box-shadow: 0 0 12px rgba(37,99,235,0.6); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .hvs-card { background: rgba(11,17,32,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(26,45,74,0.6); border-radius: 10px; transition: all 0.2s; }
        .hvs-card:hover { border-color: rgba(37,99,235,0.3); box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .hvs-glass { background: linear-gradient(135deg, rgba(11,17,32,0.8) 0%, rgba(16,29,48,0.6) 100%); backdrop-filter: blur(16px); border: 1px solid rgba(26,45,74,0.5); }
        .hvs-glow { animation: glow 2s ease-in-out infinite; }
        .hvs-slide { animation: slideIn 0.3s ease-out; }
        .hvs-pulse { animation: pulse 2s ease-in-out infinite; }
        .hvs-shimmer { background: linear-gradient(90deg, transparent 25%, rgba(37,99,235,0.08) 50%, transparent 75%); background-size: 200% 100%; animation: shimmer 3s infinite; }
        .hvs-btn { transition: all 0.15s; position: relative; overflow: hidden; }
        .hvs-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .hvs-btn:active { transform: translateY(0); }
        input[type="range"] { height: 4px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 7px; cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0b1120; } ::-webkit-scrollbar-thumb { background: #1a2d4a; border-radius: 2px; }
      `}</style>
      <div style={{ background: "linear-gradient(180deg, rgba(11,17,32,0.95) 0%, rgba(11,17,32,0.8) 100%)", backdropFilter: "blur(20px)", borderBottom: "1px solid " + K.bd, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={() => setMode("welcome")} style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg," + K.bl + "," + K.cy + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 2px 10px rgba(37,99,235,0.3)", cursor: "pointer" }} title="Back to Home">🚁</div>
          <div><div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.5 }}>Heli-VertiSafe</div><div style={{ fontSize: 8, color: K.cy, letterSpacing: 2, fontWeight: 600 }}>v5.0 SITE INTELLIGENCE</div></div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span title="Undo (Ctrl+Z)">{btn("↩", () => dp({ type: "UNDO" }), "ghost", !canUndo)}</span>
          <span title="Redo (Ctrl+Y)">{btn("↪", () => dp({ type: "REDO" }), "ghost", !canRedo)}</span>
          <span style={{ fontSize: 8, color: K.gn + "80" }} title="Auto-save active">💾</span>
          {proj.nm && <Tag color={K.bl}>{proj.nm}</Tag>}
          <Tag color={K.cy}>D={D}m</Tag>
          <Tag color={K.pu}>XW≤{getXwLim(proj)}kt</Tag>
          {(() => { const wf = WORKFLOW_STATES.find(s => s.v === (proj.workflow || "draft")) || WORKFLOW_STATES[0]; return <Tag color={wf.c}>{wf.l}</Tag>; })()}
          {btn("📤", () => {
            const data = JSON.stringify({ v: "5.0", proj, site, zones: zones.map(z => ({ ...z, sc: null })), scenarios }, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = (proj.nm || "project").replace(/\s+/g, "_") + ".hvs.json"; a.click();
          }, "ghost")}
          {btn("📥", () => {
            const input = document.createElement("input"); input.type = "file"; input.accept = ".json,.hvs.json";
            input.onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
              r.onload = (ev) => { try { const d = JSON.parse(ev.target.result); if (d.proj && d.site && d.zones) dp({ type: "IMPORT", payload: d }); } catch(err) { console.error(err); } };
              r.readAsText(f); };
            input.click();
          }, "ghost")}
          {btn("Demo", () => dp({ type: "DEMO" }), "ghost")}
          {btn("Reset", () => dp({ type: "RESET" }), "ghost")}
        </div>
      </div>
      <div className="hvs-glass" style={{ borderBottom: "1px solid " + K.bd, padding: "0 16px", display: "flex", overflowX: "auto" }}>
        {STEPS_DEF.map((s, i) => <div key={i} onClick={() => dp({ type: "STEP", payload: i })} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "2px solid " + (i === step ? K.cy : "transparent"), display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", background: i === step ? K.cy + "08" : "transparent" }}>
          <span style={{ width: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, background: i < step ? K.gn : i === step ? K.cy : K.bd, color: i <= step ? "#fff" : K.mu }}>{i < step ? "✓" : i + 1}</span>
          <span style={{ fontSize: 10, fontWeight: i === step ? 700 : 400, color: i === step ? K.tx : i < step ? K.gn : K.mu, whiteSpace: "nowrap" }}>{s.l}</span>
        </div>)}
      </div>
      <div className="hvs-slide" style={{ padding: 16, maxWidth: 1080, margin: "0 auto", paddingBottom: 70 }}>
        <ErrorBoundary label={"Step " + (step + 1) + ": " + STEPS_DEF[step]?.l}>{views[step]()}</ErrorBoundary>
      </div>
      <div className="hvs-glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, borderTop: "1px solid " + K.bd, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50 }}>
        {btn("← Back", () => dp({ type: "STEP", payload: Math.max(0, step - 1) }), "ghost", step === 0)}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {STEPS_DEF.map((_, i) => <div key={i} style={{ width: i === step ? 16 : 6, height: 6, borderRadius: 3, background: i < step ? K.gn : i === step ? K.cy : K.bd, transition: "all 0.3s" }} />)}
          <span style={{ fontSize: 8, color: K.mu, marginLeft: 8 }}>Ctrl+Z undo | ←→ zones</span>
        </div>
        {step < 4 ? btn("Next →", () => dp({ type: "STEP", payload: step + 1 }), "primary", !canNext) :
          step === 4 ? btn("⚡ Run Analysis", () => { dp({ type: "RUN" }); setTimeout(() => { const rk = zones.filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot); if (rk[0]?.sc?.tot >= 60) setShowConfetti(true); setTimeout(() => setShowConfetti(false), 100); }, 500); }, "accent", !zones.some(z => z.on)) :
            btn("New Project", () => dp({ type: "RESET" }), "ghost")}
      </div>
    </div>
  );
}
