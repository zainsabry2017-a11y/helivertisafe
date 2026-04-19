import React from "react";
import { HvsLogoHero } from "./branding/HvsLogo.jsx";
import { WELCOME_TEMPLATE_ICONS, IconResume, IconDemo, IconImport } from "./branding/HvsWelcomeIcons.jsx";
import { K } from "../utils/theme.js";
import { PC_DATA, HELIS } from "../data/constants.js";
import { loadAutoSave } from "../state/autoSave.js";

const TEMPLATES = [
  { id: "hospital", nm: "Hospital Helipad", desc: "EMS rooftop or ground-level helipad", dh: "h145", pc: "pc2", facility: "hospital_pad", sw: 300, sh: 300 },
  { id: "offshore", nm: "Offshore Platform", desc: "Oil & gas platform helideck", dh: "s92", pc: "pc2", facility: "heliport", sw: 200, sh: 200 },
  { id: "military", nm: "Military / Government", desc: "Military base or government compound", dh: "bell412", pc: "pc1", facility: "heliport", sw: 500, sh: 500 },
  { id: "corporate", nm: "Corporate / Private", desc: "Office rooftop or estate helipad", dh: "aw139", pc: "pc2", facility: "heliport", sw: 400, sh: 400 },
  { id: "vertiport", nm: "eVTOL Vertiport", desc: "Urban air mobility vertiport", dh: "joby_s4", pc: "pc1", facility: "vertiport", md: "vertiport", sw: 250, sh: 250 },
  { id: "custom", nm: "Custom Project", desc: "Blank project — configure everything", dh: "bell412", pc: "pc2", facility: "heliport", sw: 500, sh: 500 },
];

export default function WelcomeScreen({ dp, setMode, hasAutoSave }) {
  const startProject = (t) => {
    dp({ type: "RESET" });
    if (t.id !== "custom") {
      dp({ type: "UP", payload: { dh: t.dh, pc: t.pc, facility: t.facility, mode: t.md || "feasibility" } });
      dp({ type: "US", payload: { sw: t.sw, sh: t.sh } });
    }
    setMode("app");
  };

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #030810 0%, #050a12 30%, #0a1628 100%)",
        minHeight: "100vh",
        color: K.tx,
        fontFamily: "var(--font-sans), 'Segoe UI', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 3vw, 40px)",
        boxSizing: "border-box",
      }}
    >
      <div className="animate-fadeUp-w" style={{ textAlign: "center", marginBottom: "clamp(28px, 4vw, 48px)", width: "100%", maxWidth: "min(1680px, calc(100vw - 32px))" }}>
        <div className="animate-float-w" style={{ display: "flex", justifyContent: "center", margin: "0 auto clamp(12px, 2vw, 20px)" }}>
          <HvsLogoHero markSize={120} />
        </div>
        <h1 style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.25rem)", fontWeight: 800, letterSpacing: -1.5, margin: "0 0 4px" }}>
          Heli-
          <span
            className="animate-grad-w"
            style={{
              background: "linear-gradient(135deg, #06b6d4, #2563eb)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            VertiSafe
          </span>
        </h1>
        <p style={{ fontSize: "clamp(0.95rem, 1.1vw, 1.15rem)", color: K.cy, fontWeight: 600, letterSpacing: 3, margin: "0 0 12px" }}>SITE INTELLIGENCE PLATFORM</p>
        <p style={{ fontSize: "clamp(1.05rem, 1.25vw, 1.2rem)", color: K.dm, maxWidth: "min(920px, 95vw)", margin: "0 auto", lineHeight: 1.65 }}>
          Helipad & vertiport feasibility analysis — ICAO Annex 14 Vol II / GACAR Part 138 compliant. Score zones, check OLS, generate reports.
        </p>
      </div>
      <div className="animate-fadeUp-w-delay" style={{ maxWidth: "min(1680px, calc(100vw - 32px))", width: "100%" }}>
        <p style={{ fontSize: "clamp(0.95rem, 1.1vw, 1.05rem)", fontWeight: 700, color: K.mu, letterSpacing: 2, textAlign: "center", marginBottom: "clamp(14px, 2vw, 22px)" }}>START A NEW PROJECT</p>
        <div
          className="hvs-welcome-grid"
          style={{
            marginBottom: "clamp(20px, 3vw, 32px)",
          }}
        >
          {TEMPLATES.map((t) => {
            const TemplateIcon = WELCOME_TEMPLATE_ICONS[t.id];
            return (
            <div
              key={t.id}
              className="w-card"
              role="button"
              tabIndex={0}
              aria-label={"Start project: " + t.nm + ". " + t.desc}
              onClick={() => startProject(t)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startProject(t);
                }
              }}
              style={{ padding: "clamp(20px, 2.5vw, 28px)", minHeight: 0 }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, minHeight: 36 }}>
                {TemplateIcon ? <TemplateIcon size={40} /> : null}
              </div>
              <div style={{ fontSize: "clamp(1.05rem, 1.2vw, 1.2rem)", fontWeight: 700, marginBottom: 6 }}>{t.nm}</div>
              <div style={{ fontSize: "clamp(0.9rem, 1vw, 1.05rem)", color: K.dm, lineHeight: 1.5, marginBottom: 12 }}>{t.desc}</div>
              {t.id !== "custom" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "clamp(0.8rem, 0.95vw, 0.9rem)", padding: "4px 10px", borderRadius: 4, background: K.cy + "15", color: K.cy }}>{HELIS.find((h) => h.id === t.dh)?.nm}</span>
                  <span style={{ fontSize: "clamp(0.8rem, 0.95vw, 0.9rem)", padding: "4px 10px", borderRadius: 4, background: K.pu + "15", color: K.pu }}>{PC_DATA[t.pc]?.label}</span>
                </div>
              )}
            </div>
            );
          })}
        </div>
        {hasAutoSave && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <button
              type="button"
              aria-label="Resume last auto-saved session"
              onClick={async () => {
                const d = await loadAutoSave("hvs-autosave");
                if (d) {
                  dp({ type: "IMPORT", payload: d });
                  setMode("app");
                }
              }}
              className="w-btn"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 28px", border: "1px solid " + K.cy + "40", width: "100%", maxWidth: 560 }}
            >
              <span style={{ display: "flex", flexShrink: 0 }}><IconResume size={28} /></span>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: K.cy }}>Resume Last Session</div>
                <div style={{ fontSize: "0.9375rem", color: K.dm }}>Auto-saved project found — continue where you left off</div>
              </div>
            </button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: "clamp(10px, 2vw, 18px)", marginBottom: "clamp(20px, 3vw, 28px)", flexWrap: "wrap" }}>
          <button type="button" aria-label="Explore demo project with sample hospital data" onClick={() => { dp({ type: "DEMO" }); setMode("app"); }} className="w-btn" style={{ display: "flex", alignItems: "center", gap: 12, padding: "clamp(14px, 2vw, 18px) clamp(20px, 3vw, 32px)", minWidth: "min(100%, 320px)" }}>
            <span style={{ display: "flex", flexShrink: 0 }}><IconDemo size={28} /></span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: K.gn }}>Explore Demo</div>
              <div style={{ fontSize: "0.9375rem", color: K.dm }}>Al Arab Hospital — 9 zones, obstacles, wind, sensitivity</div>
            </div>
          </button>
          <button
            type="button"
            aria-label="Import project from a saved JSON file"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json,.hvs.json";
              input.onchange = (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = (ev) => {
                  try {
                    dp({ type: "IMPORT", payload: JSON.parse(ev.target.result) });
                    setMode("app");
                  } catch (err) {
                    console.error(err);
                  }
                };
                r.readAsText(f);
              };
              input.click();
            }}
            className="w-btn"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "clamp(14px, 2vw, 18px) clamp(20px, 3vw, 32px)", minWidth: "min(100%, 320px)" }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}><IconImport size={28} /></span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>Import Project</div>
              <div style={{ fontSize: "0.9375rem", color: K.dm }}>Load a saved .hvs.json file</div>
            </div>
          </button>
        </div>
        <div style={{ textAlign: "center", padding: "clamp(16px, 2vw, 22px) 0", borderTop: "1px solid " + K.bd }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "clamp(10px, 2vw, 20px)", marginBottom: 8, flexWrap: "wrap" }}>
            {["ICAO Annex 14 Vol II", "GACAR Part 138", "Saudi Building Code", "FAA AC 150/5390"].map((s) => (
              <span key={s} style={{ fontSize: "clamp(0.8rem, 0.95vw, 0.95rem)", color: K.mu }}>
                {s}
              </span>
            ))}
          </div>
          <p style={{ fontSize: "clamp(0.8rem, 0.9vw, 0.9rem)", color: K.bd }}>v4.5 — Built for aviation professionals</p>
        </div>
      </div>
    </div>
  );
}
