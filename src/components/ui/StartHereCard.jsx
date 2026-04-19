import React from "react";

/**
 * Plain-language onboarding for Project → Site → Zones → Data.
 * @param {{ K: object, variant: "project" | "site" | "zones" | "data", zonesCount?: number, hasSelection?: boolean }} props
 */
export function StartHereCard({ K, variant, zonesCount = 0, hasSelection = false }) {
  const base = {
    border: "1px solid " + K.cy + "44",
    background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(6,182,212,0.06) 100%)",
    borderRadius: 10,
    padding: "1.125rem clamp(14px, 2vw, 22px)",
    marginBottom: "1.125rem",
  };
  const olStyle = { margin: "10px 0 0", paddingLeft: 22, fontSize: "0.9375rem", color: K.tx, lineHeight: 1.6 };
  const liStyle = { marginBottom: 6 };

  if (variant === "project") {
    return (
      <div style={base} role="region" aria-label="How to start — project">
        <div style={{ fontSize: "0.875rem", fontWeight: 800, color: K.cy, letterSpacing: 1.1, marginBottom: 6 }}>START HERE — PROJECT</div>
        <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: K.tx, marginBottom: 6 }}>Name the study and pick the aircraft rules</div>
        <p style={{ fontSize: "0.9375rem", color: K.dm, margin: 0, lineHeight: 1.55 }}>
          This step sets <strong>which helicopter or eVTOL</strong> you design for — that drives runway size and wind limits.
        </p>
        <ol style={olStyle}>
          <li style={liStyle}>
            Enter a <strong>project name</strong> (required). Client and description are optional notes.
          </li>
          <li style={liStyle}>
            Choose <strong>Design aircraft</strong> and <strong>Performance class</strong> — leave defaults if unsure; you can change later.
          </li>
          <li style={liStyle}>
            Press <strong>Next</strong> to define the <strong>site</strong> — the map rectangle where zones will live.
          </li>
        </ol>
      </div>
    );
  }

  if (variant === "site") {
    return (
      <div style={base} role="region" aria-label="How to start — site">
        <div style={{ fontSize: "0.875rem", fontWeight: 800, color: K.cy, letterSpacing: 1.1, marginBottom: 6 }}>START HERE — SITE</div>
        <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: K.tx, marginBottom: 6 }}>Define where you are working</div>
        <p style={{ fontSize: "0.9375rem", color: K.dm, margin: 0, lineHeight: 1.55 }}>
          The <strong>site</strong> is one rectangle: your whole study area in <strong>metres</strong> (width × height). Everything else sits inside it.
        </p>
        <ol style={olStyle}>
          <li style={liStyle}>
            Give the site a <strong>name</strong> and set <strong>Width</strong> and <strong>Height</strong> (e.g. 500×400 m). The map above uses this box.
          </li>
          <li style={liStyle}>
            Add <strong>latitude & longitude</strong> if you know them — they tie the map to the real world and help later steps.
          </li>
          <li style={liStyle}>
            <strong>Optional:</strong> under “Add data from a file”, import coordinates or draw on the map. You can also skip and only use numbers.
          </li>
          <li style={liStyle}>
            Press <strong>Next</strong> at the bottom when the site name is filled in — that unlocks <strong>Zones</strong>.
          </li>
        </ol>
      </div>
    );
  }

  if (variant === "zones") {
    return (
      <div style={base} role="region" aria-label="How to start — zones">
        <div style={{ fontSize: "0.875rem", fontWeight: 800, color: K.cy, letterSpacing: 1.1, marginBottom: 6 }}>START HERE — ZONES</div>
        <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: K.tx, marginBottom: 6 }}>Split the site into candidate areas</div>
        <p style={{ fontSize: "0.9375rem", color: K.dm, margin: 0, lineHeight: 1.55 }}>
          A <strong>zone</strong> is one place you might put a helipad. The app scores each zone you turn <strong>on</strong> (green).
        </p>
        <ol style={olStyle}>
          <li style={liStyle}>
            <strong>Grid:</strong> set columns & rows (or cell size), then click <strong>Generate zones</strong>. Good for comparing many spots.
          </li>
          <li style={liStyle}>
            <strong>Manual:</strong> add polygons yourself if you only care about a few footprints.
          </li>
          <li style={liStyle}>
            Click a zone in the grid to <strong>select</strong> it. Toggle <strong>✓ / ✗</strong> to include or exclude from analysis.
          </li>
          <li style={liStyle}>
            Press <strong>Next</strong> when you have at least one <strong>green (on)</strong> zone — then you can enter <strong>wind & data</strong>.
          </li>
        </ol>
        {zonesCount === 0 && (
          <div style={{ fontSize: "0.875rem", color: K.am, marginTop: 8, padding: 10, background: K.am + "12", borderRadius: 6 }}>
            No zones yet — choose Grid or Manual above, then generate or add zones.
          </div>
        )}
      </div>
    );
  }

  // data
  return (
    <div style={base} role="region" aria-label="How to start — data">
      <div style={{ fontSize: "0.875rem", fontWeight: 800, color: K.cy, letterSpacing: 1.1, marginBottom: 6 }}>START HERE — DATA</div>
      <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: K.tx, marginBottom: 6 }}>Tell the app about wind and obstacles</div>
      <p style={{ fontSize: "0.9375rem", color: K.dm, margin: 0, lineHeight: 1.55 }}>
        Data is entered <strong>per zone</strong>. You do not need everything at once — start with wind and one obstacle type, then refine.
      </p>
      <ol style={olStyle}>
        <li style={liStyle}>
          In the list on the left, <strong>click a zone</strong> (pick one green “candidate” first).
        </li>
        <li style={liStyle}>
          Open tabs: <strong>Wind</strong> → <strong>Obstacles</strong> → <strong>Terrain</strong> → <strong>Access</strong> (and Sensitivity if needed). Green checkmarks show what is filled.
        </li>
        <li style={liStyle}>
          If all zones share the same wind/terrain, use <strong>Fill ALL zones from …</strong> after completing one zone.
        </li>
        <li style={liStyle}>
          When enough is filled, go to <strong>Analysis</strong> and run scoring — or continue to add detail.
        </li>
      </ol>
      {zonesCount === 0 && (
        <div style={{ fontSize: "0.875rem", color: K.rd, marginTop: 8, padding: 10, background: K.rd + "10", borderRadius: 6 }}>
          There are no zones yet. Go back to <strong>Zones</strong>, generate zones, then return here.
        </div>
      )}
      {zonesCount > 0 && !hasSelection && (
        <div style={{ fontSize: "0.875rem", color: K.am, marginTop: 8, padding: 10, background: K.am + "12", borderRadius: 6 }}>
          Select a zone in the grid on the left to edit its data.
        </div>
      )}
    </div>
  );
}
