import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { clamp } from "../../utils/coords.js";
import { mkManualZone } from "../../data/models.js";
import { zoneArea } from "../../engine/geometry.js";
import { optimizePadCenter } from "../../engine/padOptimizer.js";
import { ZGrid } from "../ui/ZGrid.jsx";
import { StartHereCard } from "../ui/StartHereCard.jsx";

export function ZoneManagerStep() {
  const { K, dp, site, zones, sel, selZ, inp, lbl, btn, G, proj, genGrid } = useHvs();
  return (
    <div>
      <h2 style={{ fontSize: "1.625rem", fontWeight: 800, color: K.tx, margin: "0 0 18px", paddingBottom: 12, borderBottom: "2px solid " + K.cy + "30" }}>Zones</h2>
      <StartHereCard K={K} variant="zones" zonesCount={zones.length} />
      {/* ZONE MODE SELECTOR */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[{ v: "grid", l: "Grid (auto)", desc: "Split site into equal cells" }, { v: "manual", l: "Manual (coordinates)", desc: "Define each zone with 4 corner points" }].map(m => (
          <div key={m.v} onClick={() => dp({ type: "US", payload: { zoneMode: m.v } })}
            style={{ flex: 1, padding: 10, borderRadius: 6, cursor: "pointer", background: (site.zoneMode || "grid") === m.v ? K.bl + "18" : K.sf, border: "2px solid " + ((site.zoneMode || "grid") === m.v ? K.bl : K.bd) }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: (site.zoneMode || "grid") === m.v ? K.bl : K.dm }}>{m.l}</div>
            <div style={{ fontSize: 12, color: K.mu }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* GRID MODE */}
      {(site.zoneMode || "grid") === "grid" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, maxWidth: 720, marginBottom: 10 }}>
          <div>{lbl("Cols")}{inp("number", site.gc, v => dp({ type: "US", payload: { gc: clamp(v, 1, 100) } }), { min: 1, max: 100 })}</div>
          <div>{lbl("Rows")}{inp("number", site.gr, v => dp({ type: "US", payload: { gr: clamp(v, 1, 100) } }), { min: 1, max: 100 })}</div>
          <div>{lbl("Cell Size (m)")}{inp("number", Math.round(site.sw / site.gc), v => {
            if (v > 0) {
              const newGc = Math.max(1, Math.round(site.sw / v));
              const newGr = Math.max(1, Math.round(site.sh / v));
              dp({ type: "US", payload: { gc: newGc, gr: newGr } });
            }
          }, { suffix: "m", min: 5 })}</div>
        </div>
        <div style={{ fontSize: 12, color: K.dm, marginBottom: 6 }}>
          Site: {site.sw}m × {site.sh}m = {(site.sw * site.sh / 1e6).toFixed(3)} km² | Grid: {site.gc}×{site.gr} = {site.gc * site.gr} zones | Cell: {(site.sw / site.gc).toFixed(0)}m × {(site.sh / site.gr).toFixed(0)}m = {((site.sw / site.gc) * (site.sh / site.gr)).toFixed(0)} m²
        </div>
        {site.gc * site.gr > 100 && <div style={{ fontSize: 13, color: K.am, marginBottom: 4 }}>⚠ {site.gc * site.gr} zones — analysis may be slow. Consider larger cells or manual mode for targeted analysis.</div>}
        {site.gc * site.gr > 400 && <div style={{ fontSize: 13, color: K.rd, marginBottom: 4 }}>⚠ {site.gc * site.gr} zones — not recommended. Use Cell Size ≥ {Math.ceil(Math.max(site.sw, site.sh) / 20)}m or manual mode.</div>}
        {btn("⟳ Generate " + site.gc + "×" + site.gr + " (" + (site.gc * site.gr) + " zones)", genGrid, "ghost")}
      </>}

      {/* MANUAL MODE */}
      {(site.zoneMode || "grid") === "manual" && <>
        <div style={{ fontSize: 13, color: K.dm, marginBottom: 8 }}>Define zones by 4 corner coordinates (m from site origin). For large sites (km-scale), each zone = candidate area.</div>
        {btn("+ Add Manual Zone", () => {
          const n = zones.length;
          const label = "M" + (n + 1);
          const newZ = mkManualZone(label, [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }]);
          dp({ type: "SZ", payload: [...zones, newZ] });
        }, "ghost")}
      </>}

      <div style={{ maxWidth: 640, margin: "14px 0" }}><ZGrid zones={zones} sel={sel} onSel={v => dp({ type: "SEL", payload: v })} cols={site.gc} rows={site.gr} /></div>

      {/* ZONE LIST + CORNER EDITOR */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {zones.map(z => <div key={z.id} onClick={() => dp({ type: "TOG", payload: z.id })} style={{ padding: "4px 8px", borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: "pointer", background: z.on ? K.gn + "18" : K.rd + "18", color: z.on ? K.gn : K.rd }}>{z.lb} {z.on ? "✓" : "✗"} {z.bw.toFixed(0)}×{z.bh.toFixed(0)}m</div>)}
      </div>

      {/* SELECTED ZONE CORNER EDITOR */}
      {selZ && selZ.corners && selZ.corners.length >= 4 && (
        <div style={{ background: K.sf, borderRadius: 8, padding: 14, border: "1px solid " + K.bd, maxWidth: 960 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: K.cy, marginBottom: 8 }}>📐 Zone {selZ.lb} — Corner Coordinates</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
            {btn("Optimize pad location", () => {
              const out = optimizePadCenter(selZ, proj);
              if (!out) {
                alert("Could not find a valid pad location inside the zone polygon. Check corners and footprint size.");
                return;
              }
              dp({ type: "ZF", payload: { zid: selZ.id, fld: "pad", val: out } });
            }, "ghost")}
            {selZ.pad?.mode && btn("Reset to centroid", () => dp({ type: "ZF", payload: { zid: selZ.id, fld: "pad", val: null } }), "ghost")}
            {selZ.pad?.mode && (
              <span style={{ fontSize: 12, color: K.dm }}>
                Pad: {selZ.pad.mode} @ {selZ.pad.x},{selZ.pad.y} (step {selZ.pad.stepM}m)
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {selZ.corners.map((cn, ci) => (
              <div key={ci} style={{ background: K.rs, borderRadius: 4, padding: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: K.dm, marginBottom: 2 }}>Corner {ci + 1}</div>
                <div style={{ marginBottom: 2 }}>{lbl("X (m)")}{inp("number", cn.x, v => {
                  const nc = [...selZ.corners]; nc[ci] = { ...nc[ci], x: v };
                  const xs = nc.map(c => c.x), ys = nc.map(c => c.y);
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "corners", val: nc } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bw", val: Math.max(...xs) - Math.min(...xs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bh", val: Math.max(...ys) - Math.min(...ys) } });
                })}</div>
                <div style={{ marginBottom: 2 }}>{lbl("Y (m)")}{inp("number", cn.y, v => {
                  const nc = [...selZ.corners]; nc[ci] = { ...nc[ci], y: v };
                  const xs = nc.map(c => c.x), ys = nc.map(c => c.y);
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "corners", val: nc } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bw", val: Math.max(...xs) - Math.min(...xs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "bh", val: Math.max(...ys) - Math.min(...ys) } });
                })}</div>
                <div>{lbl("Z (elev m)")}{inp("number", cn.z || 0, v => {
                  const nc = [...selZ.corners]; nc[ci] = { ...nc[ci], z: v };
                  const zs = nc.map(c => c.z || 0);
                  dp({ type: "ZF", payload: { zid: selZ.id, fld: "corners", val: nc } });
                  dp({ type: "ZF", payload: { zid: selZ.id, sec: "ter", fld: "elevMin", val: Math.min(...zs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, sec: "ter", fld: "elevMax", val: Math.max(...zs) } });
                  dp({ type: "ZF", payload: { zid: selZ.id, sec: "ter", fld: "elevAvg", val: Math.round(zs.reduce((a,b)=>a+b,0)/zs.length*10)/10 } });
                })}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: K.mu, marginTop: 4 }}>Area: {zoneArea(selZ).toFixed(0)} m² ({(zoneArea(selZ) / 1e6).toFixed(3)} km²) | Min side: {Math.min(selZ.bw, selZ.bh).toFixed(0)}m | FATO+SA: {G.tot.toFixed(1)}m needed{selZ.corners.some(c => c.z) ? " | Elev: " + Math.min(...selZ.corners.map(c => c.z || 0)).toFixed(1) + "–" + Math.max(...selZ.corners.map(c => c.z || 0)).toFixed(1) + "m AMSL (Δ" + (Math.max(...selZ.corners.map(c => c.z || 0)) - Math.min(...selZ.corners.map(c => c.z || 0))).toFixed(1) + "m)" : ""}</div>
        </div>
      )}
    </div>
  );
}
