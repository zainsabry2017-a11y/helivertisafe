import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { sAcc } from "../../engine/scoring.js";

// ─────────────────────────────────────────────────────────────────────────────
// REAL RESPONSE TIME ENGINE  (mirrors responseTime.js — no external import needed)
// Formula: Total = Startup(3) + FlightTime + Approach(2) + GroundTransfer
// FlightTime (min) = (distKm / speedKmh) * 60    where speedKmh = cruiseKt * 1.852
// ─────────────────────────────────────────────────────────────────────────────
function calcRT(distKm, cruiseKt = 120, groundMin = 0, maxMinutes = 0) {
  if (!distKm || distKm <= 0) return null;
  const speedKmh = cruiseKt * 1.852;
  const flightMin = (distKm / speedKmh) * 60;
  const startupMin = 3;   // engine spool-up + departure
  const approachMin = 2;  // approach circuit + landing
  const totalMin = startupMin + flightMin + approachMin + groundMin;
  const meetsReq = maxMinutes > 0 ? totalMin <= maxMinutes : true;
  return {
    distKm: Math.round(distKm * 10) / 10,
    flightMin: Math.round(flightMin * 10) / 10,
    totalMin: Math.round(totalMin * 10) / 10,
    startupMin,
    approachMin: Math.round(approachMin * 10) / 10,
    groundMin,
    speedKmh: Math.round(speedKmh),
    meetsReq,
  };
}

// km from helipad at (svgX, svgY) where 1 SVG unit = KM_PER_UNIT km
const KM_PER_UNIT = 0.5; // viewBox ±200 units → ±100 km visible
function svgToKm(svgX, svgY) {
  const x = svgX * KM_PER_UNIT;
  const y = -svgY * KM_PER_UNIT; // SVG Y is flipped vs map Y (North)
  return { x, y, dist: Math.sqrt(x * x + y * y) };
}
function kmToSvg(kmX, kmY) {
  return { svgX: kmX / KM_PER_UNIT, svgY: -(kmY / KM_PER_UNIT) };
}

// Isochrone ring radius in SVG units for a given total mission time (min)
// radius = ((totalMin - startup - approach) / 60) * speedKmh → km → svgUnits
function isoRadius(totalMinutes, cruiseKt, startupMin = 3, approachMin = 2) {
  const flightMin = totalMinutes - startupMin - approachMin;
  if (flightMin <= 0) return 0;
  const speedKmh = cruiseKt * 1.852;
  const distKm = (flightMin / 60) * speedKmh;
  return distKm / KM_PER_UNIT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ScorePill({ s }) {
  const col = s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#ef4444";
  const bg = s >= 80 ? "rgba(16,185,129,0.15)" : s >= 60 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)";
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color: col, background: bg, border: "1px solid " + col + "55", borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>
      {s}/100
    </span>
  );
}

function ToggleCard({ active, icon, label, penalty, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, minWidth: 90, padding: "10px 6px", borderRadius: 8, cursor: "pointer",
        border: "1.5px solid " + (active ? "rgba(16,185,129,0.6)" : "rgba(51,65,85,0.7)"),
        background: active ? "rgba(16,185,129,0.12)" : "rgba(15,23,42,0.5)",
        color: active ? "#34d399" : "#64748b",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        transition: "all 0.2s", outline: "none",
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
      {!active && penalty && (
        <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>{penalty}</span>
      )}
      {active && (
        <span style={{ fontSize: 9, color: "#34d399", fontWeight: 700 }}>✓ Connected</span>
      )}
    </button>
  );
}

function SliderInput({ label, value, min, max, onChange, color, zones }) {
  const pct = Math.min(100, ((value - min) / (max - min)) * 100);
  const activeZone = zones?.find(z => value >= z.min && value <= z.max);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
            style={{ width: 64, padding: "2px 6px", borderRadius: 5, background: "#0f172a", border: "1px solid rgba(51,65,85,0.9)", color: activeZone?.col || color, fontSize: 13, fontWeight: 800, textAlign: "center", outline: "none" }}
          />
          <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>m</span>
        </div>
      </div>
      {/* Zone marker bar */}
      <div style={{ position: "relative", height: 10, borderRadius: 6, overflow: "hidden", background: "rgba(30,41,59,0.8)", marginBottom: 5 }}>
        {zones?.map(z => {
          const left = ((z.min - min) / (max - min)) * 100;
          const width = ((Math.min(z.max, max) - Math.max(z.min, min)) / (max - min)) * 100;
          return <div key={z.min} style={{ position: "absolute", left: left + "%", width: width + "%", height: "100%", background: z.col + "40" }} />;
        })}
        <div style={{ position: "absolute", left: "calc(" + pct + "% - 5px)", top: 0, width: 10, height: "100%", background: activeZone?.col || color, borderRadius: 4, transition: "left 0.1s" }} />
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: activeZone?.col || color, cursor: "pointer", margin: 0 }}
      />
      {activeZone && (
        <div style={{ fontSize: 10, color: activeZone.col, fontWeight: 700, marginTop: 3 }}>
          {activeZone.icon} {activeZone.label}
        </div>
      )}
      {zones && (
        <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
          {zones.map(z => (
            <div key={z.min} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: value >= z.min && value <= z.max ? z.col : "#475569" }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: z.col, display: "inline-block" }} />
              {z.legend}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeCard({ n, idx, z, dp, K }) {
  const col = { road: "#3b82f6", gate: "#06b6d4", hospital: "#ec4899", emergency: "#f97316" }[n.tp] || "#38bdf8";
  const icon = n.tp === "hospital" ? "🏥" : n.tp === "emergency" ? "🚒" : n.tp === "gate" ? "🚪" : "🛣️";
  const update = (fld, val) => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld, val } });
  const dist = n.dist || Math.round(Math.hypot(n.x || 0, n.y || 0));

  return (
    <div style={{ background: "rgba(15,23,42,0.7)", border: "1.5px solid " + col + "60", borderRadius: 8, padding: 10, position: "relative", transition: "border-color 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: col + "22", border: "1px solid " + col + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <input
            value={n.nm || ""}
            onChange={e => update("nm", e.target.value)}
            placeholder={"Name access point #" + (idx + 1)}
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid rgba(51,65,85,0.8)", color: "#f8fafc", fontSize: 12, fontWeight: 700, padding: "2px 0", outline: "none" }}
          />
        </div>
        <select
          value={n.tp}
          onChange={e => update("tp", e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 5, color: col, fontSize: 11, padding: "2px 6px", fontWeight: 700, cursor: "pointer" }}
        >
          <option value="gate">🚪 Gate</option>
          <option value="hospital">🏥 Hospital</option>
          <option value="emergency">🚒 Emergency</option>
          <option value="road">🛣️ Road</option>
        </select>
        <button
          type="button"
          onClick={() => dp({ type: "DNODE", payload: { zid: z.id, nid: n.id } })}
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 5, padding: "3px 7px", cursor: "pointer", fontSize: 13 }}
        >✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Distance</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number"
              value={dist}
              onChange={e => update("dist", Number(e.target.value))}
              style={{ flex: 1, padding: "4px 6px", borderRadius: 5, background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", fontSize: 12, fontWeight: 800, outline: "none" }}
            />
            <span style={{ fontSize: 10, color: "#475569" }}>m</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Bearing</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number"
              value={n.br || 0}
              onChange={e => update("br", Number(e.target.value))}
              style={{ flex: 1, padding: "4px 6px", borderRadius: 5, background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", fontSize: 12, fontWeight: 800, outline: "none" }}
            />
            <span style={{ fontSize: 10, color: "#475569" }}>°</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Priority</div>
          <select
            value={String(n.importance || 3)}
            onChange={e => update("importance", parseInt(e.target.value))}
            style={{ width: "100%", padding: "4px 4px", borderRadius: 5, background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {[1,2,3,4,5].map(v => <option key={v} value={v}>{["🔴 Critical","🟠 High","🟡 Normal","🔵 Low","⚪ Info"][v-1]}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 7, fontSize: 10, color: col, fontWeight: 600, opacity: 0.8 }}>
        {dist < 50 ? "⚡ Excellent: within 50m of pad" : dist < 200 ? "✓ Good: quick access" : "⚠ Far: consider a closer route"}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL SITE DIAGRAM (existing canvas, slightly adjusted)
// ─────────────────────────────────────────────────────────────────────────────

function SiteDiagram({ z, zf, dp, K, D }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);

  const rd = typeof z?.acc?.rd === "number" ? z.acc.rd : 0;
  const bd = typeof z?.acc?.bd === "number" ? z.acc.bd : 0;
  const nodes = z?.acc?.nodes || [];
  const VR = 220;

  const getCoords = useCallback(e => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const r = svgRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((cx - r.left) / r.width) * (VR * 2) - VR,
      y: ((cy - r.top) / r.height) * (VR * 2) - VR,
    };
  }, [VR]);

  const onMove = useCallback(e => {
    if (!drag) return;
    const { x, y } = getCoords(e);
    if (drag === "road") {
      zf("acc", "rd", Math.max(0, Math.min(5000, Math.round(Math.abs(y)))));
    } else if (drag === "building") {
      zf("acc", "bd", Math.max(0, Math.min(5000, Math.round(Math.abs(x)))));
    } else if (drag?.nid) {
      dp({ type: "UNODE", payload: { zid: z.id, nid: drag.nid, fld: "x", val: Math.round(x) } });
      dp({ type: "UNODE", payload: { zid: z.id, nid: drag.nid, fld: "y", val: Math.round(-y) } });
    }
  }, [drag, getCoords, zf, dp, z]);

  useEffect(() => {
    const up = () => setDrag(null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // Log-scale compression: show objects at large distances within the 220-unit viewport
  const compress = (v, minPx = 45, maxPx = 175) => {
    if (v <= 0) return 0;
    if (v <= 200) return minPx + ((v / 200) * (maxPx - minPx) * 0.6);
    return maxPx * 0.6 + ((Math.log(v) - Math.log(200)) / (Math.log(5000) - Math.log(200))) * maxPx * 0.4;
  };

  const displayRY = compress(rd);
  const displayBX = compress(bd);
  const fatoH = Math.max(12, D / 2);
  const saH = fatoH + 3;

  const roadColor = !z.acc.road ? "#ef4444" : rd <= 200 ? "#10b981" : rd <= 500 ? "#f59e0b" : "#ef4444";
  const bldColor = bd > 0 && bd < 30 ? "#ef4444" : bd > 0 && bd < 60 ? "#f59e0b" : "#10b981";
  const nodeCols = { road: "#3b82f6", gate: "#06b6d4", hospital: "#ec4899", emergency: "#f97316" };
  const nodeIcons = { hospital: "🏥", emergency: "🚒", gate: "🚪", road: "🛣️" };

  return (
    <div style={{ position: "relative", background: "#040c18", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(51,65,85,0.5)" }}>
      <svg
        ref={svgRef}
        viewBox={`-${VR} -${VR} ${VR * 2} ${VR * 2}`}
        style={{ width: "100%", height: "100%", display: "block", cursor: drag ? "grabbing" : "default", userSelect: "none" }}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
      >
        <defs>
          <radialGradient id="d-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
          <pattern id="d-asphalt" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="#1a2535" />
            <line x1="0" y1="8" x2="16" y2="8" stroke="#243044" strokeWidth="0.6" strokeDasharray="2,2" />
          </pattern>
          <pattern id="d-facade" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#0c1929" />
            <rect x="1.5" y="1.5" width="7" height="7" fill="#0f2035" rx="1" />
            <line x1="5" y1="1.5" x2="5" y2="8.5" stroke="#1e4060" strokeWidth="0.5" />
          </pattern>
          {["amber","red","green","blue","pink","orange"].map((n,i) => {
            const fill = [["#f59e0b"],["#ef4444"],["#10b981"],["#3b82f6"],["#ec4899"],["#f97316"]][i][0];
            return (
              <marker key={n} id={"arr-"+n} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 2 L9 5 L0 8Z" fill={fill} />
              </marker>
            );
          })}
        </defs>

        <circle cx="0" cy="0" r="180" fill="url(#d-glow)" />

        {[50,100,150,200].map(r => (
          <g key={r}>
            <circle cx="0" cy="0" r={r} fill="none" stroke="rgba(148,163,184,0.09)" strokeWidth="1" strokeDasharray="3,4" />
            <text x={r+3} y="-2" fill="rgba(148,163,184,0.35)" fontSize="8" fontWeight="600">{r}m</text>
          </g>
        ))}

        <line x1={-VR} y1="0" x2={VR} y2="0" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
        <line x1="0" y1={-VR} x2="0" y2={VR} stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
        <text x="0" y={-VR+14} textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="800">N ↑</text>
        <text x={VR-8} y="3" textAnchor="end" fill="rgba(148,163,184,0.5)" fontSize="8">E →</text>
        <text x="0" y={VR-6} textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="8">↓ S</text>
        <text x={-VR+6} y="3" textAnchor="start" fill="rgba(148,163,184,0.5)" fontSize="8">← W</text>

        {/* ROAD */}
        {z.acc.road && (
          <g transform={`translate(0,${displayRY})`}>
            <rect x={-VR} y="-13" width={VR*2} height="26" fill="url(#d-asphalt)" stroke={roadColor} strokeWidth="1.5" opacity="0.95" />
            <line x1={-VR} y1="0" x2={VR} y2="0" stroke="#facc15" strokeWidth="1.5" strokeDasharray="8,6" />
            <rect x="-52" y="-11" width="104" height="22" rx="5" fill="#080f1c" stroke={roadColor} strokeWidth="1" />
            <text x="0" y="3" fill="#f8fafc" fontSize="10" fontWeight="800" textAnchor="middle">🛣️ ACCESS ROAD</text>
            <g onPointerDown={e => { e.stopPropagation(); setDrag("road"); }} style={{ cursor: "ns-resize" }}>
              <circle cx="152" cy="0" r="11" fill={roadColor} stroke="#fff" strokeWidth="1.5" />
              <text x="152" y="4" fill="#fff" fontSize="11" fontWeight="900" textAnchor="middle">↕</text>
            </g>
          </g>
        )}
        {z.acc.road && rd > 0 && (
          <g>
            <line x1="-52" y1="2" x2="-52" y2={displayRY-14} stroke={roadColor} strokeWidth="1.5" strokeDasharray="4,3" markerEnd={`url(#arr-${rd<=200?"green":rd<=500?"amber":"red"})`} />
            <g transform={`translate(-52,${(displayRY-14)/2})`}>
              <rect x="-70" y="-11" width="70" height="22" rx="4" fill="#080f1c" stroke={roadColor} strokeWidth="1" />
              <text x="-35" y="-2" fill="#38bdf8" fontSize="8" fontWeight="700" textAnchor="middle">ROAD DIST</text>
              <text x="-35" y="8" fill="#f8fafc" fontSize="12" fontWeight="900" textAnchor="middle">{rd}m</text>
            </g>
          </g>
        )}

        {/* BUILDING */}
        {bd > 0 && (
          <g transform={`translate(${displayBX},0)`}>
            <rect x="-30" y="-80" width="30" height="160" fill="rgba(239,68,68,0.07)" stroke="rgba(239,68,68,0.25)" strokeDasharray="3,3" />
            <rect x="-60" y="-80" width="30" height="160" fill="rgba(245,158,11,0.05)" stroke="rgba(245,158,11,0.2)" strokeDasharray="2,4" />
            <rect x="0" y="-70" width="68" height="140" rx="6" fill="url(#d-facade)" stroke={bldColor} strokeWidth="1.5" />
            <g transform="translate(34,0) rotate(90)">
              <rect x="-45" y="-9" width="90" height="18" rx="3" fill="#080f1c" opacity="0.9" />
              <text x="0" y="3" fill="#38bdf8" fontSize="9" fontWeight="800" textAnchor="middle">🏢 BUILDING</text>
            </g>
            <g onPointerDown={e => { e.stopPropagation(); setDrag("building"); }} style={{ cursor: "ew-resize" }}>
              <circle cx="0" cy="-52" r="11" fill={bldColor} stroke="#fff" strokeWidth="1.5" />
              <text x="0" y="-49" fill="#fff" fontSize="11" fontWeight="900" textAnchor="middle">↔</text>
            </g>
          </g>
        )}
        {bd > 0 && (
          <g>
            <line x1="2" y1="-36" x2={displayBX-2} y2="-36" stroke={bldColor} strokeWidth="1.5" strokeDasharray="4,3" markerEnd={`url(#arr-${bd<30?"red":bd<60?"amber":"green"})`} />
            <g transform={`translate(${displayBX/2},-36)`}>
              <rect x="-40" y="-20" width="80" height="20" rx="4" fill="#080f1c" stroke={bldColor} strokeWidth="1" />
              <text x="0" y="-10" fill="#38bdf8" fontSize="7.5" fontWeight="700" textAnchor="middle">BLDG DIST</text>
              <text x="0" y="-1" fill="#f8fafc" fontSize="12" fontWeight="900" textAnchor="middle">{bd}m {bd<30?"⚠️":""}</text>
            </g>
          </g>
        )}

        {/* ACCESS NODES */}
        {nodes.map((n, idx) => {
          const sx = n.x || 0;
          const sy = -(n.y || 0);
          const col = nodeCols[n.tp] || "#38bdf8";
          const icon = nodeIcons[n.tp] || "📍";
          const nodeDist = n.dist || Math.round(Math.hypot(n.x||0, n.y||0));
          const isHov = hover === n.id;
          return (
            <g key={n.id||idx} transform={`translate(${sx},${sy})`}
              onPointerDown={e => { e.stopPropagation(); setDrag({ nid: n.id }); }}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "grab" }}
            >
              <line x1="0" y1="0" x2={-sx} y2={-sy} stroke={col} strokeWidth={isHov ? 1.5 : 1} strokeDasharray="3,4" opacity="0.45" />
              <circle cx="0" cy="0" r={isHov ? 17 : 14} fill={col} opacity={isHov ? 0.25 : 0.15} style={{ transition: "r 0.15s" }} />
              <circle cx="0" cy="0" r="10" fill={col} stroke="#fff" strokeWidth="1.5" />
              <text x="0" y="4" fontSize="11" textAnchor="middle">{icon}</text>
              <rect x="-38" y="-26" width="76" height="15" rx="3" fill="#080f1c" stroke={col} strokeWidth="1" opacity="0.95" />
              <text x="0" y="-14" fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">
                {n.nm || "Node #"+(idx+1)} · {nodeDist}m
              </text>
              {isHov && (
                <g transform="translate(0, 22)">
                  <rect x="-55" y="0" width="110" height="30" rx="4" fill="#080f1c" stroke={col} strokeWidth="1" opacity="0.97" />
                  <text x="0" y="11" fill={col} fontSize="8" fontWeight="800" textAnchor="middle">
                    {n.tp?.toUpperCase()} · Priority {n.importance||3}
                  </text>
                  <text x="0" y="22" fill="#94a3b8" fontSize="7.5" textAnchor="middle">
                    X={n.x||0}m Y={n.y||0}m · {n.br||0}°
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* HELIPAD */}
        <g>
          <rect x={-saH-3} y={-saH-3} width={(saH+3)*2} height={(saH+3)*2} rx="5" fill="rgba(37,99,235,0.05)" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="4,3" />
          <rect x={-fatoH} y={-fatoH} width={fatoH*2} height={fatoH*2} rx="3" fill="rgba(5,12,25,0.85)" stroke="#06b6d4" strokeWidth="1.5" />
          <circle cx="0" cy="0" r={Math.max(8,fatoH*0.76)} fill="#0e1e33" stroke="#facc15" strokeWidth="1.5" />
          <text x="0" y="6" fill="#facc15" fontSize={Math.max(10,fatoH*0.85)} fontWeight="900" textAnchor="middle">H</text>
          <circle cx="0" cy="0" r="2.5" fill="#ef4444" />
        </g>
      </svg>
      {!z.acc.road && (
        <div style={{ position: "absolute", top: 10, left: 10, fontSize: 11, color: "#f87171", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 5, padding: "3px 8px", fontWeight: 700 }}>
          ⚠ No road toggled
        </div>
      )}
      <div style={{ position: "absolute", bottom: 8, right: 8, fontSize: 9, color: "#475569", background: "rgba(4,12,24,0.8)", borderRadius: 4, padding: "3px 6px" }}>
        Drag 🛣️ ↕ road · 🏢 ↔ building · 📍 nodes
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REGIONAL RADAR — isochrone rings + draggable destination pins
// Scale: 1 SVG unit = KM_PER_UNIT km. ViewBox ±200 units → ±100 km visible.
// ─────────────────────────────────────────────────────────────────────────────

const DEST_COLORS = {
  hospital: "#ec4899",
  hq: "#f97316",
  airport: "#38bdf8",
  military: "#a78bfa",
  offshore: "#06b6d4",
  city: "#facc15",
  custom: "#94a3b8",
};
const DEST_ICONS = {
  hospital: "🏥",
  hq: "🏢",
  airport: "✈️",
  military: "⚔️",
  offshore: "🛢️",
  city: "🏙️",
  custom: "📍",
};

const ISO_RINGS = [
  { min: 5,  col: "#10b981", opacity: 0.35, label: "5 min"  },
  { min: 10, col: "#06b6d4", opacity: 0.25, label: "10 min" },
  { min: 15, col: "#f59e0b", opacity: 0.20, label: "15 min" },
  { min: 20, col: "#ef4444", opacity: 0.15, label: "20 min" },
  { min: 30, col: "#7f1d1d", opacity: 0.12, label: "30 min" },
];

function RegionalRadar({ destinations, dp, cruiseKt }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null); // did being dragged

  const VR = 200; // viewBox half-size in SVG units

  const getSvgCoords = useCallback(e => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const r = svgRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((cx - r.left) / r.width) * (VR * 2) - VR,
      y: ((cy - r.top) / r.height) * (VR * 2) - VR,
    };
  }, [VR]);

  const onPointerMove = useCallback(e => {
    if (!drag) return;
    const { x, y } = getSvgCoords(e);
    // Clamp to viewBox
    const cx = Math.max(-VR + 10, Math.min(VR - 10, x));
    const cy = Math.max(-VR + 10, Math.min(VR - 10, y));
    // Convert SVG position to real distance
    const km = svgToKm(cx, cy);
    dp({ type: "UDEST", payload: { did: drag, fld: "distKm", val: Math.round(km.dist * 10) / 10 } });
    dp({ type: "UDEST", payload: { did: drag, fld: "rvX", val: Math.round(cx * 10) / 10 } });
    dp({ type: "UDEST", payload: { did: drag, fld: "rvY", val: Math.round(cy * 10) / 10 } });
  }, [drag, getSvgCoords, dp]);

  useEffect(() => {
    const up = () => setDrag(null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // Ring radii in SVG units
  const rings = ISO_RINGS.map(ring => ({
    ...ring,
    r: isoRadius(ring.min, cruiseKt),
  })).filter(ring => ring.r > 0 && ring.r < VR * 1.8);

  return (
    <div style={{ position: "relative", background: "#020a14", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(51,65,85,0.5)" }}>
      <svg
        ref={svgRef}
        viewBox={`-${VR} -${VR} ${VR * 2} ${VR * 2}`}
        style={{ width: "100%", height: "100%", display: "block", cursor: drag ? "grabbing" : "crosshair", userSelect: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
      >
        <defs>
          <radialGradient id="rr-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="0" cy="0" r={VR * 1.2} fill="url(#rr-glow)" />

        {/* Grid */}
        {[25, 50, 75, 100, 125, 150, 175, 200].map(r => (
          <circle key={r} cx="0" cy="0" r={r} fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
        ))}
        <line x1={-VR} y1="0" x2={VR} y2="0" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
        <line x1="0" y1={-VR} x2="0" y2={VR} stroke="rgba(148,163,184,0.08)" strokeWidth="1" />

        {/* Cardinal labels */}
        <text x="0" y={-VR+13} textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="800">N ↑</text>
        <text x={VR-8} y="3" textAnchor="end" fill="rgba(148,163,184,0.4)" fontSize="8">E →</text>
        <text x="0" y={VR-6} textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="8">↓ S</text>
        <text x={-VR+8} y="3" textAnchor="start" fill="rgba(148,163,184,0.4)" fontSize="8">← W</text>

        {/* km scale labels on grid (every 25 SVG units = 12.5 km) */}
        {[50, 100, 150].map(r => (
          <text key={r} x={r + 2} y="-2" fill="rgba(148,163,184,0.25)" fontSize="7">{Math.round(r * KM_PER_UNIT)} km</text>
        ))}

        {/* ── ISOCHRONE RINGS ── drawn back to front */}
        {[...rings].reverse().map((ring, i) => (
          <g key={ring.min}>
            {/* Filled zone band between this ring and next inner */}
            <circle
              cx="0" cy="0" r={ring.r}
              fill={ring.col}
              fillOpacity={ring.opacity * 0.25}
              stroke={ring.col}
              strokeWidth="1.5"
              strokeDasharray="6,4"
              strokeOpacity={ring.opacity + 0.1}
            />
            {/* Ring label */}
            <g transform={`translate(${ring.r * 0.707 + 4}, ${-(ring.r * 0.707) - 4})`}>
              <rect x="-1" y="-9" width={ring.label.length * 5.5 + 2} height="11" rx="3" fill="#020a14" opacity="0.85" />
              <text x="0" y="0" fill={ring.col} fontSize="8" fontWeight="800">{ring.label}</text>
            </g>
          </g>
        ))}

        {/* ── HELIPAD ── */}
        <circle cx="0" cy="0" r="10" fill="#0e1e33" stroke="#06b6d4" strokeWidth="2" />
        <text x="0" y="5" fill="#facc15" fontSize="11" fontWeight="900" textAnchor="middle">H</text>
        <circle cx="0" cy="0" r="2.5" fill="#ef4444" />

        {/* ── DESTINATION PINS ── */}
        {destinations.map((d, idx) => {
          // Position: use stored rvX/rvY if available, else compute from distKm on bearing rvBr
          let svgX = d.rvX;
          let svgY = d.rvY;
          if (svgX == null || svgY == null) {
            // Default placement: arrange evenly around a 40km radius circle
            const angle = (idx / Math.max(destinations.length, 1)) * Math.PI * 2 - Math.PI / 2;
            const defaultKm = d.distKm > 0 ? d.distKm : 40;
            const sv = kmToSvg(defaultKm * Math.cos(angle), defaultKm * Math.sin(angle));
            svgX = sv.svgX;
            svgY = sv.svgY;
          }
          const col = DEST_COLORS[d.tp] || "#94a3b8";
          const icon = DEST_ICONS[d.tp] || "📍";
          const rt = calcRT(d.distKm, d.cruiseKt || 120, d.groundMin || 0, d.maxMinutes || 0);
          const isDragging = drag === d.id;
          const label = d.nm || ("Dest #" + (idx + 1));
          const timeStr = rt ? rt.totalMin.toFixed(1) + " min" : "?";
          const statusCol = rt ? (rt.meetsReq ? "#10b981" : "#ef4444") : "#64748b";
          // Bearing label from helipad to pin
          const bearingRad = Math.atan2(svgX, -svgY); // SVG Y is inverted
          const bearingDeg = Math.round((bearingRad * 180 / Math.PI + 360) % 360);
          // Clamp pin inside viewBox
          const cx = Math.max(-VR + 10, Math.min(VR - 10, svgX));
          const cy = Math.max(-VR + 10, Math.min(VR - 10, svgY));

          return (
            <g key={d.id || idx}>
              {/* Tie line from helipad to pin */}
              <line
                x1="0" y1="0" x2={cx} y2={cy}
                stroke={col} strokeWidth={isDragging ? 2 : 1}
                strokeDasharray="5,4" opacity="0.5"
              />
              {/* Distance label midpoint */}
              <g transform={`translate(${cx / 2}, ${cy / 2})`}>
                <rect x="-22" y="-8" width="44" height="14" rx="4" fill="#020a14" opacity="0.85" />
                <text x="0" y="2" fill={col} fontSize="7.5" fontWeight="700" textAnchor="middle">
                  {d.distKm > 0 ? d.distKm.toFixed(1) + " km" : "—"}
                </text>
              </g>
              {/* Pin */}
              <g
                transform={`translate(${cx}, ${cy})`}
                onPointerDown={e => { e.stopPropagation(); setDrag(d.id); }}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
              >
                {/* Halo */}
                <circle cx="0" cy="0" r={isDragging ? 22 : 18} fill={col} opacity={isDragging ? 0.3 : 0.15} style={{ transition: "r 0.1s" }} />
                {/* Body */}
                <circle cx="0" cy="0" r="14" fill={isDragging ? col : col + "cc"} stroke="#fff" strokeWidth="1.5" />
                {/* Icon text */}
                <text x="0" y="5" fontSize="13" textAnchor="middle">{icon}</text>
                {/* Compliance dot */}
                <circle cx="11" cy="-11" r="5" fill={statusCol} stroke="#020a14" strokeWidth="1.5" />
                {rt && !rt.meetsReq && <text x="11" y="-8" fill="#fff" fontSize="7" fontWeight="900" textAnchor="middle">!</text>}
                {/* Name + time badge above pin */}
                <g transform="translate(0, -26)">
                  <rect x={-Math.max(label.length * 3.8, 30)} y="-18" width={Math.max(label.length * 7.6, 60)} height="32" rx="4" fill="#020a14" stroke={col} strokeWidth="1" opacity="0.97" />
                  <text x="0" y="-7" fill="#f8fafc" fontSize="8.5" fontWeight="800" textAnchor="middle">{label}</text>
                  <text x="0" y="5" fill={statusCol} fontSize="10" fontWeight="900" textAnchor="middle">{timeStr}</text>
                  {d.maxMinutes > 0 && rt && (
                    <text x="0" y="17" fill={statusCol} fontSize="7" fontWeight="700" textAnchor="middle">
                      {rt.meetsReq ? "✓ MEETS" : "✗ EXCEEDS"} {d.maxMinutes}min
                    </text>
                  )}
                </g>
                {/* Bearing label below */}
                <text x="0" y="25" fill="#64748b" fontSize="7" textAnchor="middle">{bearingDeg}°</text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {ISO_RINGS.map(ring => {
          const r = isoRadius(ring.min, cruiseKt);
          const km = Math.round(r * KM_PER_UNIT * 10) / 10;
          return (
            <div key={ring.min} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(2,10,20,0.85)", borderRadius: 4, padding: "2px 6px" }}>
              <div style={{ width: 10, height: 2, borderRadius: 1, background: ring.col, opacity: ring.opacity + 0.3 }} />
              <span style={{ fontSize: 9, color: ring.col, fontWeight: 700 }}>{ring.label}</span>
              <span style={{ fontSize: 9, color: "#475569" }}>= {km > 0 ? km.toFixed(1) + " km radius" : "< startup"}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 8, right: 8, fontSize: 9, color: "#475569", background: "rgba(2,10,20,0.85)", borderRadius: 4, padding: "3px 6px" }}>
        Drag pins to set distance · Isochrones at {Math.round(cruiseKt * 1.852)} km/h
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESTINATION CARD — right panel
// ─────────────────────────────────────────────────────────────────────────────

function DestinationCard({ d, dp, siteRef }) {
  const col = DEST_COLORS[d.tp] || "#94a3b8";
  const icon = DEST_ICONS[d.tp] || "📍";
  const upd = (fld, val) => dp({ type: "UDEST", payload: { did: d.id, fld, val } });
  const rt = calcRT(d.distKm, d.cruiseKt || 120, d.groundMin || 0, d.maxMinutes || 0);

  return (
    <div style={{
      background: "rgba(15,23,42,0.7)",
      border: "1.5px solid " + col + "55",
      borderRadius: 10,
      padding: 12,
      position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: col + "20", border: "1px solid " + col + "50", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {icon}
        </div>
        <input
          value={d.nm || ""}
          onChange={e => upd("nm", e.target.value)}
          placeholder="Destination name…"
          style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(51,65,85,0.8)", color: "#f8fafc", fontSize: 12, fontWeight: 700, padding: "2px 0", outline: "none" }}
        />
        <select
          value={d.tp || "hospital"}
          onChange={e => upd("tp", e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 5, color: col, fontSize: 11, padding: "2px 6px", fontWeight: 700, cursor: "pointer" }}
        >
          {Object.entries(DEST_ICONS).map(([v, ic]) => (
            <option key={v} value={v}>{ic} {v.charAt(0).toUpperCase() + v.slice(1)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => dp({ type: "DDEST", payload: d.id })}
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 5, padding: "3px 7px", cursor: "pointer", fontSize: 13 }}
        >✕</button>
      </div>

      {/* Core inputs: 2 most important fields prominently */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {/* Distance (primary input — also set by dragging on canvas) */}
        <div style={{ background: "rgba(10,18,32,0.6)", borderRadius: 6, padding: "8px 10px", border: "1px solid rgba(51,65,85,0.4)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Distance</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number" min="0" step="0.5"
              value={d.distKm || ""}
              onChange={e => upd("distKm", parseFloat(e.target.value) || 0)}
              placeholder="0"
              style={{ flex: 1, background: "transparent", border: "none", color: col, fontSize: 16, fontWeight: 900, outline: "none", width: 0 }}
            />
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>km</span>
          </div>
          <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>or drag pin on map</div>
        </div>

        {/* Max Response Target */}
        <div style={{ background: "rgba(10,18,32,0.6)", borderRadius: 6, padding: "8px 10px", border: "1px solid rgba(51,65,85,0.4)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Max Allowed</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number" min="0" step="1"
              value={d.maxMinutes || ""}
              onChange={e => upd("maxMinutes", parseInt(e.target.value) || 0)}
              placeholder="—"
              style={{ flex: 1, background: "transparent", border: "none", color: "#f8fafc", fontSize: 16, fontWeight: 900, outline: "none", width: 0 }}
            />
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>min</span>
          </div>
          <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>EMS / regulatory target</div>
        </div>
      </div>

      {/* Secondary: cruise speed + ground time, compact */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Helicopter cruise flight speed in knots (kt)">
          <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, whiteSpace: "nowrap" }}>Flight (Air)</span>
          <input
            type="number" min="40" max="250" step="5"
            value={d.cruiseKt || 120}
            onChange={e => upd("cruiseKt", parseInt(e.target.value) || 120)}
            style={{ flex: 1, padding: "3px 6px", borderRadius: 5, background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", fontSize: 11, fontWeight: 700, outline: "none", width: 0 }}
          />
          <span style={{ fontSize: 10, color: "#475569" }}>kt</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Car / Ambulance ground transit time at destination">
          <span style={{ fontSize: 10, color: "#f97316", fontWeight: 700, whiteSpace: "nowrap" }}>Car / Ground</span>
          <input
            type="number" min="0" step="1"
            value={d.groundMin || 0}
            onChange={e => upd("groundMin", parseInt(e.target.value) || 0)}
            style={{ flex: 1, padding: "3px 6px", borderRadius: 5, background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", fontSize: 11, fontWeight: 700, outline: "none", width: 0 }}
          />
          <span style={{ fontSize: 10, color: "#475569" }}>min</span>
        </div>
      </div>

      {/* LIVE RESULT */}
      {rt ? (
        <div style={{
          background: rt.meetsReq ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: "1px solid " + (rt.meetsReq ? "#10b981" : "#ef4444") + "40",
          borderRadius: 8,
          padding: "10px 12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Response Time</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: rt.meetsReq ? "#10b981" : "#ef4444", lineHeight: 1.1 }}>
                {rt.totalMin.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 700 }}>min</span>
              </div>
            </div>
            {d.maxMinutes > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: rt.meetsReq ? "#10b981" : "#ef4444", fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: "1px solid " + (rt.meetsReq ? "#10b981" : "#ef4444") + "50" }}>
                  {rt.meetsReq ? "✓ MEETS" : "✗ EXCEEDS"}
                </div>
                <div style={{ fontSize: 9, color: "#475569", marginTop: 3 }}>{d.maxMinutes} min target</div>
              </div>
            )}
          </div>
          {/* Phase breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
            {[
              { label: "Startup", val: rt.startupMin, color: "#94a3b8", unit: "min" },
              { label: "Flight", val: rt.flightMin, color: "#38bdf8", unit: "min" },
              { label: "Approach", val: rt.approachMin, color: "#94a3b8", unit: "min" },
              { label: "Ground", val: rt.groundMin, color: "#f97316", unit: "min" },
            ].map(ph => (
              <div key={ph.label} style={{ textAlign: "center", background: "rgba(15,23,42,0.5)", borderRadius: 5, padding: "4px 2px" }}>
                <div style={{ fontSize: 8, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>{ph.label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: ph.color }}>{ph.val}</div>
                <div style={{ fontSize: 8, color: "#334155" }}>{ph.unit}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#475569", marginTop: 6 }}>
            @ {rt.speedKmh} km/h ({d.cruiseKt || 120} kt) · {rt.distKm} km
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#f59e0b", textAlign: "center", padding: "8px", background: "rgba(245,158,11,0.06)", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)" }}>
          ⚠ Enter distance or drag the pin on the radar to calculate
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

// Destination type presets — one-click add with sensible defaults
const DEST_PRESETS = [
  { icon: "🏥", label: "City Hospital",   tp: "hospital", distKm: 15,  maxMinutes: 15, cruiseKt: 120, groundMin: 3, nm: "City Hospital"   },
  { icon: "🚒", label: "Fire Station",    tp: "hq",       distKm: 8,   maxMinutes: 10, cruiseKt: 120, groundMin: 2, nm: "Fire Station HQ"  },
  { icon: "✈️", label: "Regional Airport",tp: "airport",  distKm: 35,  maxMinutes: 30, cruiseKt: 120, groundMin: 0, nm: "Regional Airport"  },
  { icon: "🏙️", label: "City Center",     tp: "city",     distKm: 20,  maxMinutes: 20, cruiseKt: 120, groundMin: 5, nm: "City Centre"       },
  { icon: "⚔️", label: "Military Base",   tp: "military", distKm: 50,  maxMinutes: 45, cruiseKt: 130, groundMin: 0, nm: "Military Base"     },
  { icon: "🛢️", label: "Offshore Platform",tp: "offshore",distKm: 80,  maxMinutes: 60, cruiseKt: 130, groundMin: 0, nm: "Offshore Platform" },
];

export function AccessDiagramCanvas({ z, dp, zf, K, D = 16.6, zones, SRC_OPTIONS, sel_, site }) {
  const [viewMode, setViewMode] = useState("local"); // "local" | "regional"
  const rd = typeof z?.acc?.rd === "number" ? z.acc.rd : 0;
  const bd = typeof z?.acc?.bd === "number" ? z.acc.bd : 0;
  const nodes = z?.acc?.nodes || [];
  const destinations = site?.destinations || [];

  // Global cruise kt for isochrone rings (use first destination's speed or default 120)
  const globalCruiseKt = destinations[0]?.cruiseKt || 120;

  const scoreResult = useMemo(() => {
    try { return sAcc(z); }
    catch { return { s: 100, R: ["Access OK"] }; }
  }, [z]);

  const roadZones = [
    { min: 0,   max: 200,  col: "#10b981", icon: "✓",  label: "Excellent road proximity",  legend: "≤200m ideal"      },
    { min: 201, max: 500,  col: "#f59e0b", icon: "⚠",  label: "Moderate – slightly far",   legend: "201–500m"         },
    { min: 501, max: 5000, col: "#ef4444", icon: "✗",  label: "Too far – score penalty",   legend: ">500m penalized"  },
  ];
  const bldZones = [
    { min: 0,  max: 30,   col: "#ef4444", icon: "🚨", label: "CRITICAL: too close (<30m)", legend: "<30m critical"  },
    { min: 31, max: 60,   col: "#f59e0b", icon: "⚠",  label: "Caution: in rotor buffer",  legend: "30–60m caution" },
    { min: 61, max: 5000, col: "#10b981", icon: "✓",  label: "Safe standoff distance",     legend: "≥60m safe"      },
  ];

  return (
    <div className="hvs-card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(51,65,85,0.5)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: "rgba(15,23,42,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{viewMode === "local" ? "📐" : "🗺️"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>
              {viewMode === "local" ? "Access & Infrastructure" : "Response Time Radar"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {viewMode === "local"
                ? "Drag on the diagram or use sliders — all connected live"
                : "Drag pins on radar · isochrone rings auto-calculated · all math is real"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", background: "rgba(10,18,32,0.8)", borderRadius: 7, padding: 3, border: "1px solid rgba(51,65,85,0.5)" }}>
            {[
              { id: "local", icon: "📐", label: "Local Access" },
              { id: "regional", icon: "🗺️", label: "Response Time" },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 5,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s",
                  background: viewMode === tab.id ? "rgba(6,182,212,0.15)" : "transparent",
                  color: viewMode === tab.id ? "#38bdf8" : "#64748b",
                  outline: "none",
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === "regional" && destinations.length > 0 && (
                  <span style={{ background: "#06b6d4", color: "#020a14", fontSize: 9, fontWeight: 800, borderRadius: 10, padding: "1px 5px", marginLeft: 2 }}>
                    {destinations.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {SRC_OPTIONS && sel_ && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Source:</span>
              {sel_(z.src?.access || "assumed", v => zf("src", "access", v), SRC_OPTIONS)}
            </div>
          )}
          <ScorePill s={scoreResult.s} />
          {zones && zones.filter(zz => zz.on).length > 1 && (
            <button type="button" className="hvs-btn" onClick={() => dp({ type: "APPLY_ALL", payload: { section: "access", fromZid: z.id } })} style={{ fontSize: 11, padding: "3px 8px", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(51,65,85,0.7)", color: "#94a3b8", borderRadius: 5, cursor: "pointer" }}>
              Apply to all zones
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* LOCAL ACCESS TAB                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      {viewMode === "local" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(280px,370px)", gap: 0 }}>
          {/* LEFT: Diagram */}
          <div style={{ padding: 14, minHeight: 340 }}>
            <SiteDiagram z={z} zf={zf} dp={dp} K={K} D={D} />
          </div>

          {/* RIGHT: Controls */}
          <div style={{ borderLeft: "1px solid rgba(51,65,85,0.45)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4, background: "rgba(10,18,32,0.5)", overflowY: "auto", maxHeight: 600 }}>
            {/* Availability toggles */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Infrastructure Available</div>
              <div style={{ display: "flex", gap: 8 }}>
                <ToggleCard active={z.acc.road} icon="🛣️" label="Road" penalty="-25 pts" onClick={() => zf("acc", "road", !z.acc.road)} />
                <ToggleCard active={z.acc.emer} icon="🚒" label="Emergency" penalty="-15 pts" onClick={() => zf("acc", "emer", !z.acc.emer)} />
                <ToggleCard active={z.acc.util} icon="⚡" label="Utilities" penalty="-8 pts" onClick={() => zf("acc", "util", !z.acc.util)} />
              </div>
            </div>

            {/* Distance sliders */}
            <div style={{ marginBottom: 4, padding: "12px 14px", background: "rgba(15,23,42,0.7)", borderRadius: 8, border: "1px solid rgba(51,65,85,0.5)" }}>
              <SliderInput
                label="🛣️ Road Distance (rd)"
                value={rd} min={0} max={600}
                onChange={v => zf("acc", "rd", v)}
                color="#3b82f6"
                zones={roadZones}
              />
              <SliderInput
                label="🏢 Building Distance (bd)"
                value={bd} min={0} max={5000}
                onChange={v => zf("acc", "bd", v)}
                color="#06b6d4"
                zones={bldZones}
              />
            </div>

            {/* Quick presets */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Quick Presets</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {[
                  { label: "🏥 Hospital Pad", rd: 25, bd: 20 },
                  { label: "🏢 Adjacent Terminal", rd: 45, bd: 35 },
                  { label: "✈️ Isolated Stand", rd: 80, bd: 110 },
                  { label: "🛢️ Offshore Deck", rd: 0, bd: 5 },
                ].map(p => (
                  <button key={p.label} type="button" className="hvs-btn"
                    onClick={() => { zf("acc","rd",p.rd); zf("acc","bd",p.bd); }}
                    style={{ fontSize: 10, padding: "4px 8px", borderRadius: 5, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(51,65,85,0.6)", color: "#94a3b8", cursor: "pointer", fontWeight: 700 }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Access Points */}
            <div style={{ marginTop: 2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Access Points & Gates ({nodes.length})
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[
                    { tp: "gate", icon: "🚪" }, { tp: "hospital", icon: "🏥" }, { tp: "emergency", icon: "🚒" },
                  ].map(t => (
                    <button key={t.tp} type="button" className="hvs-btn"
                      onClick={() => {
                        dp({ type: "ANODE", payload: { zid: z.id } });
                        setTimeout(() => {
                          const nn = (z.acc?.nodes || []);
                          const newest = nn[nn.length - 1];
                          if (newest) dp({ type: "UNODE", payload: { zid: z.id, nid: newest.id, fld: "tp", val: t.tp } });
                        }, 60);
                      }}
                      style={{ fontSize: 14, padding: "3px 7px", borderRadius: 6, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(51,65,85,0.6)", cursor: "pointer" }}
                      title={"Add " + t.tp}
                    >{t.icon} +</button>
                  ))}
                </div>
              </div>
              {nodes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "18px 12px", color: "#334155", fontSize: 12, border: "1px dashed rgba(51,65,85,0.5)", borderRadius: 8 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🚪</div>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>No access points yet</div>
                  <div style={{ fontSize: 11 }}>Click + above to add gates, hospital entrances, or emergency routes.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {nodes.map((n, idx) => <NodeCard key={n.id || idx} n={n} idx={idx} z={z} dp={dp} K={K} />)}
                </div>
              )}
            </div>

            {/* Score breakdown */}
            <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(15,23,42,0.7)", borderRadius: 8, border: "1px solid rgba(51,65,85,0.5)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Score Breakdown</div>
              {scoreResult.R.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, minWidth: 14 }}>{r.includes("No") || r.includes("✗") || r.toLowerCase().includes("pen") ? "🔴" : r.includes("⚠") || r.toLowerCase().includes("far") ? "🟡" : "🟢"}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{r}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(51,65,85,0.5)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Access sub-score</span>
                <ScorePill s={scoreResult.s} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* REGIONAL RESPONSE TIME TAB                                  */}
      {/* ════════════════════════════════════════════════════════════ */}
      {viewMode === "regional" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(300px,400px)", gap: 0 }}>
          {/* LEFT: Regional radar */}
          <div style={{ padding: 14, minHeight: 380 }}>
            <RegionalRadar
              destinations={destinations}
              dp={dp}
              cruiseKt={globalCruiseKt}
            />
          </div>

          {/* RIGHT: Destination list + controls */}
          <div style={{ borderLeft: "1px solid rgba(51,65,85,0.45)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, background: "rgba(10,18,32,0.5)", overflowY: "auto", maxHeight: 680 }}>

            {/* Formula explainer */}
            <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>How it's calculated</div>
              <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>
                <span style={{ color: "#94a3b8" }}>Total = </span>
                <span style={{ color: "#94a3b8" }}>3 min startup</span>
                <span style={{ color: "#475569" }}> + </span>
                <span style={{ color: "#38bdf8" }}>flight time</span>
                <span style={{ color: "#475569" }}> + </span>
                <span style={{ color: "#94a3b8" }}>2 min approach</span>
                <span style={{ color: "#475569" }}> + </span>
                <span style={{ color: "#f97316" }}>ground transfer</span>
                <br />
                <span style={{ color: "#38bdf8" }}>Flight = (dist ÷ speed) × 60</span>
                {" "}| Speed = kt × 1.852
              </div>
            </div>

            {/* One-click presets */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Add Common Destinations</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {DEST_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      dp({ type: "ADEST" });
                      // Apply preset values after state update
                      setTimeout(() => {
                        const latest = (site?.destinations || []);
                        const newest = latest[latest.length - 1];
                        if (newest) {
                          ["nm","tp","distKm","maxMinutes","cruiseKt","groundMin"].forEach(fld => {
                            dp({ type: "UDEST", payload: { did: newest.id, fld, val: p[fld] } });
                          });
                          // Default pin position: random angle at correct distance
                          const angle = Math.random() * Math.PI * 2;
                          const sv = kmToSvg(p.distKm * Math.cos(angle), p.distKm * Math.sin(angle));
                          dp({ type: "UDEST", payload: { did: newest.id, fld: "rvX", val: Math.round(sv.svgX * 10) / 10 } });
                          dp({ type: "UDEST", payload: { did: newest.id, fld: "rvY", val: Math.round(sv.svgY * 10) / 10 } });
                        }
                      }, 80);
                    }}
                    style={{
                      fontSize: 10,
                      padding: "5px 9px",
                      borderRadius: 6,
                      background: "rgba(30,41,59,0.8)",
                      border: "1px solid rgba(51,65,85,0.6)",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => dp({ type: "ADEST" })}
                  style={{ fontSize: 10, padding: "5px 9px", borderRadius: 6, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", color: "#38bdf8", cursor: "pointer", fontWeight: 700 }}
                >
                  + Custom
                </button>
              </div>
            </div>

            {/* Destination cards */}
            {destinations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "#334155", fontSize: 12, border: "1px dashed rgba(51,65,85,0.4)", borderRadius: 10 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
                <div style={{ fontWeight: 700, marginBottom: 4, color: "#475569" }}>No destinations yet</div>
                <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                  Click a preset above (e.g., 🏥 City Hospital) to instantly add it.<br />
                  Then drag its pin on the radar to set the exact distance.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {destinations.map((d, i) => (
                  <DestinationCard key={d.id || i} d={d} dp={dp} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
