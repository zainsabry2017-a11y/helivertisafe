import React from "react";
import { K, scoreCol } from "../../utils/theme.js";

// ═══ SVG: HEATMAP ═══
export function Heatmap({ zones, cols, rows, width = 300, height = 300 }) {
  const scored = zones.filter(z => z.sc);
  if (!scored.length) return null;
  const maxS = 100;
  const P = 24;
  const cellW = (width - 2 * P) / cols;
  const cellH = (height - 2 * P) / rows;
  return (
    <svg width={width} height={height} viewBox={"0 0 " + width + " " + height}>
      <defs>
        <linearGradient id="hmLeg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={K.rd} /><stop offset="35%" stopColor={K.am} /><stop offset="65%" stopColor={K.bl} /><stop offset="100%" stopColor={K.gn} />
        </linearGradient>
      </defs>
      {zones.map(z => {
        const x = P + (z.c || 0) * cellW;
        const y = P + (z.r || 0) * cellH;
        if (!z.on) return <rect key={z.id} x={x + 1} y={y + 1} width={cellW - 2} height={cellH - 2} fill={K.mu} opacity={0.15} rx={3} />;
        const s = z.sc?.tot || 0;
        const t = s / maxS;
        const col = scoreCol(s);
        return (
          <g key={z.id}>
            <rect x={x + 1} y={y + 1} width={cellW - 2} height={cellH - 2} fill={col} opacity={0.2 + t * 0.6} rx={3} />
            <text x={x + cellW / 2} y={y + cellH / 2 - 5} fill="#fff" fontSize={9} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{z.lb}</text>
            {z.sc && <text x={x + cellW / 2} y={y + cellH / 2 + 8} fill="#fff" fontSize={13} fontWeight={800} textAnchor="middle" dominantBaseline="middle">{s}</text>}
          </g>
        );
      })}
      {/* Legend */}
      <rect x={P} y={height - 16} width={width - 2 * P} height={6} rx={3} fill="url(#hmLeg)" opacity={0.7} />
      <text x={P} y={height - 3} fill={K.mu} fontSize={7}>0</text>
      <text x={width - P} y={height - 3} fill={K.mu} fontSize={7} textAnchor="end">100</text>
    </svg>
  );
}
