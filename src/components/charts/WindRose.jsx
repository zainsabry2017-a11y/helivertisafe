import React from "react";
import { K } from "../../utils/theme.js";
import { DEG } from "../../utils/coords.js";

function sectorPath(cx, cy, r0, r1, dirDeg, halfDeg) {
  const rd = (dirDeg - 90) * DEG;
  const hw = halfDeg * DEG;
  const a0 = rd - hw;
  const a1 = rd + hw;
  const x0 = cx + r0 * Math.cos(a0);
  const y0 = cy + r0 * Math.sin(a0);
  const x1 = cx + r1 * Math.cos(a0);
  const y1 = cy + r1 * Math.sin(a0);
  const x2 = cx + r1 * Math.cos(a1);
  const y2 = cy + r1 * Math.sin(a1);
  const x3 = cx + r0 * Math.cos(a1);
  const y3 = cy + r0 * Math.sin(a1);
  const large = 0;
  return "M " + x0 + " " + y0 + " L " + x1 + " " + y1 + " A " + r1 + " " + r1 + " 0 " + large + " 1 " + x2 + " " + y2 + " L " + x3 + " " + y3 + " A " + r0 + " " + r0 + " 0 " + large + " 0 " + x0 + " " + y0 + " Z";
}

export function WindRose({ zone, ori, size = 190 }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.36;
  const { pd, ps, pf, sd, ss, sf, calm, roseBins } = zone.wind;
  const mx = Math.max(ps, ss, 1);
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  const bins = Array.isArray(roseBins) && roseBins.length ? roseBins : null;
  const halfSectorDeg = bins ? 180 / bins.length : 22.5;
  const mxPct = bins ? Math.max(...bins.map((b) => b.pct || 0), 1e-6) : 1;

  function arrow(dir, spd, freq, col) {
    if (!spd) return null;
    const rd = (dir - 90) * DEG;
    const tx = cx + Math.cos(rd) * R;
    const ty = cy + Math.sin(rd) * R;
    return (
      <g key={"arr-" + dir}>
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={col} strokeWidth={1} opacity={0.25} strokeDasharray="2,2" />
        <line x1={tx} y1={ty} x2={tx - Math.cos(rd) * R * 0.3 * spd / mx} y2={ty - Math.sin(rd) * R * 0.3 * spd / mx} stroke={col} strokeWidth={Math.max(2, spd / 4)} strokeLinecap="round" opacity={0.8} />
        <text x={tx + Math.cos(rd) * 14} y={ty + Math.sin(rd) * 14} fill={col} fontSize={7} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
          {spd}kt
        </text>
      </g>
    );
  }

  const or1 = ori ? (ori.oh - 90) * DEG : 0;
  const or2 = ori ? (ori.oh + 90) * DEG : 0;

  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke={K.bd} strokeWidth={0.5} />
      ))}
      {[0, 45, 90, 135].map((a) => {
        const r = (a - 90) * DEG;
        return <line key={a} x1={cx - Math.cos(r) * R} y1={cy - Math.sin(r) * R} x2={cx + Math.cos(r) * R} y2={cy + Math.sin(r) * R} stroke={K.bd} strokeWidth={0.3} />;
      })}
      {dirs.map((d, i) => {
        const a = (i * 45 - 90) * DEG;
        return (
          <text key={d} x={cx + Math.cos(a) * (R + 12)} y={cy + Math.sin(a) * (R + 12)} fill={K.dm} fontSize={8} fontWeight={d.length === 1 ? 700 : 500} textAnchor="middle" dominantBaseline="middle">
            {d}
          </text>
        );
      })}

      {bins &&
        bins.map((b, i) => {
          const p = b.pct || 0;
          const t = p > 0 ? p / mxPct : 0;
          const r0 = R * 0.12;
          const r1 = R * (0.16 + 0.8 * Math.max(t, 0.04));
          const col = i % 2 === 0 ? K.cy : K.bl;
          return (
            <path
              key={i}
              d={sectorPath(cx, cy, r0, r1, b.dirDeg, halfSectorDeg)}
              fill={col}
              fillOpacity={p > 0 ? 0.35 + t * 0.35 : 0.08}
              stroke={K.bd}
              strokeWidth={0.3}
            />
          );
        })}

      {bins && calm > 0 && (
        <text x={cx} y={cy + 3} fill={K.dm} fontSize={8} fontWeight={700} textAnchor="middle">
          calm {calm.toFixed(0)}%
        </text>
      )}

      {ori && <line x1={cx + Math.cos(or1) * R * 0.85} y1={cy + Math.sin(or1) * R * 0.85} x2={cx + Math.cos(or2) * R * 0.85} y2={cy + Math.sin(or2) * R * 0.85} stroke={K.gn} strokeWidth={2.5} opacity={0.7} strokeDasharray="5,3" />}
      {ori && (
        <text x={cx + Math.cos(or1) * (R * 0.85 + 10)} y={cy + Math.sin(or1) * (R * 0.85 + 10)} fill={K.gn} fontSize={7} fontWeight={800} textAnchor="middle">
          {ori.hp}
        </text>
      )}
      {arrow(pd, ps, pf, K.cy)}
      {arrow(sd, ss, sf, K.am)}
      <circle cx={cx} cy={cy} r={3} fill={K.tx} />
    </svg>
  );
}
