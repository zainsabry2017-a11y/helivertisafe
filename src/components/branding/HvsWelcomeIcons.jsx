import React, { useId } from "react";

function useStrokeGradient() {
  const uid = useId().replace(/:/g, "");
  const id = "hvs-wicon-" + uid;
  const href = "url(#" + id + ")";
  const Defs = () => (
    <defs>
      <linearGradient id={id} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38bdf8" />
        <stop offset="0.48" stopColor="#2563eb" />
        <stop offset="1" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
  );
  return { href, Defs };
}

function IconStroke({ title, size, children }) {
  const { href, Defs } = useStrokeGradient();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title}>
      <title>{title}</title>
      <Defs />
      <g stroke={href} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {children}
      </g>
    </svg>
  );
}

/** Hospital / EMS helipad */
export function IconHospital({ size = 26, title = "Hospital helipad" }) {
  return (
    <IconStroke title={title} size={size}>
      <path d="M12 3v3M10.5 4.5h3" />
      <rect x="6" y="9" width="12" height="12" rx="1.5" />
      <path d="M12 12v6M9 15h6" />
      <path d="M4 21h16" opacity="0.85" />
    </IconStroke>
  );
}

/** Offshore platform / helideck */
export function IconOffshore({ size = 26, title = "Offshore platform" }) {
  return (
    <IconStroke title={title} size={size}>
      <path d="M3 18h18" />
      <path d="M5 18l2.5-5h9l2.5 5" />
      <rect x="9" y="8" width="6" height="5" rx="0.5" />
      <path d="M12 6v2" />
      <path d="M7 14h10" opacity="0.7" />
    </IconStroke>
  );
}

/** Military / government */
export function IconMilitary({ size = 26, title = "Military / government" }) {
  return (
    <IconStroke title={title} size={size}>
      <path d="M12 2l8 4v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V6l8-4z" />
      <path d="M12 8v5M9.5 10.5h5" />
    </IconStroke>
  );
}

/** Corporate building */
export function IconCorporate({ size = 26, title = "Corporate / private" }) {
  return (
    <IconStroke title={title} size={size}>
      <rect x="5" y="4" width="14" height="17" rx="1" />
      <path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15" strokeWidth="1.25" />
      <path d="M3 21h18" />
    </IconStroke>
  );
}

/** eVTOL / electric vertiport — filled bolt + ring */
export function IconVertiport({ size = 26, title = "eVTOL vertiport" }) {
  const uid = useId().replace(/:/g, "");
  const gid = "hvs-wv-" + uid;
  const href = "url(#" + gid + ")";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gid} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.48" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path d="M13 2L3 14h7l-1 8 11-13h-7l1-7z" fill={href} />
      <circle cx="18" cy="6" r="2.5" stroke={href} strokeWidth="1.25" fill="none" opacity="0.55" />
    </svg>
  );
}

/** Custom / blank project — drafting triangle */
export function IconCustom({ size = 26, title = "Custom project" }) {
  return (
    <IconStroke title={title} size={size}>
      <path d="M4 20L20 4v16H4z" />
      <path d="M4 20l8-8" opacity="0.75" />
      <circle cx="17" cy="17" r="1.25" strokeWidth="1.5" />
    </IconStroke>
  );
}

/** Resume / restore session — circular refresh */
export function IconResume({ size = 22, title = "Resume session" }) {
  return (
    <IconStroke title={title} size={size}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 4" />
      <path d="M21 3v6h-6" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 20" />
      <path d="M3 21v-6h6" />
    </IconStroke>
  );
}

/** Explore demo — monitor / viewport */
export function IconDemo({ size = 22, title = "Explore demo" }) {
  return (
    <IconStroke title={title} size={size}>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M10 10l2 2 4-4" strokeWidth="1.5" />
    </IconStroke>
  );
}

/** Import project — folder + arrow */
export function IconImport({ size = 22, title = "Import project" }) {
  return (
    <IconStroke title={title} size={size}>
      <path d="M4 8h6l2 2h8v10H4V8z" />
      <path d="M12 11v6M9 14l3 3 3-3" />
    </IconStroke>
  );
}

/** Map template id → icon component */
// eslint-disable-next-line react-refresh/only-export-components
export const WELCOME_TEMPLATE_ICONS = {
  hospital: IconHospital,
  offshore: IconOffshore,
  military: IconMilitary,
  corporate: IconCorporate,
  vertiport: IconVertiport,
  custom: IconCustom,
};
