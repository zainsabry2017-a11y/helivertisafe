// Auto-extracted from helivertisafe.jsx
export const DEG = Math.PI / 180;
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══ BIDIRECTIONAL COORDINATE CONVERSION ═══
// X,Y → Distance,Bearing (from origin 0,0)
export const xy2db = (x, y) => ({
  d: Math.round(Math.sqrt(x * x + y * y) * 10) / 10,
  br: Math.round(((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360)
});
// Distance,Bearing → X,Y
export const db2xy = (d, br) => ({
  x: Math.round(d * Math.sin(br * Math.PI / 180) * 10) / 10,
  y: Math.round(d * Math.cos(br * Math.PI / 180) * 10) / 10
});
// Auto-calc: when one pair changes, update the other
export function autoCalcCoords(obj, fld, val) {
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
