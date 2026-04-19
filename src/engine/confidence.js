import { clamp } from "../utils/coords.js";
import { SRC_LEVELS } from "../data/constants.js";

export function calcConfidence(zone) {
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
