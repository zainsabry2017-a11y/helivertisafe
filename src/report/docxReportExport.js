import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { WT } from "../data/constants.js";
import { calcGeom, getHeli, getPc, getXwLim, WORKFLOW_STATES } from "../data/models.js";
import { checkCompliance } from "../engine/compliance.js";
import { calcConfidence } from "../engine/confidence.js";
import { calcResponseTime } from "../engine/responseTime.js";
import { zonePadCenter } from "../engine/geometry.js";
import { localToLatLng } from "../utils/mapGeo.js";

const LEGACY_REC_ICON = {
  "🏆": "recommendation",
  "🧭": "heading",
  "💨": "wind",
  "🚧": "obstacle",
  "⛰": "terrain",
  "🏘": "sensitivity",
  "⚖️": "close_match",
  "⚖": "close_match",
};

function resolveRecType(rec) {
  if (rec?.recType) return rec.recType;
  if (rec?.icon && LEGACY_REC_ICON[rec.icon]) return LEGACY_REC_ICON[rec.icon];
  return "note";
}

function recPdfPrefix(rec) {
  const t = resolveRecType(rec);
  const map = {
    recommendation: "Best zone",
    heading: "Heading",
    wind: "Wind",
    obstacle: "Obstacles",
    terrain: "Terrain",
    sensitivity: "Sensitivity",
    close_match: "Comparison",
    note: "Note",
  };
  return map[t] || "Note";
}

function run(text, opts = {}) {
  return new TextRun({ text: String(text ?? "—"), ...opts });
}

function p(text, spacing = { after: 160 }) {
  return new Paragraph({ spacing, children: [run(text)] });
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
  });
}

function cellPara(text, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [run(text, bold ? { bold: true } : {})],
      }),
    ],
  });
}

function tableFromMatrix(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => cellPara(h, true)),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: r.map((c) => cellPara(c)),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...body],
  });
}

/**
 * Builds a .docx matching the on-screen report (text & tables; no embedded images).
 */
export async function downloadHeliReportDocx({
  proj,
  site,
  zones,
  rankedAll,
  bestZ,
  today,
  hl,
  D,
  recs,
}) {
  if (!bestZ?.sc) return;

  const pc = getPc(proj);
  const G = calcGeom(proj);
  const wt = proj.wt || WT;
  const bOri = bestZ.sc.ori;
  const bObs = bestZ.sc.bd.obs;
  const excluded = zones.filter((z) => !z.on);
  const comp = checkCompliance(bestZ, proj, site);
  const confBest = calcConfidence(bestZ);
  const wf = WORKFLOW_STATES.find((s) => s.v === (proj.workflow || "draft")) || WORKFLOW_STATES[0];

  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [run("HELI-VERTISAFE SITE INTELLIGENCE", { bold: true, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [run("Helipad Feasibility Assessment", { bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [run(proj.nm || "Project", { size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        run(`Prepared for: ${proj.cl || "—"} | Date: ${today}`, { size: 20, color: "666666" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        run(`Ref: ICAO Annex 14 Vol II | GACAR Part 138 | ${pc.label}`, { italics: true, size: 18, color: "666666" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [run(`Status: ${wf.l}`, { bold: true, size: 20 })],
    })
  );

  children.push(h1("1. Executive Summary"));
  children.push(
    p(
      `This report presents the findings of a multi-criteria helipad site feasibility assessment for ${proj.nm} at ${site.nm} (Lat ${site.lat.toFixed(4)}°, Lng ${site.lng.toFixed(4)}°, Elev ${site.elev}m AMSL). The study evaluated ${rankedAll.length} candidate zone(s) across a ${site.sw}m × ${site.sh}m study area using the ${hl.nm} (D-value = ${D}m) as the design helicopter under ${pc.label} operations.`
    )
  );
  children.push(
    p(`RECOMMENDATION: Zone ${bestZ.lb} — Score ${bestZ.sc.tot}/100 (Grade ${bestZ.sc.gr}). ${bestZ.sc.rec || ""}`)
  );
  if (bOri) {
    children.push(
      p(
        `Optimal FATO heading: ${bOri.hp} (${bOri.us}% wind usability, max crosswind ${bOri.xm}kt).`
      )
    );
  }
  if (excluded.length > 0) {
    children.push(p(`${excluded.length} zone(s) were excluded from analysis.`));
  }

  children.push(h1("2. Site Information"));
  children.push(
    tableFromMatrix(
      ["Field", "Value"],
      [
        ["Site Name", site.nm],
        ["Coordinates", `${site.lat.toFixed(4)}° / ${site.lng.toFixed(4)}°`],
        ["Elevation", `${site.elev}m AMSL`],
        ["Study Area", `${site.sw}m × ${site.sh}m`],
        ["Project Type", proj.pt || "—"],
        ["Grid", `${site.gc}×${site.gr} (${zones.length} zones)`],
        ["Mag. Declination", `${site.md}°`],
        ["Ref. Temperature", `${site.rt}°C`],
      ]
    )
  );

  const dests = site.destinations || [];
  const hasDest = dests.length > 0;
  const hasObsTable = (bObs.pens?.length || 0) > 0;
  const nDesign = hasDest ? 4 : 3;
  const nZone = hasDest ? 5 : 4;
  const nRecZ = hasDest ? 6 : 5;
  const nObs = hasDest ? 7 : 6;
  const nRecAct = hasObsTable ? (hasDest ? 8 : 7) : (hasDest ? 7 : 6);
  const nDataQ = hasObsTable ? (hasDest ? 9 : 8) : (hasDest ? 8 : 7);
  const nComp = hasObsTable ? (hasDest ? 10 : 9) : (hasDest ? 9 : 8);

  if (dests.length > 0) {
    children.push(h1("3. Response Time Analysis"));
    const rtHeaders = ["Destination", "Type", "Distance", "Flight Speed", "Flight Time", "Ground / Car", "Total Time", "Requirement", "Status"];
    const rtRows = dests.map((d) => {
      const rt = calcResponseTime(d, site.lat, site.lng);
      return [
        d.nm || "—",
        d.tp || "—",
        rt ? `${rt.distKm} km` : "—",
        rt ? `${rt.cruiseKt} kt` : `${d.cruiseKt || 120} kt`,
        rt ? `${rt.flightMin} min` : "—",
        rt ? (rt.groundMin > 0 ? `${rt.groundMin} min` : "0 min") : "—",
        rt ? `${rt.totalMin} min` : "—",
        d.maxMinutes > 0 ? `≤ ${d.maxMinutes} min` : "—",
        rt && d.maxMinutes > 0 ? (rt.meetsReq ? "MEETS" : "EXCEEDS") : "—",
      ];
    });
    children.push(tableFromMatrix(rtHeaders, rtRows));
    children.push(
      p(
        `Total Mission Time = Startup (3 min spool-up) + Flight Time (${hl.nm} @ cruise knots) + Approach (2 min pattern) + Ground / Car transfer.`,
        { after: 240 }
      )
    );
  }

  children.push(h1(`${nDesign}. Design Parameters`));
  children.push(
    tableFromMatrix(
      ["Parameter", "Value"],
      [
        ["Design Helicopter", hl.nm],
        ["D-value", `${D}m`],
        ["MTOW", `${hl.mtow} kg`],
        ["Category", hl.cat],
        ["XW Limit", `${getXwLim(proj)} kt`],
        ["Performance Class", pc.label],
        ["FATO", `${G.fato.toFixed(1)}m × ${G.fato.toFixed(1)}m`],
        ["TLOF", `${G.tlof.toFixed(1)}m`],
        ["Safety Area", `${G.sa.toFixed(1)}m (min)`],
        ["Total Footprint", `${G.tot.toFixed(1)}m × ${G.tot.toFixed(1)}m`],
      ]
    )
  );

  children.push(h1(`${nZone}. Zone Comparison`));
  children.push(
    tableFromMatrix(
      ["#", "Zone", "Wind", "OBS", "Ter", "Acc", "Geo", "Env", "Tot", "Gr", "Conf"],
      rankedAll.map((z, i) => {
        const c = calcConfidence(z);
        return [
          String(i + 1),
          z.lb,
          String(z.sc.bd.wind.s),
          String(z.sc.bd.obs.s),
          String(z.sc.bd.ter.s),
          String(z.sc.bd.acc.s),
          String(z.sc.bd.geo.s),
          String(z.sc.bd.env.s),
          String(z.sc.tot),
          z.sc.gr,
          `${c.overall}%`,
        ];
      })
    )
  );
  children.push(
    p(
      `Weights: Wind ${wt.wind * 100}% | Obstacles ${wt.obs * 100}% | Terrain ${wt.ter * 100}% | Access ${wt.acc * 100}% | Geometry ${wt.geo * 100}% | Environment ${wt.env * 100}%`
    )
  );

  children.push(h1(`${nRecZ}. Recommended Zone — ${bestZ.lb}`));
  const recRows = [
    ["Score", `${bestZ.sc.tot} / 100`],
    ["Grade", bestZ.sc.gr],
  ];
  const padC = zonePadCenter(bestZ);
  const padGeo = localToLatLng(site, padC.x, padC.y);
  recRows.push(
    ["Pad center (local)", `${padC.x.toFixed(1)}, ${padC.y.toFixed(1)} m`],
    ["Pad center (geo)", `${padGeo.lat.toFixed(5)}°, ${padGeo.lng.toFixed(5)}°`]
  );
  if (bOri) {
    recRows.push(
      ["Optimal Heading", `${bOri.hp} (${bOri.oh}° / ${bOri.oh + 180}°)`],
      ["Wind Usability", `${bOri.us}% (${bOri.ok ? "OK" : "Review"})`],
      ["Max Crosswind", `${bOri.xm}kt (limit ${bOri.lim}kt)`]
    );
  }
  recRows.push(
    ["Zone Size", `${bestZ.bw.toFixed(0)}m × ${bestZ.bh.toFixed(0)}m`],
    ["Slope", `${bestZ.ter.slope}% (side: ${bestZ.ter.side}%)`],
    ["Soil", bestZ.ter.soil || "—"],
    ["Road Access", bestZ.acc.road ? `Yes (${bestZ.acc.rd}m)` : "No"],
    ["Building Clearance", `${bestZ.acc.bd}m`]
  );
  children.push(tableFromMatrix(["Field", "Value"], recRows));

  children.push(h2("Score breakdown"));
  const bdLabels = {
    wind: "Wind Analysis",
    obs: "Obstacle Clearance",
    ter: "Terrain Suitability",
    acc: "Accessibility",
    geo: "Zone Geometry",
    env: "Environmental Sensitivity",
  };
  for (const k of ["wind", "obs", "ter", "acc", "geo", "env"]) {
    const label = bdLabels[k];
    const sc = bestZ.sc.bd[k];
    children.push(p(`${label} (${(wt[k] * 100).toFixed(0)}% weight): ${sc.s}/100`));
    for (const line of sc.R || []) {
      children.push(new Paragraph({ spacing: { after: 80, left: 400 }, children: [run(`• ${line}`, { color: "666666" })] }));
    }
  }

  if (hasObsTable) {
    children.push(h1(`${nObs}. Obstacle Analysis — ${bestZ.lb}`));
    children.push(
      tableFromMatrix(
        ["Obstacle", "Height", "Distance", "Bearing", "H/D", "Approach Lim", "Status"],
        bObs.pens.map((pen) => [
          pen.nm || "—",
          `${pen.h}m`,
          `${pen.d}m`,
          `${pen.br}°`,
          String(pen.ratio),
          `${pen.a18}m`,
          pen.p18 ? `PENETRATES (+${pen.ex}m)` : pen.p12 ? "PEN 1:2" : "CLEAR",
        ])
      )
    );
  }

  children.push(h1(`${nRecAct}. Recommendations & Actions`));
  for (const r of recs || []) {
    const prefix = recPdfPrefix(r);
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          run(`[${prefix}] `, { bold: true }),
          run(r.text || ""),
        ],
      })
    );
    if (r.detail) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [run(r.detail, { color: "555555" })],
        })
      );
    }
  }

  children.push(h1(`${nDataQ}. Data Quality & Confidence`));
  children.push(p(`Overall ${confBest.overall}% — ${confBest.grade} (${bestZ.lb})`));
  children.push(
    tableFromMatrix(
      ["Category", "Data source", "Score", "Status"],
      ["wind", "obstacles", "terrain", "access"].map((cat) => {
        const d = confBest.details[cat];
        const st = d.score >= 70 ? "RELIABLE" : d.score >= 40 ? "VERIFY" : "INSUFFICIENT";
        return [cat, d.srcLabel, `${d.score}%`, st];
      })
    )
  );
  for (const f of confBest.flags || []) {
    children.push(p(`Flag: ${f}`));
  }

  children.push(h1(`${nComp}. Regulatory Compliance Matrix`));
  children.push(
    p(`${comp.compliant ? "COMPLIANT" : "NON-COMPLIANT"} — ${comp.summary.passed} pass | ${comp.summary.failed} fail | ${comp.summary.warned} warn`)
  );
  children.push(
    tableFromMatrix(
      ["Status", "Category", "Reference", "Requirement", "Finding"],
      comp.checks.map((c) => [c.status, c.cat, c.ref, c.rule, c.detail])
    )
  );

  const heli = getHeli(proj);
  if (proj.mode === "vertiport" || proj.facility === "vertiport" || heli.tp === "evtol") {
    const vz = bestZ;
    const vp = vz.vport || {};
    const vpSec = nComp + 1;
    children.push(h1(`${vpSec}. Vertiport / eVTOL Assessment`));
    children.push(
      tableFromMatrix(
        ["Field", "Value"],
        [
          ["Aircraft Type", heli.tp === "evtol" ? "eVTOL" : "Helicopter"],
          ["Number of Pads", String(vp.pads || 1)],
          ["Charging", vp.charging ? `Yes (${vp.chargePoints || 0} points)` : "No"],
          ["Turnaround", `${vp.turnaround || 10} min`],
          ["Passenger Flow", vp.paxFlow || "walk"],
          ["Terminal", vp.terminal ? "Connected" : "Standalone"],
          [
            "Est. Throughput",
            `${Math.round((60 / (vp.turnaround || 10)) * (vp.pads || 1))} ops/hr`,
          ],
          ...(heli.pax ? [["Pax/Flight", String(heli.pax)]] : []),
        ]
      )
    );
  }

  if ((proj.auditLog || []).length > 0) {
    children.push(h1("Project audit trail"));
    children.push(
      tableFromMatrix(
        ["Date/Time", "Action", "Details"],
        proj.auditLog.map((log) => [
          new Date(log.ts).toLocaleString("en-GB"),
          log.action || "—",
          log.detail || "—",
        ])
      )
    );
  }

  children.push(h1("Assumptions & limitations"));
  const bullets = [
    "Wind data based on input frequencies; full wind rose study recommended for detailed design.",
    "Obstacle positions are approximate; topographic survey required to confirm distances and heights.",
    "Terrain slopes are estimated; geotechnical investigation required for foundation design.",
    "OLS analysis uses simplified 2D cross-section; full 3D OLS assessment per ICAO Annex 14 Vol II required.",
    "Scoring weights may be adjusted based on project-specific priorities.",
    "This assessment does not replace formal authority approval per GACAR Part 138.",
  ];
  for (const b of bullets) {
    children.push(new Paragraph({ spacing: { after: 80 }, children: [run(`• ${b}`, { color: "555555" })] }));
  }

  children.push(
    new Paragraph({
      spacing: { before: 400, after: 120 },
      children: [run(`Generated by Heli-VertiSafe — ${today}`, { italics: true, color: "888888" })],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const name = (proj.nm || "HeliVertiSafe").replace(/\s+/g, "_") + "_Report.docx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
