import React, { useState, useRef, useMemo, useEffect } from "react";
import { sAcc } from "../../engine/scoring.js";

/**
 * AccessDiagramCanvas
 * An interactive, visual 2D architectural site canvas showing:
 * - Center Helipad (FATO, TLOF, Safety Area)
 * - Road Distance (rd) with interactive visual offset & threshold zones (<200m, 200-500m, >500m)
 * - Building / Terminal Distance (bd) with safety buffer zones (<30m critical, 30-60m warning, >=60m safe)
 * - Access Points / Nodes (Gates, Hospital Entry, Emergency Route) with interactive drag & click-to-place
 * - Real-time scoring feedback and explanation of all required measurements
 */
export function AccessDiagramCanvas({ z, dp, zf, K, D = 16.6 }) {
  const svgRef = useRef(null);
  const [activeDrag, setActiveDrag] = useState(null); // 'road' | 'building' | { type: 'node', id: string }
  const [hoveredNode, setHoveredNode] = useState(null);
  const [canvasMode, setCanvasMode] = useState("navigate"); // 'navigate' | 'add_node'
  const [newNodeType, setNewNodeType] = useState("gate"); // 'gate' | 'road' | 'hospital' | 'emergency'

  const rd = typeof z?.acc?.rd === "number" ? z.acc.rd : 0;
  const bd = typeof z?.acc?.bd === "number" ? z.acc.bd : 0;
  const nodes = z?.acc?.nodes || [];

  // Live scoring calculation for access
  const scoreResult = useMemo(() => {
    try {
      return sAcc(z);
    } catch {
      return { s: 100, R: ["Access OK"] };
    }
  }, [z]);

  // Viewport mapping: 1 SVG unit = 1 meter
  // Canvas coordinate system: -220 to +220 meters
  const viewRange = 220;

  const toSvgX = (mX) => mX;
  const toSvgY = (mY) => -mY; // invert so +Y is North (up)

  const toMeterX = (svgX) => svgX;
  const toMeterY = (svgY) => -svgY;

  // Mouse event handlers for dragging or placing nodes
  const getSvgCoordinates = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale client coords to SVG viewBox (-viewRange to +viewRange)
    const relX = ((clientX - rect.left) / rect.width) * (viewRange * 2) - viewRange;
    const relY = ((clientY - rect.top) / rect.height) * (viewRange * 2) - viewRange;
    return { x: relX, y: relY };
  };

  const handlePointerDown = (e, dragTarget) => {
    e.stopPropagation();
    setActiveDrag(dragTarget);
  };

  const handleCanvasClick = (e) => {
    if (activeDrag) return;
    if (canvasMode === "add_node") {
      const { x, y } = getSvgCoordinates(e);
      const mX = Math.round(toMeterX(x));
      const mY = Math.round(toMeterY(y));

      dp({
        type: "ANODE",
        payload: { zid: z.id },
      });

      // Update the newly created node with coordinates and type
      setTimeout(() => {
        const latestNodes = z.acc?.nodes || [];
        const newest = latestNodes[latestNodes.length - 1];
        if (newest) {
          dp({
            type: "UNODE",
            payload: { zid: z.id, nid: newest.id, fld: "x", val: mX },
          });
          dp({
            type: "UNODE",
            payload: { zid: z.id, nid: newest.id, fld: "y", val: mY },
          });
          dp({
            type: "UNODE",
            payload: { zid: z.id, nid: newest.id, fld: "tp", val: newNodeType },
          });
        }
      }, 60);

      setCanvasMode("navigate");
    }
  };

  const handlePointerMove = (e) => {
    if (!activeDrag) return;
    const { x, y } = getSvgCoordinates(e);
    const mX = toMeterX(x);
    const mY = toMeterY(y);

    if (activeDrag === "road") {
      const dist = Math.max(0, Math.min(600, Math.round(Math.abs(mY))));
      zf("acc", "rd", dist);
    } else if (activeDrag === "building") {
      const dist = Math.max(0, Math.min(600, Math.round(Math.abs(mX))));
      zf("acc", "bd", dist);
    } else if (activeDrag?.type === "node") {
      const nid = activeDrag.id;
      const roundedX = Math.round(mX);
      const roundedY = Math.round(mY);
      dp({
        type: "UNODE",
        payload: { zid: z.id, nid, fld: "x", val: roundedX },
      });
      dp({
        type: "UNODE",
        payload: { zid: z.id, nid, fld: "y", val: roundedY },
      });
    }
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
  };

  useEffect(() => {
    const onUp = () => setActiveDrag(null);
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, []);

  // Clamped display positions so objects remain visible inside viewport even if distance is large
  const displayRoadY = Math.min(180, Math.max(40, rd));
  const isRoadFar = rd > 180;

  const displayBuildX = Math.min(180, Math.max(40, bd));
  const isBuildFar = bd > 180;

  // Helipad dimensions
  const fatoHalf = Math.max(12, D / 2);
  const saHalf = fatoHalf + 3;

  // Road score color
  const roadStatusColor = !z.acc.road
    ? "#ef4444"
    : rd <= 200
    ? "#10b981"
    : rd <= 500
    ? "#f59e0b"
    : "#ef4444";

  // Building score color
  const buildingStatusColor =
    bd > 0 && bd < 30
      ? "#ef4444"
      : bd > 0 && bd < 60
      ? "#f59e0b"
      : "#10b981";

  const nodeColors = {
    road: "#3b82f6",
    gate: "#06b6d4",
    hospital: "#ec4899",
    emergency: "#f97316",
  };

  return (
    <div style={{ background: "rgba(11,17,32,0.9)", border: "1px solid " + K.bd, borderRadius: 10, padding: 14, marginBottom: 16 }}>
      {/* Top Banner & Canvas Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📐</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: K.tx, letterSpacing: -0.2 }}>
              ACCESS & DISTANCE MEASUREMENT CANVAS
            </span>
            <span style={{ fontSize: 11, background: scoreResult.s >= 80 ? "rgba(16,185,129,0.18)" : scoreResult.s >= 60 ? "rgba(245,158,11,0.18)" : "rgba(239,68,68,0.18)", color: scoreResult.s >= 80 ? "#34d399" : scoreResult.s >= 60 ? "#fbbf24" : "#f87171", border: "1px solid currentColor", borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>
              Access Score: {scoreResult.s}/100
            </span>
          </div>
          <div style={{ fontSize: 12, color: K.mu, marginTop: 2 }}>
            Visual distance map: Drag objects or enter values below. All distances are measured from the <strong>Helipad Center (0, 0)</strong>.
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: K.dm, fontWeight: 600 }}>Presets:</span>
          <button
            type="button"
            className="hvs-btn"
            onClick={() => { zf("acc", "rd", 45); zf("acc", "bd", 35); }}
            style={{ padding: "3px 8px", fontSize: 11, borderRadius: 4, background: "rgba(30,41,59,0.8)", border: "1px solid " + K.bd, color: K.tx, cursor: "pointer" }}
            title="Adjacent Terminal: 35m building, 45m road"
          >
            🏢 Adjacent Terminal (35m / 45m)
          </button>
          <button
            type="button"
            className="hvs-btn"
            onClick={() => { zf("acc", "rd", 80); zf("acc", "bd", 110); }}
            style={{ padding: "3px 8px", fontSize: 11, borderRadius: 4, background: "rgba(30,41,59,0.8)", border: "1px solid " + K.bd, color: K.tx, cursor: "pointer" }}
            title="Isolated Stand: 110m building, 80m road"
          >
            ✈️ Isolated Stand (110m / 80m)
          </button>
          <button
            type="button"
            className="hvs-btn"
            onClick={() => { zf("acc", "rd", 25); zf("acc", "bd", 20); }}
            style={{ padding: "3px 8px", fontSize: 11, borderRadius: 4, background: "rgba(30,41,59,0.8)", border: "1px solid " + K.bd, color: K.tx, cursor: "pointer" }}
            title="Hospital Helipad: 20m building, 25m road"
          >
            🏥 Hospital Pad (20m / 25m)
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div style={{ position: "relative", width: "100%", height: 380, background: "#050b14", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(51,65,85,0.6)" }}>
        <svg
          ref={svgRef}
          viewBox={`-${viewRange} -${viewRange} ${viewRange * 2} ${viewRange * 2}`}
          style={{ width: "100%", height: "100%", cursor: activeDrag ? "grabbing" : canvasMode === "add_node" ? "crosshair" : "default", userSelect: "none" }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleCanvasClick}
        >
          <defs>
            {/* Background Radial Glow */}
            <radialGradient id="acc-center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>

            {/* Road Asphalt Texture */}
            <pattern id="acc-asphalt" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect width="20" height="20" fill="#1e293b" />
              <line x1="0" y1="10" x2="20" y2="10" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
            </pattern>

            {/* Building Grid Texture */}
            <pattern id="acc-building-facade" width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="#0f172a" />
              <rect x="1" y="1" width="8" height="8" fill="#1e293b" rx="1" />
              <line x1="5" y1="1" x2="5" y2="9" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>

            {/* Arrow Markers */}
            <marker id="acc-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#38bdf8" />
            </marker>
            <marker id="acc-arrow-amber" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f59e0b" />
            </marker>
            <marker id="acc-arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ef4444" />
            </marker>
            <marker id="acc-arrow-green" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#10b981" />
            </marker>
          </defs>

          {/* Radial Center Glow */}
          <circle cx="0" cy="0" r="160" fill="url(#acc-center-glow)" />

          {/* Range Grid Rings (50m, 100m, 150m, 200m) */}
          {[50, 100, 150, 200].map((ring) => (
            <g key={ring}>
              <circle cx="0" cy="0" r={ring} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" strokeDasharray="3,3" />
              <text x={ring + 2} y="-4" fill="rgba(148,163,184,0.4)" fontSize="9" fontWeight="600">
                {ring}m
              </text>
            </g>
          ))}

          {/* Crosshairs & Compass Cardinal Marks */}
          <line x1={`-${viewRange}`} y1="0" x2={`${viewRange}`} y2="0" stroke="rgba(148,163,184,0.1)" strokeWidth="1" />
          <line x1="0" y1={`-${viewRange}`} x2="0" y2={`${viewRange}`} stroke="rgba(148,163,184,0.1)" strokeWidth="1" />

          <text x="0" y={`-${viewRange - 16}`} fill="#38bdf8" fontSize="11" fontWeight="800" textAnchor="middle">
            NORTH (0°)
          </text>
          <text x={`${viewRange - 16}`} y="4" fill="rgba(148,163,184,0.6)" fontSize="10" fontWeight="700" textAnchor="end">
            EAST (90°)
          </text>
          <text x="0" y={`${viewRange - 8}`} fill="rgba(148,163,184,0.6)" fontSize="10" fontWeight="700" textAnchor="middle">
            SOUTH (180°)
          </text>
          <text x={`-${viewRange - 12}`} y="4" fill="rgba(148,163,184,0.6)" fontSize="10" fontWeight="700" textAnchor="start">
            WEST (270°)
          </text>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 1. ROAD CORRIDOR & ROAD DISTANCE (rd)                            */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {z.acc.road && (
            <g transform={`translate(0, ${displayRoadY})`}>
              {/* Road Asphalt Corridor */}
              <rect
                x={`-${viewRange}`}
                y="-14"
                width={viewRange * 2}
                height="28"
                fill="url(#acc-asphalt)"
                stroke={roadStatusColor}
                strokeWidth="1.5"
                opacity="0.9"
              />
              {/* Road Centerline (Yellow Dashed) */}
              <line
                x1={`-${viewRange}`}
                y1="0"
                x2={`${viewRange}`}
                y2="0"
                stroke="#facc15"
                strokeWidth="1.5"
                strokeDasharray="6,6"
              />
              {/* Road Outer Curb lines */}
              <line x1={`-${viewRange}`} y1="-14" x2={`${viewRange}`} y2="-14" stroke="#ffffff" strokeWidth="0.8" opacity="0.5" />
              <line x1={`-${viewRange}`} y1="14" x2={`${viewRange}`} y2="14" stroke="#ffffff" strokeWidth="0.8" opacity="0.5" />

              {/* Road Label Badge */}
              <rect x="-70" y="-12" width="140" height="24" rx="4" fill="#0f172a" stroke={roadStatusColor} strokeWidth="1" />
              <text x="0" y="4" fill="#f8fafc" fontSize="11" fontWeight="800" textAnchor="middle">
                🛣️ SITE ACCESS ROAD
              </text>

              {/* Draggable Road Handle */}
              <g
                onPointerDown={(e) => handlePointerDown(e, "road")}
                style={{ cursor: "ns-resize" }}
              >
                <circle cx="160" cy="0" r="10" fill={roadStatusColor} stroke="#ffffff" strokeWidth="2" />
                <text x="160" y="3" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">↕</text>
              </g>
            </g>
          )}

          {/* Dimension Line for Road Distance (rd) */}
          {z.acc.road && (
            <g>
              <line
                x1="-40"
                y1="0"
                x2="-40"
                y2={displayRoadY - 14}
                stroke={roadStatusColor}
                strokeWidth="2"
                strokeDasharray="4,4"
                markerEnd={`url(#acc-arrow-${rd <= 200 ? "green" : rd <= 500 ? "amber" : "red"})`}
              />
              {/* Road Distance Badge */}
              <g transform={`translate(-40, ${(displayRoadY - 14) / 2})`}>
                <rect x="-85" y="-12" width="80" height="24" rx="4" fill="#090d16" stroke={roadStatusColor} strokeWidth="1.2" />
                <text x="-45" y="-1" fill="#38bdf8" fontSize="9" fontWeight="700" textAnchor="middle">
                  ROAD DIST (rd)
                </text>
                <text x="-45" y="9" fill="#f8fafc" fontSize="11" fontWeight="800" textAnchor="middle">
                  {rd}m {isRoadFar ? "(offscreen)" : ""}
                </text>
              </g>
            </g>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 2. BUILDING / TERMINAL & BUILDING DISTANCE (bd)                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {bd > 0 && (
            <g transform={`translate(${displayBuildX}, 0)`}>
              {/* Building Facade Block */}
              <rect
                x="0"
                y="-65"
                width="70"
                height="130"
                rx="6"
                fill="url(#acc-building-facade)"
                stroke={buildingStatusColor}
                strokeWidth="1.5"
              />

              {/* Building Title */}
              <g transform="translate(35, 0) rotate(90)">
                <rect x="-50" y="-10" width="100" height="20" rx="3" fill="#0f172a" opacity="0.85" />
                <text x="0" y="3" fill="#38bdf8" fontSize="10" fontWeight="800" textAnchor="middle">
                  🏢 TERMINAL / BLDG
                </text>
              </g>

              {/* Standoff Hazard Zones Visual (<30m Red, 30-60m Amber) */}
              <rect
                x="-30"
                y="-75"
                width="30"
                height="150"
                fill="rgba(239,68,68,0.08)"
                stroke="rgba(239,68,68,0.3)"
                strokeDasharray="2,2"
              />
              <text x="-15" y="-80" fill="#f87171" fontSize="8" fontWeight="700" textAnchor="middle">
                &lt;30m CRITICAL
              </text>

              {/* Draggable Building Handle */}
              <g
                onPointerDown={(e) => handlePointerDown(e, "building")}
                style={{ cursor: "ew-resize" }}
              >
                <circle cx="0" cy="-50" r="10" fill={buildingStatusColor} stroke="#ffffff" strokeWidth="2" />
                <text x="0" y="-47" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">↔</text>
              </g>
            </g>
          )}

          {/* Dimension Line for Building Distance (bd) */}
          {bd > 0 && (
            <g>
              <line
                x1="0"
                y1="-30"
                x2={displayBuildX}
                y2="-30"
                stroke={buildingStatusColor}
                strokeWidth="2"
                strokeDasharray="4,4"
                markerEnd={`url(#acc-arrow-${bd < 30 ? "red" : bd < 60 ? "amber" : "green"})`}
              />
              {/* Building Distance Badge */}
              <g transform={`translate(${displayBuildX / 2}, -30)`}>
                <rect x="-45" y="-22" width="90" height="22" rx="4" fill="#090d16" stroke={buildingStatusColor} strokeWidth="1.2" />
                <text x="0" y="-11" fill="#38bdf8" fontSize="8" fontWeight="700" textAnchor="middle">
                  BUILDING DIST (bd)
                </text>
                <text x="0" y="-1" fill="#f8fafc" fontSize="11" fontWeight="800" textAnchor="middle">
                  {bd}m {bd < 30 ? "⚠️" : ""}
                </text>
              </g>
            </g>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 3. ACCESS POINTS / NODES (GATES, HOSPITAL, AMBULANCE)            */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {nodes.map((n, idx) => {
            const svgX = toSvgX(n.x || 0);
            const svgY = toSvgY(n.y || 0);
            const col = nodeColors[n.tp] || "#38bdf8";
            const icon =
              n.tp === "hospital"
                ? "🏥"
                : n.tp === "emergency"
                ? "🚒"
                : n.tp === "gate"
                ? "🚪"
                : "🛣️";

            return (
              <g
                key={n.id || idx}
                transform={`translate(${svgX}, ${svgY})`}
                onPointerDown={(e) => handlePointerDown(e, { type: "node", id: n.id })}
                onMouseEnter={() => setHoveredNode(n)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "grab" }}
              >
                {/* Radial distance tie-line to pad center */}
                <line
                  x1="0"
                  y1="0"
                  x2={-svgX}
                  y2={-svgY}
                  stroke={col}
                  strokeWidth="1"
                  strokeDasharray="2,3"
                  opacity="0.4"
                />

                {/* Node Outer Halo */}
                <circle cx="0" cy="0" r="14" fill={col} opacity="0.25" />
                <circle cx="0" cy="0" r="9" fill={col} stroke="#ffffff" strokeWidth="1.5" />

                {/* Node Icon */}
                <text x="0" y="3.5" fontSize="10" textAnchor="middle">
                  {icon}
                </text>

                {/* Node Label Pin */}
                <rect x="-35" y="-24" width="70" height="15" rx="3" fill="#090d16" stroke={col} strokeWidth="1" opacity="0.9" />
                <text x="0" y="-13" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">
                  {n.nm || "Node #" + (idx + 1)} ({n.dist || Math.round(Math.hypot(n.x || 0, n.y || 0))}m)
                </text>
              </g>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 4. HELIPAD (FATO, TLOF, SAFETY AREA) AT CENTER (0, 0)          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <g>
            {/* Safety Area (Outer Boundary) */}
            <rect
              x={-saHalf}
              y={-saHalf}
              width={saHalf * 2}
              height={saHalf * 2}
              rx="4"
              fill="rgba(37,99,235,0.06)"
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            {/* FATO Boundary */}
            <rect
              x={-fatoHalf}
              y={-fatoHalf}
              width={fatoHalf * 2}
              height={fatoHalf * 2}
              rx="2"
              fill="rgba(15,23,42,0.8)"
              stroke="#06b6d4"
              strokeWidth="1.5"
            />
            {/* TLOF Circular Pad */}
            <circle cx="0" cy="0" r={Math.max(8, fatoHalf * 0.75)} fill="#1e293b" stroke="#facc15" strokeWidth="1.5" />
            <circle cx="0" cy="0" r={Math.max(6, fatoHalf * 0.55)} fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="3,3" opacity="0.8" />

            {/* Helipad "H" Marking */}
            <text x="0" y="5" fill="#facc15" fontSize="14" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
              H
            </text>

            {/* Center Origin Dot & Tag */}
            <circle cx="0" cy="0" r="2.5" fill="#ef4444" />
            <rect x="-55" y="16" width="110" height="16" rx="3" fill="#090d16" stroke="#06b6d4" strokeWidth="0.8" opacity="0.95" />
            <text x="0" y="27" fill="#67e8f9" fontSize="8" fontWeight="800" textAnchor="middle">
              FATO CENTER (0, 0)
            </text>
          </g>
        </svg>

        {/* Floating Canvas Mode Controls (Add Node / Guide) */}
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, background: "rgba(15,23,42,0.9)", padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(51,65,85,0.8)" }}>
          <button
            type="button"
            className="hvs-btn"
            onClick={() => setCanvasMode(canvasMode === "add_node" ? "navigate" : "add_node")}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 4,
              background: canvasMode === "add_node" ? "linear-gradient(135deg, #06b6d4, #2563eb)" : "rgba(30,41,59,0.8)",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {canvasMode === "add_node" ? "✕ Cancel Click-to-Place" : "+ Click to Place Access Point"}
          </button>
          {canvasMode === "add_node" && (
            <select
              value={newNodeType}
              onChange={(e) => setNewNodeType(e.target.value)}
              style={{ background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", borderRadius: 4, fontSize: 11, padding: "2px 6px" }}
            >
              <option value="gate">🚪 Gate</option>
              <option value="hospital">🏥 Hospital Entrance</option>
              <option value="emergency">🚒 Emergency Route</option>
              <option value="road">🛣️ Road Access</option>
            </select>
          )}
        </div>

        {/* Hovered Node Tooltip HUD */}
        {hoveredNode && (
          <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(15,23,42,0.95)", border: "1px solid #38bdf8", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#f8fafc", pointerEvents: "none" }}>
            <div style={{ fontWeight: 800, color: "#38bdf8" }}>{hoveredNode.nm || "Access Point"}</div>
            <div>Type: {hoveredNode.tp} · Distance: {hoveredNode.dist || Math.round(Math.hypot(hoveredNode.x || 0, hoveredNode.y || 0))}m · Bearing: {hoveredNode.br || 0}°</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Coordinates: X={hoveredNode.x || 0}m, Y={hoveredNode.y || 0}m (relative to pad)</div>
          </div>
        )}

        {/* Distance Guide Legend on Canvas */}
        <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 6, padding: "6px 10px", fontSize: 10, color: "#94a3b8", textAlign: "right" }}>
          <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 2 }}>DISTANCE CRITERIA</div>
          <div style={{ color: "#34d399" }}>🛣️ Road: &le;200m ideal · &gt;500m penalized</div>
          <div style={{ color: bd < 30 ? "#f87171" : bd < 60 ? "#fbbf24" : "#34d399" }}>
            🏢 Building: &ge;60m clear · &lt;30m critical hazard
          </div>
        </div>
      </div>

      {/* Explanatory Cards below Canvas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 12 }}>
        <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(51,65,85,0.6)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
            <span>🛣️</span> ROAD DISTANCE (rd)
          </div>
          <div style={{ fontSize: 11, color: K.tx, marginTop: 4 }}>
            Perpendicular / shortest distance from pad center to site road.
          </div>
          <div style={{ fontSize: 10, color: roadStatusColor, marginTop: 3, fontWeight: 700 }}>
            {rd <= 200 ? "✓ Excellent proximity (≤200m)" : rd <= 500 ? "⚠ Moderate distance (200-500m)" : "✗ Excessive distance (>500m, -15 pts)"}
          </div>
        </div>

        <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(51,65,85,0.6)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
            <span>🏢</span> BUILDING DISTANCE (bd)
          </div>
          <div style={{ fontSize: 11, color: K.tx, marginTop: 4 }}>
            Direct distance from pad center to terminal or hospital facade.
          </div>
          <div style={{ fontSize: 10, color: buildingStatusColor, marginTop: 3, fontWeight: 700 }}>
            {bd === 0 ? "No building recorded" : bd < 30 ? "✗ Critical obstacle proximity (<30m, -30 pts)" : bd < 60 ? "⚠ Caution: within rotor buffer (<60m)" : "✓ Safe building standoff (≥60m)"}
          </div>
        </div>

        <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(51,65,85,0.6)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
            <span>🚪</span> ACCESS POINTS / NODES
          </div>
          <div style={{ fontSize: 11, color: K.tx, marginTop: 4 }}>
            Specific gates, ambulance entry points, and emergency muster bays.
          </div>
          <div style={{ fontSize: 10, color: "#10b981", marginTop: 3, fontWeight: 700 }}>
            {nodes.length > 0 ? "✓ " + nodes.length + " point(s) mapped on site plan" : "Click canvas above or \"+ Add\" to place gates"}
          </div>
        </div>
      </div>
    </div>
  );
}
