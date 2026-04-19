import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pdf } from "@react-pdf/renderer";
import html2canvas from "html2canvas";
import { HelivertiPdfDocument } from "./HelivertiPdfDocument.jsx";
import { WindRose } from "../components/charts/WindRose.jsx";
import { checkCompliance } from "../engine/compliance.js";
import { getReportTemplate } from "./reportTemplates.js";

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function captureMapImage(containerEl) {
  if (!containerEl) return null;
  try {
    const canvas = await html2canvas(containerEl, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      logging: false,
      backgroundColor: "#0f172a",
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Map screenshot failed:", e);
    return null;
  }
}

export async function staticOsmMapDataUrl(lat, lng, zoom = 15) {
  const u = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=1024x576&maptype=mapnik`;
  try {
    const res = await fetch(u);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/** Root <svg> must include xmlns or browsers may fail to rasterize to canvas. */
function ensureSvgXmlns(svgString) {
  if (/xmlns\s*=/.test(svgString)) return svgString;
  return svgString.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
}

function svgToPngDataUrl(svgString, w, h) {
  const fixed = ensureSvgXmlns(svgString);
  const rasterize = (img) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL("image/png");
  };
  const load = (src, revoke) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          if (revoke) revoke();
          resolve(rasterize(img));
        } catch (e) {
          if (revoke) revoke();
          reject(e);
        }
      };
      img.onerror = () => {
        if (revoke) revoke();
        reject(new Error("svg load"));
      };
      img.src = src;
    });
  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(fixed);
  return load(dataUrl).catch(() => {
    const blob = new Blob([fixed], { type: "image/svg+xml;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    return load(u, () => URL.revokeObjectURL(u));
  });
}

export async function buildWindRosePng(zone) {
  if (!zone?.wind) return null;
  try {
    const svg = renderToStaticMarkup(React.createElement(WindRose, { zone, ori: zone.sc?.ori, size: 240 }));
    return await svgToPngDataUrl(svg, 240, 240);
  } catch (e) {
    console.warn("Wind rose PNG failed:", e);
    return null;
  }
}

export function buildComparisonRows(scenarios, proj, site, zones) {
  const rows = [{ scenarioName: "Current", proj, site, zones }];
  for (const sc of scenarios || []) {
    rows.push({ scenarioName: sc.name || "Scenario", proj: sc.proj, site: sc.site, zones: sc.zones });
  }
  return rows.map((r) => {
    const best = [...(r.zones || [])].filter((z) => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0];
    const comp = best ? checkCompliance(best, r.proj, r.site) : null;
    return {
      scenarioName: r.scenarioName,
      siteNm: r.site?.nm || "—",
      bestLb: best?.lb ?? "—",
      score: best?.sc?.tot,
      grade: best?.sc?.gr,
      compliant: comp ? comp.compliant : false,
    };
  });
}

/**
 * @param {object} opts
 * @param {string} opts.templateId
 * @param {object} opts.proj
 * @param {object} opts.site
 * @param {object[]} opts.zones
 * @param {object[]} opts.scenarios
 * @param {object} opts.bestZone
 * @param {object[]} opts.rankedAll
 * @param {object} opts.hl
 * @param {number} opts.D
 * @param {object} opts.G
 * @param {string} opts.pcLabel
 * @param {object} opts.wt
 * @param {object} opts.comp
 * @param {object} opts.confBest
 * @param {object[]} opts.recs
 * @param {string|null} opts.mapImage
 * @param {string|null} [opts.sitePlanImage]
 * @param {string|null} [opts.ols3dImage]
 * @param {string} [opts.preparedBy]
 */
export async function downloadHeliPdfReport(opts) {
  const template = getReportTemplate(opts.templateId);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  let mapImage = opts.mapImage;
  if (template.sections.mapImage && !mapImage && opts.site?.lat && opts.site?.lng) {
    mapImage = await staticOsmMapDataUrl(opts.site.lat, opts.site.lng);
  }
  let windRoseImage = opts.windRoseImage;
  if (template.sections.wind && !windRoseImage && opts.bestZone) {
    windRoseImage = await buildWindRosePng(opts.bestZone);
  }
  const comparisonRows = template.sections.comparisonTable ? buildComparisonRows(opts.scenarios, opts.proj, opts.site, opts.zones) : [];

  const doc = (
    <HelivertiPdfDocument
      template={template}
      proj={opts.proj}
      site={opts.site}
      zones={opts.zones}
      scenarios={opts.scenarios}
      bestZone={opts.bestZone}
      rankedAll={opts.rankedAll}
      hl={opts.hl}
      D={opts.D}
      G={opts.G}
      pcLabel={opts.pcLabel}
      wt={opts.wt}
      comp={opts.comp}
      confBest={opts.confBest}
      recs={opts.recs || []}
      mapImage={mapImage}
      sitePlanImage={opts.sitePlanImage ?? null}
      ols3dImage={opts.ols3dImage ?? null}
      windRoseImage={windRoseImage}
      preparedBy={opts.preparedBy || "Heli-VertiSafe (automated export)"}
      today={today}
      comparisonRows={comparisonRows}
    />
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(opts.proj?.nm || "HelivertiSafe_report").replace(/\s+/g, "_")}_${template.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
