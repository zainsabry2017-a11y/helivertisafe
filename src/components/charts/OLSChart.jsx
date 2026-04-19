import React from "react";
import { K } from "../../utils/theme.js";
import { calcGeom } from "../../data/models.js";

// ═══ SVG: OLS SECTION ═══
export function OLSChart({ zone, proj, width = 560, height = 240 }) {
  const G = calcGeom(proj);
  const obs = zone.obs.filter(o => o.d > 0 && o.h > 0);
  if (!obs.length) return <div style={{ width, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: K.rs, borderRadius: 6, fontSize: 10, color: K.mu }}>Add obstacles to see OLS</div>;

  const mxD = Math.max(...obs.map(o => o.d), 200);
  const envH = (d) => {
    const inner = G.innerLenM || 0;
    const outer = G.outerLenM || 0;
    const ig = G.innerG ?? G.transG;
    const og = G.outerG ?? G.appG;
    if (d <= inner) return d * ig;
    if (d <= inner + outer) return inner * ig + (d - inner) * og;
    return inner * ig + outer * og;
  };
  const mxH = Math.max(...obs.map(o => o.h), envH(mxD) + 5);
  const P = { t: 24, r: 20, b: 36, l: 44 };
  const PW = width - P.l - P.r, PH = height - P.t - P.b;
  const sx = (d) => P.l + (d / mxD) * PW;
  const sy = (v) => P.t + PH - (v / mxH) * PH;
  const s18 = [];
  for (let d = 0; d <= mxD; d += mxD / 80) s18.push(sx(d) + "," + sy(envH(d)));
  const s12 = [];
  for (let d = 0; d <= mxD; d += mxD / 80) { const v = d * G.transG; if (v <= mxH) s12.push(sx(d) + "," + sy(v)); }

  return (
    <svg width={width} height={height} viewBox={"0 0 " + width + " " + height}>
      <rect x={P.l} y={P.t} width={PW} height={PH} fill={K.pn} rx={2} />
      {Array.from({ length: 6 }, (_, i) => { const v = (mxH / 5) * i; return <g key={"h" + i}><line x1={P.l} y1={sy(v)} x2={P.l + PW} y2={sy(v)} stroke={K.bd} strokeWidth={0.3} /><text x={P.l - 4} y={sy(v)} fill={K.mu} fontSize={7} textAnchor="end" dominantBaseline="middle">{Math.round(v)}</text></g>; })}
      {Array.from({ length: 6 }, (_, i) => { const d = (mxD / 5) * i; return <g key={"v" + i}><line x1={sx(d)} y1={P.t} x2={sx(d)} y2={P.t + PH} stroke={K.bd} strokeWidth={0.3} /><text x={sx(d)} y={P.t + PH + 12} fill={K.mu} fontSize={7} textAnchor="middle">{Math.round(d)}</text></g>; })}
      <line x1={P.l} y1={sy(0)} x2={P.l + PW} y2={sy(0)} stroke="#4a7a4a" strokeWidth={1.5} />
      <rect x={sx(0)} y={sy(0) - 6} width={Math.max(8, sx(G.tot) - sx(0))} height={6} fill={K.gn} rx={2} opacity={0.7} />
      <text x={sx(G.tot / 2)} y={sy(0) + 14} fill={K.gn} fontSize={7} fontWeight={700} textAnchor="middle">FATO+SA {G.tot.toFixed(0)}m</text>
      <polygon points={sx(0) + "," + sy(0) + " " + s18.join(" ") + " " + sx(mxD) + "," + sy(0)} fill={K.am} fillOpacity={0.06} />
      <polyline points={s18.join(" ")} fill="none" stroke={K.am} strokeWidth={2} strokeDasharray="6,3" />
      <text x={P.l + PW - 2} y={sy(envH(mxD)) - 6} fill={K.am} fontSize={8} fontWeight={700} textAnchor="end">OLS env</text>
      {s12.length > 2 && <polyline points={s12.join(" ")} fill="none" stroke={K.cy} strokeWidth={1.2} strokeDasharray="3,3" opacity={0.7} />}
      {obs.map((o, i) => {
        const x = sx(o.d), yt = sy(o.h), yb = sy(0);
        const a18 = envH(o.d), pen = o.h > a18, col = pen ? K.rd : K.gn;
        return (
          <g key={i}>
            <line x1={x} y1={yb} x2={x} y2={yt} stroke={col} strokeWidth={3} strokeLinecap="round" />
            <rect x={x - 5} y={yt - 2} width={10} height={4} rx={1} fill={col} />
            <text x={x} y={yt - 10} fill={col} fontSize={8} fontWeight={700} textAnchor="middle">{o.h}m</text>
            <text x={x} y={yt - 20} fill={K.tx} fontSize={7} textAnchor="middle" opacity={0.6}>{o.nm}</text>
            <line x1={x - 8} y1={sy(a18)} x2={x + 8} y2={sy(a18)} stroke={K.am} strokeWidth={1} opacity={0.5} />
            {pen && <text x={x + 10} y={yt + 2} fill={K.rd} fontSize={7} fontWeight={700}>+{(o.h - a18).toFixed(1)}m</text>}
            <text x={x} y={yb + 10} fill={K.mu} fontSize={6} textAnchor="middle">{o.d}m</text>
          </g>
        );
      })}
      <text x={P.l + PW / 2} y={height - 4} fill={K.dm} fontSize={8} textAnchor="middle">Distance (m)</text>
    </svg>
  );
}
