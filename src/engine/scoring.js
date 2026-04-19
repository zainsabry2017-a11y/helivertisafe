import { clamp, DEG } from "../utils/coords.js";
import { SOIL_DATA, WT } from "../data/constants.js";
import { getHeli, getPc, getXwLim, calcGeom } from "../data/models.js";
import { zonePadCenter, angDiff, decomposeSlope } from "./geometry.js";
import { evaluateObstacleOLS } from "./olsEngine.js";
import { calcOrientation } from "./orientation.js";
import { noiseImpactOnZone } from "./noiseModel.js";

export function sWind(z, p) {
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

export function sObs(z, p) {
  const G = calcGeom(p);
  const pc = getPc(p);
  const cent = zonePadCenter(z);
  const ori = calcOrientation(z, p);
  const useDirectional = ori.reason !== "No wind data" && (z.wind.pf + z.wind.sf + z.wind.calm) > 0;
  let s = 100; const R = []; const pens = [];
  if (!z.obs.length) { R.push("No obstacles — verify"); return { s: 90, R, pens }; }
  for (const o of z.obs) {
    const ev = evaluateObstacleOLS(o, cent, ori.oh, G, pc, useDirectional);
    const dist = ev.dist;
    if (dist <= 0) continue;
    const a18 = ev.a18;
    const ratio = o.h / dist;
    const p18 = ev.p18;
    const p12 = ev.p12;
    const ex = Math.max(0, o.h - a18);
    const hasCorners = o.corners && o.corners.length >= 3;
    pens.push({
      nm: o.nm, h: o.h, d: Math.round(dist * 10) / 10, br: o.br, ratio: Math.round(ratio * 10000) / 10000,
      a18: Math.round(a18 * 10) / 10, p18, p12, pIH: false, olsMode: ev.mode,
      ex: Math.round(ex * 10) / 10, polygon: hasCorners,
    });
    if (p18) {
      const surf = ev.mode === "directional" ? "OLS corridor" : "approach radial";
      if (ex / Math.max(a18, 1) > 0.5) { s -= 35; R.push(o.nm + ": CRITICAL +" + ex.toFixed(1) + "m above " + surf + (hasCorners ? " (nearest corner)" : "")); }
      else { s -= 20; R.push(o.nm + ": pen " + surf + " (" + o.h + "m@" + dist.toFixed(0) + "m)"); }
    } else if (p12) { s -= 10; R.push(o.nm + ": pen 1:2 transitional"); }
    else if (ratio > 0.1) { s -= 5; R.push(o.nm + ": marginal ratio " + ratio.toFixed(3)); }
    if (dist < G.D * 2) { s -= 10; R.push(o.nm + ": within 2D (" + (G.D * 2).toFixed(0) + "m)"); }
    if (!o.perm) s += 3;
  }
  if (!R.length) R.push("All clear");
  return { s: clamp(s, 0, 100), R, pens };
}

export function sTer(z, p) {
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

export function sAcc(z) {
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

export function sGeo(z, p) {
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

export function sEnv(z, p) {
  const sens = z.sens || [];
  let s = 100; const R = [];
  if (!sens.length) { R.push("No sensitivity zones defined"); }
  else {
    for (const sz of sens) {
      const sev = sz.level === "high" ? 3 : sz.level === "medium" ? 2 : 1;
      if (sz.dist > 0 && sz.dist < 100) { s -= sev * 12; R.push(sz.nm + " (" + sz.tp + ") at " + sz.dist + "m — " + sz.level + " sensitivity"); }
      else if (sz.dist > 0 && sz.dist < 250) { s -= sev * 5; R.push(sz.nm + " (" + sz.tp + ") at " + sz.dist + "m — within buffer"); }
      else if (sz.dist > 0 && sz.dist < 500) { s -= sev * 2; R.push(sz.nm + " at " + sz.dist + "m — monitor"); }
    }
    if (!R.length) R.push("No sensitive areas nearby");
  }
  if (p) {
    const ns = noiseImpactOnZone(z, p);
    if (ns.maxDbAtSens >= 80) { s -= 22; R.push("Approx. noise " + ns.maxDbAtSens.toFixed(0) + " dB at sensitivity (severe)"); }
    else if (ns.maxDbAtSens >= 75) { s -= 16; R.push("Approx. noise " + ns.maxDbAtSens.toFixed(0) + " dB at sensitivity"); }
    else if (ns.maxDbAtSens >= 70) { s -= 10; R.push("Noise ~" + ns.maxDbAtSens.toFixed(0) + " dB — 70 dBA contour engagement"); }
    else if (ns.maxDbAtSens >= 65) { s -= 5; R.push("Noise ~" + ns.maxDbAtSens.toFixed(0) + " dB near sensitivity"); }
    for (const lv of [80, 75, 70, 65]) {
      const n = ns.contourHits[lv] || 0;
      if (n > 0) R.push(n + " sensitivity zone(s) inside ~" + lv + " dBA contour");
    }
  }
  if (!sens.length && !p) return { s: 95, R: ["No sensitivity zones defined"] };
  return { s: clamp(s, 0, 100), R };
}

export function calcAllScores(z, p) {
  const wind = sWind(z, p), obs = sObs(z, p), ter = sTer(z, p), acc = sAcc(z), geo = sGeo(z, p), env = sEnv(z, p);
  const ori = calcOrientation(z, p);
  const w = p.wt || WT;
  const tot = Math.round((wind.s * w.wind + obs.s * w.obs + ter.s * w.ter + acc.s * w.acc + geo.s * w.geo + env.s * w.env) * 10) / 10;
  const gr = tot >= 80 ? "A" : tot >= 65 ? "B" : tot >= 50 ? "C" : tot >= 35 ? "D" : "F";
  const recMap = { A: "Highly Suitable", B: "Suitable — minor mods", C: "Marginal", D: "Poor", F: "Not Recommended" };
  return { tot, gr, rec: recMap[gr], bd: { wind, obs, ter, acc, geo, env }, ori };
}

export function makeRecs(zones, _p) {
  const rk = zones.filter(z => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
  if (!rk.length) return [];
  const b = rk[0]; const R = [];
  R.push({ recType: "recommendation", text: "Recommended: " + b.lb + " — " + b.sc.tot + "/100 (" + b.sc.gr + ")", detail: b.sc.rec });
  if (b.sc.ori) {
    R.push({
      recType: "heading",
      text: "FATO heading: " + b.sc.ori.hp + " (" + b.sc.ori.us + "% usability)",
      detail: b.sc.ori.ok ? "Meets ICAO 95% wind usability" : "Below ICAO 95% wind usability — review wind data or FATO orientation",
    });
  }
  if (b.sc.bd.wind.s < 70) R.push({ recType: "wind", text: "Align FATO " + b.wind.pd + "°", detail: b.sc.bd.wind.R.join("; ") });
  if (b.sc.bd.obs.s < 70) R.push({ recType: "obstacle", text: "Obstacle issue", detail: b.sc.bd.obs.R.join("; ") });
  if (b.sc.bd.ter.s < 70) R.push({ recType: "terrain", text: "Grading needed", detail: b.sc.bd.ter.R.join("; ") });
  if (b.sc.bd.env.s < 70) R.push({ recType: "sensitivity", text: "Sensitivity concern", detail: b.sc.bd.env.R.join("; ") });
  if (rk.length >= 2 && rk[0].sc.tot - rk[1].sc.tot < 5) {
    R.push({ recType: "close_match", text: "Close match: " + rk[0].lb + " vs " + rk[1].lb, detail: "Scores within 5 points — review both zones in detail." });
  }
  return R;
}
