import { DEG } from "../utils/coords.js";
import { obsNearestVector } from "./geometry.js";

/**
 * Annex 14 Vol II–style OLS screening (elevated/simplified heliport model).
 * - Directional: approach & departure corridors along FATO heading ±180°, segmented inner (1:2) + outer (1:22.22), lateral splay.
 * - Omnidirectional fallback: radial limits when no usable wind/orientation (same as legacy).
 */

function corridorHeightAlongAxis(s, innerLenM, outerLenM, innerG, outerG) {
  if (s <= 0) return 0;
  if (s <= innerLenM) return s * innerG;
  if (s <= innerLenM + outerLenM) {
    return innerLenM * innerG + (s - innerLenM) * outerG;
  }
  return innerLenM * innerG + outerLenM * outerG;
}

function heightAllowAlongCorridor(along, lateral, fatoHalf, innerLenM, outerLenM, innerG, outerG, splay) {
  if (along < fatoHalf) return null;
  const s = along - fatoHalf;
  const halfWidth = fatoHalf + splay * s;
  if (lateral > halfWidth) return null;
  return corridorHeightAlongAxis(s, innerLenM, outerLenM, innerG, outerG);
}

/**
 * @param {object} obs
 * @param {{ x: number, y: number }} centroid
 * @param {number} fatoHeadingDeg — landing direction (deg), same convention as calcOrientation.oh
 * @param {object} G — calcGeom(proj)
 * @param {object} pc — getPc(proj)
 * @param {boolean} useDirectional — false → legacy radial screening (no wind / no coverage)
 */
export function evaluateObstacleOLS(obs, centroid, fatoHeadingDeg, G, pc, useDirectional) {
  const { dx, dy, d } = obsNearestVector(obs, centroid.x, centroid.y);

  const innerLenM = pc.innerLenM ?? (pc.innerLenFactor * G.D);
  const outerLenM = pc.outerLenM;
  const innerG = pc.innerG;
  const outerG = pc.outerG ?? pc.appG;
  const transG = pc.transG;
  const splay = pc.splay;
  const fatoHalf = G.fato / 2;

  const radial18 = d * pc.appG;
  const radial12 = d * transG;
  const pIH = false;

  if (!useDirectional || d <= 0) {
    const p18 = obs.h > radial18;
    const p12 = obs.h > radial12 && !p18;
    return {
      mode: "omni",
      hAllow: radial18,
      a18: radial18,
      a12: radial12,
      p18,
      p12,
      pIH,
      ex: Math.max(0, obs.h - radial18),
      ratio: obs.h / d,
      dist: d,
      along: null,
      lateral: null,
    };
  }

  let hMin = Infinity;
  for (const base of [fatoHeadingDeg, fatoHeadingDeg + 180]) {
    const θ = ((base % 360) + 360) % 360;
    const t = θ * DEG;
    const sin = Math.sin(t);
    const cos = Math.cos(t);
    const along = -(dx * sin + dy * cos);
    const lateral = Math.abs(dx * cos - dy * sin);
    const h = heightAllowAlongCorridor(along, lateral, fatoHalf, innerLenM, outerLenM, innerG, outerG, splay);
    if (h != null) hMin = Math.min(hMin, h);
  }

  const hTrans = radial12;
  const hAllow = Math.min(hMin === Infinity ? hTrans : hMin, hTrans);
  const p18 = obs.h > hAllow;
  const p12 = obs.h > radial12 && !p18;
  return {
    mode: "directional",
    hAllow,
    a18: hAllow,
    a12: radial12,
    p18,
    p12,
    pIH,
    ex: Math.max(0, obs.h - hAllow),
    ratio: obs.h / d,
    dist: d,
    along: null,
    lateral: null,
  };
}
