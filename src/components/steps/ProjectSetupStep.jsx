import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { StartHereCard } from "../ui/StartHereCard.jsx";
import {
  PC_DATA, HELIS, PROJ_TYPES, FACILITY_TYPES, MODES, COORD_SYS, ELEV_REF,
} from "../../data/constants.js";
import { getXwLim, WORKFLOW_STATES } from "../../data/models.js";

export function ProjectSetupStep() {
  const { K, dp, proj, inp, lbl, sel_, G, hl } = useHvs();
  return (
    <div style={{ maxWidth: "min(100%, 1400px)", width: "100%" }}>
      <h2 style={{ fontSize: "1.625rem", fontWeight: 800, color: K.tx, margin: "0 0 22px", paddingBottom: 12, borderBottom: "2px solid " + K.cy + "30" }}>Project Setup</h2>
      <StartHereCard K={K} variant="project" />
      <div style={{ marginBottom: 12 }}>{lbl("Project Name *")}{inp("text", proj.nm, v => dp({ type: "UP", payload: { nm: v } }), { ph: "e.g. Hospital Helipad" })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>{lbl("Client")}{inp("text", proj.cl, v => dp({ type: "UP", payload: { cl: v } }))}</div>
        <div>{lbl("Description")}{inp("text", proj.desc, v => dp({ type: "UP", payload: { desc: v } }), { ph: "Notes..." })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>{lbl("Mode")}{sel_(proj.mode, v => dp({ type: "UP", payload: { mode: v } }), MODES)}</div>
        <div>{lbl("Facility Type")}{sel_(proj.facility, v => dp({ type: "UP", payload: { facility: v } }), FACILITY_TYPES)}</div>
        <div>{lbl("Project Type")}{sel_(proj.pt, v => dp({ type: "UP", payload: { pt: v } }), PROJ_TYPES.map(t => ({ v: t, l: t })))}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>{lbl("Performance Class")}{sel_(proj.pc, v => dp({ type: "UP", payload: { pc: v } }), Object.entries(PC_DATA).map(([k, v]) => ({ v: k, l: v.label })))}</div>
        <div>{lbl("Coord System")}{sel_(proj.coordSys, v => dp({ type: "UP", payload: { coordSys: v } }), COORD_SYS)}</div>
        <div>{lbl("Elevation Ref")}{sel_(proj.elevRef, v => dp({ type: "UP", payload: { elevRef: v } }), ELEV_REF)}</div>
      </div>
      <div style={{ marginBottom: 12 }}>{lbl("Design Aircraft")}{sel_(proj.dh, v => dp({ type: "UP", payload: { dh: v } }), HELIS.map(h => ({ v: h.id, l: h.id === "custom" ? "Custom" : h.nm + " (D=" + h.D + "m, " + h.tp + ")" })))}</div>
      {proj.dh === "custom" && <div style={{ marginBottom: 12 }}>{lbl("Custom D-Value")}{inp("number", proj.cdv, v => dp({ type: "UP", payload: { cdv: v } }), { suffix: "m", min: 3 })}</div>}
      <div style={{ background: K.pn, borderRadius: 6, padding: 10, fontSize: 11, color: K.tx }}>
        <div style={{ fontWeight: 700, color: K.dm, fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>GEOMETRY (auto)</div>
        <div>FATO: {G.fato.toFixed(1)}m | TLOF: {G.tlof.toFixed(1)}m | SA: {G.sa.toFixed(1)}m | Total: {G.tot.toFixed(1)}m</div>
        <div>Approach splay: {(G.splay * 100)}% | XW limit: {getXwLim(proj)}kt ({hl.cat})</div>
        <div>Max slopes: FATO {G.maxSlope}% | SA {G.maxSA}% | Aircraft: {hl.tp === "evtol" ? "eVTOL" : "Helicopter"} {hl.len > 0 ? hl.len + "m×" + hl.wid + "m" : ""}</div>
      </div>
      {/* WORKFLOW STATUS */}
      <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.bd, marginTop: 12 }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 10 }}>WORKFLOW STATUS</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {WORKFLOW_STATES.map(ws => {
            const active = (proj.workflow || "draft") === ws.v;
            return (
              <div key={ws.v} onClick={() => dp({ type: "WORKFLOW", payload: ws.v })}
                style={{ flex: 1, padding: "8px 4px", borderRadius: 4, textAlign: "center", cursor: "pointer", background: active ? ws.c + "20" : K.rs, border: "2px solid " + (active ? ws.c : "transparent"), transition: "all .15s" }}>
                <div style={{ fontSize: "0.9375rem", fontWeight: active ? 800 : 500, color: active ? ws.c : K.mu }}>{ws.l}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: "0.875rem", color: K.mu }}>Click to update project status. Changes are logged automatically.</div>
      </div>
      {/* AUDIT LOG */}
      <div className="hvs-card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 8 }}>AUDIT LOG ({(proj.auditLog || []).length})</div>
        <div style={{ maxHeight: 120, overflowY: "auto" }}>
          {(proj.auditLog || []).length === 0 && <div style={{ fontSize: "0.875rem", color: K.mu, textAlign: "center", padding: 8 }}>No actions logged yet. Run analysis to start logging.</div>}
          {[...(proj.auditLog || [])].reverse().map((log, i) => (
            <div key={log.id || i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid " + K.bd, fontSize: "0.875rem" }}>
              <span style={{ color: K.mu, minWidth: 110 }}>{new Date(log.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ color: K.cy, fontWeight: 600, minWidth: 100 }}>{log.action}</span>
              <span style={{ color: K.dm }}>{log.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
