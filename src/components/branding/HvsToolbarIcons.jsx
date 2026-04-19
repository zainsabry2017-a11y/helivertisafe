import React from "react";

function baseSvg(size, title, children) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Auto-save / cloud sync indicator */
export function IconCloudSaved({ size = 18, title = "Auto-save active" }) {
  return baseSvg(size, title, (
    <>
      <path d="M6 18h12a4 4 0 0 0 0-8 5 5 0 0 0-9.7-1.5A3.5 3.5 0 0 0 6 11a4 4 0 0 0 0 8z" opacity={0.95} />
      <path d="m9 12 2 2 4-4" strokeWidth="1.85" />
    </>
  ));
}

/** Export project (JSON) — upload from tray */
export function IconExportProject({ size = 18, title = "Export project" }) {
  return baseSvg(size, title, (
    <>
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M12 4v10" />
      <path d="m8 8 4-4 4 4" />
    </>
  ));
}

/** Import project — download to tray */
export function IconImportProject({ size = 18, title = "Import project" }) {
  return baseSvg(size, title, (
    <>
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M12 3v11" />
      <path d="m8 11 4 4 4-4" />
    </>
  ));
}

export function IconUndo({ size = 18, title = "Undo" }) {
  return baseSvg(size, title, (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ));
}

export function IconRedo({ size = 18, title = "Redo" }) {
  return baseSvg(size, title, (
    <>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3-2.7" />
    </>
  ));
}

export function IconDownload({ size = 18, title = "Download" }) {
  return baseSvg(size, title, (
    <>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 21h16" />
    </>
  ));
}

export function IconPdfFile({ size = 18, title = "PDF document" }) {
  return baseSvg(size, title, (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h6" strokeWidth="1.4" />
    </>
  ));
}

export function IconPrint({ size = 18, title = "Print" }) {
  return baseSvg(size, title, (
    <>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </>
  ));
}

export function IconHtmlFile({ size = 18, title = "HTML file" }) {
  return baseSvg(size, title, (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 12h2l1 3 1-6 1 6 1-3h2" strokeWidth="1.35" />
    </>
  ));
}

/** Word / DOCX export */
export function IconDocxFile({ size = 18, title = "Word document" }) {
  return baseSvg(size, title, (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h6M8 9h5" strokeWidth="1.4" />
    </>
  ));
}

export function IconBolt({ size = 18, title = "Run analysis" }) {
  return baseSvg(size, title, <path d="M13 2 3 14h7l-1 8 11-12h-7l1-8z" strokeWidth="1.75" />);
}

export function IconSaveAnalysis({ size = 18, title = "Save analysis" }) {
  return baseSvg(size, title, (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </>
  ));
}

export function IconClipboardList({ size = 18, title = "Saved scenarios" }) {
  return baseSvg(size, title, (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <path d="M9 12h6M9 16h6M9 8h2" strokeWidth="1.4" />
    </>
  ));
}

export function IconRefreshSite({ size = 18, title = "New site" }) {
  return baseSvg(size, title, (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 4" />
      <path d="M21 3v6h-6" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 20" />
      <path d="M8 21H3v-5" />
    </>
  ));
}

export function IconMapPin({ size = 16, title = "Location" }) {
  return baseSvg(size, title, (
    <>
      <path d="M12 21s7-4.35 7-11a7 7 0 0 0-14 0c0 6.65 7 11 7 11z" />
      <circle cx="12" cy="10" r="2" strokeWidth="1.5" />
    </>
  ));
}

export function IconTrash({ size = 16, title = "Delete" }) {
  return baseSvg(size, title, (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" strokeWidth="1.4" />
    </>
  ));
}

/** Best zone / primary recommendation */
export function IconAward({ size = 20, title = "Recommendation" }) {
  return baseSvg(size, title, (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </>
  ));
}

/** FATO heading / orientation */
export function IconCompass({ size = 20, title = "Heading" }) {
  return baseSvg(size, title, (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.2 7.8-2.3 6.9-6.9 2.3 2.3-6.9 6.9-2.3z" strokeWidth="1.4" />
    </>
  ));
}

/** Wind alignment */
export function IconWind({ size = 20, title = "Wind" }) {
  return baseSvg(size, title, (
    <>
      <path d="M4 10h12a2 2 0 1 0-2-2" />
      <path d="M6 16h12a2 2 0 1 1 2 2" />
      <path d="M8 6h10a2 2 0 1 1-2 2" opacity={0.85} />
    </>
  ));
}

/** Obstacle / construction */
export function IconBarrier({ size = 20, title = "Obstacles" }) {
  return baseSvg(size, title, (
    <>
      <path d="M4 15h16" />
      <path d="M8 15V9M12 15V5M16 15v-4" strokeWidth="1.5" />
      <path d="m3 20 18-18" opacity={0.9} />
    </>
  ));
}

/** Terrain / slope */
export function IconTerrain({ size = 20, title = "Terrain" }) {
  return baseSvg(size, title, (
    <>
      <path d="m2 18 4-6 4 3 4-8 4 5 4-4 2 10H2z" strokeWidth="1.45" />
      <path d="M10 10v2" strokeWidth="1.25" opacity={0.7} />
    </>
  ));
}

/** Environment / sensitivity */
export function IconSensitivity({ size = 20, title = "Sensitivity" }) {
  return baseSvg(size, title, (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 10v4M12 9v7M15 8v8" strokeWidth="1.35" />
    </>
  ));
}

/** Close scores — balance / compare */
export function IconBalance({ size = 20, title = "Close match" }) {
  return baseSvg(size, title, (
    <>
      <path d="M12 3v18" />
      <path d="M5 3h14" />
      <path d="m5 3-3 5h6L5 3z" strokeWidth="1.45" />
      <path d="m19 3-3 5h6l-3-5z" strokeWidth="1.45" />
      <path d="M5 21c1.5-2.5 3.5-4 7-4s5.5 1.5 7 4" opacity={0.9} />
    </>
  ));
}

export function IconStatusSuccess({ size = 18, title = "OK" }) {
  return baseSvg(size, title, (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" strokeWidth="1.85" />
    </>
  ));
}

export function IconStatusWarning({ size = 18, title = "Warning" }) {
  return baseSvg(size, title, (
    <>
      <path d="M12 9v4" strokeWidth="1.85" />
      <path d="M12 17h.01" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10.3 3.3h3.4L22 18.5a1 1 0 0 1-.9 1.5H2.9a1 1 0 0 1-.9-1.5L10.3 3.3z" strokeWidth="1.45" />
    </>
  ));
}

export function IconStatusDanger({ size = 18, title = "Alert" }) {
  return baseSvg(size, title, (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5" strokeWidth="1.85" />
      <path d="M12 17h.01" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ));
}

export function IconStatusInfo({ size = 18, title = "Info" }) {
  return baseSvg(size, title, (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-1M12 12V8" strokeWidth="1.75" />
    </>
  ));
}

export function IconLayersCompare({ size = 18, title = "Compare sites" }) {
  return baseSvg(size, title, (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .6.91l8.6 3.92a2 2 0 0 0 1.65 0l8.58-3.91A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .6.91l8.6 3.92a2 2 0 0 0 1.65 0l8.58-3.91A1 1 0 0 0 22 17" opacity={0.85} />
    </>
  ));
}

/** Step badge numbers (1–4) for workflow cards — no emoji */
export function IconStepBadge({ n, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity={0.35} />
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {n}
      </text>
    </svg>
  );
}
