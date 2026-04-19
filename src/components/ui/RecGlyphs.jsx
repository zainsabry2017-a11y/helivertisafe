import React from "react";
import {
  IconAward,
  IconBalance,
  IconBarrier,
  IconCompass,
  IconSensitivity,
  IconStatusDanger,
  IconStatusInfo,
  IconStatusSuccess,
  IconStatusWarning,
  IconTerrain,
  IconWind,
} from "../branding/HvsToolbarIcons.jsx";

/** Legacy emoji keys from older saves / scoring output */
const LEGACY_REC_ICON = {
  "🏆": "recommendation",
  "🧭": "heading",
  "💨": "wind",
  "🚧": "obstacle",
  "⛰": "terrain",
  "🏘": "sensitivity",
  "⚖️": "close_match",
  "⚖": "close_match",
};

// eslint-disable-next-line react-refresh/only-export-components
export function resolveRecType(rec) {
  if (rec?.recType) return rec.recType;
  if (rec?.icon && LEGACY_REC_ICON[rec.icon]) return LEGACY_REC_ICON[rec.icon];
  return "note";
}

/** Left border accent for report / cards */
// eslint-disable-next-line react-refresh/only-export-components
export function recBorderColor(rec) {
  const t = resolveRecType(rec);
  if (t === "recommendation") return "#10b981";
  if (t === "heading") return "#a78bfa";
  return "#f59e0b";
}

export function RecGlyph({ rec, size = 20, color = "#475569" }) {
  const t = resolveRecType(rec);
  const wrap = (node) => <span style={{ display: "inline-flex", color, flexShrink: 0 }}>{node}</span>;
  switch (t) {
    case "recommendation":
      return wrap(<IconAward size={size} title="" />);
    case "heading":
      return wrap(<IconCompass size={size} title="" />);
    case "wind":
      return wrap(<IconWind size={size} title="" />);
    case "obstacle":
      return wrap(<IconBarrier size={size} title="" />);
    case "terrain":
      return wrap(<IconTerrain size={size} title="" />);
    case "sensitivity":
      return wrap(<IconSensitivity size={size} title="" />);
    case "close_match":
      return wrap(<IconBalance size={size} title="" />);
    default:
      return wrap(<IconStatusInfo size={size} title="" />);
  }
}

export function SuggestionGlyph({ suggestion, size = 18 }) {
  const col =
    suggestion.type === "danger" ? "#f87171" : suggestion.type === "warning" ? "#fbbf24" : suggestion.type === "success" ? "#34d399" : "#38bdf8";
  const wrap = (node) => <span style={{ display: "inline-flex", color: col, flexShrink: 0, marginTop: 1 }}>{node}</span>;
  switch (suggestion.type) {
    case "danger":
      return wrap(<IconStatusDanger size={size} title="" />);
    case "warning":
      return wrap(<IconStatusWarning size={size} title="" />);
    case "success":
      return wrap(<IconStatusSuccess size={size} title="" />);
    default:
      return wrap(<IconStatusInfo size={size} title="" />);
  }
}

/** Plain labels for PDF / HTML export (no emoji) */
// eslint-disable-next-line react-refresh/only-export-components
export function recPdfPrefix(rec) {
  const t = resolveRecType(rec);
  const map = {
    recommendation: "Best zone",
    heading: "Heading",
    wind: "Wind",
    obstacle: "Obstacles",
    terrain: "Terrain",
    sensitivity: "Sensitivity",
    close_match: "Comparison",
    note: "Note",
  };
  return map[t] || "Note";
}
