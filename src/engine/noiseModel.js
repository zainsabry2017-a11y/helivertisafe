/**
 * Simplified outdoor noise (5.5): geometric + soft-ground absorption.
 * L(d) = Lref - 20*log10(d/dref) - 1.5 * log2(max(d/dref, 1))
 */
import { getHeli } from "../data/models.js";
import { zoneCentroid } from "./geometry.js";

function sensDistM(sz, cx, cy) {
  if (sz.dist > 0) return sz.dist;
  if (sz.x != null && sz.y != null) return Math.hypot(sz.x - cx, sz.y - cy);
  return null;
}

/** Reference SPL at dref for types (ICAO-style indicative; tune per project). */
const NOISE_LEPDBY_HELI = {
  bell412: { lref: 94, dref: 150 },
  h145: { lref: 91, dref: 150 },
  aw139: { lref: 93, dref: 150 },
  s92: { lref: 96, dref: 180 },
  h135: { lref: 88, dref: 150 },
  bell429: { lref: 90, dref: 150 },
  aw169: { lref: 92, dref: 150 },
  ehang216: { lref: 82, dref: 80 },
  joby_s4: { lref: 84, dref: 100 },
  lilium_jet: { lref: 86, dref: 120 },
  custom: { lref: 92, dref: 150 },
};

export function getNoiseRef(proj) {
  const hl = getHeli(proj);
  return NOISE_LEPDBY_HELI[hl.id] || NOISE_LEPDBY_HELI.custom;
}

export function splAtDistance(distM, proj, softGround = true) {
  if (!(distM > 0)) return 999;
  const { lref, dref } = getNoiseRef(proj);
  const r = Math.max(distM / dref, 1e-6);
  let L = lref - 20 * Math.log10(r);
  if (softGround && r > 1) L -= 1.5 * (Math.log(r) / Math.LN2);
  return L;
}

/** Radii (m) where SPL <= targetDb (iterative search). */
export function radiusForSpl(targetDb, proj, softGround = true) {
  const { dref } = getNoiseRef(proj);
  let lo = dref * 0.01;
  let hi = dref * 400;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (splAtDistance(mid, proj, softGround) > targetDb) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const CONTOUR_DBS = [65, 70, 75, 80];

export function noiseContourRadii(proj, levels = CONTOUR_DBS, softGround = true) {
  return levels.map((db) => ({ db, r: radiusForSpl(db, proj, softGround) }));
}

/** Environment / noise: max SPL at sensitivity nodes, contour hits. */
export function noiseImpactOnZone(z, proj) {
  const cent = zoneCentroid(z);
  const rings = noiseContourRadii(proj);
  const sensitivities = [];
  for (const sz of z.sens || []) {
    const dist = sensDistM(sz, cent.x, cent.y);
    if (dist == null || !(dist >= 0)) continue;
    const l = splAtDistance(dist, proj);
    sensitivities.push({ nm: sz.nm, dist, estDb: l, level: sz.level, tp: sz.tp });
  }
  const contourHits = {};
  for (const { db, r } of rings) {
    contourHits[db] = (z.sens || []).filter((sz) => {
      const d = sensDistM(sz, cent.x, cent.y);
      return d != null && d < r;
    }).length;
  }
  const maxDbAtSens = sensitivities.length ? Math.max(...sensitivities.map((s) => s.estDb)) : 0;
  return { rings, sensitivities, contourHits, maxDbAtSens };
}
