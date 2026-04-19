import React, { useId } from "react";

// ==========================================
// LOGO CONFIGURATION (MAKE IT UNIQUE)
// ==========================================
// To use the new out-of-the-box generated logo, set useImage to true.
// To use the default original SVG, set useImage to false.
// eslint-disable-next-line react-refresh/only-export-components
export const logoConfig = {
  useImage: true, 
  imageUrl: "/custom-logo.png" 
};

/**
 * Heli-VertiSafe wordmark — aviation / GIS SaaS style (no emoji).
 * Mark: helipad ring + H + rotor — reads at favicon and hero sizes.
 */
export function HvsLogoMark({ size = 80, className, style, title = "Heli-VertiSafe" }) {
  const uid = useId().replace(/:/g, "");
  const gStroke = "hvs-grad-stroke-" + uid;
  const gFill = "hvs-grad-fill-" + uid;
  const gGlow = "hvs-grad-glow-" + uid;

  if (logoConfig.useImage) {
    return <img src={logoConfig.imageUrl} alt={title} width={size} height={size} className={className} style={{ ...style, borderRadius: '22%' }} draggable={false} />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gStroke} x1="8" y1="12" x2="80" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.45" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={gFill} x1="22" y1="18" x2="66" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e3a8a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0e7490" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={gGlow} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(44 38) rotate(90) scale(40 40)">
          <stop stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
        <filter id={"hvs-soft-" + uid} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient glow */}
      <circle cx="44" cy="44" r="38" fill={"url(#" + gGlow + ")"} opacity={0.9} />

      {/* Panel */}
      <rect x="6" y="6" width="76" height="76" rx="22" fill={"url(#" + gFill + ")"} stroke={"url(#" + gStroke + ")"} strokeWidth="1.25" />
      <rect x="6.5" y="6.5" width="75" height="75" rx="21.5" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" fill="none" />

      {/* Rotor — three-blade hint */}
      <g filter={"url(#hvs-soft-" + uid + ")"} stroke={"url(#" + gStroke + ")"} strokeWidth="2" strokeLinecap="round" opacity={0.95}>
        <line x1="44" y1="28" x2="44" y2="14" />
        <line x1="44" y1="28" x2="29" y2="36" />
        <line x1="44" y1="28" x2="59" y2="36" />
      </g>
      <circle cx="44" cy="28" r="3.5" fill={"url(#" + gStroke + ")"} opacity={0.9} />

      {/* Helipad outer ring */}
      <circle cx="44" cy="52" r="24" stroke={"url(#" + gStroke + ")"} strokeWidth="1.75" fill="none" opacity={0.95} />
      <circle cx="44" cy="52" r="15" stroke={"url(#" + gStroke + ")"} strokeWidth="1" strokeDasharray="3 3" fill="none" opacity={0.45} />

      {/* H — ICAO-style marking (legs + crossbar) */}
      <path
        d="M32 40v16M56 40v16M32 48h24"
        stroke={"url(#" + gStroke + ")"}
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Solid mark for print / HTML reports (white or light background).
 * Matches app identity without gradients for reliable PDF/print.
 */
export function HvsLogoMarkReport({ size = 48, title = "Heli-VertiSafe" }) {
  if (logoConfig.useImage) {
    return <img src={logoConfig.imageUrl} alt={title} width={size} height={size} style={{ borderRadius: '22%' }} />;
  }

  const navy = "#1e3a5f";
  const blue = "#2563eb";
  const cyan = "#0891b2";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect x="6" y="6" width="76" height="76" rx="22" fill={navy} stroke={blue} strokeWidth="1.25" />
      <circle cx="44" cy="52" r="24" stroke={cyan} strokeWidth="1.75" />
      <circle cx="44" cy="52" r="15" stroke={cyan} strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />
      <g stroke={blue} strokeWidth="2" strokeLinecap="round" opacity={0.95}>
        <line x1="44" y1="28" x2="44" y2="14" />
        <line x1="44" y1="28" x2="29" y2="36" />
        <line x1="44" y1="28" x2="59" y2="36" />
      </g>
      <circle cx="44" cy="28" r="3.5" fill={blue} />
      <path
        d="M32 40v16M56 40v16M32 48h24"
        stroke={cyan}
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Framed mark for welcome hero — glass panel, no duplicate headings. */
export function HvsLogoHero({ markSize = 88 }) {
  return (
    <div
      style={{
        padding: "clamp(12px, 2.4vw, 20px)",
        borderRadius: 28,
        background: "linear-gradient(165deg, rgba(37,99,235,0.14) 0%, rgba(6,182,212,0.07) 45%, rgba(15,23,42,0.35) 100%)",
        border: "1px solid rgba(148,163,184,0.14)",
        boxShadow: "0 28px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      <HvsLogoMark size={markSize} />
    </div>
  );
}
