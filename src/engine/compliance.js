import { SOIL_DATA } from "../data/constants.js";
import { calcGeom, getHeli, getPc } from "../data/models.js";
import { COMPLIANCE_REF, maxObstacleHeightAtDistance } from "./regulatoryFormulas.js";

/** Pass/fail matrix: see docs/REGULATORY_ENGINE_REFERENCE.md for formula scope and gaps. */
export function checkCompliance(zone, proj, site) {
  void site;
  const G = calcGeom(proj);
  const pc = getPc(proj);
  const hl = getHeli(proj);
  const ori = zone.sc?.ori;
  const checks = [];

  const pass = (cat, ref, rule, detail) => checks.push({ cat, ref, rule, status: "PASS", detail });
  const fail = (cat, ref, rule, detail) => checks.push({ cat, ref, rule, status: "FAIL", detail });
  const warn = (cat, ref, rule, detail) => checks.push({ cat, ref, rule, status: "WARN", detail });

  // ── FATO DIMENSIONS ──
  const zoneMin = Math.min(zone.bw, zone.bh);
  if (zoneMin >= G.tot) pass("FATO", COMPLIANCE_REF.ICAO_FATO_SA, "FATO size ≥ 1.0D with safety area", "Zone " + zoneMin.toFixed(0) + "m ≥ " + G.tot.toFixed(1) + "m required");
  else fail("FATO", COMPLIANCE_REF.ICAO_FATO_SA, "FATO size ≥ 1.0D with safety area", "Zone " + zoneMin.toFixed(0) + "m < " + G.tot.toFixed(1) + "m required");

  // TLOF within FATO
  if (G.tlof <= G.fato) pass("FATO", COMPLIANCE_REF.ICAO_TLOF, "TLOF ≥ 0.83D within FATO", "TLOF " + G.tlof.toFixed(1) + "m within FATO " + G.fato.toFixed(1) + "m");
  else fail("FATO", COMPLIANCE_REF.ICAO_TLOF, "TLOF ≥ 0.83D within FATO", "TLOF exceeds FATO");

  // Safety Area ≥ 3m or 0.25D
  if (G.sa >= 3) pass("FATO", COMPLIANCE_REF.ICAO_SA_WIDTH, "Safety area ≥ 3m or 0.25D", "SA = " + G.sa.toFixed(1) + "m");
  else fail("FATO", COMPLIANCE_REF.ICAO_SA_WIDTH, "Safety area ≥ 3m or 0.25D", "SA = " + G.sa.toFixed(1) + "m < 3m");

  // ── SLOPES ──
  if (zone.ter.slope <= pc.maxSlope) pass("Slopes", COMPLIANCE_REF.GACAR_SLOPE, "FATO longitudinal slope ≤ " + pc.maxSlope + "%", "Slope " + zone.ter.slope + "%");
  else fail("Slopes", COMPLIANCE_REF.GACAR_SLOPE, "FATO longitudinal slope ≤ " + pc.maxSlope + "%", "Slope " + zone.ter.slope + "% exceeds limit");

  if (zone.ter.side <= pc.maxSlope) pass("Slopes", COMPLIANCE_REF.GACAR_SLOPE, "FATO transverse (side) slope ≤ " + pc.maxSlope + "%", "Side slope " + zone.ter.side + "%");
  else fail("Slopes", COMPLIANCE_REF.GACAR_SLOPE, "FATO transverse (side) slope ≤ " + pc.maxSlope + "%", "Side slope " + zone.ter.side + "% exceeds limit");

  if (zone.ter.slope <= pc.maxSA) pass("Slopes", COMPLIANCE_REF.ICAO_SA_SLOPE, "Safety area slope ≤ " + pc.maxSA + "% (downward)", "Ground slope " + zone.ter.slope + "%");
  else warn("Slopes", COMPLIANCE_REF.ICAO_SA_SLOPE, "Safety area slope ≤ " + pc.maxSA + "%", "Slope " + zone.ter.slope + "% — verify SA grading");

  // ── WIND ──
  const tf = zone.wind.pf + zone.wind.sf + zone.wind.calm;
  if (tf >= 95) pass("Wind", COMPLIANCE_REF.WIND_COVERAGE, "Wind data coverage ≥ 95%", "Coverage " + tf + "%");
  else if (tf > 0) warn("Wind", COMPLIANCE_REF.WIND_COVERAGE, "Wind data coverage ≥ 95%", "Coverage " + tf + "% — additional data recommended");
  else warn("Wind", COMPLIANCE_REF.WIND_COVERAGE, "Wind data coverage ≥ 95%", "No wind data entered");

  if (ori && ori.ok) pass("Wind", COMPLIANCE_REF.ICAO_ORIENTATION, "FATO orientation provides ≥ 95% usability", "Heading " + ori.hp + " = " + ori.us + "%");
  else if (ori) fail("Wind", COMPLIANCE_REF.ICAO_ORIENTATION, "FATO orientation provides ≥ 95% usability", "Best heading " + ori.hp + " = " + ori.us + "%");

  if (ori && ori.xm <= ori.lim) pass("Wind", COMPLIANCE_REF.GACAR_XWIND, "Max crosswind ≤ " + ori.lim + "kt (" + hl.cat + ")", "XW " + ori.xm + "kt");
  else if (ori) fail("Wind", COMPLIANCE_REF.GACAR_XWIND, "Max crosswind ≤ " + ori.lim + "kt (" + hl.cat + ")", "XW " + ori.xm + "kt exceeds limit");

  // ── OLS / OBSTACLES ──
  const pens18 = (zone.sc?.bd?.obs?.pens || []).filter(p => p.p18);
  const pens12 = (zone.sc?.bd?.obs?.pens || []).filter(p => p.p12 && !p.p18);

  if (pens18.length === 0 && zone.obs.length > 0) pass("OLS", COMPLIANCE_REF.ICAO_OLS_18, "No penetrations of OLS envelope (segmented approach/departure)", "All " + zone.obs.length + " obstacles clear");
  else if (pens18.length > 0) fail("OLS", COMPLIANCE_REF.ICAO_OLS_18, "No penetrations of OLS envelope (segmented approach/departure)", pens18.length + " obstacle(s) penetrate: " + pens18.map(p => p.nm + " (+" + p.ex + "m)").join(", "));
  else if (zone.obs.length === 0) warn("OLS", COMPLIANCE_REF.ICAO_OLS_18, "No penetrations of OLS envelope (segmented approach/departure)", "No obstacles entered — survey required");

  if (pens12.length === 0 && zone.obs.length > 0) pass("OLS", COMPLIANCE_REF.ICAO_OLS_12, "No penetrations of 1:2 transitional surface", "Clear");
  else if (pens12.length > 0) warn("OLS", COMPLIANCE_REF.ICAO_OLS_12, "No penetrations of 1:2 transitional surface", pens12.length + " obstacle(s) in transitional zone");
  else if (zone.obs.length === 0) warn("OLS", COMPLIANCE_REF.ICAO_OLS_12, "No penetrations of 1:2 transitional surface", "No obstacles entered — survey required");

  // Obstacles within 2D
  const close = zone.obs.filter(o => o.d > 0 && o.d < G.D * 2);
  if (close.length === 0) pass("OLS", COMPLIANCE_REF.GACAR_OBS_2D, "No fixed obstacles within 2D of FATO center", "Clear within " + (G.D * 2).toFixed(0) + "m");
  else fail("OLS", COMPLIANCE_REF.GACAR_OBS_2D, "No fixed obstacles within 2D of FATO center", close.length + " obstacle(s): " + close.map(o => o.nm + " at " + o.d + "m").join(", "));

  // Lit/marked obstacles
  const unlitPen = zone.obs.filter(o => o.d > 0 && o.h > maxObstacleHeightAtDistance(o.d, G.appG) && !o.lit);
  if (unlitPen.length === 0) pass("OLS", COMPLIANCE_REF.ICAO_OBS_LIT, "Penetrating obstacles marked/lit", "All penetrating obstacles lit or no penetrations");
  else warn("OLS", COMPLIANCE_REF.ICAO_OBS_LIT, "Penetrating obstacles marked/lit", unlitPen.length + " unlit penetrating obstacle(s)");

  // ── ACCESS ──
  if (zone.acc.emer) pass("Access", COMPLIANCE_REF.GACAR_EMER_ACCESS, "Emergency vehicle access provided", "Available");
  else fail("Access", COMPLIANCE_REF.GACAR_EMER_ACCESS, "Emergency vehicle access provided", "No emergency vehicle access");

  if (zone.acc.bd >= 30 || zone.acc.bd === 0) pass("Access", COMPLIANCE_REF.GACAR_BUILDING_CLR, "Minimum 30m clearance from occupied buildings", zone.acc.bd > 0 ? zone.acc.bd + "m" : "Not specified — verify");
  else fail("Access", COMPLIANCE_REF.GACAR_BUILDING_CLR, "Minimum 30m clearance from occupied buildings", zone.acc.bd + "m < 30m minimum");

  if (zone.acc.road) pass("Access", COMPLIANCE_REF.GACAR_ROAD, "Ground access road to helipad", "Road at " + zone.acc.rd + "m");
  else warn("Access", COMPLIANCE_REF.GACAR_ROAD, "Ground access road to helipad", "No road access — consider access road");

  // ── TERRAIN ──
  const soil = SOIL_DATA.find(s => s.value === zone.ter.soil);
  const needCBR = hl.mtow > 5000 ? 30 : 15;
  if (soil && soil.cbr >= needCBR) pass("Terrain", COMPLIANCE_REF.SBC_SOIL, "Soil bearing adequate for " + hl.mtow + "kg MTOW", soil.label + " CBR ~" + soil.cbr);
  else if (soil) warn("Terrain", COMPLIANCE_REF.SBC_SOIL, "Soil bearing adequate for " + hl.mtow + "kg MTOW", soil.label + " CBR ~" + soil.cbr + " — geotechnical study needed");

  if (!zone.ter.flood) pass("Terrain", COMPLIANCE_REF.GACAR_FLOOD, "No flood risk at FATO location", "No flood risk reported");
  else fail("Terrain", COMPLIANCE_REF.GACAR_FLOOD, "No flood risk at FATO location", "Flood risk identified — drainage required");

  if (Math.abs(zone.ter.cf) <= 2) pass("Terrain", COMPLIANCE_REF.ICAO_EARTHWORKS, "Minimal earthworks for FATO construction", "Cut/Fill " + Math.abs(zone.ter.cf) + "m");
  else warn("Terrain", COMPLIANCE_REF.ICAO_EARTHWORKS, "Minimal earthworks for FATO construction", "Cut/Fill " + Math.abs(zone.ter.cf) + "m — significant grading");

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
