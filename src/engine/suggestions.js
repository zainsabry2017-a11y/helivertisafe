import { calcGeom, getHeli, getXwLim } from "../data/models.js";

export function genSuggestions(zones, proj, site) {
  void site;
  const suggestions = [];
  const rk = zones.filter(z => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
  if (!rk.length) return suggestions;
  const best = rk[0];
  const G = calcGeom(proj);

  // Wind-based heading suggestion
  if (best.sc?.ori) {
    const ori = best.sc.ori;
    if (ori.us >= 95) suggestions.push({ type: "success", text: "Heading " + ori.hp + " achieves " + ori.us + "% wind coverage — ICAO compliant" });
    else suggestions.push({ type: "warning", text: "Best heading " + ori.hp + " only " + ori.us + "% coverage (need 95%). Consider rotating FATO or reviewing wind data." });
    if (ori.xm > getXwLim(proj)) suggestions.push({ type: "danger", text: "Max crosswind " + ori.xm + "kt exceeds " + getXwLim(proj) + "kt limit for " + getHeli(proj).nm + ". Consider different aircraft or heading." });
  }

  // OLS penetrations
  const pens = best.sc?.bd?.obs?.pens?.filter(p => p.p18) || [];
  if (pens.length > 0) {
    const worst = pens.sort((a, b) => (b.h - b.d/8) - (a.h - a.d/8))[0];
    suggestions.push({ type: "danger", text: pens.length + " OLS penetration(s). Worst: " + worst.nm + " at " + worst.h + "m (limit " + (worst.d/8).toFixed(1) + "m). Options: remove obstacle, lower it, or move FATO further." });
  } else if (best.obs?.length > 0) {
    suggestions.push({ type: "success", text: "All obstacles clear of approach OLS surface" });
  }

  // Slope check
  if (best.ter?.slope > G.maxSlope) suggestions.push({ type: "warning", text: "Slope " + best.ter.slope + "% exceeds " + G.maxSlope + "% limit for " + (proj.pc === "pc1" ? "PC1" : "PC2/3") + ". Earthworks required." });

  // Close match
  if (rk.length >= 2 && rk[0].sc.tot - rk[1].sc.tot < 5) suggestions.push({ type: "info", text: "Close match: " + rk[0].lb + " (" + rk[0].sc.tot + ") vs " + rk[1].lb + " (" + rk[1].sc.tot + "). Review both zones in detail before deciding." });

  // Score improvement
  const weakest = Object.entries(best.sc?.bd || {}).sort((a, b) => a[1].s - b[1].s)[0];
  if (weakest && weakest[1].s < 60) {
    const names = { wind: "Wind", obs: "Obstacles", ter: "Terrain", acc: "Access", geo: "Geometry", env: "Environment" };
    suggestions.push({ type: "info", text: "Weakest category: " + (names[weakest[0]] || weakest[0]) + " (" + weakest[1].s + "/100). Improving this would have the biggest impact on overall score." });
  }

  // Sensitivity
  const highSens = (best.sens || []).filter(s => s.level === "high" && s.dist < 100);
  if (highSens.length) suggestions.push({ type: "warning", text: highSens.length + " high-sensitivity zone(s) within 100m: " + highSens.map(s => s.nm).join(", ") + ". Noise mitigation may be required." });

  return suggestions;
}
