import React, { useState } from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { DEG } from "../../utils/coords.js";
import {
  OBS_TYPES, SOIL_DATA, SENS_TYPES, SENS_LEVELS, SRC_OPTIONS,
} from "../../data/constants.js";
import { mkObs } from "../../data/models.js";
import { zonePadCenter, zoneCentroid, zoneArea, obsNearestDist, decomposeSlope } from "../../engine/geometry.js";
import { calcResponseTime } from "../../engine/responseTime.js";
import { calcConfidence } from "../../engine/confidence.js";
import { Tip } from "../ui/Tooltip.jsx";
import { OLSBar } from "../ui/OLSBar.jsx";
import { Tag } from "../ui/Tag.jsx";
import { ZGrid } from "../ui/ZGrid.jsx";
import { parseWindRoseCsv, parseMetarWindPaste, parseWindRoseTable, applyImportToWind } from "../../engine/windRoseImport.js";
import { parseObstacleXlsxArrayBuffer, parsePnezdText, parseDroneClassificationCsv } from "../../engine/obstacleSurveyImport.js";
import { parseElevationCsv, computeTerrainAnalysis } from "../../engine/terrainMesh.js";
import { StartHereCard } from "../ui/StartHereCard.jsx";

export function DataInputStep() {
  const {
    K, dp, proj, site, zones, sel, selZ, inp, lbl, btn, chk, sel_, zf,
    obsView, setObsView, dataTab, setDataTab, hl, D, G, zoneCompleteness,
  } = useHvs();

  const [windPaste, setWindPaste] = useState("");
  const [windImpMode, setWindImpMode] = useState("csv");
  const [windNSect, setWindNSect] = useState(16);
  const [obSurPaste, setObSurPaste] = useState("");
  const [obSurMode, setObSurMode] = useState("pnezd");
  const [elevPaste, setElevPaste] = useState("");

  if (!selZ) {
    return (
      <div style={{ maxWidth: "min(100%, 1400px)", width: "100%" }}>
        <h2 style={{ fontSize: "1.625rem", fontWeight: 800, color: K.tx, margin: "0 0 16px", paddingBottom: 12, borderBottom: "2px solid " + K.cy + "30" }}>Data Input</h2>
        <StartHereCard K={K} variant="data" zonesCount={zones.length} hasSelection={false} />
        {zones.length > 0 && (
          <div className="hvs-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: K.cy, marginBottom: 10 }}>Pick a zone to edit</div>
            <ZGrid zones={zones} sel={sel} onSel={(v) => dp({ type: "SEL", payload: v })} cols={site.gc} rows={site.gr} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
              {(zones.filter((zz) => zz.on).length ? zones.filter((zz) => zz.on) : zones).map((zz) => (
                <button
                  key={zz.id}
                  type="button"
                  onClick={() => dp({ type: "SEL", payload: zz.id })}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid " + (zz.on ? K.cy : K.mu),
                    background: zz.id === sel ? K.cy + "22" : K.rs,
                    color: K.tx,
                    opacity: zz.on ? 1 : 0.75,
                  }}
                >
                  {zz.on ? "Open" : "View"} zone {zz.lb}{!zz.on ? " (off)" : ""}
                </button>
              ))}
            </div>
            {zones.length > 0 && !zones.some((zz) => zz.on) && (
              <p style={{ fontSize: 13, color: K.am, marginTop: 10, marginBottom: 0 }}>
                No zone is turned <strong>on</strong> for analysis. Go back to <strong>Zones</strong> and enable at least one candidate (✓).
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
  const z = selZ;
  const comp = zoneCompleteness(z);
  const dataTabs = [
    { id: "wind", l: "💨 Wind", done: comp.wind },
    { id: "obs", l: "🚧 Obstacles", done: comp.obs },
    { id: "terrain", l: "⛰ Terrain", done: comp.terrain },
    { id: "access", l: "🛣 Access", done: comp.access },
    { id: "sens", l: "🏘 Sensitivity", done: comp.sens },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: "clamp(12px, 2vw, 20px)" }}>
      <div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 14px", letterSpacing: -0.3 }}>Data Input</h2>
        {/* ZONE GRID WITH COMPLETENESS */}
        <div style={{ marginBottom: 10 }}>
          <ZGrid zones={zones} sel={sel} onSel={v => dp({ type: "SEL", payload: v })} cols={site.gc} rows={site.gr} sm />
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
            {zones.filter(zz => zz.on).map(zz => {
              const c = zoneCompleteness(zz);
              return <div key={zz.id} onClick={() => dp({ type: "SEL", payload: zz.id })} style={{ padding: "2px 5px", borderRadius: 3, fontSize: 13, cursor: "pointer", background: zz.id === sel ? K.cy + "20" : c.pct === 100 ? K.gn + "12" : c.pct > 0 ? K.am + "12" : K.rd + "08", color: c.pct === 100 ? K.gn : c.pct > 0 ? K.am : K.mu, fontWeight: zz.id === sel ? 700 : 400, border: zz.id === sel ? "1px solid " + K.cy : "1px solid transparent" }}>{zz.lb} {c.pct}%</div>;
            })}
          </div>
        </div>
        {/* SELECTED ZONE INFO */}
        <div className="hvs-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>{z.lb}</div>
          <div style={{ fontSize: 13, color: K.dm, marginTop: 2 }}>{z.bw.toFixed(0)}×{z.bh.toFixed(0)}m | {zoneArea(z).toFixed(0)} m²</div>
          <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
            <Tag color={z.on ? K.gn : K.rd}>{z.on ? "CANDIDATE" : "EXCLUDED"}</Tag>
            <Tag color={comp.pct === 100 ? K.gn : comp.pct > 0 ? K.am : K.rd}>{comp.filled}/{comp.total}</Tag>
          </div>
          {z.excludeReason && <div style={{ fontSize: 13, color: K.rd, marginTop: 3 }}>{z.excludeReason}</div>}
          {/* Quick actions */}
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
            {zones.filter(zz => zz.on).length > 1 && comp.filled > 0 && btn("📋 Fill ALL zones from " + z.lb, () => {
              ["wind", "terrain", "access"].forEach(sec => dp({ type: "APPLY_ALL", payload: { section: sec, fromZid: z.id } }));
            }, "ghost")}
            {zones.filter(zz => zz.on && zz.id !== z.id && zoneCompleteness(zz).pct > comp.pct).length > 0 && (() => {
              const best = zones.filter(zz => zz.on && zz.id !== z.id).sort((a, b) => zoneCompleteness(b).pct - zoneCompleteness(a).pct)[0];
              return best && zoneCompleteness(best).pct > 0 ? btn("⬇ Copy from " + best.lb + " (" + zoneCompleteness(best).pct + "%)", () => {
                ["wind", "terrain", "access"].forEach(sec => {
                  const src = best;
                  if (sec === "wind") { Object.keys(src.wind).forEach(k => zf("wind", k, src.wind[k])); zf("src", "wind", src.src?.wind || "assumed"); }
                  if (sec === "terrain") { Object.keys(src.ter).forEach(k => zf("ter", k, src.ter[k])); zf("src", "terrain", src.src?.terrain || "assumed"); }
                  if (sec === "access") { Object.keys(src.acc).forEach(k => { if (k !== "nodes") zf("acc", k, src.acc[k]); }); zf("src", "access", src.src?.access || "assumed"); }
                });
              }, "ghost") : null;
            })()}
          </div>
          {/* Data checklist */}
          <div style={{ marginTop: 6 }}>
            {dataTabs.map(t => (
              <div key={t.id} onClick={() => setDataTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", cursor: "pointer", fontSize: 13, color: dataTab === t.id ? K.cy : K.dm }}>
                <span style={{ color: t.done ? K.gn : K.rd }}>{t.done ? "✓" : "○"}</span>
                <span>{t.l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* CONFIDENCE */}
        {(() => {
          const conf = calcConfidence(z);
          return (
            <div className="hvs-card" style={{ padding: 10, marginTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: K.dm, letterSpacing: 1.2, marginBottom: 4 }}>DATA CONFIDENCE</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: conf.gradeColor, textShadow: "0 0 10px " + conf.gradeColor + "30" }}>{conf.overall}%</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: conf.gradeColor }}>{conf.grade}</span>
              </div>
              <div style={{ height: 4, background: K.rs, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: conf.overall + "%", background: conf.gradeColor, borderRadius: 2 }} />
              </div>
              {["wind", "obstacles", "terrain", "access"].map(cat => {
                const d = conf.details[cat];
                return (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", fontSize: 13 }}>
                    <span style={{ color: K.dm, textTransform: "capitalize" }}>{cat}</span>
                    <span style={{ color: d.color, fontWeight: 600 }}>{d.icon} {d.srcLabel.split("/")[0]}</span>
                  </div>
                );
              })}
              {conf.flags.length > 0 && <div style={{ marginTop: 4 }}>{conf.flags.map((f, i) => <div key={i} style={{ fontSize: 14, color: K.rd, marginTop: 2 }}>⚠ {f}</div>)}</div>}
            </div>
          );
        })()}
      </div>
      <div style={{ maxHeight: "68vh", overflowY: "auto", paddingRight: 4 }}>
        {/* SECTION TABS */}
        <div style={{ display: "flex", gap: 2, marginBottom: 10, background: K.pn, borderRadius: 6, padding: 2, position: "sticky", top: 0, zIndex: 10 }}>
          {[
            { id: "wind", l: "💨 Wind", done: comp.wind },
            { id: "obs", l: "🚧 Obstacles", done: comp.obs, count: z.obs.length },
            { id: "terrain", l: "⛰ Terrain", done: comp.terrain },
            { id: "access", l: "🛣 Access", done: comp.access },
            { id: "sens", l: "🏘 Sens", done: comp.sens, count: (z.sens || []).length },
          ].map(t => (
            <div key={t.id} onClick={() => setDataTab(t.id)} style={{ flex: 1, padding: "6px 4px", borderRadius: 4, fontSize: 13, fontWeight: dataTab === t.id ? 700 : 400, cursor: "pointer", background: dataTab === t.id ? K.bl : "transparent", color: dataTab === t.id ? "#fff" : K.dm, textAlign: "center", transition: "all 0.15s", position: "relative" }}>
              {t.l}{t.count > 0 ? " (" + t.count + ")" : ""}
              <div style={{ position: "absolute", top: 2, right: 4, width: 6, height: 6, borderRadius: 3, background: t.done ? K.gn : K.rd + "40" }} />
            </div>
          ))}
        </div>

        {/* WIND TAB */}
        {dataTab === "wind" && <>
        <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: K.cy }}>💨 Wind</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {zones.filter(zz => zz.on && zz.id !== z.id && zz.wind.ps > 0).length > 0 && <>
                <select onChange={e => { if (!e.target.value) return; const src = zones.find(zz => zz.id === e.target.value); if (src) { Object.keys(src.wind).forEach(k => zf("wind", k, src.wind[k])); zf("src", "wind", src.src?.wind || "assumed"); } e.target.value = ""; }} style={{ background: K.rs, border: "1px solid " + K.bd, borderRadius: 4, padding: "3px 6px", color: K.tx, fontSize: 13, cursor: "pointer" }}>
                  <option value="">Copy from...</option>
                  {zones.filter(zz => zz.on && zz.id !== z.id && zz.wind.ps > 0).map(zz => <option key={zz.id} value={zz.id}>{zz.lb}</option>)}
                </select>
              </>}
              {zones.filter(zz => zz.on).length > 1 && btn("📋 Apply to all zones", () => dp({ type: "APPLY_ALL", payload: { section: "wind", fromZid: z.id } }), "ghost")}
            </div>
          </div>
          <div style={{ fontSize: 14, color: K.mu, marginBottom: 6 }}>Wind data is typically the same across all zones on a single site. Fill once then "Apply to all zones".</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: K.dm }}>Data Source:</span>
            {sel_(z.src?.wind || "assumed", v => zf("src", "wind", v), SRC_OPTIONS)}
          </div>
          <div style={{ fontSize: 13, color: K.cy, fontWeight: 600, marginBottom: 4 }}>PRIMARY WIND <Tip text="The wind direction that occurs most frequently at this site. Direction = where the wind comes FROM, measured clockwise from North. E.g. 340° = from the NNW.">(most frequent direction)</Tip></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div>{lbl("Direction (°from N) *")}<Tip text="Compass bearing where wind blows FROM. 0°=North, 90°=East, 180°=South, 270°=West">{inp("number", z.wind.pd, v => zf("wind", "pd", v), { suffix: "°", min: 0, max: 360 })}</Tip></div>
            <div>{lbl("Speed (knots) *")}<Tip text="Average wind speed in knots. 1 knot = 1.852 km/h = 0.514 m/s">{inp("number", z.wind.ps, v => zf("wind", "ps", v), { suffix: "kt" })}</Tip></div>
            <div>{lbl("Frequency (%) *")}<Tip text="Percentage of time wind blows from this direction. E.g. 45% means the primary wind occurs 45% of the year.">{inp("number", z.wind.pf, v => zf("wind", "pf", v), { suffix: "%" })}</Tip></div>
          </div>
          <div style={{ fontSize: 13, color: K.am, fontWeight: 600, marginBottom: 4 }}>SECONDARY WIND (second most frequent)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div>{lbl("Direction (°from N)")}{inp("number", z.wind.sd, v => zf("wind", "sd", v), { suffix: "°", min: 0, max: 360 })}</div>
            <div>{lbl("Speed (knots)")}{inp("number", z.wind.ss, v => zf("wind", "ss", v), { suffix: "kt" })}</div>
            <div>{lbl("Frequency (%)")}{inp("number", z.wind.sf, v => zf("wind", "sf", v), { suffix: "%" })}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>{lbl("Calm (no wind) %")}{inp("number", z.wind.calm, v => zf("wind", "calm", v), { suffix: "%" })}</div>
            <div>{lbl("Seasonal Variation")}{sel_(z.wind.seasonal || "none", v => zf("wind", "seasonal", v), [{ v: "none", l: "None — constant year-round" }, { v: "mild", l: "Mild — minor seasonal shift" }, { v: "moderate", l: "Moderate — notable changes" }, { v: "strong", l: "Strong — major seasonal reversal" }])}</div>
          </div>
          {z.wind.seasonal && z.wind.seasonal !== "none" && <div style={{ fontSize: 13, color: K.am, marginTop: 4, padding: "3px 6px", background: K.am + "10", borderRadius: 3 }}>⚠ Seasonal variation noted — consider separate summer/winter analysis for detailed design</div>}
          {(() => {
            const total = (z.wind.pf || 0) + (z.wind.sf || 0) + (z.wind.calm || 0);
            if (total > 0 && Math.abs(total - 100) > 5) return <div style={{ fontSize: 13, color: total > 100 ? K.rd : K.am, marginTop: 4, padding: "4px 8px", background: (total > 100 ? K.rd : K.am) + "10", borderRadius: 3 }}>{total > 100 ? "⚠ Frequencies exceed 100%: " : "⚠ Frequencies sum to only "}{total.toFixed(0)}% (Primary {z.wind.pf}% + Secondary {z.wind.sf}% + Calm {z.wind.calm}%){total < 100 ? ". Remaining " + (100 - total).toFixed(0) + "% is unaccounted wind from other directions." : ". Please check values."}</div>;
            return null;
          })()}
          {/* WIND VISUAL SUMMARY */}
          {z.wind.ps > 0 && (() => {
            const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
            const pdIdx = Math.round(z.wind.pd / 22.5) % 16;
            const sdIdx = z.wind.ss > 0 ? Math.round(z.wind.sd / 22.5) % 16 : -1;
            const coverage = (z.wind.pf || 0) + (z.wind.sf || 0) + (z.wind.calm || 0);
            return (
              <div style={{ marginTop: 8, padding: "8px 10px", background: K.pn, borderRadius: 6 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {/* Mini compass */}
                  <svg width={70} height={70} viewBox="0 0 70 70">
                    <circle cx={35} cy={35} r={30} fill="none" stroke={K.bd} strokeWidth={1} />
                    {["N","E","S","W"].map((d, i) => <text key={d} x={35 + 28 * Math.sin(i * Math.PI/2)} y={35 - 28 * Math.cos(i * Math.PI/2) + 3} fill={K.mu} fontSize={7} textAnchor="middle">{d}</text>)}
                    {/* Primary wind arrow */}
                    <line x1={35} y1={35} x2={35 + 22 * Math.sin(z.wind.pd * DEG)} y2={35 - 22 * Math.cos(z.wind.pd * DEG)} stroke={K.cy} strokeWidth={2.5} markerEnd="url(#arrowP)" />
                    {/* Secondary wind arrow */}
                    {z.wind.ss > 0 && <line x1={35} y1={35} x2={35 + 16 * Math.sin(z.wind.sd * DEG)} y2={35 - 16 * Math.cos(z.wind.sd * DEG)} stroke={K.am} strokeWidth={1.5} strokeDasharray="3,2" />}
                    <defs><marker id="arrowP" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4Z" fill={K.cy} /></marker></defs>
                  </svg>
                  {/* Summary text */}
                  <div style={{ flex: 1, fontSize: 14 }}>
                    <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                      <div><span style={{ color: K.cy, fontWeight: 700 }}>Primary:</span> <span style={{ color: K.tx }}>{dirs[pdIdx]} ({z.wind.pd}°)</span> at <strong>{z.wind.ps}kt</strong> — {z.wind.pf}% of time</div>
                    </div>
                    {z.wind.ss > 0 && <div style={{ marginBottom: 4 }}>
                      <span style={{ color: K.am, fontWeight: 700 }}>Secondary:</span> <span style={{ color: K.tx }}>{dirs[sdIdx]} ({z.wind.sd}°)</span> at <strong>{z.wind.ss}kt</strong> — {z.wind.sf}% of time
                    </div>}
                    <div style={{ color: K.dm }}>Calm: {z.wind.calm}% | Coverage: <span style={{ color: coverage >= 95 ? K.gn : coverage >= 85 ? K.am : K.rd, fontWeight: 700 }}>{coverage}%</span> {coverage >= 95 ? "✓ ICAO compliant" : coverage >= 85 ? "⚠ Near limit" : "✗ Below 95% minimum"}</div>
                  </div>
                </div>
              </div>
            );
          })()}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid " + K.bd }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: K.dm, marginBottom: 6 }}>Import wind rose / METAR / sector table</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
              {sel_(windImpMode, (v) => setWindImpMode(v), [
                { v: "csv", l: "CSV rows" },
                { v: "metar", l: "METAR paste" },
                { v: "table", l: "8/16/36 table" },
              ])}
              <select value={String(windNSect)} onChange={(e) => setWindNSect(parseInt(e.target.value, 10))} style={{ background: K.rs, border: "1px solid " + K.bd, borderRadius: 4, padding: "3px 6px", color: K.tx, fontSize: 13 }}>
                {[8, 16, 36].map((n) => (
                  <option key={n} value={String(n)}>
                    Rose: {n} sectors
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={windPaste}
              onChange={(e) => setWindPaste(e.target.value)}
              placeholder={windImpMode === "metar" ? "Paste METAR lines (e.g. ...27008KT...)" : windImpMode === "table" ? "Paste wind frequency table — header row + data" : "Direction(°), Speed(kt), Frequency(%) — CSV header + rows"}
              rows={4}
              style={{ width: "100%", background: K.rs, border: "1px solid " + K.bd, borderRadius: 4, padding: 8, color: K.tx, fontSize: 13, fontFamily: "monospace", resize: "vertical" }}
            />
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {btn("Apply to zone wind", () => {
                try {
                  let parsed;
                  if (windImpMode === "csv") parsed = parseWindRoseCsv(windPaste);
                  else if (windImpMode === "metar") parsed = parseMetarWindPaste(windPaste);
                  else parsed = parseWindRoseTable(windPaste, windNSect);
                  const wind = applyImportToWind(parsed, windNSect);
                  dp({ type: "WIND_IMPORT", payload: { zid: z.id, wind } });
                } catch (err) {
                  alert(err.message || String(err));
                }
              }, "primary")}
              <input type="file" accept=".csv,.txt" style={{ display: "none" }} id="wind-csv-file" onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setWindPaste(String(r.result || ""));
                r.readAsText(f);
                e.target.value = "";
              }} />
              <label htmlFor="wind-csv-file" style={{ cursor: "pointer", fontSize: 13, padding: "6px 10px", borderRadius: 4, border: "1px solid " + K.bd, color: K.dm, alignSelf: "center" }}>Load file…</label>
            </div>
            <div style={{ fontSize: 14, color: K.mu, marginTop: 4 }}>Fills primary/secondary/calm and full-sector rose. Table mode uses the sector count you select.</div>
          </div>
        </div>
        </>}

        {/* OBSTACLES TAB */}
        {dataTab === "obs" && <>
        {/* OBSTACLES */}
        <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: K.am }}>🚧 Obstacles ({z.obs.length})</span>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <div style={{ display: "flex", background: K.pn, borderRadius: 4, padding: 1 }}>
                {[{ v: "card", l: "Cards" }, { v: "table", l: "Table" }].map(m => (
                  <div key={m.v} onClick={() => setObsView(m.v)} style={{ padding: "3px 8px", borderRadius: 3, fontSize: 13, fontWeight: obsView === m.v ? 700 : 400, cursor: "pointer", background: obsView === m.v ? K.bl : "transparent", color: obsView === m.v ? "#fff" : K.dm }}>{m.l}</div>
                ))}
              </div>
              {btn("+ Add", () => dp({ type: "AO", payload: z.id }), "ghost")}
              {btn("📋 Paste", async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (!text.trim()) return;
                  const lines = text.trim().split(/\r?\n/).filter(l => l.trim() && !l.trim().toLowerCase().startsWith("name") && !l.trim().toLowerCase().startsWith("x,"));
                  for (const line of lines) {
                    const c = line.split(/\t|,/).map(s => s.trim());
                    if (c.length < 3) continue;
                    const isXY = !isNaN(parseFloat(c[0])) && !isNaN(parseFloat(c[1])) && c.length >= 6;
                    const o = isXY
                      ? mkObs({ x: parseFloat(c[0])||0, y: parseFloat(c[1])||0, elevAMSL: parseFloat(c[2])||0, nm: c[3]||"Obs", tp: c[4]||"building", h: parseFloat(c[5])||0, w: parseFloat(c[6])||0, l: parseFloat(c[7])||0 })
                      : mkObs({ nm: c[0]||"Obs", tp: c[1]||"building", h: parseFloat(c[2])||0, w: parseFloat(c[3])||0, l: parseFloat(c[4])||0, x: parseFloat(c[5])||0, y: parseFloat(c[6])||0 });
                    dp({ type: "SZ", payload: zones.map(zz => zz.id !== z.id ? zz : { ...zz, obs: [...zz.obs, o] }) });
                  }
                } catch(e) { console.error("Paste:", e); }
              }, "ghost")}
            </div>
          </div>
          <div style={{ marginBottom: 10, padding: 10, background: K.pn, borderRadius: 6, border: "1px solid " + K.bd }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: K.am, marginBottom: 6 }}>Survey import</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
              <input id={"hvs-ob-xlsx-" + z.id} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const buf = await f.arrayBuffer();
                  const add = parseObstacleXlsxArrayBuffer(buf);
                  dp({ type: "OB_SURVEY", payload: { zid: z.id, add } });
                } catch (err) {
                  alert(err.message || String(err));
                }
                e.target.value = "";
              }} />
              {btn("Excel .xlsx", () => { const el = document.getElementById("hvs-ob-xlsx-" + z.id); if (el) el.click(); }, "ghost")}
              {sel_(obSurMode, (v) => setObSurMode(v), [
                { v: "pnezd", l: "PNEZD text" },
                { v: "drone", l: "Drone XYZ class CSV" },
              ])}
            </div>
            <textarea
              value={obSurPaste}
              onChange={(e) => setObSurPaste(e.target.value)}
              placeholder={obSurMode === "pnezd" ? "Point,Northing,Easting,Z,Description (one row per line)" : "Header: X,Y,Z,Classification then data rows"}
              rows={3}
              style={{ width: "100%", background: K.rs, border: "1px solid " + K.bd, borderRadius: 4, padding: 6, color: K.tx, fontSize: 13, fontFamily: "monospace" }}
            />
            {btn("Append obstacles", () => {
              try {
                const add = obSurMode === "pnezd" ? parsePnezdText(obSurPaste) : parseDroneClassificationCsv(obSurPaste);
                dp({ type: "OB_SURVEY", payload: { zid: z.id, add } });
              } catch (err) {
                alert(err.message || String(err));
              }
            }, "primary")}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: K.dm }}>Source:</span>
              {sel_(z.src?.obstacles || "assumed", v => zf("src", "obstacles", v), SRC_OPTIONS)}
            </div>
          </div>
          {z.obs.length === 0 && (
            <div style={{ textAlign: "center", padding: 20, background: K.pn, borderRadius: 8 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🚧</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No obstacles added</div>
              <div style={{ fontSize: 13, color: K.dm, marginBottom: 10, lineHeight: 1.5 }}>
                Add obstacles one by one, or <strong>paste from Excel</strong>:<br/>
                Copy rows in format: <span style={{ color: K.cy, fontFamily: "monospace" }}>Name, Type, Height, Width, Length, X, Y</span><br/>
                or: <span style={{ color: K.cy, fontFamily: "monospace" }}>X, Y, Z, Name, Type, Height, W, L</span>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {btn("+ Add Obstacle", () => dp({ type: "AO", payload: z.id }), "primary")}
                {btn("+ Add 5 Empty", () => { for (let i = 0; i < 5; i++) dp({ type: "AO", payload: z.id }); }, "ghost")}
              </div>
            </div>
          )}

          {/* TABLE MODE */}
          {obsView === "table" && z.obs.length > 0 && (
            <div style={{ overflowX: "auto", marginBottom: 4 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid " + K.bd }}>
                    {["#", "Name", "Type", "H (m)", "W", "L", "X", "Y", "Dist", "Brg", "AMSL", "Perm", "Conf", ""].map(h => (
                      <th key={h} style={{ padding: "4px 4px", textAlign: "left", color: K.dm, fontWeight: 700, fontSize: 14, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {z.obs.map((o, i) => {
                    const uo = (fld, val) => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld, val } });
                    const cellSt = { padding: "2px 2px", borderBottom: "1px solid " + K.bd };
                    const miniInp = (val, fld, w) => <input type="number" value={val} onChange={e => uo(fld, e.target.value === "" ? 0 : parseFloat(e.target.value))} style={{ width: w || 45, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "3px 4px", color: K.tx, fontSize: 13, outline: "none" }} />;
                    const pen = o.d > 0 ? o.h > o.d / 8 : false;
                    return (
                      <tr key={o.id} style={{ background: pen ? K.rd + "08" : "transparent" }}>
                        <td style={cellSt}><span style={{ fontSize: 13, color: K.mu }}>{i + 1}</span></td>
                        <td style={cellSt}><input type="text" value={o.nm} onChange={e => uo("nm", e.target.value)} style={{ width: 80, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "3px 4px", color: K.tx, fontSize: 13, outline: "none" }} /></td>
                        <td style={cellSt}><select value={o.tp} onChange={e => uo("tp", e.target.value)} style={{ width: 65, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "3px 2px", color: K.tx, fontSize: 13 }}>{OBS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                        <td style={{ ...cellSt, fontWeight: 700, color: pen ? K.rd : K.gn }}>{miniInp(o.h, "h", 40)}</td>
                        <td style={cellSt}>{miniInp(o.w || 0, "w", 35)}</td>
                        <td style={cellSt}>{miniInp(o.l || 0, "l", 35)}</td>
                        <td style={cellSt}>{miniInp(o.x || 0, "x", 45)}</td>
                        <td style={cellSt}>{miniInp(o.y || 0, "y", 45)}</td>
                        <td style={cellSt}><span style={{ fontSize: 13, color: K.cy }}>{o.d?.toFixed(0) || 0}</span></td>
                        <td style={cellSt}><span style={{ fontSize: 13, color: K.cy }}>{o.br || 0}°</span></td>
                        <td style={cellSt}>{miniInp(o.elevAMSL || 0, "elevAMSL", 40)}</td>
                        <td style={cellSt}><input type="checkbox" checked={o.perm} onChange={e => uo("perm", e.target.checked)} /></td>
                        <td style={cellSt}><select value={String(o.confidence || 50)} onChange={e => uo("confidence", parseInt(e.target.value))} style={{ width: 42, background: K.rs, border: "1px solid " + K.bd, borderRadius: 3, padding: "2px 1px", color: K.tx, fontSize: 13 }}>{["100","80","50","20"].map(v => <option key={v} value={v}>{v}%</option>)}</select></td>
                        <td style={cellSt}><button onClick={() => dp({ type: "DO", payload: { zid: z.id, oid: o.id } })} style={{ background: "none", color: K.rd, border: "none", fontSize: 14, cursor: "pointer", padding: "2px 4px" }}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 14, color: K.mu, marginTop: 4 }}>Dist/Brg auto-calculated from X,Y. Edit X or Y to update. Red rows = penetrates approach OLS.</div>
            </div>
          )}

          {/* CARD MODE */}
          {obsView === "card" && <>
          {z.obs.map((o, i) => (
            <div key={o.id} style={{ background: K.rs, borderRadius: 4, padding: 8, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>#{i + 1}</span>
                <button onClick={() => dp({ type: "DO", payload: { zid: z.id, oid: o.id } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 14, padding: "1px 4px", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                <div>{lbl("Name *")}{inp("text", o.nm, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "nm", val: v } }))}</div>
                <div>{lbl("Type *")}{sel_(o.tp, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "tp", val: v } }), OBS_TYPES.map(t => ({ v: t, l: t })))}</div>
                <div>{lbl("Confidence")}{sel_(String(o.confidence || 50), v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "confidence", val: parseInt(v) } }), ["100","80","50","20"].map(v => ({ v, l: v + "%" })))}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 4 }}>
                <div>{lbl("Height AGL *")}<Tip text="Height Above Ground Level in meters. This is the obstacle's height from its base, NOT its elevation. Critical for OLS penetration check.">{inp("number", o.h, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "h", val: v } }), { suffix: "m" })}</Tip></div>
                <div>{lbl("Elev AMSL")}{inp("number", o.elevAMSL || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "elevAMSL", val: v } }), { suffix: "m" })}</div>
                <div>{lbl("Total Height")}<div style={{ padding: "6px 8px", background: K.pn, borderRadius: 4, color: K.cy, fontSize: 14, fontWeight: 700 }}>{((o.elevAMSL || 0) + o.h).toFixed(1)}m AMSL</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 4 }}>
                <div>{lbl("Width")}{inp("number", o.w || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "w", val: v } }), { suffix: "m" })}</div>
                <div>{lbl("Length")}{inp("number", o.l || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "l", val: v } }), { suffix: "m" })}</div>
                <div style={{ paddingTop: 12, fontSize: 13, color: K.dm }}>{o.w > 0 && o.l > 0 ? "Footprint: " + (o.w * o.l).toFixed(0) + " m²" : "Set W×L for 3D view"}</div>
              </div>
              <div style={{ background: K.cy + "06", border: "1px solid " + K.cy + "15", borderRadius: 4, padding: 6, marginTop: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: K.cy, marginBottom: 4, letterSpacing: 0.5 }}>📍 POSITION (auto-linked: edit either pair)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                  <div>{lbl("X (m)")}{inp("number", o.x || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "x", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Y (m)")}{inp("number", o.y || 0, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "y", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Distance")}{inp("number", o.d, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "d", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Bearing (°N)")}{inp("number", o.br, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "br", val: v } }), { suffix: "°" })}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {chk(o.perm, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "perm", val: v } }), "Permanent")}
                  {chk(o.lit || false, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "lit", val: v } }), "Lit/Marked")}
                  {chk(o.verified || false, v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "verified", val: v } }), "Verified")}
                </div>
              </div>
              {/* POLYGON CORNERS (for building footprint — nearest corner used for OLS) */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: K.dm }}>Building Footprint (4 corners — optional, uses nearest corner for OLS)</span>
                  {!o.corners?.length && <button onClick={() => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: [{ x: (o.x || 0) - 10, y: (o.y || 0) - 10 }, { x: (o.x || 0) + 10, y: (o.y || 0) - 10 }, { x: (o.x || 0) + 10, y: (o.y || 0) + 10 }, { x: (o.x || 0) - 10, y: (o.y || 0) + 10 }] } })} style={{ background: K.cy + "18", color: K.cy, border: "1px solid " + K.cy + "33", borderRadius: 3, fontSize: 14, padding: "2px 6px", cursor: "pointer" }}>+ Add 4 Corners</button>}
                  {o.corners?.length >= 4 && <button onClick={() => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: [] } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 14, padding: "2px 6px", cursor: "pointer" }}>Clear Corners</button>}
                </div>
                {o.corners && o.corners.length >= 4 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 3, marginTop: 4 }}>
                    {o.corners.map((cn, ci) => (
                      <div key={ci} style={{ background: K.pn, borderRadius: 3, padding: "3px 4px" }}>
                        <div style={{ fontSize: 14, color: K.dm, fontWeight: 700, marginBottom: 2 }}>C{ci + 1}</div>
                        {inp("number", cn.x, v => { const nc = [...o.corners]; nc[ci] = { ...nc[ci], x: v }; dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: nc } }); }, { suffix: "x", ph: "X" })}
                        <div style={{ height: 2 }} />
                        {inp("number", cn.y, v => { const nc = [...o.corners]; nc[ci] = { ...nc[ci], y: v }; dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "corners", val: nc } }); }, { suffix: "y", ph: "Y" })}
                      </div>
                    ))}
                  </div>
                )}
                {o.corners && o.corners.length >= 4 && (() => {
                  const cent = zonePadCenter(z);
                  const nd = obsNearestDist(o, cent.x, cent.y);
                  return <div style={{ fontSize: 14, color: K.cy, marginTop: 2 }}>Nearest corner: {nd.toFixed(1)}m from zone center (this distance used for OLS check)</div>;
                })()}
              </div>
              {!o.perm && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                <div>{lbl("Start Date")}{inp("text", o.startDate || "", v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "startDate", val: v } }), { ph: "YYYY-MM" })}</div>
                <div>{lbl("End Date")}{inp("text", o.endDate || "", v => dp({ type: "UO", payload: { zid: z.id, oid: o.id, fld: "endDate", val: v } }), { ph: "YYYY-MM" })}</div>
              </div>}
              {o.d > 0 && <>
                <OLSBar height={o.h} distance={o.d} approachGradient={G.appG} />
                <div style={{ fontSize: 13, color: K.mu, display: "flex", gap: 8, marginTop: 2 }}>
                  <span>H/D: {(o.h / o.d).toFixed(4)}</span>
                  <span>Total: {((o.elevAMSL || 0) + o.h).toFixed(1)}m AMSL</span>
                  {o.verified ? <span style={{ color: K.gn }}>✓ Verified</span> : <span style={{ color: K.am }}>? Unverified</span>}
                </div>
              </>}
            </div>
          ))}
          </>}
        </div>
        </>}

        {/* TERRAIN TAB */}
        {dataTab === "terrain" && <>
        {/* TERRAIN */}
        <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: K.gn }}>⛰ Terrain</span>
            {zones.filter(zz => zz.on).length > 1 && btn("📋 Apply to all", () => dp({ type: "APPLY_ALL", payload: { section: "terrain", fromZid: z.id } }), "ghost")}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: K.dm }}>Data Source:</span>
            {sel_(z.src?.terrain || "assumed", v => zf("src", "terrain", v), SRC_OPTIONS)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div>{lbl("Slope * (%)")}<Tip text="Maximum ground slope across the zone as percentage. ICAO limit: 2% for PC1, 3% for PC2/3. Measured by survey or estimated from contour maps.">{inp("number", z.ter.slope, v => zf("ter", "slope", v), { suffix: "%" })}</Tip></div>
            <div>{lbl("Slope Dir (°)")}<Tip text="Direction of maximum slope, clockwise from North. E.g. 180° = slope falls toward south.">{inp("number", z.ter.slopeDir || 0, v => zf("ter", "slopeDir", v), { suffix: "°", min: 0, max: 360 })}</Tip></div>
            <div>{lbl("Side Slope (%)")}{inp("number", z.ter.side, v => zf("ter", "side", v), { suffix: "%" })}</div>
            <div>{lbl("Cut/Fill")}{inp("number", z.ter.cf, v => zf("ter", "cf", v), { suffix: "m" })}</div>
          </div>
          {z.ter.slope > 0 && (z.ter.slopeDir || 0) > 0 && (() => {
            const d = decomposeSlope(z.ter.slope, z.ter.slopeDir, 0);
            return <div style={{ fontSize: 13, color: K.cy, background: K.cy + "10", padding: "4px 6px", borderRadius: 3, marginBottom: 6 }}>
              Slope {z.ter.slope}% at {z.ter.slopeDir}° → Long: {d.longitudinal}% | Trans: {d.transverse}% (relative to N, recalculated at scoring vs FATO heading) | Max FATO: {G.maxSlope}%
            </div>;
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div>{lbl("Elev Min")}{inp("number", z.ter.elevMin || 0, v => zf("ter", "elevMin", v), { suffix: "m" })}</div>
            <div>{lbl("Elev Max")}{inp("number", z.ter.elevMax || 0, v => zf("ter", "elevMax", v), { suffix: "m" })}</div>
            <div>{lbl("Elev Avg")}{inp("number", z.ter.elevAvg || 0, v => zf("ter", "elevAvg", v), { suffix: "m" })}</div>
            <div>{lbl("Data Pts")}{inp("number", z.ter.elevPts || 0, v => zf("ter", "elevPts", v))}</div>
          </div>
          {(z.ter.elevMin > 0 || z.ter.elevMax > 0) && <div style={{ fontSize: 13, color: K.mu, background: K.pn, padding: "3px 6px", borderRadius: 3, marginBottom: 6 }}>
            Elevation range: {z.ter.elevMin}–{z.ter.elevMax}m ({(z.ter.elevMax - z.ter.elevMin).toFixed(1)}m diff) | Avg: {z.ter.elevAvg}m{z.ter.elevPts > 0 ? " | " + z.ter.elevPts + " survey points" : ""}
          </div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>{lbl("Soil")}{sel_(z.ter.soil, v => zf("ter", "soil", v), SOIL_DATA.map(s => ({ v: s.value, l: s.label + " (CBR " + s.cbr + ")" })))}</div>
            <div style={{ paddingTop: 12 }}>{chk(z.ter.flood, v => zf("ter", "flood", v), "Flood Risk")}</div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid " + K.bd }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: K.dm, marginBottom: 4 }}>Elevation grid (CSV X,Y,Z) — Delaunay terrain</div>
            <div style={{ fontSize: 14, color: K.mu, marginBottom: 6 }}>Coordinates in site meters (same as zone map). Run analysis to store contours, zone slopes, and FATO cut/fill estimates.</div>
            <textarea
              value={elevPaste}
              onChange={(e) => setElevPaste(e.target.value)}
              placeholder={"X,Y,Z\n0,0,12.1\n10,0,12.3\n..."}
              rows={4}
              style={{ width: "100%", background: K.rs, border: "1px solid " + K.bd, borderRadius: 4, padding: 8, color: K.tx, fontSize: 13, fontFamily: "monospace" }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {btn("Import points to site", () => {
                try {
                  const pts = parseElevationCsv(elevPaste);
                  dp({ type: "US", payload: { elevationPoints: pts } });
                } catch (err) {
                  alert(err.message || String(err));
                }
              }, "ghost")}
              {btn("Compute terrain analysis", () => {
                try {
                  const pts = site.elevationPoints?.length >= 3 ? site.elevationPoints : parseElevationCsv(elevPaste);
                  const siteN = { ...site, elevationPoints: pts };
                  const analysis = computeTerrainAnalysis(siteN, zones, proj);
                  dp({ type: "US", payload: { elevationPoints: pts, terrainAnalysis: analysis } });
                  zf("src", "terrain", "survey");
                } catch (err) {
                  alert(err.message || String(err));
                }
              }, "primary")}
              {btn("Apply slopes to all zones", () => dp({ type: "APPLY_TERRAIN_SLOPES" }), "ghost")}
            </div>
            {site.terrainAnalysis?.error && <div style={{ fontSize: 13, color: K.rd, marginTop: 4 }}>{site.terrainAnalysis.error}</div>}
            {site.terrainAnalysis?.nPts > 0 && (
              <div style={{ fontSize: 13, color: K.dm, marginTop: 6 }}>
                {site.terrainAnalysis.nPts} pts | Z {site.terrainAnalysis.zmin?.toFixed(2)}–{site.terrainAnalysis.zmax?.toFixed(2)} m
                {site.terrainAnalysis.cutFillByZone && (
                  <ul style={{ margin: "4px 0 0 12px", padding: 0, lineHeight: 1.5 }}>
                    {zones.filter((zz) => zz.on && site.terrainAnalysis.cutFillByZone[zz.id]).map((zz) => {
                      const cf = site.terrainAnalysis.cutFillByZone[zz.id];
                      return (
                        <li key={zz.id}>
                          {zz.lb}: FATO ref Z ≈ {cf.targetElev} m, net cut/fill ≈ {cf.cutFillM3} m³ (grid est.)
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        </>}

        {/* ACCESS TAB */}
        {dataTab === "access" && <>
        {/* ACCESS */}
        <div className="hvs-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: K.bl }}>🛣 Access</span>
            {zones.filter(zz => zz.on).length > 1 && btn("📋 Apply to all", () => dp({ type: "APPLY_ALL", payload: { section: "access", fromZid: z.id } }), "ghost")}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: K.dm }}>Data Source:</span>
            {sel_(z.src?.access || "assumed", v => zf("src", "access", v), SRC_OPTIONS)}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            {chk(z.acc.road, v => zf("acc", "road", v), "Road")}
            {chk(z.acc.emer, v => zf("acc", "emer", v), "Emergency")}
            {chk(z.acc.util, v => zf("acc", "util", v), "Utilities")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div>{lbl("Road Dist")}{inp("number", z.acc.rd, v => zf("acc", "rd", v), { suffix: "m" })}</div>
            <div>{lbl("Building Dist")}{inp("number", z.acc.bd, v => zf("acc", "bd", v), { suffix: "m" })}</div>
          </div>
          {/* ACCESS NODES */}
          <div style={{ marginTop: 8, borderTop: "1px solid " + K.bd, paddingTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: K.cy }}>Access Points ({(z.acc.nodes || []).length})</span>
              {btn("+ Add", () => dp({ type: "ANODE", payload: { zid: z.id } }), "ghost")}
            </div>
            {(z.acc.nodes || []).map((n) => (
              <div key={n.id} style={{ background: K.rs, borderRadius: 4, padding: 6, marginBottom: 3 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 4, alignItems: "end" }}>
                  <div>{lbl("Name")}{inp("text", n.nm, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "nm", val: v } }))}</div>
                  <div>{lbl("Type")}{sel_(n.tp, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "tp", val: v } }), [{ v: "road", l: "Road" }, { v: "gate", l: "Gate" }, { v: "hospital", l: "Hospital" }, { v: "emergency", l: "Emergency" }])}</div>
                  <div>{lbl("Priority")}{sel_(String(n.importance || 3), v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "importance", val: parseInt(v) } }), ["1", "2", "3", "4", "5"].map(v => ({ v, l: v })))}</div>
                  <button onClick={() => dp({ type: "DNODE", payload: { zid: z.id, nid: n.id } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 14, padding: "4px 6px", cursor: "pointer", marginBottom: 12 }}>✕</button>
                </div>
                <div style={{ background: K.cy + "06", border: "1px solid " + K.cy + "15", borderRadius: 4, padding: 5, marginTop: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: K.cy, marginBottom: 2 }}>📍 POSITION (auto-linked)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    <div>{lbl("X")}{inp("number", n.x || 0, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "x", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Y")}{inp("number", n.y || 0, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "y", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Dist")}{inp("number", n.dist, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "dist", val: v } }), { suffix: "m" })}</div>
                    <div>{lbl("Bearing")}{inp("number", n.br || 0, v => dp({ type: "UNODE", payload: { zid: z.id, nid: n.id, fld: "br", val: v } }), { suffix: "°" })}</div>
                  </div>
                </div>
              </div>
            ))}
            {!(z.acc.nodes || []).length && <div style={{ fontSize: 13, color: K.mu, textAlign: "center", padding: 4 }}>Add specific access points (gates, hospital entries, etc.)</div>}
          </div>
        </div>
        {/* RESPONSE TIME DESTINATIONS */}
        <div className="hvs-card" style={{ padding: 16, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: K.pu }}>🕐 Response Time Destinations ({(site.destinations || []).length})</span>
            {btn("+ Add Destination", () => dp({ type: "ADEST" }), "ghost")}
          </div>
          <div style={{ fontSize: 13, color: K.dm, marginBottom: 8, background: K.pn, padding: "4px 8px", borderRadius: 4 }}>
            Define target locations (hospital, HQ, base) — the system calculates flight time from helipad. Use for EMS response time compliance or client requirements.
          </div>
          {(site.destinations || []).map((d, i) => {
            const rt = calcResponseTime(d, site.lat, site.lng);
            return (
              <div key={d.id} style={{ background: K.rs, borderRadius: 6, padding: 10, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>#{i + 1} {d.nm}</span>
                  <button onClick={() => dp({ type: "DDEST", payload: d.id })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 14, padding: "1px 6px", cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 4, marginBottom: 4 }}>
                  <div>{lbl("Name *")}{inp("text", d.nm, v => dp({ type: "UDEST", payload: { did: d.id, fld: "nm", val: v } }))}</div>
                  <div>{lbl("Type")}{sel_(d.tp, v => dp({ type: "UDEST", payload: { did: d.id, fld: "tp", val: v } }), [{ v: "hospital", l: "Hospital" }, { v: "hq", l: "HQ / Base" }, { v: "airport", l: "Airport" }, { v: "military", l: "Military" }, { v: "offshore", l: "Offshore" }, { v: "city", l: "City Center" }, { v: "custom", l: "Custom" }])}</div>
                  <div>{lbl("Required")}{chk(d.required, v => dp({ type: "UDEST", payload: { did: d.id, fld: "required", val: v } }), "Must meet")}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: 4 }}>
                  <div>{lbl("Lat")}{inp("number", d.lat, v => dp({ type: "UDEST", payload: { did: d.id, fld: "lat", val: v } }), { suffix: "°", step: 0.001 })}</div>
                  <div>{lbl("Lng")}{inp("number", d.lng, v => dp({ type: "UDEST", payload: { did: d.id, fld: "lng", val: v } }), { suffix: "°", step: 0.001 })}</div>
                  <div>{lbl("OR Distance")}{inp("number", d.distKm, v => dp({ type: "UDEST", payload: { did: d.id, fld: "distKm", val: v } }), { suffix: "km" })}</div>
                  <div>{lbl("Max Time")}{inp("number", d.maxMinutes, v => dp({ type: "UDEST", payload: { did: d.id, fld: "maxMinutes", val: v } }), { suffix: "min" })}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
                  <div>{lbl("Cruise Speed")}{inp("number", d.cruiseKt, v => dp({ type: "UDEST", payload: { did: d.id, fld: "cruiseKt", val: v } }), { suffix: "kt" })}</div>
                  <div>{lbl("Ground Time")}{inp("number", d.groundMin, v => dp({ type: "UDEST", payload: { did: d.id, fld: "groundMin", val: v } }), { suffix: "min" })}</div>
                </div>
                {/* RESULT */}
                {rt && (
                  <div style={{ background: rt.meetsReq ? K.gn + "10" : K.rd + "10", border: "1px solid " + (rt.meetsReq ? K.gn : K.rd) + "30", borderRadius: 4, padding: 8, marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>TOTAL RESPONSE TIME</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: rt.meetsReq ? K.gn : K.rd }}>{rt.totalMin} min</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {d.maxMinutes > 0 && <Tag color={rt.meetsReq ? K.gn : K.rd}>{rt.meetsReq ? "MEETS" : "EXCEEDS"} {d.maxMinutes}min</Tag>}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginTop: 6, fontSize: 13 }}>
                      <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Distance</div><div style={{ fontWeight: 700 }}>{rt.distKm} km</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Startup</div><div style={{ fontWeight: 700 }}>{rt.startupMin} min</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Flight</div><div style={{ fontWeight: 700, color: K.cy }}>{rt.flightMin} min</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ color: K.dm }}>Ground</div><div style={{ fontWeight: 700 }}>{rt.groundMin} min</div></div>
                    </div>
                    <div style={{ fontSize: 14, color: K.mu, marginTop: 4 }}>Breakdown: {rt.startupMin}min startup + {rt.flightMin}min flight ({rt.speedKmh} km/h) + {rt.approachMin}min approach + {rt.groundMin}min ground</div>
                  </div>
                )}
                {!rt && <div style={{ fontSize: 13, color: K.am, marginTop: 4 }}>Enter coordinates or distance to calculate response time</div>}
              </div>
            );
          })}
          {!(site.destinations || []).length && <div style={{ fontSize: 13, color: K.mu, textAlign: "center", padding: 8 }}>No destinations defined. Add hospital, HQ, or other response targets.</div>}
        </div>
        </>}

        {/* SENSITIVITY TAB */}
        {dataTab === "sens" && <>
        {/* SENSITIVITY */}
        <div className="hvs-card" style={{ padding: 16, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: K.or }}>🏘 Sensitivity Zones ({(z.sens || []).length})</span>
            {btn("+ Add", () => dp({ type: "ASENS", payload: z.id }), "ghost")}
          </div>
          <div style={{ fontSize: 13, color: K.dm, marginBottom: 8, background: K.pn, padding: "4px 8px", borderRadius: 4 }}>
            Areas affected by noise, downwash, or safety risk. Types: <strong>Residential</strong> (housing), <strong>School</strong> (children), <strong>Hospital</strong> (patients), <strong>Fuel</strong> (fire risk), <strong>Sensitive</strong> (heritage/VIP). Distance = from zone center to nearest edge.
          </div>
          {(z.sens || []).map((s, i) => (
            <div key={s.id} style={{ background: K.rs, borderRadius: 4, padding: 8, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>#{i + 1}</span>
                <button onClick={() => dp({ type: "DSENS", payload: { zid: z.id, sid: s.id } })} style={{ background: K.rd + "18", color: K.rd, border: "1px solid " + K.rd + "33", borderRadius: 3, fontSize: 14, padding: "1px 4px", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 4 }}>
                <div>{lbl("Name *")}{inp("text", s.nm, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "nm", val: v } }))}</div>
                <div>{lbl("Type")}{sel_(s.tp, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "tp", val: v } }), SENS_TYPES)}</div>
                <div>{lbl("Level")}{sel_(s.level, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "level", val: v } }), SENS_LEVELS.map(l => ({ v: l, l: l })))}</div>
              </div>
              <div style={{ background: K.cy + "06", border: "1px solid " + K.cy + "15", borderRadius: 4, padding: 5, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: K.cy, marginBottom: 3 }}>📍 POSITION (auto-linked)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                  <div>{lbl("X (m)")}{inp("number", s.x || 0, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "x", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Y (m)")}{inp("number", s.y || 0, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "y", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Distance")}{inp("number", s.dist, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "dist", val: v } }), { suffix: "m" })}</div>
                  <div>{lbl("Bearing")}{inp("number", s.br || 0, v => dp({ type: "USENS", payload: { zid: z.id, sid: s.id, fld: "br", val: v } }), { suffix: "°" })}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: s.level === "high" ? K.rd : s.level === "medium" ? K.am : K.gn, marginTop: 4 }}>
                {s.level === "high" ? "⚠ High sensitivity — significant noise/safety restrictions expected" : s.level === "medium" ? "⚠ Medium — operational restrictions may apply" : "Low — monitor only"}
                {s.dist > 0 && s.dist < 100 ? " | CRITICAL: within 100m" : s.dist > 0 && s.dist < 250 ? " | Within buffer zone" : ""}
              </div>
            </div>
          ))}
          {!(z.sens || []).length && <div style={{ fontSize: 13, color: K.mu, textAlign: "center", padding: 8 }}>
            No sensitivity zones added. Consider adding nearby: residential areas, schools, hospitals, fuel storage, heritage sites, VIP facilities.
          </div>}
        </div>
        {/* VERTIPORT (conditional — inside sens tab) */}
        {(proj.mode === "vertiport" || proj.facility === "vertiport" || hl.tp === "evtol") && (
          <div style={{ background: K.sf, borderRadius: 8, padding: 16, border: "1px solid " + K.cy + "33", marginTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: K.cy, marginBottom: 8 }}>⚡ Vertiport / eVTOL</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div>{lbl("Pads")}{inp("number", z.vport?.pads || 1, v => zf("vport", "pads", Math.max(1, v)), { min: 1 })}</div>
              <div>{lbl("Turnaround")}{inp("number", z.vport?.turnaround || 10, v => zf("vport", "turnaround", v), { suffix: "min" })}</div>
              <div>{lbl("Pax Flow")}{sel_(z.vport?.paxFlow || "walk", v => zf("vport", "paxFlow", v), [{ v: "walk", l: "Walk-on" }, { v: "shuttle", l: "Shuttle" }, { v: "jet_bridge", l: "Jet Bridge" }])}</div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
              {chk(z.vport?.charging || false, v => zf("vport", "charging", v), "Charging Required")}
              {chk(z.vport?.terminal || false, v => zf("vport", "terminal", v), "Terminal Connection")}
            </div>
            {(z.vport?.charging) && (
              <div style={{ marginBottom: 4 }}>{lbl("Charge Points")}{inp("number", z.vport?.chargePoints || 0, v => zf("vport", "chargePoints", v), { min: 0 })}</div>
            )}
            <div style={{ fontSize: 13, color: K.mu, background: K.pn, padding: "4px 6px", borderRadius: 3, marginTop: 4 }}>
              {(z.vport?.pads || 1)} pad(s) × D={D}m | Turnaround: {z.vport?.turnaround || 10}min | {z.vport?.charging ? z.vport.chargePoints + " charge pts" : "No charging"} | Throughput: ~{Math.round(60 / (z.vport?.turnaround || 10) * (z.vport?.pads || 1))} ops/hr
            </div>
          </div>
        )}
        </>}
      </div>
    </div>
  );
}
