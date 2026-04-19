import React from "react";
import { K } from "../../utils/theme.js";
import { DEFAULT_APPROACH_GRADIENT, maxObstacleHeightAtDistance } from "../../engine/regulatoryFormulas.js";

// ═══ LIVE OLS PREVIEW BAR (simplified approach vs obstacle height) ═══
export function OLSBar({ height, distance, approachGradient = DEFAULT_APPROACH_GRADIENT, style }) {
  if (!distance || distance <= 0) return null;
  const allowable = maxObstacleHeightAtDistance(distance, approachGradient);
  const pct = Math.min(height / allowable * 100, 150);
  const pen = height > allowable;
  const excess = pen ? (height - allowable).toFixed(1) : 0;
  return (
    <div style={{ ...style, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9 }}>
        <div style={{ flex: 1, height: 8, background: K.rs, borderRadius: 4, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: Math.min(pct, 100) + "%", background: pen ? "linear-gradient(90deg, " + K.am + ", " + K.rd + ")" : "linear-gradient(90deg, " + K.gn + "80, " + K.gn + ")", borderRadius: 4, transition: "width 0.3s" }} />
          {/* Approach limit marker */}
          <div style={{ position: "absolute", left: "100%", top: -2, width: 2, height: 12, background: K.am, transform: "translateX(-1px)" }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: pen ? K.rd : K.gn, minWidth: 55 }}>
          {pen ? "PEN +" + excess + "m" : "CLEAR " + (allowable - height).toFixed(1) + "m"}
        </span>
      </div>
      <div style={{ fontSize: 8, color: K.mu, display: "flex", justifyContent: "space-between" }}>
        <span>H={height}m</span>
        <span>Approach limit={allowable.toFixed(1)}m</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
