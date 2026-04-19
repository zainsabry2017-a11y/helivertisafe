import React from "react";
import { K, scoreCol } from "../../utils/theme.js";

export function ScoreBar({ label, score, weight, reasons }) {
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
