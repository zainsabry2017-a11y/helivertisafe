import React, { useState, useEffect, useCallback, useMemo, useReducer, useRef } from "react";
import { K } from "../utils/theme.js";
import { useAuth } from "../hooks/useAuth";
import { LoginPage } from "./auth/LoginPage";
import { SignupPage } from "./auth/SignupPage";
import { STEPS_DEF } from "../data/constants.js";
import {
  getD, getHeli, getXwLim, calcGeom, WORKFLOW_STATES,
  mkProj, mkSite, mkZone,
} from "../data/models.js";
import { useAutoSave, loadAutoSave } from "../state/autoSave.js";
import { undoReducer } from "../state/reducer.js";
import { runScoring } from "../engine/scoringRunner.js";
import { zoneCompleteness } from "../utils/zoneCompleteness.js";
import { pointInPolygon } from "../engine/geometry.js";

import { ErrorBoundary } from "./ui/ErrorBoundary.jsx";
import { Tag } from "./ui/Tag.jsx";
import WelcomeScreen from "./WelcomeScreen.jsx";
import { HvsLogoMark } from "./branding/HvsLogo.jsx";
import {
  IconBolt,
  IconCloudSaved,
  IconExportProject,
  IconImportProject,
  IconRedo,
  IconUndo,
} from "./branding/HvsToolbarIcons.jsx";
import { HvsContext } from "../context/HvsContext.jsx";
import {
  ProjectSetupStep,
  SiteDefinitionStep,
  ZoneManagerStep,
  DataInputStep,
  ScoreEngineStep,
  ResultsStep,
} from "./steps/index.js";


export default function App() {
  const { user, loading, signOut, signIn, signUp, signInWithGoogle } = useAuth();
  const [authView, setAuthView] = useState("login"); // "login" | "signup"

  const [mode, setMode] = useState("welcome"); // "welcome" | "app"
  const emptyState = { step: 0, proj: mkProj(), site: mkSite(), zones: [], sel: null, recs: [], scored: false, tab: "overview", scenarios: [] };
  const [historyState, dp] = useReducer(undoReducer, { past: [], present: emptyState, future: [] });
  const state = historyState.present;
  const canUndo = historyState.past.length > 0;
  const canRedo = historyState.future.length > 0;
  const { step, proj, site, zones, sel, recs, scored, tab, scenarios } = state;
  const [scenarioName, setScenarioName] = useState("");
  const [compareId, setCompareId] = useState(null);
  const [obsView, setObsView] = useState("card"); // "card" | "table"
  const [dataTab, setDataTab] = useState("wind");
  const [showConfetti, setShowConfetti] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const analysisBusyRef = useRef(false);

  const selZ = useMemo(() => zones.find(z => z.id === sel), [zones, sel]);

  const runFullAnalysis = useCallback(async () => {
    if (!zones.some((z) => z.on) || analysisBusyRef.current) return;
    analysisBusyRef.current = true;
    const n = zones.length;
    setAnalysisProgress({ current: 0, total: n });
    try {
      const { zones: scored } = await runScoring({
        zones,
        proj,
        onProgress: (c, t) => setAnalysisProgress({ current: c, total: t }),
      });
      dp({ type: "RUN", payload: { precomputedZones: scored } });
      setTimeout(() => {
        const rk = scored.filter((z) => z.sc).sort((a, b) => b.sc.tot - a.sc.tot);
        if (rk[0]?.sc?.tot >= 60) setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 100);
      }, 100);
    } catch (err) {
      console.error(err);
      alert("Analysis failed: " + (err?.message || err));
    } finally {
      analysisBusyRef.current = false;
      setAnalysisProgress(null);
    }
  }, [zones, proj, dp]);

  // Auto-save
  useAutoSave("hvs-autosave", state, mode);

  // Check for auto-saved data on mount
  const [hasAutoSave, setHasAutoSave] = useState(false);
  useEffect(() => {
    loadAutoSave("hvs-autosave").then(d => { if (d) setHasAutoSave(true); });
  }, []);

  // Keyboard shortcuts: Ctrl+Z = Undo, Ctrl+Y/Ctrl+Shift+Z = Redo, Arrows = zone nav
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); dp({ type: "UNDO" }); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); dp({ type: "REDO" }); }
      // Arrow keys to navigate zones (only in data/results steps)
      if (step >= 3 && step <= 5 && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "SELECT" && document.activeElement?.tagName !== "TEXTAREA") {
        const activeZones = zones.filter(z => z.on);
        const idx = activeZones.findIndex(z => z.id === sel);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); if (idx < activeZones.length - 1) dp({ type: "SEL", payload: activeZones[idx + 1].id }); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); if (idx > 0) dp({ type: "SEL", payload: activeZones[idx - 1].id }); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, zones, sel]);
  const D = useMemo(() => getD(proj), [proj]);
  const hl = useMemo(() => getHeli(proj), [proj]);
  const G = useMemo(() => calcGeom(proj), [proj]);

  const genGrid = useCallback(() => {
    const nz = [];
    const excls = site.exclusions || [];
    for (let r = 0; r < site.gr; r++) {
      for (let c = 0; c < site.gc; c++) {
        const z = mkZone(r, c, site);
        // Check if zone center overlaps any exclusion area
        const zCx = c * z.bw + z.bw / 2;
        const zCy = r * z.bh + z.bh / 2;
        for (const ex of excls) {
          const inside =
            ex.corners && ex.corners.length >= 3
              ? pointInPolygon(zCx, zCy, ex.corners)
              : zCx >= (ex.x || 0) && zCx <= (ex.x || 0) + (ex.w || 0) && zCy >= (ex.y || 0) && zCy <= (ex.y || 0) + (ex.h || 0);
          if (inside) {
            z.on = false;
            z.excludeReason = "Overlaps: " + ex.nm;
            break;
          }
        }
        nz.push(z);
      }
    }
    dp({ type: "SZ", payload: nz });
  }, [site]);

  const canNext = useMemo(() => {
    if (step === 0) return proj.nm.trim().length > 0;
    if (step === 1) return site.nm.trim().length > 0;
    if (step === 2) return zones.length > 0;
    return true;
  }, [step, proj, site, zones]);

  const prevStep = useRef(step);
  useEffect(() => {
    if (step === 2 && prevStep.current !== 2 && zones.length === 0) genGrid();
    prevStep.current = step;
  }, [step, zones.length, genGrid]);

  const zf = (sec, fld, val) => dp({ type: "ZF", payload: { zid: sel, sec, fld, val } });
  const inp = (type, value, onChange, extra = {}) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input type={type} value={value} onChange={e => onChange(type === "number" ? (e.target.value === "" ? 0 : parseFloat(e.target.value)) : e.target.value)} min={extra.min} max={extra.max} step={extra.step} placeholder={extra.ph}
        style={{ flex: 1, background: "rgba(21,34,54,0.6)", border: "1px solid " + K.bd, borderRadius: 6, padding: "0.65rem 0.85rem", color: K.tx, fontSize: "1rem", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s", backdropFilter: "blur(4px)" }}
        onFocus={e => { e.target.style.borderColor = K.cy; e.target.style.boxShadow = "0 0 0 2px " + K.cy + "20"; }}
        onBlur={e => { e.target.style.borderColor = K.bd; e.target.style.boxShadow = "none"; }} />
      {extra.suffix && <span style={{ fontSize: "0.875rem", color: K.cy, fontWeight: 600, minWidth: 16 }}>{extra.suffix}</span>}
    </div>
  );
  const sel_ = (value, onChange, options) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", background: "rgba(21,34,54,0.6)", border: "1px solid " + K.bd, borderRadius: 6, padding: "0.65rem 0.85rem", color: K.tx, fontSize: "1rem", outline: "none", cursor: "pointer", backdropFilter: "blur(4px)" }}>
      {options.map(o => <option key={typeof o === "string" ? o : o.v} value={typeof o === "string" ? o : o.v}>{typeof o === "string" ? o : o.l}</option>)}
    </select>
  );
  const lbl = (text) => {
    const isMandatory = text.includes("*");
    return <div style={{ fontSize: "0.875rem", fontWeight: 700, color: K.dm, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 }}>{text.replace(" *", "")}{isMandatory && <span style={{ color: K.rd, marginLeft: 2 }}>*</span>}</div>;
  };
  const btn = (content, onClick, variant = "primary", disabled = false, a11y = {}) => {
    const vs = {
      primary: { bg: "linear-gradient(135deg, #2563eb, #1d4ed8)", c: "#fff", shadow: "0 2px 8px rgba(37,99,235,0.3)" },
      accent: { bg: "linear-gradient(135deg, #10b981, #059669)", c: "#fff", shadow: "0 2px 8px rgba(16,185,129,0.3)" },
      ghost: { bg: "rgba(26,45,74,0.3)", c: K.dm, border: "1px solid " + K.bd, shadow: "none" }
    };
    const v = vs[variant] || vs.primary;
    const ariaLabel = a11y.ariaLabel ?? (typeof content === "string" && content.length > 0 && content.length <= 80 ? content : undefined);
    const iconOnly = typeof content !== "string";
    return (
      <button
        type="button"
        className="hvs-btn"
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        aria-label={ariaLabel}
        aria-busy={a11y.busy || undefined}
        style={{
          padding: iconOnly ? "0.45rem 0.55rem" : "0.6rem 1.15rem",
          borderRadius: 6,
          fontSize: "0.9375rem",
          fontWeight: 600,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.3 : 1,
          background: v.bg,
          color: v.c,
          border: v.border || "none",
          boxShadow: disabled ? "none" : v.shadow,
          letterSpacing: 0.3,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {content}
      </button>
    );
  };
  const chk = (checked, onChange, label) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.9375rem", color: checked ? K.tx : K.dm, transition: "color 0.2s" }}>
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "linear-gradient(135deg, " + K.gn + ", #059669)" : K.bd, position: "relative", cursor: "pointer", transition: "background 0.2s", boxShadow: checked ? "0 0 6px " + K.gn + "40" : "none" }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2, left: checked ? 16 : 2, transition: "left .15s ease-out", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} aria-hidden="true" />
      </div>{label}
    </label>
  );

  const StepViews = [ProjectSetupStep, SiteDefinitionStep, ZoneManagerStep, DataInputStep, ScoreEngineStep, ResultsStep];
  const StepComponent = StepViews[step];

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #030810 0%, #050a12 30%, #0a1628 100%)",
          color: "#e1e7ef",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            aria-hidden="true"
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              border: "2px solid rgba(6,182,212,0.35)",
              borderTopColor: "#06b6d4",
              animation: "hvs-spin 0.9s linear infinite",
            }}
          />
          <div style={{ fontWeight: 700, color: "#cbd5e1" }}>Loading…</div>
        </div>
        <style>{`@keyframes hvs-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return authView === "signup" ? (
      <SignupPage onSignup={signUp} onGoToLogin={() => setAuthView("login")} />
    ) : (
      <LoginPage
        onSignIn={signIn}
        onSignInWithGoogle={signInWithGoogle}
        onGoToSignup={() => setAuthView("signup")}
      />
    );
  }

  if (mode === "welcome") {
    return <WelcomeScreen dp={dp} setMode={setMode} hasAutoSave={hasAutoSave} />;
  }

  const hvs = {
    K, dp, proj, site, zones, sel, selZ, step, recs, scored, tab, scenarios,
    D, hl, G, genGrid, zf, inp, lbl, btn, chk, sel_,
    obsView, setObsView, dataTab, setDataTab,
    scenarioName, setScenarioName, compareId, setCompareId,
    showConfetti, setShowConfetti,
    zoneCompleteness,
    runFullAnalysis,
    analysisBusy: !!analysisProgress,
  };

  return (
    <HvsContext.Provider value={hvs}>
    <div style={{ background: "linear-gradient(180deg, #030810 0%, #050a12 30%, #0a1628 100%)", minHeight: "100vh", color: K.tx, fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(180deg, rgba(11,17,32,0.95) 0%, rgba(11,17,32,0.8) 100%)", backdropFilter: "blur(20px)", borderBottom: "1px solid " + K.bd, padding: "0.6rem clamp(12px, 2vw, 28px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={() => setMode("welcome")} style={{ width: 40, height: 40, borderRadius: 8, background: "linear-gradient(145deg, rgba(37,99,235,0.35), rgba(6,182,212,0.2))", border: "1px solid rgba(148,163,184,0.2)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(37,99,235,0.25)", cursor: "pointer" }} title="Back to Home" role="button" tabIndex={0} aria-label="Back to welcome screen" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode("welcome"); } }}><HvsLogoMark size={26} title="Heli-VertiSafe — home" /></div>
          <div><div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: -0.5 }}>Heli-VertiSafe</div><div style={{ fontSize: "0.8125rem", color: K.cy, letterSpacing: 1.5, fontWeight: 600 }}>v5.0 SITE INTELLIGENCE</div></div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span title="Undo (Ctrl+Z)">{btn(<IconUndo size={18} title="" />, () => dp({ type: "UNDO" }), "ghost", !canUndo, { ariaLabel: "Undo last change" })}</span>
          <span title="Redo (Ctrl+Y)">{btn(<IconRedo size={18} title="" />, () => dp({ type: "REDO" }), "ghost", !canRedo, { ariaLabel: "Redo" })}</span>
          <span style={{ display: "inline-flex", color: K.gn + "cc", alignItems: "center" }} title="Auto-save active" role="status" aria-label="Auto-save active">
            <IconCloudSaved size={19} title="Auto-save active" />
          </span>
          {proj.nm && <Tag color={K.bl}>{proj.nm}</Tag>}
          <Tag color={K.cy}>D={D}m</Tag>
          <Tag color={K.pu}>XW≤{getXwLim(proj)}kt</Tag>
          {(() => { const wf = WORKFLOW_STATES.find(s => s.v === (proj.workflow || "draft")) || WORKFLOW_STATES[0]; return <Tag color={wf.c}>{wf.l}</Tag>; })()}
          <Tag color={K.cy}>{user.email || "Signed in"}</Tag>
          {btn(
            "Logout",
            async () => {
              try {
                await signOut();
              } finally {
                setMode("welcome");
              }
            },
            "ghost",
            false,
            { ariaLabel: "Sign out" }
          )}
          {btn(
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <IconExportProject size={17} title="" />
              Export
            </span>,
            () => {
              const data = JSON.stringify({ v: "5.0", proj, site, zones: zones.map(z => ({ ...z, sc: null })), scenarios }, null, 2);
              const blob = new Blob([data], { type: "application/json" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
              a.download = (proj.nm || "project").replace(/\s+/g, "_") + ".hvs.json"; a.click();
            },
            "ghost",
            false,
            { ariaLabel: "Export project as JSON file" }
          )}
          {btn(
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <IconImportProject size={17} title="" />
              Import
            </span>,
            () => {
              const input = document.createElement("input"); input.type = "file"; input.accept = ".json,.hvs.json";
              input.onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
                r.onload = (ev) => { try { const d = JSON.parse(ev.target.result); if (d.proj && d.site && d.zones) dp({ type: "IMPORT", payload: d }); } catch(err) { console.error(err); } };
                r.readAsText(f); };
              input.click();
            },
            "ghost",
            false,
            { ariaLabel: "Import project from JSON file" }
          )}
          {btn("Demo", () => dp({ type: "DEMO" }), "ghost", false, { ariaLabel: "Load demo project" })}
          {btn("Reset", () => dp({ type: "RESET" }), "ghost", false, { ariaLabel: "Reset project to empty state" })}
        </div>
      </div>
      <div className="hvs-glass" role="tablist" aria-label="Workflow steps" style={{ borderBottom: "1px solid " + K.bd, padding: "0 clamp(12px, 2vw, 28px)", display: "flex", overflowX: "auto" }}>
        {STEPS_DEF.map((s, i) => (
          <div
            key={i}
            role="tab"
            id={"hvs-step-tab-" + i}
            aria-selected={i === step}
            aria-controls="hvs-step-panel"
            tabIndex={i === step ? 0 : -1}
            onClick={() => dp({ type: "STEP", payload: i })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dp({ type: "STEP", payload: i });
              }
            }}
            style={{ padding: "0.75rem clamp(10px, 1.2vw, 18px)", cursor: "pointer", borderBottom: "2px solid " + (i === step ? K.cy : "transparent"), display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", background: i === step ? K.cy + "08" : "transparent" }}
          >
            <span style={{ width: 26, height: 26, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: 700, background: i < step ? K.gn : i === step ? K.cy : K.bd, color: i <= step ? "#fff" : K.mu }} aria-hidden="true">{i < step ? "✓" : i + 1}</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: i === step ? 700 : 400, color: i === step ? K.tx : i < step ? K.gn : K.mu, whiteSpace: "nowrap" }}>{s.l}</span>
          </div>
        ))}
      </div>
      <div className="hvs-slide" id="hvs-step-panel" role="tabpanel" aria-labelledby={"hvs-step-tab-" + step} style={{ padding: "clamp(16px, 2vw, 28px) clamp(16px, 3vw, 40px)", maxWidth: "min(1720px, calc(100vw - 16px))", margin: "0 auto", paddingBottom: "clamp(72px, 12vh, 100px)", width: "100%", boxSizing: "border-box" }}>
        <ErrorBoundary label={"Step " + (step + 1) + ": " + STEPS_DEF[step]?.l}><StepComponent /></ErrorBoundary>
      </div>
      <div className="hvs-glass" style={{ position: "fixed", bottom: 0, left: 0, right: 0, borderTop: "1px solid " + K.bd, padding: "0.75rem clamp(16px, 3vw, 36px)", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50 }}>
        {btn("← Back", () => dp({ type: "STEP", payload: Math.max(0, step - 1) }), "ghost", step === 0, { ariaLabel: "Go to previous workflow step" })}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} aria-hidden="true">
          {STEPS_DEF.map((_, i) => <div key={i} style={{ width: i === step ? 16 : 6, height: 6, borderRadius: 3, background: i < step ? K.gn : i === step ? K.cy : K.bd, transition: "all 0.3s" }} />)}
          <span style={{ fontSize: "0.8125rem", color: K.mu, marginLeft: 8 }}>Ctrl+Z undo | ←→ zones</span>
        </div>
        {step < 4 ? btn("Next →", () => dp({ type: "STEP", payload: step + 1 }), "primary", !canNext, { ariaLabel: "Go to next workflow step" }) :
          step === 4 ? btn(
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconBolt size={18} title="" />
              Run Analysis
            </span>,
            () => runFullAnalysis(),
            "accent",
            !zones.some(z => z.on) || !!analysisProgress,
            { ariaLabel: "Run full analysis on all candidate zones", busy: !!analysisProgress }
          ) :
            btn("New Project", () => dp({ type: "RESET" }), "ghost", false, { ariaLabel: "Start a new empty project" })}
      </div>
      {analysisProgress && (
        <div
          className="hvs-analysis-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="hvs-analysis-title"
          aria-describedby="hvs-analysis-status"
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(3,8,16,0.82)",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="hvs-card" style={{ width: "min(420px, 90vw)", padding: 24, border: "1px solid rgba(56,189,248,0.35)" }}>
            <h2 id="hvs-analysis-title" style={{ margin: "0 0 12px", fontSize: "1.125rem", fontWeight: 800, color: K.tx }}>Running analysis</h2>
            <p id="hvs-analysis-status" style={{ margin: "0 0 12px", fontSize: "0.9375rem", color: K.dm }}>
              Scoring zones… {analysisProgress.current} / {analysisProgress.total}
            </p>
            <div style={{ height: 8, background: K.rs, borderRadius: 4, overflow: "hidden", border: "1px solid " + K.bd }} aria-hidden="true">
              <div style={{
                height: "100%",
                width: analysisProgress.total ? (100 * analysisProgress.current / analysisProgress.total) + "%" : "0%",
                background: "linear-gradient(90deg, #2563eb, #06b6d4)",
                borderRadius: 4,
                transition: "width 0.15s ease-out",
              }} />
            </div>
            <p className="sr-only" aria-live="polite">
              Progress {analysisProgress.current} of {analysisProgress.total} zones
            </p>
          </div>
        </div>
      )}
    </div>
    </HvsContext.Provider>
  );
}
