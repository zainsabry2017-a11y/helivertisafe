import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { WT } from "../../data/constants.js";
import { getPc, getXwLim } from "../../data/models.js";

export function ScoreEngineStep() {
  const { K, dp, proj, zones, btn, D, hl, G, zoneCompleteness, runFullAnalysis, analysisBusy } = useHvs();

  const cc = zones.filter(z => z.on).length;
  const w = proj.wt || WT;
  const wSum = Object.values(w).reduce((a, b) => a + b, 0);
  const wLabels = { wind: "Wind", obs: "Obstacles", ter: "Terrain", acc: "Accessibility", geo: "Geometry", env: "Environment" };
  const wColors = { wind: K.cy, obs: K.am, ter: K.gn, acc: K.bl, geo: K.pu, env: K.or };
  const tooSmall = zones.filter(z => z.on && Math.min(z.bw, z.bh) < G.tot);

  // Data readiness check
  const activeZones = zones.filter(z => z.on);
  const readiness = activeZones.map(z => zoneCompleteness(z));
  const avgPct = readiness.length ? Math.round(readiness.reduce((s, r) => s + r.pct, 0) / readiness.length) : 0;
  const allWindFilled = readiness.every(r => r.wind);
  const anyObsFilled = readiness.some(r => r.obs);

  return (
    <div style={{ maxWidth: "min(100%, 1400px)", margin: "0 auto", textAlign: "center", width: "100%" }}>
      <h2 style={{ fontSize: "1.625rem", fontWeight: 800, margin: "0 0 22px", color: K.tx, paddingBottom: 12, borderBottom: "2px solid " + K.cy + "30" }}>Analysis Engine</h2>

      {/* DATA READINESS */}
      <div className="hvs-card" style={{ padding: 16, marginBottom: 12, textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>DATA READINESS</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: avgPct >= 80 ? K.gn : avgPct >= 40 ? K.am : K.rd }}>{avgPct}%</span>
        </div>
        <div style={{ height: 6, background: K.rs, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ height: "100%", width: avgPct + "%", background: avgPct >= 80 ? K.gn : avgPct >= 40 ? K.am : K.rd, borderRadius: 3, transition: "width 0.3s" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(activeZones.length, 8) + ", 1fr)", gap: 4, marginBottom: 8 }}>
          {activeZones.slice(0, 16).map((z, i) => {
            const r = readiness[i];
            return <div key={z.id} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, color: K.dm, marginBottom: 2 }}>{z.lb}</div>
              <div style={{ height: 20, display: "flex", gap: 1 }}>
                {["wind", "obs", "terrain", "access", "sens"].map(k => <div key={k} style={{ flex: 1, background: r[k] ? K.gn : K.rd + "30", borderRadius: 1 }} title={k + ": " + (r[k] ? "✓" : "missing")} />)}
              </div>
              <div style={{ fontSize: 14, color: r.pct === 100 ? K.gn : r.pct > 0 ? K.am : K.rd, fontWeight: 700 }}>{r.pct}%</div>
            </div>;
          })}
        </div>
        {!allWindFilled && <div style={{ fontSize: 13, color: K.am, padding: "6px 10px", background: K.am + "10", borderRadius: 4, marginBottom: 4 }}>⚠ Some zones missing wind data — go to Data Input step and use "Apply to all zones"</div>}
        {!anyObsFilled && <div style={{ fontSize: 13, color: K.am, padding: "6px 10px", background: K.am + "10", borderRadius: 4, marginBottom: 4 }}>⚠ No obstacles in any zone — analysis will assume clear OLS</div>}
        {avgPct < 40 && <div style={{ fontSize: 13, color: K.rd, padding: "6px 10px", background: K.rd + "10", borderRadius: 4 }}>⚠ Low data coverage — results may not be reliable. Consider filling at least Wind + Terrain for all zones.</div>}
        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
          <span style={{ fontSize: 14, display: "flex", gap: 3, alignItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: 1, background: K.gn, display: "inline-block" }} /> Filled</span>
          <span style={{ fontSize: 14, display: "flex", gap: 3, alignItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: 1, background: K.rd + "30", display: "inline-block" }} /> Missing</span>
        </div>
      </div>
      <div style={{ background: K.sf, borderRadius: 8, padding: 16, border: "1px solid " + K.bd, textAlign: "left", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>SCORING WEIGHTS</span>
          <span style={{ fontSize: 14, color: Math.abs(wSum - 1) < 0.01 ? K.gn : K.rd, fontWeight: 700 }}>Total: {(wSum * 100).toFixed(0)}%{Math.abs(wSum - 1) > 0.01 ? " ⚠" : " ✓"}</span>
        </div>
        {Object.entries(wLabels).map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid " + K.bd }}>
            <span style={{ fontSize: 13, color: wColors[k], fontWeight: 600, width: 100 }}>{label}</span>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.round((w[k] || 0) * 100)}
              onChange={e => dp({ type: "UP", payload: { wt: { ...w, [k]: parseInt(e.target.value) / 100 } } })} style={{ flex: 1, accentColor: wColors[k] }}
              aria-valuemin={0}
              aria-valuemax={40}
              aria-valuenow={Math.round((w[k] || 0) * 100)}
              aria-valuetext={label + " weight " + Math.round((w[k] || 0) * 100) + " percent"}
              aria-label={"Scoring weight: " + label}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: wColors[k], width: 36, textAlign: "right" }}>{Math.round((w[k] || 0) * 100)}%</span>
          </div>
        ))}
        {Math.abs(wSum - 1) > 0.01 && <div style={{ fontSize: 14, color: K.rd, marginTop: 4 }}>⚠ Weights should sum to 100%. Currently {(wSum * 100).toFixed(0)}%.</div>}
        {btn("Reset to Default", () => dp({ type: "UP", payload: { wt: { ...WT } } }), "ghost", false, { ariaLabel: "Reset scoring weights to defaults" })}
      </div>
      <div style={{ background: K.sf, borderRadius: 8, padding: 14, border: "1px solid " + K.bd, textAlign: "left", marginBottom: 12, fontSize: 14 }}>
        <div>{hl.nm} (D={D}m) | {getPc(proj).label} | XW≤{getXwLim(proj)}kt</div>
        <div>Candidates: {cc}/{zones.length} | Footprint: {G.tot.toFixed(1)}m</div>
      </div>
      {tooSmall.length > 0 && (
        <div style={{ background: K.sf, borderRadius: 8, padding: 12, border: "1px solid " + K.am + "44", textAlign: "left", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: K.am, marginBottom: 4 }}>⚠ {tooSmall.length} zone(s) too small for FATO+SA ({G.tot.toFixed(1)}m)</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {tooSmall.map(z => <span key={z.id} style={{ fontSize: 14, color: K.am }}>{z.lb} ({Math.min(z.bw, z.bh).toFixed(0)}m)</span>)}
          </div>
          {btn("Auto-exclude these zones", () => { tooSmall.forEach(z => dp({ type: "TOG", payload: z.id })); }, "ghost")}
        </div>
      )}
      {/* DATA READINESS CHECK */}
      {(() => {
        const cands = zones.filter(z => z.on);
        const issues = [];
        for (const z of cands) {
          const zIss = [];
          if (z.wind.ps === 0 && z.wind.ss === 0 && z.wind.calm === 0) zIss.push("no wind");
          if (z.obs.length === 0) zIss.push("no obstacles");
          if (z.wind.pf + z.wind.sf + z.wind.calm > 100) zIss.push("freq >100%");
          if (z.obs.some(o => o.d <= 0 && o.h > 0)) zIss.push("obs missing distance");
          if (zIss.length) issues.push({ lb: z.lb, iss: zIss });
        }
        if (!issues.length) return (
          <div style={{ background: K.sf, borderRadius: 8, padding: 10, border: "1px solid " + K.gn + "44", textAlign: "left", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: K.gn }}>✓ All {cands.length} candidate zones have data — ready to analyze</div>
          </div>
        );
        return (
          <div style={{ background: K.sf, borderRadius: 8, padding: 10, border: "1px solid " + K.am + "44", textAlign: "left", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: K.am, marginBottom: 4 }}>⚠ Data warnings ({issues.length} zone{issues.length > 1 ? "s" : ""})</div>
            {issues.map((iss, i) => <div key={i} style={{ fontSize: 14, color: K.am, marginBottom: 1 }}>{iss.lb}: {iss.iss.join(", ")}</div>)}
            <div style={{ fontSize: 14, color: K.mu, marginTop: 4 }}>Analysis will proceed with defaults for missing data. Results may have lower confidence.</div>
          </div>
        );
      })()}
      {btn("⚡ Run Full Analysis", () => runFullAnalysis(), "accent", cc === 0 || analysisBusy, { ariaLabel: "Run full analysis on all candidate zones", busy: analysisBusy })}
    </div>
  );
}
