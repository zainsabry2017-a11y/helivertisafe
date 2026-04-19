/**
 * Central formulas used for heliport / FATO screening (simplified ICAO Annex 14 Vol II style).
 *
 * The real obstacle limitation surface (OLS) set is 3‑D, sectorised, and depends on approach
 * direction, heliport type, and aerodrome reference point — not a single cone from a zone
 * centroid. These functions encode the *numerical* rules applied elsewhere in the app so they
 * stay consistent (scoring, geometry, charts, compliance narratives).
 *
 * See docs/REGULATORY_ENGINE_REFERENCE.md for scope, gaps, and citation hygiene.
 */

/** Minimum TLOF diameter as a fraction of D (rotor diameter or declared dimension per project input). */
export const TLOF_DIAMETER_FACTOR = 0.83;

/** Default approach/departure outer slope (rise:run 1:22.22) as gradient m/m. */
export const DEFAULT_APPROACH_GRADIENT = 1 / 22.22;

/** Simplified inner transitional slope used in this app (rise:run 1:2) as gradient m/m. */
export const DEFAULT_TRANSITIONAL_GRADIENT = 1 / 2;

/**
 * Square FATO side length (m) and safety area strip width (m), TLOF diameter, total pad extent.
 * @param {number} D — characteristic dimension (m), typically rotor diameter
 * @param {{ fatoMin: number, sa: number }} pc — performance class multipliers from PC_DATA
 */
export function helipadFootprintMetres(D, pc) {
  const fato = D * pc.fatoMin;
  const sa = Math.max(D * pc.sa, 3);
  const tlof = D * TLOF_DIAMETER_FACTOR;
  const tot = fato + 2 * sa;
  return { fato, sa, tlof, tot };
}

/**
 * Simplified OLS: maximum obstacle height AGL (m) allowed at horizontal distance distM (m)
 * along a plane of constant gradient (m rise per m run).
 */
export function maxObstacleHeightAtDistance(distM, gradient) {
  return distM * gradient;
}

export { COMPLIANCE_REF } from "../data/complianceCitations.js";
