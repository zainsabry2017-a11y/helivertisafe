import React, { useState, useEffect, useId, useMemo } from "react";
import { K, gradeCol, scoreCol } from "../../utils/theme.js";
import { DEG } from "../../utils/coords.js";
import { calcGeom, getHeli } from "../../data/models.js";
import { zoneCentroid, zonePadCenter } from "../../engine/geometry.js";
import { polygonAreaM2 } from "../../utils/mapGeo.js";
import { noiseContourRadii } from "../../engine/noiseModel.js";

const NOISE_RING_COL = { 65: "#6c5ce7", 70: "#00b894", 75: "#fdcb6e", 80: "#d63031" };

export function SitePlan({ zones, proj, site, selId, onSel, onAddObs, size = 480, showNoiseContours = false, showTerrainOverlay = false }) {
  const rid = useId().replace(/:/g, "");
  const gridPatId = "sp-grid-" + rid;
  const plotGradId = "sp-plot-" + rid;
  const G = calcGeom(proj);
  const heli = getHeli(proj);
  const pad = 40;
  const plotSize = size - 2 * pad;
  const scaleX = (v) => pad + (v / site.sw) * plotSize;
  const scaleY = (v) => pad + (v / site.sh) * plotSize;
  const scaleD = (v) => (v / Math.max(site.sw, site.sh)) * plotSize;
  const unscaleX = (px) => ((px - pad) / plotSize) * site.sw;
  const unscaleY = (py) => ((py - pad) / plotSize) * site.sh;

  const bestZ = [...zones].filter(z => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0];
  const ori = bestZ?.sc?.ori;
  const [hover, setHover] = useState(null);
  const [windT, setWindT] = useState(0);

  // Animate wind particles
  useEffect(() => {
    const timer = setInterval(() => setWindT(t => (t + 1) % 200), 80);
    return () => clearInterval(timer);
  }, []);

  const selZone = zones.find(z => z.id === selId);
  const windDir = selZone?.wind?.pd || bestZ?.wind?.pd || 0;
  const windSpd = selZone?.wind?.ps || bestZ?.wind?.ps || 0;
  const windSeeds = useMemo(() => {
    // deterministic jitter for render purity (no Math.random in render)
    const xmur3 = (str) => {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
      };
    };
    const mulberry32 = (a) => () => {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const seed = xmur3("wind:" + rid)();
    const r = mulberry32(seed);
    return Array.from({ length: 12 }, (_, i) => ({
      jx: r(),
      jy: r(),
      op: r(),
      idx: i,
    }));
  }, [rid]);

  // Double-click to add obstacle (use click detail — onDoubleClick on <svg> is unreliable when child shapes handle clicks)
  const handleSvgClick = (e) => {
    if (e.detail !== 2) return;
    if (!onAddObs || !selId) return;
    e.preventDefault();
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = unscaleX((e.clientX - rect.left) * (size / rect.width));
    const y = unscaleY((e.clientY - rect.top) * (size / rect.height));
    if (x >= 0 && x <= site.sw && y >= 0 && y <= site.sh) onAddObs(x, y);
  };

  const gw = plotSize / site.gc;
  const gh = plotSize / site.gr;

  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{ display: "block", cursor: onAddObs && selId ? "crosshair" : "default" }} onClick={handleSvgClick}>
      <defs>
        <linearGradient id={plotGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d1528" />
          <stop offset="100%" stopColor="#101d30" />
        </linearGradient>
        <pattern id={gridPatId} width={gw} height={gh} patternUnits="userSpaceOnUse" x={pad} y={pad}>
          <path d={"M " + gw + " 0 L 0 0 0 " + gh} fill="none" stroke="#1e3a5f" strokeWidth={0.45} opacity={0.85} />
        </pattern>
        <filter id={"sp-sh-" + rid} x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity={0.35} />
        </filter>
        <marker id={"arrowM-" + rid} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={K.am} opacity={0.7} /></marker>
        <marker id={"slopeArrow-" + rid} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={K.pu} opacity={0.85} /></marker>
      </defs>
      {/* Sheet frame */}
      <rect x={2} y={2} width={size - 4} height={size - 4} rx={10} fill={K.sf} stroke="#2563eb" strokeOpacity={0.35} strokeWidth={1} filter={"url(#sp-sh-" + rid + ")"} />
      <rect x={5} y={5} width={size - 10} height={size - 10} rx={8} fill="none" stroke="#ffffff" strokeOpacity={0.06} strokeWidth={1} />
      {/* Title block */}
      <rect x={pad - 4} y={6} width={plotSize + 8} height={26} rx={4} fill={K.pn} stroke={K.bd} strokeWidth={0.5} />
      <rect x={pad - 4} y={6} width={3} height={26} rx={1} fill={K.bl} />
      <text x={pad + 6} y={21} fill={K.cy} fontSize={8} fontWeight={800} letterSpacing={1.8}>SITE PLAN</text>
      <text x={pad + 68} y={21} fill={K.mu} fontSize={8} fontWeight={600} letterSpacing={0.8}>TOP VIEW · LOCAL GRID · METERS · N↑</text>
      <text x={pad + plotSize - 4} y={21} fill={K.dm} fontSize={7} fontWeight={600} textAnchor="end">{heli?.nm || "Aircraft"} · D={G.D.toFixed(1)}m</text>
      {/* Plot area */}
      <rect x={pad} y={pad} width={plotSize} height={plotSize} fill={"url(#" + plotGradId + ")"} rx={3} stroke={K.bd} strokeWidth={1} />
      <rect x={pad} y={pad} width={plotSize} height={plotSize} fill={"url(#" + gridPatId + ")"} rx={3} />
      <rect x={pad} y={pad} width={plotSize} height={plotSize} fill="none" rx={3} stroke="#ffffff" strokeOpacity={0.04} strokeWidth={1} />

      {/* Terrain contours (Delaunay mesh analysis) */}
      {showTerrainOverlay &&
        site.terrainAnalysis?.contours?.length > 0 &&
        site.terrainAnalysis.contours.map((c, ci) => (
          <g key={"tc-" + ci} opacity={0.55}>
            {c.segs.map((seg, si) => {
              if (!seg[0] || !seg[1]) return null;
              return (
                <line
                  key={si}
                  x1={scaleX(seg[0].x)}
                  y1={scaleY(seg[0].y)}
                  x2={scaleX(seg[1].x)}
                  y2={scaleY(seg[1].y)}
                  stroke={K.gn}
                  strokeWidth={0.8}
                  strokeDasharray="4,3"
                />
              );
            })}
          </g>
        ))}

      {/* Zone fills */}
      {zones.map(z => {
        const isSel = z.id === selId;
        const isBest = bestZ && z.id === bestZ.id;
        const sc = z.sc?.tot;
        const col = !z.on ? K.mu : sc != null ? scoreCol(sc) : K.bd;
        const op = !z.on ? 0.08 : sc != null ? 0.15 + (sc / 100) * 0.25 : 0.06;
        // Use corners for polygon rendering, fallback to grid rect
        const hasCorners = z.corners && z.corners.length >= 3;
        const pts = hasCorners ? z.corners.map(c => scaleX(c.x) + "," + scaleY(c.y)).join(" ") : null;
        const cent = zoneCentroid(z);
        const cx = scaleX(cent.x), cy = scaleY(cent.y);
        const padC = zonePadCenter(z);
        const px = scaleX(padC.x), py = scaleY(padC.y);
        if (hasCorners) {
          return (
            <g key={z.id} onClick={() => onSel(z.id)} onMouseEnter={() => setHover(z.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <polygon points={pts} fill={col} opacity={op} stroke={isSel ? "#fff" : isBest ? K.gn : "transparent"} strokeWidth={isSel ? 2 : isBest ? 1.5 : 0} />
              <text x={cx} y={cy + (sc != null ? -6 : 0)} fill={"#ffffff" + (z.on ? "cc" : "44")} fontSize={10} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{z.lb}</text>
              {sc != null && <text x={cx} y={cy + 6} fill={col} fontSize={14} fontWeight={800} textAnchor="middle" dominantBaseline="middle">{sc}</text>}
              {z.sc && <text x={cx} y={cy + 18} fill={gradeCol(z.sc.gr)} fontSize={8} fontWeight={700} textAnchor="middle">{z.sc.gr}</text>}
              {(isSel || isBest) && (
                <g opacity={0.95}>
                  <circle cx={px} cy={py} r={4.2} fill="#0b1120" stroke={isBest ? K.gn : K.cy} strokeWidth={1.4} />
                  <line x1={px - 7} y1={py} x2={px + 7} y2={py} stroke={isBest ? K.gn : K.cy} strokeWidth={1.2} />
                  <line x1={px} y1={py - 7} x2={px} y2={py + 7} stroke={isBest ? K.gn : K.cy} strokeWidth={1.2} />
                </g>
              )}
            </g>
          );
        }
        const x = scaleX((z.c || 0) * site.sw / site.gc);
        const y = scaleY((z.r || 0) * site.sh / site.gr);
        const w = scaleD(z.bw);
        const h = scaleD(z.bh);
        return (
          <g key={z.id} onClick={() => onSel(z.id)} onMouseEnter={() => setHover(z.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={w} height={h} fill={col} opacity={op} stroke={isSel ? "#fff" : isBest ? K.gn : "transparent"} strokeWidth={isSel ? 2 : isBest ? 1.5 : 0} rx={2} />
            <text x={x + w / 2} y={y + (sc != null ? h / 2 - 6 : h / 2)} fill={"#ffffff" + (z.on ? "cc" : "44")} fontSize={10} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{z.lb}</text>
            {sc != null && <text x={x + w / 2} y={y + h / 2 + 6} fill={col} fontSize={14} fontWeight={800} textAnchor="middle" dominantBaseline="middle">{sc}</text>}
            {z.sc && <text x={x + w / 2} y={y + h / 2 + 18} fill={gradeCol(z.sc.gr)} fontSize={8} fontWeight={700} textAnchor="middle">{z.sc.gr}</text>}
            {(isSel || isBest) && (
              <g opacity={0.95}>
                <circle cx={px} cy={py} r={4.2} fill="#0b1120" stroke={isBest ? K.gn : K.cy} strokeWidth={1.4} />
                <line x1={px - 7} y1={py} x2={px + 7} y2={py} stroke={isBest ? K.gn : K.cy} strokeWidth={1.2} />
                <line x1={px} y1={py - 7} x2={px} y2={py + 7} stroke={isBest ? K.gn : K.cy} strokeWidth={1.2} />
              </g>
            )}
          </g>
        );
      })}

      {/* Slope-down arrows (terrain analysis) */}
      {showTerrainOverlay &&
        site.terrainAnalysis?.zoneSlopes?.length > 0 &&
        site.terrainAnalysis.zoneSlopes.map((sl) => {
          const zSl = zones.find((zz) => zz.id === sl.zoneId);
          if (!zSl || !zSl.on) return null;
          const c = zoneCentroid(zSl);
          const cxS = scaleX(c.x);
          const cyS = scaleY(c.y);
          const down = ((sl.dirDeg || 0) + 180) % 360;
          const rd = (down - 90) * DEG;
          const L = scaleD(Math.min(40, 12 + (sl.slopePct || 0) * 2.2));
          return (
            <g key={"sl-" + sl.zoneId}>
              <line
                x1={cxS}
                y1={cyS}
                x2={cxS + Math.cos(rd) * L}
                y2={cyS + Math.sin(rd) * L}
                stroke={K.pu}
                strokeWidth={1.4}
                markerEnd={"url(#slopeArrow-" + rid + ")"}
                opacity={0.88}
              />
              <text x={cxS} y={cyS + 14} fill={K.pu} fontSize={6} fontWeight={700} textAnchor="middle" opacity={0.9}>
                ↘ {sl.slopePct}%
              </text>
            </g>
          );
        })}

      {/* Approximate noise contours (dBA), centered on recommended zone centroid */}
      {showNoiseContours &&
        bestZ &&
        (() => {
          const cent = zonePadCenter(bestZ);
          const cxN = scaleX(cent.x);
          const cyN = scaleY(cent.y);
          const rings = noiseContourRadii(proj);
          return (
            <g opacity={0.78}>
              {rings.map(({ db, r }) => (
                <circle
                  key={db}
                  cx={cxN}
                  cy={cyN}
                  r={scaleD(r)}
                  fill="none"
                  stroke={NOISE_RING_COL[db] || K.pu}
                  strokeWidth={1.2}
                  strokeDasharray={db >= 75 ? "2,2" : "6,4"}
                />
              ))}
              {rings.map(({ db, r }, ri) => (
                <text
                  key={"t-" + db}
                  x={cxN + scaleD(r) * (0.55 + ri * 0.04)}
                  y={cyN - 6 - ri * 9}
                  fill={NOISE_RING_COL[db] || K.pu}
                  fontSize={7}
                  fontWeight={700}
                >
                  ~{db}dBA
                </text>
              ))}
            </g>
          );
        })()}

      {/* FATO rectangle on best zone */}
      {bestZ && (() => {
        const bx = scaleX((bestZ.c || 0) * site.sw / site.gc);
        const by = scaleY((bestZ.r || 0) * site.sh / site.gr);
        const bw = scaleD(bestZ.bw);
        const bh = scaleD(bestZ.bh);
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const fatoW = scaleD(G.fato);
        const totW = scaleD(G.tot);

        // Approach corridors
        const heading = ori ? ori.oh : 0;
        const rad1 = (heading - 90) * DEG;
        const rad2 = (heading + 90) * DEG;
        const appLen = scaleD(Math.min(G.appLen, Math.max(site.sw, site.sh) * 0.35));

        return (
          <g>
            {/* Safety Area */}
            <rect x={cx - totW / 2} y={cy - totW / 2} width={totW} height={totW} fill="none" stroke={K.am} strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            {/* FATO */}
            <rect x={cx - fatoW / 2} y={cy - fatoW / 2} width={fatoW} height={fatoW} fill={K.gn} fillOpacity={0.2} stroke={K.gn} strokeWidth={1.5} rx={1} />
            {/* TLOF circle */}
            <circle cx={cx} cy={cy} r={scaleD(G.tlof) / 2} fill="none" stroke={K.gn} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
            {/* H marking */}
            <text x={cx} y={cy + 1} fill={K.gn} fontSize={Math.max(8, fatoW * 0.4)} fontWeight={800} textAnchor="middle" dominantBaseline="middle" opacity={0.5}>H</text>
            {/* Approach corridors */}
            <line x1={cx} y1={cy} x2={cx + Math.cos(rad1) * appLen} y2={cy + Math.sin(rad1) * appLen} stroke={K.cy} strokeWidth={1.5} strokeDasharray="6,3" opacity={0.5} markerEnd={"url(#arrowM-" + rid + ")"} />
            <line x1={cx} y1={cy} x2={cx + Math.cos(rad2) * appLen} y2={cy + Math.sin(rad2) * appLen} stroke={K.cy} strokeWidth={1.5} strokeDasharray="6,3" opacity={0.5} markerEnd={"url(#arrowM-" + rid + ")"} />
            {/* Approach labels */}
            {ori && <text x={cx + Math.cos(rad1) * (appLen + 12)} y={cy + Math.sin(rad1) * (appLen + 12)} fill={K.cy} fontSize={7} fontWeight={700} textAnchor="middle">{ori.hp.split("/")[0]}</text>}
            {ori && <text x={cx + Math.cos(rad2) * (appLen + 12)} y={cy + Math.sin(rad2) * (appLen + 12)} fill={K.cy} fontSize={7} fontWeight={700} textAnchor="middle">{ori.hp.split("/")[1]}</text>}
          </g>
        );
      })()}

      {/* Obstacles on selected zone */}
      {(() => {
        const sz = zones.find(z => z.id === selId);
        if (!sz || !sz.obs.length) return null;
        const cent = zoneCentroid(sz);
        const cx = scaleX(cent.x), cy = scaleY(cent.y);
        return sz.obs.map((o, i) => {
          const hasCorn = o.corners && o.corners.length >= 3;
          const pen = o.d > 0 ? o.h > o.d / 8 : false;
          const col = pen ? K.rd : K.gn;
          if (hasCorn) {
            // Render building footprint as polygon
            const pts = o.corners.map(c => scaleX(c.x) + "," + scaleY(c.y)).join(" ");
            const centObs = { x: o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length, y: o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length };
            return (
              <g key={i}>
                <line x1={cx} y1={cy} x2={scaleX(centObs.x)} y2={scaleY(centObs.y)} stroke={col} strokeWidth={0.5} opacity={0.3} strokeDasharray="2,2" />
                <polygon points={pts} fill={col} opacity={0.2} stroke={col} strokeWidth={1} />
                <text x={scaleX(centObs.x)} y={scaleY(centObs.y) - 7} fill={col} fontSize={7} fontWeight={600} textAnchor="middle">{o.nm}</text>
              </g>
            );
          }
          // Fallback: point obstacle
          if (o.d <= 0) return null;
          const dist = scaleD(Math.min(o.d, Math.max(sz.bw, sz.bh)));
          const rad = (o.br - 90) * DEG;
          const ox = cx + Math.cos(rad) * dist;
          const oy = cy + Math.sin(rad) * dist;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={ox} y2={oy} stroke={col} strokeWidth={0.5} opacity={0.3} strokeDasharray="2,2" />
              <circle cx={ox} cy={oy} r={4} fill={col} opacity={0.8} />
              <text x={ox} y={oy - 7} fill={col} fontSize={7} fontWeight={600} textAnchor="middle">{o.nm}</text>
            </g>
          );
        });
      })()}

      {/* Exclusion zones */}
      {(site.exclusions || []).map((ex, i) => {
        if (ex.corners && ex.corners.length >= 3) {
          const pts = ex.corners.map((c) => scaleX(c.x) + "," + scaleY(c.y)).join(" ");
          const cx = ex.corners.reduce((s, c) => s + c.x, 0) / ex.corners.length;
          const cy = ex.corners.reduce((s, c) => s + c.y, 0) / ex.corners.length;
          const ar = ex.areaM2 ?? polygonAreaM2(ex.corners);
          return (
            <g key={ex.id || i}>
              <polygon points={pts} fill={K.rd} opacity={0.14} stroke={K.rd} strokeWidth={1} strokeDasharray="4,2" />
              <text x={scaleX(cx)} y={scaleY(cy)} fill={K.rd} fontSize={7} fontWeight={600} textAnchor="middle" dominantBaseline="middle" opacity={0.85}>
                {ex.nm}
              </text>
              <text x={scaleX(cx)} y={scaleY(cy) + 9} fill={K.rd} fontSize={6} textAnchor="middle" opacity={0.7}>
                {Math.round(ar).toLocaleString()} m²
              </text>
            </g>
          );
        }
        const x = scaleX(ex.x || 0);
        const y = scaleY(ex.y || 0);
        const w = scaleD(ex.w || 50);
        const h = scaleD(ex.h || 50);
        return (
          <g key={ex.id || i}>
            <rect x={x} y={y} width={w} height={h} fill={K.rd} opacity={0.12} stroke={K.rd} strokeWidth={1} strokeDasharray="4,2" rx={2} />
            <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={K.rd} strokeWidth={0.5} opacity={0.3} />
            <line x1={x + w} y1={y} x2={x} y2={y + h} stroke={K.rd} strokeWidth={0.5} opacity={0.3} />
            <text x={x + w / 2} y={y + h / 2} fill={K.rd} fontSize={7} fontWeight={600} textAnchor="middle" dominantBaseline="middle" opacity={0.7}>
              {ex.nm}
            </text>
          </g>
        );
      })}

      {/* Site boundary (if imported) */}
      {site.boundary && site.boundary.length >= 3 && (() => {
        const pts = site.boundary.map(p => scaleX(p.x) + "," + scaleY(p.y)).join(" ");
        return <polygon points={pts} fill="none" stroke={K.cy} strokeWidth={2} strokeDasharray="8,4" opacity={0.6} />;
      })()}

      {/* Terrain features */}
      {(site.terrainFeatures || []).filter(tf => tf.elevPeak > 0 && tf.radius > 0).map((tf, i) => {
        const cx = tf.points?.length ? scaleX(tf.points.reduce((s, p) => s + p.x, 0) / tf.points.length) : scaleX(site.sw / 2);
        const cy = tf.points?.length ? scaleY(tf.points.reduce((s, p) => s + p.y, 0) / tf.points.length) : scaleY(site.sh / 2);
        const r = scaleD(tf.radius);
        return <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={K.am} fillOpacity={0.08} stroke={K.am} strokeWidth={0.5} strokeDasharray="2,2" />
          <text x={cx} y={cy} fill={K.am} fontSize={7} fontWeight={600} textAnchor="middle">{tf.nm} {tf.elevPeak}m</text>
        </g>;
      })}

      {/* North arrow — compass rose */}
      <g transform={"translate(" + (size - pad + 8) + "," + (pad + 36) + ")"}>
        <circle cx={0} cy={0} r={22} fill={K.pn} stroke={K.bd} strokeWidth={0.75} opacity={0.95} />
        <circle cx={0} cy={0} r={18} fill="none" stroke="#2563eb" strokeOpacity={0.25} strokeWidth={1} />
        <line x1={0} y1={14} x2={0} y2={-14} stroke={K.tx} strokeWidth={1.2} />
        <polygon points="0,-14 -5,-6 5,-6" fill={K.rd} opacity={0.9} />
        <text x={0} y={-20} fill={K.tx} fontSize={9} fontWeight={800} textAnchor="middle">N</text>
        <text x={0} y={26} fill={K.mu} fontSize={5} fontWeight={600} textAnchor="middle" letterSpacing={0.5}>TRUE</text>
      </g>

      {/* Scale bar — survey style */}
      {(() => {
        const barM = Math.round(site.sw / 5 / 10) * 10;
        const barPx = scaleD(barM);
        const x0 = pad + 6;
        const y0 = size - 32;
        const segs = 4;
        const segW = barPx / segs;
        const fills = ["#e1e7ef", "#8896ab"];
        return (
          <g>
            <text x={x0} y={y0 - 4} fill={K.mu} fontSize={6} fontWeight={700} letterSpacing={1}>GRAPHIC SCALE</text>
            {Array.from({ length: segs }, (_, i) => (
              <rect key={i} x={x0 + i * segW} y={y0} width={segW} height={5} fill={fills[i % 2]} opacity={0.9} stroke={K.bd} strokeWidth={0.3} />
            ))}
            <line x1={x0} y1={y0} x2={x0} y2={y0 + 9} stroke={K.tx} strokeWidth={1} />
            <line x1={x0 + barPx} y1={y0} x2={x0 + barPx} y2={y0 + 9} stroke={K.tx} strokeWidth={1} />
            <text x={x0 + barPx / 2} y={y0 + 22} fill={K.tx} fontSize={8} fontWeight={700} textAnchor="middle">{barM} m</text>
          </g>
        );
      })()}

      {/* Footer spec strip */}
      <rect x={pad} y={size - 18} width={plotSize} height={14} rx={2} fill={K.bg} fillOpacity={0.55} stroke={K.bd} strokeWidth={0.4} />
      <text x={pad + 6} y={size - 7} fill={K.dm} fontSize={7} fontWeight={600}>{site.sw}×{site.sh} m · {site.gc}×{site.gr} cells</text>
      <text x={pad + plotSize - 6} y={size - 7} fill={K.dm} fontSize={7} fontWeight={600} textAnchor="end">FATO {G.fato.toFixed(0)} · TLOF {G.tlof.toFixed(0)} · SA {G.sa.toFixed(0)} m</text>

      {/* WIND PARTICLES */}
      {windSpd > 0 && Array.from({ length: 12 }, (_, i) => {
        const rad = (windDir - 90) * DEG;
        const t = ((windT + i * 17) % 200) / 200;
        const s = windSeeds[i] || { jx: 0.5, jy: 0.5, op: 0.5 };
        const startX = pad + plotSize * (0.1 + s.jx * 0.02 + i * 0.07);
        const startY = pad + plotSize * (0.15 + (i % 3) * 0.3 + (s.jy - 0.5) * 0.02);
        const px = startX + Math.cos(rad) * plotSize * 0.7 * t;
        const py = startY + Math.sin(rad) * plotSize * 0.7 * t;
        if (px < pad || px > pad + plotSize || py < pad || py > pad + plotSize) return null;
        return <circle key={i} cx={px} cy={py} r={1.5} fill={K.cy} opacity={0.15 + (1 - t) * 0.2 + s.op * 0.05} />;
      })}

      {/* HOVER TOOLTIP */}
      {hover && (() => {
        const hz = zones.find(z => z.id === hover);
        if (!hz) return null;
        const cent = zoneCentroid(hz);
        const tx = Math.min(scaleX(cent.x), size - 120);
        const ty = Math.max(scaleY(cent.y) - 50, 10);
        return (
          <g>
            <rect x={tx - 4} y={ty - 2} width={115} height={46} rx={4} fill={K.bg} fillOpacity={0.92} stroke={K.cy} strokeWidth={0.5} />
            <text x={tx + 2} y={ty + 10} fill={K.tx} fontSize={10} fontWeight={700}>{hz.lb} {hz.sc ? "— " + hz.sc.tot + "/100 " + hz.sc.gr : ""}</text>
            <text x={tx + 2} y={ty + 22} fill={K.dm} fontSize={8}>{hz.bw.toFixed(0)}×{hz.bh.toFixed(0)}m | {hz.obs.length} obs</text>
            <text x={tx + 2} y={ty + 32} fill={K.dm} fontSize={8}>{hz.sc?.ori ? "Hdg " + hz.sc.ori.hp + " | " + hz.sc.ori.us + "%" : hz.on ? "Not scored" : "Excluded"}</text>
            {hz.sc && <text x={tx + 2} y={ty + 42} fill={hz.sc.tot >= 70 ? K.gn : hz.sc.tot >= 50 ? K.am : K.rd} fontSize={8} fontWeight={600}>W:{hz.sc.bd.wind?.s} O:{hz.sc.bd.obs?.s} T:{hz.sc.bd.ter?.s} A:{hz.sc.bd.acc?.s} G:{hz.sc.bd.geo?.s}</text>}
          </g>
        );
      })()}

      {/* Interactive hint — inside plot */}
      {onAddObs && (
        <text x={pad + plotSize / 2} y={pad + plotSize - 8} fill={K.cy} fontSize={7} textAnchor="middle" opacity={0.5} fontWeight={600} pointerEvents="none">
          {selId ? "Double-click plot to place obstacle" : "Select a zone first, then double-click"}
        </text>
      )}
    </svg>
  );
}
