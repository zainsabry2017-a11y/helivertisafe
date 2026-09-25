import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { gradeCol, scoreCol } from "../../utils/theme.js";
import { PC_DATA, HELIS, WT } from "../../data/constants.js";
import { getPc, getXwLim, mkObs, getHeli, getD, calcGeom, WORKFLOW_STATES } from "../../data/models.js";
import { checkCompliance } from "../../engine/compliance.js";
import { calcConfidence } from "../../engine/confidence.js";
import { genSuggestions } from "../../engine/suggestions.js";
import { calcResponseTime } from "../../engine/responseTime.js";
import { optimizePadCenter } from "../../engine/padOptimizer.js";
import { calculateDownwash } from "../../engine/downwash.js";
import { ErrorBoundary } from "../ui/ErrorBoundary.jsx";
import { WindRose } from "../charts/WindRose.jsx";
import { OLSChart } from "../charts/OLSChart.jsx";
import { ScoreRadar } from "../charts/ScoreRadar.jsx";
import { SitePlan } from "../charts/SitePlan.jsx";
import { Confetti } from "../ui/Confetti.jsx";
import { AnimScore } from "../ui/AnimScore.jsx";
import { RankingBars } from "../charts/RankingBars.jsx";
import { Heatmap } from "../charts/Heatmap.jsx";
import { ZGrid } from "../ui/ZGrid.jsx";
import { Tag } from "../ui/Tag.jsx";
import { ScoreBar } from "../ui/ScoreBar.jsx";
import { ResultsMapView } from "../map/ResultsMapView.jsx";
import { REPORT_TEMPLATES } from "../../report/reportTemplates.js";
import { captureMapImage, downloadHeliPdfReport, buildWindRosePng } from "../../report/pdfExport.jsx";
import { downloadHeliReportDocx } from "../../report/docxReportExport.js";
import { captureElementAsPng, downloadDataUrl, printElementAsImage } from "../../report/imageExport.js";
import { HvsLogoMarkReport } from "../branding/HvsLogo.jsx";
import { RecGlyph, SuggestionGlyph, recBorderColor } from "../ui/RecGlyphs.jsx";
import { IconStatusWarning } from "../branding/HvsToolbarIcons.jsx";
import {
  IconClipboardList,
  IconDownload,
  IconDocxFile,
  IconLayersCompare,
  IconMapPin,
  IconPdfFile,
  IconPrint,
  IconRefreshSite,
  IconSaveAnalysis,
  IconStepBadge,
  IconTrash,
} from "../branding/HvsToolbarIcons.jsx";

const LazyObs3D = React.lazy(() => import("../charts/Obs3DLazy.jsx"));

export function ResultsStep() {
  const {
    K, dp, proj, site, zones, sel, selZ, scored, tab, scenarios, recs,
    showConfetti, compareId, setCompareId, scenarioName, setScenarioName,
    inp, lbl, btn, sel_, D, hl, G,
  } = useHvs();
  const [pdfTemplate, setPdfTemplate] = useState("full");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [sitePlanNoise, setSitePlanNoise] = useState(true);
  const [sitePlanTerrain, setSitePlanTerrain] = useState(true);
  const obs3dRef = useRef(null);
  const [ols3dPngCache, setOls3dPngCache] = useState(null);
  const [windRoseExportErr, setWindRoseExportErr] = useState("");
  const [mountOls3d, setMountOls3d] = useState(false);
  const [ols3dBusy, setOls3dBusy] = useState(false);

  // Mount the heavy 3D view only after OLS tab is visible and the browser is idle.
  useEffect(() => {
    if (tab !== "ols" || !selZ?.sc) return;
    if (mountOls3d) return;
    setOls3dBusy(true);
    const schedule = (cb) => {
      if (typeof window.requestIdleCallback === "function") {
        return window.requestIdleCallback(cb, { timeout: 800 });
      }
      return window.setTimeout(cb, 120);
    };
    const cancel = (id) => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
    const id = schedule(() => {
      setMountOls3d(true);
      setTimeout(() => setOls3dBusy(false), 50);
    });
    return () => cancel(id);
  }, [tab, selZ?.id, selZ?.sc, mountOls3d]);

  if (!scored) return <div className="hvs-card" style={{ padding: 16 }}><p style={{ color: K.dm, textAlign: "center" }}>Run analysis first</p></div>;
  const rk = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
  const best = rk[0];
  if (!best) return null;
  const tabs = [{ id: "overview", l: "Overview" }, { id: "map", l: "Map" }, { id: "siteplan", l: "Site Plan" }, { id: "orient", l: "Orientation" }, { id: "ols", l: "OLS Section" }, { id: "comply", l: "Compliance" }, { id: "scenarios", l: "Scenarios" }, { id: "report", l: "Report" }];
  const suggestions = genSuggestions(zones, proj, site);

  return (
    <div>
      <Confetti active={showConfetti} />
      {/* SMART SUGGESTIONS BANNER */}
      {suggestions.length > 0 && tab === "overview" && (
        <div style={{ marginBottom: 10 }}>
          {suggestions.slice(0, 4).map((s, i) => (
            <div key={i} style={{ padding: "6px 12px", marginBottom: 3, borderRadius: 6, fontSize: 14, lineHeight: 1.4, display: "flex", gap: 8, alignItems: "flex-start", background: s.type === "danger" ? K.rd + "08" : s.type === "warning" ? K.am + "08" : s.type === "success" ? K.gn + "08" : K.cy + "08", border: "1px solid " + (s.type === "danger" ? K.rd : s.type === "warning" ? K.am : s.type === "success" ? K.gn : K.cy) + "20" }}>
              <SuggestionGlyph suggestion={s} size={18} />
              <span style={{ color: K.tx }}>{s.text}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Results</h2>
          <p style={{ fontSize: 14, color: K.dm, margin: "2px 0 0" }}>{proj.nm} — {hl.nm} {getPc(proj).label}</p>
        </div>
        <div style={{ display: "flex", gap: 2, background: K.pn, borderRadius: 6, padding: 2 }}>
          {tabs.map(t => <div key={t.id} onClick={() => dp({ type: "TAB", payload: t.id })} style={{ padding: "6px 12px", borderRadius: 4, fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", background: tab === t.id ? K.bl : "transparent", color: tab === t.id ? "#fff" : K.dm, transition: "all 0.15s" }}>{t.l}</div>)}
        </div>
      </div>
      {tab === "map" ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: K.dm }}>Geo map — Leaflet · satellite toggle</span>
            <button
              type="button"
              onClick={async () => {
                const el = document.getElementById("hvs-results-map-host");
                const dataUrl = el ? await captureMapImage(el) : null;
                if (dataUrl) downloadDataUrl(dataUrl, (proj.nm || "map").replace(/\s+/g, "_") + "_geo_map.png");
              }}
              aria-label="Download map as PNG"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: K.cy + "18", color: K.cy, border: "1px solid " + K.cy + "44" }}
            >
              <IconDownload size={17} title="" />
              Download map PNG
            </button>
          </div>
          <ResultsMapView site={site} zones={zones} proj={proj} sel={sel} onSelectZone={(id) => dp({ type: "SEL", payload: id })} />
        </div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: "clamp(12px, 2vw, 20px)" }}>
        <div>
          {/* RECOMMENDED ZONE — hero card */}
          <div className="hvs-card hvs-slide" style={{ padding: 16, marginBottom: 10, position: "relative", overflow: "hidden", borderColor: K.gn + "40" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: "radial-gradient(circle at 100% 0%, " + K.gn + "15, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: K.gn, letterSpacing: 2.5, marginBottom: 4 }}>★ RECOMMENDED</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>{best.lb}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
              <AnimScore value={best.sc.tot} color={scoreCol(best.sc.tot)} size={32} />
              <span style={{ fontSize: 14, color: K.dm }}>/100</span>
              <Tag color={gradeCol(best.sc.gr)}>{best.sc.gr}</Tag>
            </div>
            <div style={{ fontSize: 13, color: K.dm, marginTop: 4, lineHeight: 1.4 }}>{best.sc.rec}</div>
            {best.sc.ori && <div style={{ marginTop: 8, padding: "6px 8px", background: "linear-gradient(135deg, " + K.pu + "10, " + K.pu + "05)", borderRadius: 6, border: "1px solid " + K.pu + "20" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: K.pu, letterSpacing: 1.5 }}>HEADING</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{best.sc.ori.hp}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: K.dm }}>{best.sc.ori.us}% usable</div>
                  <div style={{ fontSize: 13, color: best.sc.ori.xm <= best.sc.ori.lim ? K.gn : K.rd }}>XW {best.sc.ori.xm}kt</div>
                </div>
              </div>
            </div>}
            {(() => { const c = calcConfidence(best); return (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: c.gradeColor + "08", borderRadius: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.gradeColor, letterSpacing: 1 }}>CONFIDENCE</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: c.gradeColor }}>{c.overall}%</span>
                <span style={{ fontSize: 12, color: c.gradeColor }}>{c.grade}</span>
              </div>
            ); })()}
          </div>
          {/* RADAR */}
          <div className="hvs-card" style={{ padding: 10, marginBottom: 10, display: "flex", justifyContent: "center" }}>
            <ScoreRadar scores={selZ?.sc} size={160} />
          </div>
          {/* RANKING */}
          <div className="hvs-card" style={{ padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1.2, marginBottom: 6 }}>RANKING</div>
            {rk.map((z, i) => { const conf = calcConfidence(z); const isActive = z.id === sel; return <div key={z.id} onClick={() => dp({ type: "SEL", payload: z.id })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px", borderBottom: i < rk.length - 1 ? "1px solid " + K.bd : "none", cursor: "pointer", background: isActive ? K.bl + "10" : "transparent", borderRadius: isActive ? 4 : 0, transition: "background 0.15s" }}>
              <span style={{ width: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, background: i === 0 ? K.gn : K.pn, color: i === 0 ? "#fff" : K.mu }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{z.lb}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: scoreCol(z.sc.tot) }}>{z.sc.tot}</span>
              <Tag color={gradeCol(z.sc.gr)}>{z.sc.gr}</Tag>
              <span style={{ fontSize: 12, color: conf.gradeColor, fontWeight: 600 }}>{conf.overall}%</span>
            </div>; })}
          </div>
          <ZGrid zones={zones} sel={sel} onSel={v => dp({ type: "SEL", payload: v })} cols={site.gc} rows={site.gr} sm />
        </div>
        <div style={{ maxHeight: "72vh", overflowY: "auto", paddingRight: 6 }}>
          {tab === "overview" && <>
            {/* DASHBOARD METRICS */}
            {(() => {
              const comp = checkCompliance(best, proj, site);
              const conf = calcConfidence(best);
              const ori = best.sc.ori;
              const metrics = [
                { label: "BEST SCORE", value: best.sc.tot, sub: best.lb + " — Grade " + best.sc.gr, color: scoreCol(best.sc.tot) },
                { label: "HEADING", value: ori ? ori.hp : "—", sub: ori ? ori.us + "% usability" : "", color: K.pu },
                { label: "MAX XW", value: ori ? ori.xm + "kt" : "—", sub: "limit " + getXwLim(proj) + "kt (" + hl.cat + ")", color: ori && ori.xm <= ori.lim ? K.gn : K.am },
                { label: "COMPLIANCE", value: comp.compliant ? "PASS" : "FAIL", sub: comp.summary.passed + "/" + comp.summary.total + " checks", color: comp.compliant ? K.gn : K.rd },
                { label: "CONFIDENCE", value: conf.overall + "%", sub: conf.grade, color: conf.gradeColor },
                { label: "OLS", value: best.sc.bd.obs.pens?.filter(p => p.p18).length || 0, sub: best.sc.bd.obs.pens?.filter(p => p.p18).length > 0 ? "penetrations" : "all clear", color: (best.sc.bd.obs.pens?.filter(p => p.p18).length || 0) > 0 ? K.rd : K.gn },
              ];
              return (
                <div className="hvs-slide" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 10 }}>
                  {metrics.map((m, i) => (
                    <div key={i} className="hvs-card" style={{ padding: "12px 8px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                      <div className="hvs-shimmer" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: K.mu, letterSpacing: 1.2, marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: m.color, textShadow: "0 0 12px " + m.color + "40" }}>{typeof m.value === "number" ? <AnimScore value={m.value} color={m.color} size={20} /> : m.value}</div>
                      <div style={{ fontSize: 12, color: K.dm, marginTop: 3 }}>{m.sub}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* CHARTS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div className="hvs-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 8 }}>SCORE HEATMAP</div>
                <Heatmap zones={zones} cols={site.gc} rows={site.gr} width={260} height={220} />
              </div>
              <div className="hvs-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 8 }}>ZONE RANKING</div>
                <RankingBars zones={zones} width={280} height={220} />
              </div>
            </div>
            <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: K.gn, letterSpacing: 1, marginBottom: 8 }}>RECOMMENDATIONS</div>
              {recs.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, padding: 6, background: K.rs, borderRadius: 4, alignItems: "flex-start" }}>
                  <RecGlyph rec={r} size={18} color={K.cy} />
                  <div>
                    <div style={{ fontSize: 13 }}>{r.text}</div>
                    {r.detail && <div style={{ fontSize: 13, color: K.mu }}>{r.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
            {selZ?.sc && <div className="hvs-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}><span style={{ fontSize: 16, fontWeight: 800 }}>{selZ.lb}</span><span style={{ fontSize: 16, fontWeight: 800, color: scoreCol(selZ.sc.tot) }}>{selZ.sc.tot}</span><Tag color={gradeCol(selZ.sc.gr)}>Grade {selZ.sc.gr}</Tag></div>
              <ScoreBar label="Wind" score={selZ.sc.bd.wind.s} weight={(proj.wt || WT).wind} reasons={selZ.sc.bd.wind.R} />
              <ScoreBar label="Obstacles" score={selZ.sc.bd.obs.s} weight={(proj.wt || WT).obs} reasons={selZ.sc.bd.obs.R} />
              <ScoreBar label="Terrain" score={selZ.sc.bd.ter.s} weight={(proj.wt || WT).ter} reasons={selZ.sc.bd.ter.R} />
              <ScoreBar label="Access" score={selZ.sc.bd.acc.s} weight={(proj.wt || WT).acc} reasons={selZ.sc.bd.acc.R} />
              <ScoreBar label="Geometry" score={selZ.sc.bd.geo.s} weight={(proj.wt || WT).geo} reasons={selZ.sc.bd.geo.R} />
              <ScoreBar label="Environment" score={selZ.sc.bd.env.s} weight={(proj.wt || WT).env} reasons={selZ.sc.bd.env.R} />
              {/* Confidence */}
              {(() => {
                const conf = calcConfidence(selZ);
                return (
                  <div style={{ marginTop: 14, padding: 10, background: K.rs, borderRadius: 6, border: "1px solid " + conf.gradeColor + "33" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: K.dm }}>DATA CONFIDENCE</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: conf.gradeColor }}>{conf.overall}%</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: conf.gradeColor }}>{conf.grade}</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: K.pn, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ height: "100%", width: conf.overall + "%", background: conf.gradeColor, borderRadius: 2 }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {["wind", "obstacles", "terrain", "access"].map(cat => {
                        const d = conf.details[cat];
                        return (
                          <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 4px", background: d.color + "10", borderRadius: 3 }}>
                            <span style={{ color: K.dm, textTransform: "capitalize" }}>{cat}</span>
                            <span style={{ color: d.color, fontWeight: 600 }}>{d.score}%</span>
                          </div>
                        );
                      })}
                    </div>
                    {conf.flags.length > 0 &&
                      conf.flags.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: K.rd, marginTop: 3 }}>
                          <span style={{ display: "inline-flex", flexShrink: 0, color: K.rd }}><IconStatusWarning size={14} title="" /></span>
                          <span>{f}</span>
                        </div>
                      ))}
                  </div>
                );
              })()}
            </div>}
            {/* ZONE QUICK COMPARE */}
            {selZ?.sc && (() => {
              const scored2 = zones.filter(z => z.sc && z.id !== selZ.id);
              const compZ = scored2.find(z => z.id === compareId) || scored2[0];
              if (!compZ) return null;
              const catLabels = { wind: "Wind", obs: "Obstacles", ter: "Terrain", acc: "Access", geo: "Geometry", env: "Environment" };
              return (
                <div style={{ background: K.sf, borderRadius: 8, padding: 16, border: "1px solid " + K.bd, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1 }}>ZONE COMPARE</span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: K.dm }}>vs</span>
                      {sel_(compareId || compZ?.id || "", v => setCompareId(v), scored2.map(z => ({ v: z.id, l: z.lb + " (" + z.sc.tot + ")" })))}
                    </div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: "2px solid " + K.bd }}>
                      <th style={{ padding: "4px 6px", textAlign: "left", color: K.dm }}>Criterion</th>
                      <th style={{ padding: "4px 6px", textAlign: "center", color: K.cy }}>{selZ.lb}</th>
                      <th style={{ padding: "4px 6px", textAlign: "center", color: K.am }}>{compZ.lb}</th>
                      <th style={{ padding: "4px 6px", textAlign: "center", color: K.dm }}>Δ</th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(catLabels).map(([k, label]) => {
                        const s1 = selZ.sc.bd[k]?.s || 0, s2 = compZ.sc.bd[k]?.s || 0, delta = s1 - s2;
                        return (
                          <tr key={k} style={{ borderBottom: "1px solid " + K.bd }}>
                            <td style={{ padding: "5px 6px", color: K.dm }}>{label}</td>
                            <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: scoreCol(s1) }}>{s1}</td>
                            <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: scoreCol(s2) }}>{s2}</td>
                            <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: delta > 0 ? K.gn : delta < 0 ? K.rd : K.dm }}>{delta > 0 ? "+" : ""}{delta}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: K.rs }}>
                        <td style={{ padding: "5px 6px", fontWeight: 800 }}>TOTAL</td>
                        <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 800, color: scoreCol(selZ.sc.tot) }}>{selZ.sc.tot}</td>
                        <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 800, color: scoreCol(compZ.sc.tot) }}>{compZ.sc.tot}</td>
                        <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 800, color: selZ.sc.tot - compZ.sc.tot > 0 ? K.gn : K.rd }}>{selZ.sc.tot > compZ.sc.tot ? "+" : ""}{(selZ.sc.tot - compZ.sc.tot).toFixed(1)}</td>
                      </tr>
                      <tr><td style={{ padding: "5px 6px", color: K.dm }}>Heading</td><td style={{ padding: "5px 6px", textAlign: "center", color: K.pu }}>{selZ.sc.ori?.hp || "—"}</td><td style={{ padding: "5px 6px", textAlign: "center", color: K.pu }}>{compZ.sc.ori?.hp || "—"}</td><td></td></tr>
                      <tr><td style={{ padding: "5px 6px", color: K.dm }}>Confidence</td>{[selZ, compZ].map((z, i) => { const c = calcConfidence(z); return <td key={i} style={{ padding: "5px 6px", textAlign: "center", color: c.gradeColor, fontWeight: 600 }}>{c.overall}%</td>; })}<td></td></tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>}

          {tab === "siteplan" && (() => {
            return (
              <>
                <div id="hvs-site-plan-export" className="hvs-card" style={{ padding: 0, marginBottom: 8, overflow: "hidden", border: "1px solid " + K.bd, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "14px 16px", background: "linear-gradient(90deg, rgba(37,99,235,0.12), transparent)", borderBottom: "1px solid " + K.bd }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: K.cy, letterSpacing: 2 }}>SITE INTELLIGENCE</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: K.tx, marginTop: 4, letterSpacing: -0.4 }}>Plan view — operations layout</div>
                      <div style={{ fontSize: 13, color: K.mu, marginTop: 4, lineHeight: 1.45 }}>Select zones · Recommended FATO & approaches · Optional noise & terrain overlays</div>
                    </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={async () => {
                          const el = document.getElementById("hvs-site-plan-export");
                          const dataUrl = el ? await captureElementAsPng(el, { backgroundColor: "#0a0f1a", scale: 2 }) : null;
                          if (dataUrl) downloadDataUrl(dataUrl, (proj.nm || "site").replace(/\s+/g, "_") + "_site_plan.png");
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: K.gn + "18", color: K.gn, border: "1px solid " + K.gn + "44" }}
                      >
                        <IconDownload size={16} title="" />
                        Plan PNG
                      </button>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 10, background: K.gn, opacity: 0.3, display: "inline-block", borderRadius: 2, border: "1px solid " + K.gn }} /> FATO</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 1, background: K.am, display: "inline-block" }} /> Safety Area</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 1, background: K.cy, display: "inline-block" }} /> Approach</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: K.gn, display: "inline-block" }} /> Clear Obs</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: K.rd, display: "inline-block" }} /> Pen. Obs</span>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", marginLeft: 6 }}>
                        <input type="checkbox" checked={sitePlanNoise} onChange={(e) => setSitePlanNoise(e.target.checked)} /> ~65–80 dBA rings
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="checkbox" checked={sitePlanTerrain} onChange={(e) => setSitePlanTerrain(e.target.checked)} /> Terrain contours / slopes
                      </label>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", padding: "12px 10px 16px", background: "radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.06), transparent 55%)" }}>
                    <SitePlan
                      zones={zones}
                      proj={proj}
                      site={site}
                      selId={sel}
                      onSel={(v) => dp({ type: "SEL", payload: v })}
                      showNoiseContours={sitePlanNoise}
                      showTerrainOverlay={sitePlanTerrain}
                      onAddObs={(x, y) => {
                        if (!sel) return;
                        dp({ type: "SZ", payload: zones.map((z) => (z.id !== sel ? z : { ...z, obs: [...z.obs, mkObs({ nm: "Obs_" + (z.obs.length + 1), x, y, h: 10, tp: "building" })] })) });
                      }}
                      size={520}
                    />
                  </div>
                </div>
                {/* Selected zone info */}
                {selZ?.sc && (
                  <div className="hvs-card" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800 }}>{selZ.lb}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: scoreCol(selZ.sc.tot) }}>{selZ.sc.tot}</span>
                        <Tag color={gradeCol(selZ.sc.gr)}>{selZ.sc.gr}</Tag>
                        {selZ.sc.ori && <span style={{ fontSize: 13, color: K.pu }}>Hdg {selZ.sc.ori.hp}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: K.dm }}>
                        {selZ.bw.toFixed(0)}×{selZ.bh.toFixed(0)}m | {selZ.obs.length} obstacles | slope {selZ.ter.slope}%
                      </div>
                    </div>
                    {selZ.obs.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {selZ.obs.map((o, i) => {
                          const pen = o.d > 0 && o.h > o.d / 8;
                          return (
                            <div key={i} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 13, background: pen ? K.rd + "15" : K.gn + "15", color: pen ? K.rd : K.gn, border: "1px solid " + (pen ? K.rd : K.gn) + "30" }}>
                              {o.nm}: {o.h}m @ {o.d}m / {o.br}° — {pen ? "PEN" : "CLEAR"}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          {tab === "orient" && selZ?.sc?.ori && (() => {
            const o = selZ.sc.ori;
            return <>
              <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: K.pu, letterSpacing: 1 }}>ORIENTATION — {selZ.lb}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Optimal: {o.hp} ({o.oh}°/{o.oh + 180}°)</div>
                    <div style={{ fontSize: 14, color: K.dm, marginTop: 2 }}>{o.reason}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <Tag color={o.ok ? K.gn : K.rd}>{o.ok ? "✓" : "✗"} ICAO 95%: {o.us}%</Tag>
                      <Tag color={o.xm <= o.lim ? K.gn : K.am}>XW: {o.xm}kt / {o.lim}kt</Tag>
                      {o.tw && <Tag color={K.am}>Tailwind risk</Tag>}
                    </div>
                  </div>
                  <div id="hvs-wind-rose-export" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        setWindRoseExportErr("");
                        const url = await buildWindRosePng(selZ);
                        if (url) {
                          downloadDataUrl(url, (proj.nm || "wind").replace(/\s+/g, "_") + "_wind_rose.png");
                        } else {
                          setWindRoseExportErr("Could not build PNG (browser blocked SVG→canvas). Try another browser or use Print.");
                        }
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer", background: K.pu + "18", color: K.pu, border: "1px solid " + K.pu + "44" }}
                    >
                      <IconDownload size={15} title="" />
                      Wind rose PNG
                    </button>
                    {windRoseExportErr && (
                      <span style={{ fontSize: 12, color: K.rd, maxWidth: 200, textAlign: "right" }}>{windRoseExportErr}</span>
                    )}
                    <WindRose zone={selZ} ori={o} size={170} />
                  </div>
                </div>
              </div>
              <div className="hvs-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 6 }}>HEADING COMPARISON</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ borderBottom: "1px solid " + K.bd }}>{["Hdg", "Usability", "XW Max", "HW Pri", "HW Sec", ""].map(h => <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: K.dm }}>{h}</th>)}</tr></thead>
                  <tbody>{o.all.slice(0, 10).map((h, i) => <tr key={i} style={{ borderBottom: "1px solid " + K.bd, background: i === 0 ? K.gn + "08" : "transparent" }}>
                    <td style={{ padding: "4px 6px", fontWeight: i === 0 ? 700 : 400, color: i === 0 ? K.gn : K.tx }}>{h.hp}</td>
                    <td style={{ padding: "4px 6px", color: h.us >= 95 ? K.gn : h.us >= 85 ? K.am : K.rd }}>{h.us}%</td>
                    <td style={{ padding: "4px 6px", color: h.xm <= o.lim ? K.gn : K.am }}>{h.xm}kt</td>
                    <td style={{ padding: "4px 6px" }}>{h.hwP}kt</td>
                    <td style={{ padding: "4px 6px" }}>{h.hwS}kt</td>
                    <td style={{ padding: "4px 6px" }}>{i === 0 ? <Tag color={K.gn}>OPTIMAL</Tag> : h.us >= 95 ? <Tag color={K.bl}>OK</Tag> : <Tag color={K.rd}>BELOW</Tag>}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>;
          })()}

          {tab === "ols" && selZ?.sc && <>
            <div id="hvs-ols-chart-export" className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: K.am, letterSpacing: 1 }}>OLS CROSS-SECTION — {selZ.lb}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const out = optimizePadCenter(selZ, proj);
                      if (!out) {
                        alert("Could not find a valid pad location inside the zone polygon. Check corners and footprint size.");
                        return;
                      }
                      dp({ type: "ZF", payload: { zid: selZ.id, fld: "pad", val: out } });
                      alert("Pad location optimized. Please run Analysis again to update scores/OLS.");
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: K.cy + "18", color: K.cy, border: "1px solid " + K.cy + "44" }}
                  >
                    Optimize pad
                  </button>
                  {selZ.pad?.mode && (
                    <button
                      type="button"
                      onClick={() => {
                        dp({ type: "ZF", payload: { zid: selZ.id, fld: "pad", val: null } });
                        alert("Pad reset to centroid. Please run Analysis again to update scores/OLS.");
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: K.mu + "18", color: K.dm, border: "1px solid " + K.bd }}
                    >
                      Reset pad
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const el = document.getElementById("hvs-ols-chart-export");
                    const dataUrl = el ? await captureElementAsPng(el, { backgroundColor: "#0b1120", scale: 2 }) : null;
                    if (dataUrl) downloadDataUrl(dataUrl, (proj.nm || "ols").replace(/\s+/g, "_") + "_ols_section.png");
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: K.am + "18", color: K.am, border: "1px solid " + K.am + "44" }}
                >
                  <IconDownload size={16} title="" />
                  OLS chart PNG
                </button>
              </div>
              <OLSChart zone={selZ} proj={proj} width={560} height={240} />
              <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 13, flexWrap: "wrap" }}>
                <span>—<span style={{ color: K.am }}> Approach (per PC)</span></span>
                <span>--<span style={{ color: K.cy }}> 1:2 Trans.</span></span>
                <span>●<span style={{ color: K.gn }}> Clear</span></span>
                <span>●<span style={{ color: K.rd }}> Penetrates</span></span>
              </div>
            </div>
            {selZ.sc.bd.obs.pens?.length > 0 && <div className="hvs-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: K.dm, letterSpacing: 1, marginBottom: 6 }}>OBSTACLE TABLE</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: "1px solid " + K.bd }}>{["Name", "H", "Dist", "H/D", "Limit", "Status"].map(h => <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: K.dm }}>{h}</th>)}</tr></thead>
                <tbody>{selZ.sc.bd.obs.pens.map((p, i) => <tr key={i} style={{ borderBottom: "1px solid " + K.bd }}>
                  <td style={{ padding: "4px 6px", fontWeight: 600 }}>{p.nm}</td>
                  <td style={{ padding: "4px 6px" }}>{p.h}m</td>
                  <td style={{ padding: "4px 6px" }}>{p.d}m</td>
                  <td style={{ padding: "4px 6px", fontFamily: "monospace" }}>{p.ratio}</td>
                  <td style={{ padding: "4px 6px" }}>{p.a18}m</td>
                  <td style={{ padding: "4px 6px" }}>{p.p18 ? <Tag color={K.rd}>PEN +{p.ex}m</Tag> : p.p12 ? <Tag color={K.am}>PEN 1:2</Tag> : <Tag color={K.gn}>CLEAR</Tag>}</td>
                </tr>)}</tbody>
              </table>
            </div>}
            {/* 3D ISOMETRIC VIEW */}
            <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
              <ErrorBoundary label="3D OLS View">
                {mountOls3d ? (
                  <Suspense
                    fallback={
                      <div className="hvs-card" style={{ padding: 18, width: 540, textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: K.cy }}>Loading 3D OLS view…</div>
                        <div style={{ fontSize: 13, color: K.dm, marginTop: 6 }}>The cross-section above is ready; 3D loads in the background.</div>
                      </div>
                    }
                  >
                    <LazyObs3D ref={obs3dRef} zone={selZ} proj={proj} size={500} onSnapshotReady={setOls3dPngCache} />
                  </Suspense>
                ) : (
                  <div className="hvs-card" style={{ padding: 18, width: 540, textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: K.cy }}>
                      {ols3dBusy ? "Preparing 3D OLS view…" : "3D OLS view queued"}
                    </div>
                    <div style={{ fontSize: 13, color: K.dm, marginTop: 6 }}>
                      Opening this tab stays fast; 3D initializes when the browser is idle.
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </div>

            {/* ROTOR DOWNWASH IMPACT ASSESSMENT CARD */}
            {(() => {
              const hl = getHeli(proj);
              const dw = calculateDownwash(hl, site?.elev || 0);
              const zObs = selZ?.obs || [];
              const affectedObs = zObs.filter(o => (o.d || 999) <= dw.hazardRadii.r30Kt);

              return (
                <div className="hvs-card" style={{ padding: "18px 22px", marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>💨</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: K.tx, letterSpacing: -0.2 }}>
                          ROTOR DOWNWASH & GROUND OUTWASH ASSESSMENT
                        </div>
                        <div style={{ fontSize: 11, color: K.mu, marginTop: 2 }}>
                          Momentum Theory & IGE Ground Outwash Profile (FAA AC 150/5390 · UK CAA CAP 1264)
                        </div>
                      </div>
                    </div>
                    <Tag color={dw.severityColor}>{dw.severityLabel.toUpperCase()}</Tag>
                  </div>

                  {/* Physics & Telemetry Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
                    <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 8, border: "1px solid " + K.bd }}>
                      <div style={{ fontSize: 10, color: K.mu, fontWeight: 700 }}>DESIGN AIRCRAFT</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: K.tx, marginTop: 4 }}>{hl.nm}</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>MTOW {(hl.mtow / 1000).toFixed(1)}t · Ø {hl.rtr || hl.D}m</div>
                    </div>
                    <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 8, border: "1px solid " + K.bd }}>
                      <div style={{ fontSize: 10, color: K.mu, fontWeight: 700 }}>DISC LOADING</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: K.cy, marginTop: 4 }}>{dw.discLoadingKgM2.toFixed(1)} <span style={{ fontSize: 10 }}>kg/m²</span></div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>Area {dw.discAreaM2.toFixed(0)} m²</div>
                    </div>
                    <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 8, border: "1px solid " + K.bd }}>
                      <div style={{ fontSize: 10, color: K.mu, fontWeight: 700 }}>HOVER INDUCED (OGE)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: K.tx, marginTop: 4 }}>{dw.viKt.toFixed(0)} kt</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>{dw.viMs.toFixed(1)} m/s at disc</div>
                    </div>
                    <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 8, border: "1px solid " + K.bd }}>
                      <div style={{ fontSize: 10, color: K.mu, fontWeight: 700 }}>PEAK GROUND OUTWASH</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: dw.severityColor, marginTop: 4 }}>{dw.vMaxKt.toFixed(0)} kt</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>{dw.vMaxMs.toFixed(1)} m/s @ {dw.peakRadiusM.toFixed(1)}m</div>
                    </div>
                    <div style={{ background: "rgba(15,23,42,0.6)", padding: "10px 12px", borderRadius: 8, border: "1px solid " + K.bd }}>
                      <div style={{ fontSize: 10, color: K.mu, fontWeight: 700 }}>PERSONNEL 30kt LIMIT</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24", marginTop: 4 }}>{dw.hazardRadii.r30Kt} m</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>Safe personnel perimeter</div>
                    </div>
                  </div>

                  {/* Hazard Zone Distance Thresholds */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#f87171" }}>🔴 Severe Zone (&gt;60 kt / 31 m/s): 0 – {dw.hazardRadii.r60Kt}m</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>Extreme debris & structural damage risk. Personnel strictly prohibited.</div>
                    </div>
                    <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#fb923c" }}>🟠 High Wind Zone (&gt;45 kt / 23 m/s): {dw.hazardRadii.r60Kt} – {dw.hazardRadii.r45Kt}m</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>Risk of personnel blow-over. Loose objects become high-velocity projectiles.</div>
                    </div>
                    <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#fcd34d" }}>🟡 Caution Zone (30–45 kt / 15–23 m/s): {dw.hazardRadii.r45Kt} – {dw.hazardRadii.r30Kt}m</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>Passenger walking difficulty. Eye protection recommended; tie downs required.</div>
                    </div>
                    <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#67e8f9" }}>🟢 Operational Boundary (&lt;15 kt): Beyond {dw.hazardRadii.r15Kt}m</div>
                      <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>Safe general pedestrian area, parking lots, and passenger holding lounges.</div>
                    </div>
                  </div>

                  {/* Impact on nearby structures/obstacles */}
                  {affectedObs.length > 0 && (
                    <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>
                        ⚠️ {affectedObs.length} Structure(s) inside the &gt;30 kt Downwash Buffer:
                      </div>
                      <div style={{ fontSize: 10, color: K.tx, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {affectedObs.map(o => (
                          <span key={o.nm || o.id}>
                            <strong>{o.nm || "Obstacle"}</strong> ({o.d}m away) — exp. velocity: <strong>{dw.getVelocityAtDistance(o.d).kt.toFixed(0)} kt</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>}

          {tab === "comply" && selZ?.sc && (() => {
            const comp = checkCompliance(selZ, proj, site);
            const sCol = { PASS: K.gn, FAIL: K.rd, WARN: K.am, "N/A": K.mu };
            const sIcon = { PASS: "✓", FAIL: "✗", WARN: "⚠", "N/A": "—" };
            const sBg = { PASS: K.gn + "10", FAIL: K.rd + "10", WARN: K.am + "10", "N/A": K.rs };
            return (
              <>
                {/* Summary bar */}
                <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: comp.compliant ? K.gn : K.rd, letterSpacing: 1 }}>
                        COMPLIANCE STATUS — {selZ.lb}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: comp.compliant ? K.gn : K.rd, marginTop: 2 }}>
                        {comp.compliant ? "COMPLIANT" : "NON-COMPLIANT"}
                      </div>
                      <div style={{ fontSize: 13, color: K.dm, marginTop: 2 }}>
                        {comp.compliant ? "All mandatory requirements met" : comp.summary.failed + " requirement(s) not met"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: K.gn }}>{comp.summary.passed}</div>
                        <div style={{ fontSize: 12, color: K.dm, fontWeight: 600 }}>PASS</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: K.rd }}>{comp.summary.failed}</div>
                        <div style={{ fontSize: 12, color: K.dm, fontWeight: 600 }}>FAIL</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: K.am }}>{comp.summary.warned}</div>
                        <div style={{ fontSize: 12, color: K.dm, fontWeight: 600 }}>WARN</div>
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 8, background: K.rs, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                    <div style={{ width: (comp.summary.passed / comp.summary.total * 100) + "%", background: K.gn, transition: "width .3s" }} />
                    <div style={{ width: (comp.summary.warned / comp.summary.total * 100) + "%", background: K.am, transition: "width .3s" }} />
                    <div style={{ width: (comp.summary.failed / comp.summary.total * 100) + "%", background: K.rd, transition: "width .3s" }} />
                  </div>
                  <div style={{ fontSize: 13, color: K.mu, marginTop: 4 }}>{comp.summary.passed + comp.summary.warned + comp.summary.failed} / {comp.summary.total} checks evaluated</div>
                </div>

                {/* Per category */}
                {comp.categories.map(cat => {
                  const catChecks = comp.checks.filter(c => c.cat === cat);
                  const catFails = catChecks.filter(c => c.status === "FAIL").length;
                  return (
                    <div key={cat} className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: catFails > 0 ? K.rd : K.gn }}>
                          {catFails > 0 ? "⚠" : "✓"} {cat}
                        </div>
                        <div style={{ fontSize: 13, color: K.dm }}>
                          {catChecks.filter(c => c.status === "PASS").length}/{catChecks.length} passed
                        </div>
                      </div>
                      {catChecks.map((c, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", marginBottom: 4, background: sBg[c.status], borderRadius: 4, borderLeft: "3px solid " + sCol[c.status] }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: sCol[c.status], minWidth: 16 }}>{sIcon[c.status]}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: K.tx }}>{c.rule}</div>
                            <div style={{ fontSize: 13, color: K.mu, marginTop: 1 }}>{c.detail}</div>
                          </div>
                          <div style={{ fontSize: 12, color: K.mu, whiteSpace: "nowrap" }}>{c.ref}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            );
          })()}

          {tab === "scenarios" && (() => {
            const rankedCurrent = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
            const currentBest = rankedCurrent[0];
            return (
              <>
                {/* MULTI-SITE WORKFLOW GUIDE */}
                <div style={{ background: "linear-gradient(135deg, " + K.cy + "08, " + K.pu + "05)", border: "1px solid " + K.cy + "25", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: K.cy, marginBottom: 8 }}>
                    <span style={{ display: "flex", color: K.cy }}><IconLayersCompare size={22} title="" /></span>
                    <span>Multi-Site Comparison · مقارنة مواقع مختلفة</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, fontSize: 13, color: K.dm }}>
                    <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: K.cy }}><IconStepBadge n={1} /></div>
                      <div>Run Site A → <strong style={{ color: K.gn }}>Save</strong></div>
                    </div>
                    <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: K.am }}><IconStepBadge n={2} /></div>
                      <div><strong style={{ color: K.am }}>New Site</strong> → Setup B → Run → Save</div>
                    </div>
                    <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: K.pu }}><IconStepBadge n={3} /></div>
                      <div>Repeat for Site C</div>
                    </div>
                    <div style={{ background: K.pn, borderRadius: 4, padding: 6, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: K.cy }}><IconStepBadge n={4} /></div>
                      <div><strong style={{ color: K.cy }}>Compare</strong> below</div>
                    </div>
                  </div>
                </div>

                {/* SAVE CURRENT */}
                <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: K.cy, marginBottom: 4 }}>
                    <IconSaveAnalysis size={18} title="" />
                    Save Current Analysis
                  </div>
                  <div style={{ fontSize: 13, color: K.dm, marginBottom: 8 }}>Site: <strong style={{ color: K.tx }}>{site.nm || "Unnamed"}</strong> | {site.lat.toFixed(4)}°, {site.lng.toFixed(4)}° | {site.sw}×{site.sh}m | {hl.nm} {getPc(proj).label}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {inp("text", scenarioName, setScenarioName, { ph: "e.g. Site A — Hospital Rooftop" })}
                    {btn("Save", () => { if (scenarioName.trim()) { dp({ type: "SAVE_SCENARIO", payload: scenarioName.trim() }); setScenarioName(""); } }, "accent", !scenarioName.trim() || !scored)}
                    {btn(
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <IconRefreshSite size={17} title="" />
                        New Site (Reset)
                      </span>,
                      () => dp({ type: "RESET" }),
                      "ghost",
                      false,
                      { ariaLabel: "New site — reset project" }
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: K.mu, marginTop: 4 }}>Saves EVERYTHING: site location, zones, obstacles, wind, scores. Use "New Site" to start a different location — saved scenarios are preserved.</div>
                </div>

                {/* WHAT-IF QUICK COMPARE */}
                <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: K.pu, marginBottom: 10 }}>
                    <IconRefreshSite size={18} title="" />
                    Quick What-If (same site, different aircraft / PC)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      {lbl("Helicopter")}
                      {sel_(proj.dh, v => dp({ type: "WHATIF", payload: { dh: v } }), HELIS.map(h => ({ v: h.id, l: h.id === "custom" ? "Custom" : h.nm + " (D=" + h.D + "m)" })))}
                    </div>
                    <div>
                      {lbl("Performance Class")}
                      {sel_(proj.pc, v => dp({ type: "WHATIF", payload: { pc: v } }), Object.entries(PC_DATA).map(([k, v]) => ({ v: k, l: v.label })))}
                    </div>
                  </div>
                  {currentBest && <div style={{ marginTop: 10, padding: "8px 10px", background: K.rs, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: K.tx }}>Current best: <strong>{currentBest.lb}</strong> — {currentBest.sc.tot}/100 ({currentBest.sc.gr})</span>
                    <Tag color={gradeCol(currentBest.sc.gr)}>{currentBest.sc.gr}</Tag>
                  </div>}
                </div>

                {/* SAVED SCENARIOS */}
                <div className="hvs-card" style={{ padding: 16, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: K.am, marginBottom: 10 }}>
                    <IconClipboardList size={18} title="" />
                    Saved Scenarios ({scenarios.length})
                  </div>
                  {scenarios.length === 0 && <div style={{ fontSize: 13, color: K.mu, textAlign: "center", padding: 16 }}>No scenarios saved. Run analysis then Save to start comparing sites.</div>}
                  {scenarios.map((sc) => {
                    const scBest = sc.zones.filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0];
                    const scHeli = HELIS.find(h => h.id === sc.proj.dh);
                    const scPc = PC_DATA[sc.proj.pc];
                    const scComp = scBest ? checkCompliance(scBest, sc.proj, sc.site) : null;
                    return (
                      <div key={sc.id} style={{ background: K.rs, borderRadius: 6, padding: 12, marginBottom: 6, borderLeft: "3px solid " + (scBest ? scoreCol(scBest.sc.tot) : K.bd) }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: K.tx }}>{sc.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: K.cy, marginTop: 2 }}>
                              <span style={{ display: "flex", flexShrink: 0 }}><IconMapPin size={15} title="" /></span>
                              <span>{sc.site?.nm || "—"} | {sc.site?.lat?.toFixed(4) || 0}°, {sc.site?.lng?.toFixed(4) || 0}° | {sc.site?.sw || 0}×{sc.site?.sh || 0}m</span>
                            </div>
                            <div style={{ fontSize: 13, color: K.mu }}>{new Date(sc.savedAt).toLocaleString()} | {scHeli?.nm || "Custom"} | {scPc?.label || sc.proj.pc} | {sc.zones.filter(z => z.on).length} zones</div>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            {btn("Load", () => dp({ type: "LOAD_SCENARIO", payload: sc.id }), "ghost")}
                            {btn("Dup", () => dp({ type: "DUP_SCENARIO", payload: sc.id }), "ghost")}
                            {btn(<IconTrash size={17} title="" />, () => dp({ type: "DEL_SCENARIO", payload: sc.id }), "ghost", false, { ariaLabel: "Delete scenario " + (sc.name || "") })}
                          </div>
                        </div>
                        {scBest && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, color: K.dm }}>Best: <strong style={{ color: K.tx }}>{scBest.lb}</strong></span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: scoreCol(scBest.sc.tot) }}>{scBest.sc.tot}</span>
                          <Tag color={gradeCol(scBest.sc.gr)}>{scBest.sc.gr}</Tag>
                          {scBest.sc.ori && <span style={{ fontSize: 13, color: K.dm }}>Hdg {scBest.sc.ori.hp}</span>}
                          {scComp && <Tag color={scComp.compliant ? K.gn : K.rd}>{scComp.compliant ? "PASS" : "FAIL"} {scComp.summary.passed}/{scComp.summary.total}</Tag>}
                        </div>}
                      </div>
                    );
                  })}
                </div>

                {/* SIDE-BY-SIDE COMPARISON */}
                {scenarios.length > 0 && scored && <div className="hvs-card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: K.gn, marginBottom: 10 }}>
                    <IconLayersCompare size={18} title="" />
                    Side-by-Side Comparison
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid " + K.bd }}>
                          <th style={{ padding: "6px 8px", textAlign: "left", color: K.dm }}>Parameter</th>
                          <th style={{ padding: "6px 8px", textAlign: "center", color: K.cy, fontWeight: 700 }}>Current</th>
                          {scenarios.map(sc => <th key={sc.id} style={{ padding: "6px 8px", textAlign: "center", color: K.am, fontWeight: 700 }}>{sc.name}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const curBest = rankedCurrent[0];
                          const allBests = scenarios.map(sc => sc.zones.filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0]);
                          const rows = [
                            { label: "Site Name", cur: site.nm || "Current", vals: scenarios.map(sc => sc.site?.nm || "—"), section: true },
                            { label: "Location", cur: site.lat.toFixed(4) + "°, " + site.lng.toFixed(4) + "°", vals: scenarios.map(sc => (sc.site?.lat?.toFixed(4) || 0) + "°, " + (sc.site?.lng?.toFixed(4) || 0) + "°") },
                            { label: "Site Area", cur: site.sw + "×" + site.sh + "m", vals: scenarios.map(sc => (sc.site?.sw || 0) + "×" + (sc.site?.sh || 0) + "m") },
                            { label: "Elevation", cur: site.elev + "m", vals: scenarios.map(sc => (sc.site?.elev || 0) + "m") },
                            { label: "Active Zones", cur: zones.filter(z => z.on).length + "/" + zones.length, vals: scenarios.map(sc => sc.zones.filter(z => z.on).length + "/" + sc.zones.length) },
                            { label: "Helicopter", cur: hl.nm, vals: scenarios.map(sc => HELIS.find(h => h.id === sc.proj.dh)?.nm || "Custom"), section: true },
                            { label: "D-value", cur: D + "m", vals: scenarios.map(sc => getD(sc.proj) + "m") },
                            { label: "Perf. Class", cur: getPc(proj).label, vals: scenarios.map(sc => PC_DATA[sc.proj.pc]?.label || "") },
                            { label: "FATO+SA", cur: G.tot.toFixed(1) + "m", vals: scenarios.map(sc => calcGeom(sc.proj).tot.toFixed(1) + "m") },
                            { label: "Best Zone", cur: curBest?.lb || "—", vals: allBests.map(b => b?.lb || "—"), section: true },
                            { label: "Score", cur: curBest?.sc?.tot || "—", vals: allBests.map(b => b?.sc?.tot || "—"), highlight: true },
                            { label: "Grade", cur: curBest?.sc?.gr || "—", vals: allBests.map(b => b?.sc?.gr || "—"), grade: true },
                            { label: "Heading", cur: curBest?.sc?.ori?.hp || "—", vals: allBests.map(b => b?.sc?.ori?.hp || "—") },
                            { label: "Usability", cur: curBest?.sc?.ori ? curBest.sc.ori.us + "%" : "—", vals: allBests.map(b => b?.sc?.ori ? b.sc.ori.us + "%" : "—") },
                            { label: "Max XW", cur: curBest?.sc?.ori ? curBest.sc.ori.xm + "kt" : "—", vals: allBests.map(b => b?.sc?.ori ? b.sc.ori.xm + "kt" : "—") },
                            { label: "Wind", cur: curBest?.sc?.bd?.wind?.s || "—", vals: allBests.map(b => b?.sc?.bd?.wind?.s || "—") },
                            { label: "OBS", cur: curBest?.sc?.bd?.obs?.s || "—", vals: allBests.map(b => b?.sc?.bd?.obs?.s || "—") },
                            { label: "Terrain", cur: curBest?.sc?.bd?.ter?.s || "—", vals: allBests.map(b => b?.sc?.bd?.ter?.s || "—") },
                            { label: "Access", cur: curBest?.sc?.bd?.acc?.s || "—", vals: allBests.map(b => b?.sc?.bd?.acc?.s || "—") },
                            { label: "Geometry", cur: curBest?.sc?.bd?.geo?.s || "—", vals: allBests.map(b => b?.sc?.bd?.geo?.s || "—") },
                            { label: "Environment", cur: curBest?.sc?.bd?.env?.s || "—", vals: allBests.map(b => b?.sc?.bd?.env?.s || "—") },
                            { label: "Compliance", cur: (() => { if (!curBest) return "—"; const c = checkCompliance(curBest, proj, site); return c.compliant ? "PASS " + c.summary.passed + "/" + c.summary.total : "FAIL " + c.summary.passed + "/" + c.summary.total; })(), vals: allBests.map((b, j) => { if (!b) return "—"; const sc = scenarios[j]; const c = checkCompliance(b, sc.proj, sc.site); return c.compliant ? "PASS " + c.summary.passed + "/" + c.summary.total : "FAIL " + c.summary.passed + "/" + c.summary.total; }) },
                          ];
                          return rows.map((r, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid " + K.bd, background: r.section ? K.cy + "05" : "transparent" }}>
                              <td style={{ padding: "5px 8px", color: r.section ? K.cy : K.dm, fontWeight: r.section ? 700 : 600, fontSize: r.section ? 10 : 9 }}>{r.label}</td>
                              <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: r.highlight ? 800 : 400, fontSize: r.highlight ? 14 : 10, color: r.highlight ? scoreCol(typeof r.cur === "number" ? r.cur : 0) : r.grade ? gradeCol(r.cur) : K.tx }}>{r.cur}</td>
                              {r.vals.map((v, j) => <td key={j} style={{ padding: "5px 8px", textAlign: "center", fontWeight: r.highlight ? 800 : 400, fontSize: r.highlight ? 14 : 10, color: r.highlight ? scoreCol(typeof v === "number" ? v : 0) : r.grade ? gradeCol(v) : K.tx }}>{v}</td>)}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>}
              </>
            );
          })()}

          {tab === "report" && (() => {
            const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
            const pc = getPc(proj);
            const rankedAll = [...zones].filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
            const excluded = zones.filter(z => !z.on);
            const bestZ = rankedAll[0];
            if (!bestZ) return null;
            const bOri = bestZ.sc.ori;
            const bObs = bestZ.sc.bd.obs;

            const rSec = (title, children) => (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a2540", borderBottom: "2px solid #2563eb", paddingBottom: 4, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
                {children}
              </div>
            );
            const rRow = (label, value, highlight) => (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 14, color: "#6b7280" }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: highlight || "#1f2937" }}>{value}</span>
              </div>
            );

            return (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", marginBottom: 8, gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: K.mu, marginRight: "auto", maxWidth: 420, lineHeight: 1.4 }}>
                    Tip: for richest PDF, open <strong>Map</strong>, <strong>Site Plan</strong>, and <strong>OLS</strong> once so captures cache (map fallback: static OSM; 3D uses last OLS view).
                  </span>
                  <label style={{ fontSize: 13, color: K.dm, display: "flex", alignItems: "center", gap: 6 }}>
                    Template
                    <select value={pdfTemplate} onChange={(e) => setPdfTemplate(e.target.value)} style={{ padding: "4px 8px", borderRadius: 4, fontSize: 13, background: K.pn, color: K.tx, border: "1px solid " + K.bd }}>
                      {Object.values(REPORT_TEMPLATES).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={pdfBusy}
                    onClick={async () => {
                      setPdfBusy(true);
                      try {
                        const mapEl = document.getElementById("hvs-results-map-host");
                        const mapImage = mapEl ? await captureMapImage(mapEl) : null;
                        const planEl = document.getElementById("hvs-site-plan-export");
                        const sitePlanImage = planEl ? await captureElementAsPng(planEl, { backgroundColor: "#0a0f1a", scale: 2 }) : null;
                        let ols3dImage = null;
                        try {
                          ols3dImage = obs3dRef.current?.capturePng?.() ?? null;
                        } catch {
                          // ignore
                        }
                        if (!ols3dImage) ols3dImage = ols3dPngCache;
                        const windRoseImage = await buildWindRosePng(bestZ);
                        const comp = checkCompliance(bestZ, proj, site);
                        const confBest = calcConfidence(bestZ);
                        await downloadHeliPdfReport({
                          templateId: pdfTemplate,
                          proj,
                          site,
                          zones,
                          scenarios,
                          bestZone: bestZ,
                          rankedAll,
                          hl,
                          D,
                          G,
                          pcLabel: getPc(proj).label,
                          wt: proj.wt || WT,
                          comp,
                          confBest,
                          recs,
                          mapImage,
                          sitePlanImage,
                          ols3dImage,
                          windRoseImage,
                        });
                      } finally {
                        setPdfBusy(false);
                      }
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: pdfBusy ? "wait" : "pointer", background: K.gn, color: "#fff", border: "none", opacity: pdfBusy ? 0.7 : 1 }}
                  >
                    <IconPdfFile size={17} title="" />
                    {pdfBusy ? "Preparing PDF…" : "Download PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("hvs-report");
                      if (el) printElementAsImage(el);
                    }}
                    aria-label="Print report"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: "pointer", background: K.bl, color: "#fff", border: "none" }}
                  >
                    <IconPrint size={17} title="" />
                    Print Report
                  </button>
                  <button
                    type="button"
                    disabled={docxBusy}
                    aria-label="Download report as Word document"
                    onClick={async () => {
                      setDocxBusy(true);
                      try {
                        await downloadHeliReportDocx({
                          proj,
                          site,
                          zones,
                          rankedAll,
                          bestZ,
                          today,
                          hl,
                          D,
                          recs,
                        });
                      } catch (e) {
                        console.error(e);
                        alert(e?.message || "Could not build the Word document.");
                      } finally {
                        setDocxBusy(false);
                      }
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: docxBusy ? "wait" : "pointer", background: "transparent", color: K.dm, border: "1px solid " + K.bd, opacity: docxBusy ? 0.7 : 1 }}
                  >
                    <IconDocxFile size={17} title="" />
                    {docxBusy ? "Preparing DOCX…" : "Download DOCX"}
                  </button>
                </div>
                <div id="hvs-report" style={{ background: "#fff", color: "#1f2937", borderRadius: 8, padding: "32px 36px", fontFamily: "'Outfit', 'Segoe UI', sans-serif", maxWidth: "min(920px, 100%)", lineHeight: 1.6 }}>
                {/* HEADER */}
                <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 20, borderBottom: "3px solid #2563eb" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <HvsLogoMarkReport size={56} title="Heli-VertiSafe" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", letterSpacing: 3, marginBottom: 4 }}>HELI-VERTISAFE SITE INTELLIGENCE</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>Helipad Feasibility Assessment</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{proj.nm}</div>
                  <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Prepared for: {proj.cl || "—"} | Date: {today}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>Ref: ICAO Annex 14 Vol II | GACAR Part 138 | {pc.label}</div>
                  {(() => { const wf = WORKFLOW_STATES.find(s => s.v === (proj.workflow || "draft")) || WORKFLOW_STATES[0]; return <div style={{ marginTop: 6 }}><span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 13, fontWeight: 700, color: wf.c, background: wf.c + "18", border: "1px solid " + wf.c + "33" }}>Status: {wf.l}</span></div>; })()}
                </div>

                {/* EXECUTIVE SUMMARY */}
                {rSec("1. Executive Summary", (
                  <div>
                    <p style={{ fontSize: 14, margin: "0 0 8px" }}>
                      This report presents the findings of a multi-criteria helipad site feasibility assessment for <strong>{proj.nm}</strong> at <strong>{site.nm}</strong> (Lat {site.lat.toFixed(4)}°, Lng {site.lng.toFixed(4)}°, Elev {site.elev}m AMSL). The study evaluated <strong>{rankedAll.length}</strong> candidate zone(s) across a {site.sw}m × {site.sh}m study area using the {hl.nm} (D-value = {D}m) as the design helicopter under {pc.label} operations.
                    </p>
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", letterSpacing: 1, marginBottom: 4 }}>RECOMMENDATION</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#14532d" }}>Zone {bestZ.lb} — Score {bestZ.sc.tot}/100 (Grade {bestZ.sc.gr})</div>
                      <div style={{ fontSize: 14, color: "#166534" }}>{bestZ.sc.rec}</div>
                      {bOri && <div style={{ fontSize: 14, color: "#166534", marginTop: 4 }}>Optimal FATO heading: {bOri.hp} ({bOri.us}% wind usability, max crosswind {bOri.xm}kt)</div>}
                    </div>
                    {excluded.length > 0 && <p style={{ fontSize: 13, color: "#6b7280" }}>{excluded.length} zone(s) were excluded from analysis.</p>}
                  </div>
                ))}

                {/* SITE DATA */}
                {rSec("2. Site Information", (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      {rRow("Site Name", site.nm)}
                      {rRow("Coordinates", site.lat.toFixed(4) + "° / " + site.lng.toFixed(4) + "°")}
                      {rRow("Elevation", site.elev + "m AMSL")}
                      {rRow("Study Area", site.sw + "m × " + site.sh + "m")}
                    </div>
                    <div>
                      {rRow("Project Type", proj.pt)}
                      {rRow("Grid", site.gc + "×" + site.gr + " (" + zones.length + " zones)")}
                      {rRow("Mag. Declination", site.md + "°")}
                      {rRow("Ref. Temperature", site.rt + "°C")}
                    </div>
                  </div>
                ))}

                {/* RESPONSE TIMES */}
                {(site.destinations || []).length > 0 && rSec("3. Response Time Analysis", (
                  <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Destination", "Type", "Distance", "Flight", "Total", "Requirement", "Status"].map(h => (
                            <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(site.destinations || []).map((d, i) => {
                          const rt = calcResponseTime(d, site.lat, site.lng);
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                              <td style={{ padding: "4px 6px", fontWeight: 600 }}>{d.nm}</td>
                              <td style={{ padding: "4px 6px" }}>{d.tp}</td>
                              <td style={{ padding: "4px 6px" }}>{rt ? rt.distKm + " km" : "—"}</td>
                              <td style={{ padding: "4px 6px" }}>{rt ? rt.flightMin + " min" : "—"}</td>
                              <td style={{ padding: "4px 6px", fontWeight: 700, color: rt && !rt.meetsReq ? "#991b1b" : "#166534" }}>{rt ? rt.totalMin + " min" : "—"}</td>
                              <td style={{ padding: "4px 6px" }}>{d.maxMinutes > 0 ? "≤" + d.maxMinutes + " min" : "—"}</td>
                              <td style={{ padding: "4px 6px" }}>
                                {rt && d.maxMinutes > 0 ? <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 13, fontWeight: 700, color: rt.meetsReq ? "#166534" : "#991b1b", background: rt.meetsReq ? "#bbf7d0" : "#fecaca" }}>{rt.meetsReq ? "MEETS" : "EXCEEDS"}</span> : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>Response time = startup (3min) + flight time ({hl.nm}) + approach (2min) + ground transport. Speed based on cruise at configured knots.</div>
                  </div>
                ))}

                {/* DESIGN PARAMETERS */}
                {rSec((site.destinations || []).length > 0 ? "4" : "3" + ". Design Parameters", (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      {rRow("Design Helicopter", hl.nm)}
                      {rRow("D-value", D + "m")}
                      {rRow("MTOW", hl.mtow + " kg")}
                      {rRow("Category", hl.cat)}
                      {rRow("XW Limit", getXwLim(proj) + " kt")}
                    </div>
                    <div>
                      {rRow("Performance Class", pc.label)}
                      {rRow("FATO", G.fato.toFixed(1) + "m × " + G.fato.toFixed(1) + "m")}
                      {rRow("TLOF", G.tlof.toFixed(1) + "m")}
                      {rRow("Safety Area", G.sa.toFixed(1) + "m (min)")}
                      {rRow("Total Footprint", G.tot.toFixed(1) + "m × " + G.tot.toFixed(1) + "m")}
                    </div>
                  </div>
                ))}

                {/* ZONE COMPARISON */}
                {rSec("4. Zone Comparison", (
                  <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["#", "Zone", "Wind", "OBS", "Terrain", "Access", "Geo", "Env", "Total", "Grade", "Conf."].map(h => (
                            <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rankedAll.map((z, i) => (
                          <tr key={z.id} style={{ background: i === 0 ? "#f0fdf4" : i % 2 === 0 ? "#fafafa" : "#fff" }}>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, color: i === 0 ? "#166534" : "#6b7280" }}>{i + 1}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>{z.lb}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.wind.s}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.obs.s}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.ter.s}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.acc.s}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.geo.s}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{z.sc.bd.env.s}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontWeight: 800, color: i === 0 ? "#166534" : "#1f2937" }}>{z.sc.tot}</td>
                            <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>
                              <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 13, fontWeight: 700, background: gradeCol(z.sc.gr) + "20", color: gradeCol(z.sc.gr) }}>{z.sc.gr}</span>
                            </td>
                            {(() => { const c = calcConfidence(z); return <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 13, fontWeight: 600, color: c.gradeColor }}>{c.overall}%</td>; })()}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>Weights: Wind {(proj.wt || WT).wind * 100}% | Obstacles {(proj.wt || WT).obs * 100}% | Terrain {(proj.wt || WT).ter * 100}% | Access {(proj.wt || WT).acc * 100}% | Geometry {(proj.wt || WT).geo * 100}% | Environment {(proj.wt || WT).env * 100}%</div>
                  </div>
                ))}

                {/* RECOMMENDED ZONE DETAIL */}
                {rSec("5. Recommended Zone — " + bestZ.lb, (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div>
                        {rRow("Score", bestZ.sc.tot + " / 100", "#166534")}
                        {rRow("Grade", bestZ.sc.gr, gradeCol(bestZ.sc.gr))}
                        {rRow("Zone Size", bestZ.bw.toFixed(0) + "m × " + bestZ.bh.toFixed(0) + "m")}
                        {rRow("Slope", bestZ.ter.slope + "% (side: " + bestZ.ter.side + "%)")}
                        {rRow("Soil", bestZ.ter.soil)}
                      </div>
                      <div>
                        {bOri && rRow("Optimal Heading", bOri.hp + " (" + bOri.oh + "°/" + (bOri.oh + 180) + "°)")}
                        {bOri && rRow("Wind Usability", bOri.us + "%" + (bOri.ok ? " ✓" : " ⚠"), bOri.ok ? "#166534" : "#b91c1c")}
                        {bOri && rRow("Max Crosswind", bOri.xm + "kt (limit " + bOri.lim + "kt)")}
                        {rRow("Road Access", bestZ.acc.road ? "Yes (" + bestZ.acc.rd + "m)" : "No", bestZ.acc.road ? undefined : "#b91c1c")}
                        {rRow("Building Clearance", bestZ.acc.bd + "m", bestZ.acc.bd < 30 ? "#b91c1c" : undefined)}
                      </div>
                    </div>

                    {/* Score breakdown */}
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Score Breakdown</div>
                    {["wind", "obs", "ter", "acc", "geo", "env"].map(k => {
                      const label = { wind: "Wind Analysis", obs: "Obstacle Clearance", ter: "Terrain Suitability", acc: "Accessibility", geo: "Zone Geometry", env: "Environmental Sensitivity" }[k];
                      const sc = bestZ.sc.bd[k];
                      return (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: 13, color: "#6b7280" }}>{label} ({((proj.wt || WT)[k] * 100).toFixed(0)}%)</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: scoreCol(sc.s) }}>{sc.s}/100</span>
                          </div>
                          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden", marginBottom: 2 }}>
                            <div style={{ height: "100%", width: sc.s + "%", background: scoreCol(sc.s), borderRadius: 2 }} />
                          </div>
                          {sc.R.map((r, i) => <div key={i} style={{ fontSize: 13, color: "#9ca3af", paddingLeft: 8, borderLeft: "2px solid #e5e7eb", marginTop: 1 }}>{r}</div>)}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* OBSTACLE SUMMARY */}
                {bObs.pens.length > 0 && rSec("6. Obstacle Analysis — " + bestZ.lb, (
                  <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Obstacle", "Type", "Height", "Distance", "Bearing", "H/D Ratio", "Approach Limit", "Status"].map(h => (
                            <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bObs.pens.map((p, i) => (
                          <tr key={i} style={{ background: p.p18 ? "#fef2f2" : "#fff" }}>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontWeight: 600 }}>{p.nm}</td>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.nm}</td>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.h}m</td>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.d}m</td>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.br}°</td>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{p.ratio}</td>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{p.a18}m</td>
                            <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                              <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 13, fontWeight: 700, background: p.p18 ? "#fecaca" : "#bbf7d0", color: p.p18 ? "#991b1b" : "#166534" }}>
                                {p.p18 ? "PENETRATES (+" + p.ex + "m)" : p.p12 ? "PEN 1:2" : "CLEAR"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* RECOMMENDATIONS */}
                {rSec((bObs.pens.length > 0 ? "7" : "6") + ". Recommendations & Actions", (
                  <div>
                    {recs.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 4, borderLeft: "3px solid " + recBorderColor(r), alignItems: "flex-start" }}>
                        <RecGlyph rec={r} size={22} color="#334155" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{r.text}</div>
                          {r.detail && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{r.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* DATA CONFIDENCE */}
                {(() => {
                  const confSecNum = bObs.pens.length > 0 ? 8 : 7;
                  const confBest = calcConfidence(bestZ);
                  return rSec(confSecNum + ". Data Quality & Confidence", (
                    <div>
                      <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center" }}>
                        <div style={{ padding: "6px 12px", background: confBest.overall >= 55 ? "#f0fdf4" : "#fffbeb", border: "1px solid " + (confBest.overall >= 55 ? "#bbf7d0" : "#fde68a"), borderRadius: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: confBest.gradeColor }}>{confBest.overall}% — {confBest.grade}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>Overall data confidence for {bestZ.lb}</div>
                        </div>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["Category", "Data Source", "Quality Score", "Status"].map(h => (
                              <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {["wind", "obstacles", "terrain", "access"].map(cat => {
                            const d = confBest.details[cat];
                            return (
                              <tr key={cat}>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, textTransform: "capitalize" }}>{cat}</td>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>{d.srcLabel}</td>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ width: 60, height: 4, background: "#e5e7eb", borderRadius: 2 }}>
                                      <div style={{ width: d.score + "%", height: "100%", background: d.color, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: d.color }}>{d.score}%</span>
                                  </div>
                                </td>
                                <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                                  <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 12, fontWeight: 700, color: d.score >= 70 ? "#166534" : d.score >= 40 ? "#92400e" : "#991b1b", background: d.score >= 70 ? "#bbf7d0" : d.score >= 40 ? "#fde68a" : "#fecaca" }}>
                                    {d.score >= 70 ? "RELIABLE" : d.score >= 40 ? "VERIFY" : "INSUFFICIENT"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {confBest.flags.length > 0 && (
                        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, padding: 8, marginTop: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>DATA QUALITY FLAGS</div>
                          {confBest.flags.map((f, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#92400e" }}>
                              <span style={{ display: "inline-flex", flexShrink: 0, color: "#d97706" }}><IconStatusWarning size={16} title="" /></span>
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 6 }}>
                        Source levels: Survey (100%) → Documented (85%) → Estimated (60%) → Assumed (30%). Score adjusted for data completeness.
                      </div>
                    </div>
                  ));
                })()}

                {/* COMPLIANCE MATRIX */}
                {(() => {
                  const comp = checkCompliance(bestZ, proj, site);
                  const secNum = bObs.pens.length > 0 ? 9 : 8;
                  const sCol = { PASS: "#166534", FAIL: "#991b1b", WARN: "#92400e", "N/A": "#6b7280" };
                  const sBg = { PASS: "#f0fdf4", FAIL: "#fef2f2", WARN: "#fffbeb", "N/A": "#f9fafb" };
                  return rSec(secNum + ". Regulatory Compliance Matrix", (
                    <div>
                      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                        <div style={{ padding: "6px 12px", background: comp.compliant ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (comp.compliant ? "#bbf7d0" : "#fecaca"), borderRadius: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: comp.compliant ? "#166534" : "#991b1b" }}>{comp.compliant ? "COMPLIANT" : "NON-COMPLIANT"}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>{comp.summary.passed} pass | {comp.summary.failed} fail | {comp.summary.warned} warn</div>
                        </div>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["Status", "Category", "Reference", "Requirement", "Finding"].map(h => (
                              <th key={h} style={{ padding: "5px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {comp.checks.map((c, i) => (
                            <tr key={i} style={{ background: sBg[c.status] }}>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb" }}>
                                <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 12, fontWeight: 700, color: sCol[c.status], background: c.status === "PASS" ? "#bbf7d0" : c.status === "FAIL" ? "#fecaca" : c.status === "WARN" ? "#fde68a" : "#e5e7eb" }}>{c.status}</span>
                              </td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>{c.cat}</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", whiteSpace: "nowrap" }}>{c.ref}</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", color: "#1f2937" }}>{c.rule}</td>
                              <td style={{ padding: "4px 6px", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>{c.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ));
                })()}

                {/* VERTIPORT SECTION (conditional) */}
                {(proj.mode === "vertiport" || proj.facility === "vertiport" || getHeli(proj).tp === "evtol") && (() => {
                  const vz = bestZ;
                  const vp = vz.vport || {};
                  const secN = bObs.pens.length > 0 ? 10 : 9;
                  return rSec(secN + ". Vertiport / eVTOL Assessment", (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Aircraft Type</span><span style={{ fontSize: 14, fontWeight: 600 }}>{getHeli(proj).tp === "evtol" ? "eVTOL" : "Helicopter"}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Number of Pads</span><span style={{ fontSize: 14, fontWeight: 600 }}>{vp.pads || 1}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Charging</span><span style={{ fontSize: 14, fontWeight: 600 }}>{vp.charging ? "Yes (" + (vp.chargePoints || 0) + " points)" : "No"}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Turnaround</span><span style={{ fontSize: 14, fontWeight: 600 }}>{vp.turnaround || 10} min</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Passenger Flow</span><span style={{ fontSize: 14, fontWeight: 600 }}>{vp.paxFlow || "walk"}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Terminal</span><span style={{ fontSize: 14, fontWeight: 600 }}>{vp.terminal ? "Connected" : "Standalone"}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Est. Throughput</span><span style={{ fontSize: 14, fontWeight: 600, color: "#2563eb" }}>{Math.round(60 / (vp.turnaround || 10) * (vp.pads || 1))} ops/hr</span></div>
                        {getHeli(proj).pax && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Pax/Flight</span><span style={{ fontSize: 14, fontWeight: 600 }}>{getHeli(proj).pax}</span></div>}
                      </div>
                    </div>
                  ));
                })()}

                {/* AUDIT LOG in report */}
                {(proj.auditLog || []).length > 0 && (() => {
                  const secN = (bObs.pens.length > 0 ? 10 : 9) + ((proj.mode === "vertiport" || proj.facility === "vertiport" || getHeli(proj).tp === "evtol") ? 1 : 0);
                  return rSec(secN + ". Project Audit Trail", (
                    <div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead><tr style={{ background: "#f8fafc" }}>
                          {["Date/Time", "Action", "Details"].map(h => <th key={h} style={{ padding: "4px 6px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontWeight: 700, color: "#374151" }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {(proj.auditLog || []).map((log, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                              <td style={{ padding: "3px 6px", color: "#6b7280", whiteSpace: "nowrap" }}>{new Date(log.ts).toLocaleString("en-GB")}</td>
                              <td style={{ padding: "3px 6px", fontWeight: 600, color: "#1f2937" }}>{log.action}</td>
                              <td style={{ padding: "3px 6px", color: "#6b7280" }}>{log.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ));
                })()}

                {/* ASSUMPTIONS */}
                {rSec((bObs.pens.length > 0 ? 11 : 10) + ((proj.mode === "vertiport" || proj.facility === "vertiport" || getHeli(proj).tp === "evtol") ? 1 : 0) + ((proj.auditLog || []).length > 0 ? 1 : 0) + ". Assumptions & Limitations", (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    <p style={{ margin: "0 0 4px" }}>• Wind data based on input frequencies; full wind rose study recommended for detailed design.</p>
                    <p style={{ margin: "0 0 4px" }}>• Obstacle positions are approximate; topographic survey required to confirm distances and heights.</p>
                    <p style={{ margin: "0 0 4px" }}>• Terrain slopes are estimated; geotechnical investigation required for foundation design.</p>
                    <p style={{ margin: "0 0 4px" }}>• OLS analysis uses simplified 2D cross-section; full 3D OLS assessment per ICAO Annex 14 Vol II required.</p>
                    <p style={{ margin: "0 0 4px" }}>• Scoring weights may be adjusted based on project-specific priorities.</p>
                    <p style={{ margin: "0 0 4px" }}>• This assessment does not replace formal authority approval per GACAR Part 138.</p>
                  </div>
                ))}

                {/* FOOTER */}
                <div style={{ marginTop: 28, paddingTop: 12, borderTop: "2px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 13, color: "#9ca3af" }}>
                  <span>Generated by Heli-VertiSafe v4.2 — Site Intelligence Platform</span>
                  <span>{today}</span>
                </div>
              </div>
              </div>
            );
          })()}
        </div>
      </div>
      )}
    </div>
  );
}
