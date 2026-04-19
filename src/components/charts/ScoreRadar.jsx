import React from "react";
import { K } from "../../utils/theme.js";
import { DEG } from "../../utils/coords.js";

// ═══ SVG: RADAR ═══
export function ScoreRadar({ scores, size = 160 }) {
  if (!scores) return null;
  const cats = [{ k: "wind", l: "Wind", c: K.cy }, { k: "obs", l: "OBS", c: K.am }, { k: "ter", l: "Terrain", c: K.gn }, { k: "acc", l: "Access", c: K.bl }, { k: "geo", l: "Geo", c: K.pu }, { k: "env", l: "Env", c: K.or }];
  const cx = size / 2, cy = size / 2, R = size * 0.35, n = cats.length;
  const pts = cats.map((c, i) => {
    const a = (i * 360 / n - 90) * DEG;
    const v = (scores.bd[c.k]?.s || 0) / 100;
    return { x: cx + Math.cos(a) * R * v, y: cy + Math.sin(a) * R * v, lx: cx + Math.cos(a) * (R + 16), ly: cy + Math.sin(a) * (R + 16), l: c.l, s: scores.bd[c.k]?.s || 0, c: c.c };
  });
  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
      {[0.25, 0.5, 0.75, 1].map(f => <polygon key={f} points={cats.map((_, i) => { const a = (i * 360 / n - 90) * DEG; return (cx + Math.cos(a) * R * f) + "," + (cy + Math.sin(a) * R * f); }).join(" ")} fill="none" stroke={K.bd} strokeWidth={0.5} />)}
      <polygon points={pts.map(p => p.x + "," + p.y).join(" ")} fill={K.bl} fillOpacity={0.15} stroke={K.bl} strokeWidth={1.5} />
      {pts.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={3} fill={p.c} /><text x={p.lx} y={p.ly} fill={p.c} fontSize={7} fontWeight={600} textAnchor="middle" dominantBaseline="middle">{p.l} {p.s}</text></g>)}
    </svg>
  );
}
