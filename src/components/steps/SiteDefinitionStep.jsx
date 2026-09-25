import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { mkTerrainFeature } from "../../data/models.js";
import { SiteDefinitionMap } from "../map/SiteDefinitionMap.jsx";
import { SiteImportPanel } from "../import/SiteImportPanel.jsx";
import { StartHereCard } from "../ui/StartHereCard.jsx";
import { polygonAreaM2 } from "../../utils/mapGeo.js";

export function SiteDefinitionStep() {
  const { K, dp, site, zones, inp, lbl, btn, sel_ } = useHvs();
  return (
    <div>
      <h2 style={{ fontSize: "1.625rem", fontWeight: 800, color: K.tx, margin: "0 0 22px", paddingBottom: 12, borderBottom: "2px solid " + K.cy + "30" }}>Site Definition</h2>
      <StartHereCard K={K} variant="site" />
      <SiteDefinitionMap site={site} zones={zones} dp={dp} />
      <div style={{ maxWidth: "min(100%, 1400px)", width: "100%" }}>
      <div style={{ marginBottom: 12 }}>{lbl("Site Name *")}{inp("text", site.nm, v => dp({ type: "US", payload: { nm: v } }))}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>{lbl("Lat")}{inp("number", site.lat, v => dp({ type: "US", payload: { lat: v } }), { suffix: "°", step: 0.0001 })}</div>
        <div>{lbl("Lng")}{inp("number", site.lng, v => dp({ type: "US", payload: { lng: v } }), { suffix: "°", step: 0.0001 })}</div>
        <div>{lbl("Elev")}{inp("number", site.elev, v => dp({ type: "US", payload: { elev: v } }), { suffix: "m" })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}>
        <div>{lbl("Width")}{inp("number", site.sw, v => dp({ type: "US", payload: { sw: v } }), { suffix: "m", min: 30 })}</div>
        <div>{lbl("Height")}{inp("number", site.sh, v => dp({ type: "US", payload: { sh: v } }), { suffix: "m", min: 30 })}</div>
        <div>{lbl("Mag Decl")}{inp("number", site.md, v => dp({ type: "US", payload: { md: v } }), { suffix: "°" })}</div>
        <div>{lbl("Ref Temp")}{inp("number", site.rt, v => dp({ type: "US", payload: { rt: v } }), { suffix: "°C" })}</div>
      </div>
      {/* EXCLUSION ZONES */}
      <div className="hvs-card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: K.rd }}>🚫 Exclusion Zones ({(site.exclusions || []).length})</span>
          {btn("+ Add", () => dp({ type: "AEXCL" }), "ghost")}
        </div>
        {(site.exclusions || []).map((ex, i) => (
          <div key={ex.id} style={{ background: K.rs, borderRadius: 4, padding: 8, marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: K.rd }}>#{i + 1}</span>
              <button onClick={() => dp({ type: "DEXCL", payload: ex.id })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "1px 4px", cursor: "pointer" }}>✕</button>
            </div>
            {ex.corners && ex.corners.length >= 3 && (
              <div style={{ fontSize: 9, color: K.gn, marginBottom: 6, padding: "4px 6px", background: K.gn + "10", borderRadius: 4 }}>
                Polygon · {ex.corners.length} vertices · {Math.round(ex.areaM2 ?? polygonAreaM2(ex.corners)).toLocaleString()} m² — editing width/height below converts to rectangle
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div>{lbl("Name")}{inp("text", ex.nm, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "nm", val: v } }))}</div>
              <div>{lbl("Reason")}{inp("text", ex.reason, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "reason", val: v } }), { ph: "e.g. Parking structure" })}</div>
              <div>{lbl("Offset X")}{inp("number", ex.x, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "x", val: v } }), { suffix: "m" })}</div>
              <div>{lbl("Offset Y")}{inp("number", ex.y, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "y", val: v } }), { suffix: "m" })}</div>
              <div>{lbl("Width")}{inp("number", ex.w, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "w", val: v } }), { suffix: "m" })}</div>
              <div>{lbl("Height")}{inp("number", ex.h, v => dp({ type: "UEXCL", payload: { eid: ex.id, fld: "h", val: v } }), { suffix: "m" })}</div>
            </div>
          </div>
        ))}
        {!(site.exclusions || []).length && <div style={{ fontSize: 9, color: K.mu, textAlign: "center", padding: 8 }}>No exclusion zones. Add restricted/no-build areas here.</div>}
      </div>
      <SiteImportPanel />
      {/* SITE BOUNDARY (N-point polygon) */}
      {(site.boundary || []).length >= 3 && (
        <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.gn + "33", marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: K.gn }}>🗺 Site Boundary ({site.boundary.length} points)</span>
            {btn("Clear", () => dp({ type: "US", payload: { boundary: [] } }), "ghost")}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 60, overflowY: "auto" }}>
            {site.boundary.map((p, i) => <span key={i} style={{ fontSize: 8, color: K.dm, background: K.rs, borderRadius: 2, padding: "1px 4px" }}>{p.x.toFixed(1)},{p.y.toFixed(1)}{p.z ? "," + p.z.toFixed(1) : ""}</span>)}
          </div>
        </div>
      )}
      {/* TERRAIN FEATURES */}
      <div className="hvs-card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: K.gn }}>⛰ Terrain Features ({(site.terrainFeatures || []).length})</span>
          {btn("+ Add", () => dp({ type: "US", payload: { terrainFeatures: [...(site.terrainFeatures || []), mkTerrainFeature()] } }), "ghost")}
        </div>
        <div style={{ fontSize: 8, color: K.mu, marginBottom: 4 }}>Hills, ridges, valleys — add manually or imported from file. Peak elevation used for obstacle analysis.</div>
        {(site.terrainFeatures || []).map((tf, i) => (
          <div key={tf.id} style={{ background: K.rs, borderRadius: 4, padding: 6, marginBottom: 3 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 4, alignItems: "end" }}>
              <div>{lbl("Name")}{inp("text", tf.nm, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], nm: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); })}</div>
              <div>{lbl("Type")}{sel_(tf.tp, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], tp: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, [{ v: "hill", l: "Hill" }, { v: "ridge", l: "Ridge" }, { v: "valley", l: "Valley" }, { v: "slope", l: "Slope" }, { v: "cliff", l: "Cliff" }, { v: "surface", l: "Surface" }])}</div>
              <div>{lbl("Peak (m)")}{inp("number", tf.elevPeak, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], elevPeak: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, { suffix: "m" })}</div>
              <div>{lbl("Base (m)")}{inp("number", tf.elevBase, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], elevBase: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, { suffix: "m" })}</div>
              <div>{lbl("Radius")}{inp("number", tf.radius, v => { const nf = [...(site.terrainFeatures || [])]; nf[i] = { ...nf[i], radius: v }; dp({ type: "US", payload: { terrainFeatures: nf } }); }, { suffix: "m" })}</div>
              <button onClick={() => { const nf = (site.terrainFeatures || []).filter((_, j) => j !== i); dp({ type: "US", payload: { terrainFeatures: nf } }); }} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 8, padding: "4px 6px", cursor: "pointer", marginBottom: 12 }}>✕</button>
            </div>
            {tf.points?.length > 0 && <div style={{ fontSize: 8, color: K.cy, marginTop: 2 }}>{tf.points.length} elevation points imported | Peak: {tf.elevPeak}m | Base: {tf.elevBase}m | Rise: {(tf.elevPeak - tf.elevBase).toFixed(1)}m</div>}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
