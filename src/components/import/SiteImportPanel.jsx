import React, { useState } from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import {
  HVS_CSV_SAMPLE_SIMPLE,
  HVS_CSV_SAMPLE_FULL,
  HVS_GEOJSON_SAMPLE_SIMPLE,
  downloadTextFile,
} from "../../data/importSamples.js";
import { applySiteFileImport, applySiteImportError } from "../../utils/siteImportApply.js";

function pickFile(accept, onText) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        onText(ev.target.result, f.name);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(f);
  };
  input.click();
}

export function SiteImportPanel() {
  const { K, dp, site, zones, sel, btn } = useHvs();
  const [path, setPath] = useState(null);

  const runImport = (text, name) => {
    try {
      applySiteFileImport(text, name, { site, zones, sel, dp });
    } catch (err) {
      console.error("Import error:", err);
      applySiteImportError(dp, err);
    }
  };

  const ir = site.importResult;

  return (
    <div style={{ background: K.sf, borderRadius: 8, padding: 14, border: "1px solid " + K.cy + "33", marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: K.tx, marginBottom: 4 }}>Add data from a file</div>
      <p style={{ fontSize: 11, color: K.dm, margin: "0 0 12px", lineHeight: 1.5 }}>
        Choose what you have — we&apos;ll keep choices simple. You can always draw on the map instead.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className="hvs-card"
          onClick={() => setPath("sheet")}
          style={{
            textAlign: "left",
            padding: 12,
            border: path === "sheet" ? "2px solid " + K.cy : "1px solid " + K.bd,
            background: path === "sheet" ? K.cy + "12" : "rgba(11,17,32,0.5)",
          }}
          aria-pressed={path === "sheet"}
          aria-label="I have a spreadsheet or table of coordinates"
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: K.tx, marginBottom: 4 }}>Spreadsheet / CSV</div>
          <div style={{ fontSize: 9, color: K.mu, lineHeight: 1.4 }}>Excel export, survey points, obstacle list</div>
        </button>
        <button
          type="button"
          className="hvs-card"
          onClick={() => setPath("map")}
          style={{
            textAlign: "left",
            padding: 12,
            border: path === "map" ? "2px solid " + K.cy : "1px solid " + K.bd,
            background: path === "map" ? K.cy + "12" : "rgba(11,17,32,0.5)",
          }}
          aria-pressed={path === "map"}
          aria-label="I have a map or GIS file"
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: K.tx, marginBottom: 4 }}>Map / GIS file</div>
          <div style={{ fontSize: 9, color: K.mu, lineHeight: 1.4 }}>GeoJSON, Google Earth (KML)</div>
        </button>
        <button
          type="button"
          className="hvs-card"
          onClick={() => setPath("skip")}
          style={{
            textAlign: "left",
            padding: 12,
            border: path === "skip" ? "2px solid " + K.mu : "1px solid " + K.bd,
            background: path === "skip" ? K.mu + "14" : "rgba(11,17,32,0.5)",
          }}
          aria-pressed={path === "skip"}
          aria-label="Skip file import and use the map only"
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: K.tx, marginBottom: 4 }}>Skip for now</div>
          <div style={{ fontSize: 9, color: K.mu, lineHeight: 1.4 }}>Draw the site and zones on the map</div>
        </button>
      </div>

      {path === "sheet" && (
        <div style={{ background: K.rs, borderRadius: 8, padding: 12, marginBottom: 10, border: "1px solid " + K.bd }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: K.cy, marginBottom: 6 }}>CSV — rows are points</div>
          <p style={{ fontSize: 10, color: K.dm, margin: "0 0 8px", lineHeight: 1.5 }}>
            Export from Excel as <strong>CSV (comma-separated)</strong>. You need <strong>X</strong> and <strong>Y</strong> columns (site metres or same units as your map).
            Add <strong>Height</strong> for obstacles; leave height empty for ground survey spots.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {btn("Download simple example", () => downloadTextFile("helivertisafe-example.csv", HVS_CSV_SAMPLE_SIMPLE, "text/csv"), "ghost", false, { ariaLabel: "Download simple CSV example" })}
            {btn("Download full example", () => downloadTextFile("helivertisafe-full-template.csv", HVS_CSV_SAMPLE_FULL, "text/csv"), "ghost", false, { ariaLabel: "Download full CSV template with many columns" })}
            {btn("Choose CSV file…", () => pickFile(".csv,.txt", runImport), "accent", false, { ariaLabel: "Upload CSV file" })}
          </div>
        </div>
      )}

      {path === "map" && (
        <div style={{ background: K.rs, borderRadius: 8, padding: 12, marginBottom: 10, border: "1px solid " + K.bd }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: K.cy, marginBottom: 6 }}>GeoJSON or KML</div>
          <p style={{ fontSize: 10, color: K.dm, margin: "0 0 8px", lineHeight: 1.5 }}>
            Closed shapes usually become site boundary (large), zones (medium), or obstacles (small). <strong>GeoJSON</strong> and <strong>KML</strong> from Google Earth work well.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {btn("Download GeoJSON example", () => downloadTextFile("helivertisafe-example.geojson", HVS_GEOJSON_SAMPLE_SIMPLE, "application/geo+json"), "ghost", false, { ariaLabel: "Download GeoJSON example" })}
            {btn("Choose GeoJSON or KML…", () => pickFile(".geojson,.json,.kml,.xml", runImport), "accent", false, { ariaLabel: "Upload GeoJSON or KML file" })}
          </div>
        </div>
      )}

      {path === "skip" && (
        <div style={{ fontSize: 10, color: K.dm, padding: 8, background: K.pn, borderRadius: 6, marginBottom: 10 }} role="status">
          Use the map above to draw your site boundary and exclusions. You can import a file later anytime from this step.
        </div>
      )}

      <details style={{ marginBottom: 8 }}>
        <summary style={{ fontSize: 10, fontWeight: 700, color: K.mu, cursor: "pointer", userSelect: "none" }}>
          All formats (DXF, WKT, auto-detect) — for CAD / GIS experts
        </summary>
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid " + K.bd, fontSize: 9, color: K.dm, lineHeight: 1.45 }}>
          <p style={{ margin: "0 0 6px" }}>
            <strong>DXF</strong> (AutoCAD), <strong>WKT</strong>, and mixed <strong>CSV</strong>/<strong>JSON</strong> are supported. The app guesses geometry type by size: very large polygons → site boundary;
            medium → zones; small → obstacles.
          </p>
          {btn("Upload any supported file…", () => pickFile(".dxf,.geojson,.json,.kml,.csv,.txt,.wkt", runImport), "ghost", false, { ariaLabel: "Upload DXF GeoJSON KML CSV WKT or JSON" })}
        </div>
      </details>

      {ir && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 8,
            border: "1px solid " + (ir.error ? K.rd + "55" : K.gn + "44"),
            background: ir.error ? K.rd + "0d" : K.gn + "0c",
          }}
          role="status"
          aria-live="polite"
        >
          {ir.error ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: K.rd, marginBottom: 6 }}>Import issue</div>
              <div style={{ fontSize: 10, color: K.tx }}>{ir.error}</div>
              {(ir.plainLines || []).length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 10, color: K.dm }}>
                  {ir.plainLines.map((line, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: K.gn, marginBottom: 6 }}>Import summary</div>
              <div style={{ fontSize: 10, color: K.dm, marginBottom: 8 }}>
                File: <strong style={{ color: K.tx }}>{ir.fileName || ir.format}</strong>
                {ir.format ? " · " + ir.format : ""}
              </div>
              <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 10, color: K.tx, lineHeight: 1.5 }}>
                {(ir.plainLines || []).map((line, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {line}
                  </li>
                ))}
              </ul>
              {(ir.nextSteps || []).length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: K.cy, marginBottom: 4 }}>Suggested next steps</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10, color: K.dm, lineHeight: 1.5 }}>
                    {ir.nextSteps.map((s, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div style={{ fontSize: 9, color: K.mu, marginTop: 10, paddingTop: 8, borderTop: "1px solid " + K.bd }}>
                If something looks wrong, use <strong style={{ color: K.tx }}>Undo</strong> in the top bar (<kbd style={{ background: K.bd, padding: "1px 4px", borderRadius: 3 }}>Ctrl+Z</kbd>
                ) to step back — each click reverses one change.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
