import React from "react";
import { K, scoreCol } from "../../utils/theme.js";

export function RankingBars({ zones, width = 460, height = 180 }) {
  const ranked = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
  if (!ranked.length) return null;
  const P = { t: 16, r: 16, b: 20, l: 40 };
  const W = width - P.l - P.r, H = height - P.t - P.b;
  const barH = Math.min(20, H / ranked.length - 2);
  const maxS = 100;
  return (
    <svg width={width} height={height} viewBox={"0 0 " + width + " " + height}>
      {ranked.map((z, i) => {
        const y = P.t + i * (barH + 3);
        const bw = (z.sc.tot / maxS) * W;
        const col = scoreCol(z.sc.tot);
        return (
          <g key={z.id}>
            <text x={P.l - 4} y={y + barH / 2 + 1} fill={K.dm} fontSize={9} fontWeight={600} textAnchor="end" dominantBaseline="middle">{z.lb}</text>
            <rect x={P.l} y={y} width={W} height={barH} fill={K.rs} rx={3} />
            <rect x={P.l} y={y} width={bw} height={barH} fill={col} rx={3} opacity={0.8} />
            <text x={P.l + bw + 4} y={y + barH / 2 + 1} fill={col} fontSize={9} fontWeight={700} dominantBaseline="middle">{z.sc.tot} ({z.sc.gr})</text>
          </g>
        );
      })}
    </svg>
  );
}
