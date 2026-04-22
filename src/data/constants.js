// Auto-extracted
// ═══ STANDARDS ═══
/** Performance class OLS / footprint parameters (Annex 14 Vol II style; verify tables in official Annex). */
export const PC_DATA = {
  pc1: {
    label: "PC-1",
    fatoMin: 1, sa: 0.25, maxSlope: 2, maxSA: 4,
    splay: 0.10,
    innerG: 1 / 2, outerG: 1 / 22.22,
    innerLenFactor: 5,
    outerLenM: 260,
    // Approach/departure surface length from Safety Area edge (m)
    appLen: 3386,
    appG: 1 / 22.22, transG: 1 / 2,
    ih: 45,
    ihRadiusM: 3000,
  },
  pc2: {
    label: "PC-2",
    fatoMin: 1, sa: 0.25, maxSlope: 3, maxSA: 4,
    splay: 0.12,
    innerG: 1 / 2, outerG: 1 / 12.5,
    innerLenFactor: 6,
    outerLenM: 280,
    // Approach/departure surface length from Safety Area edge (m)
    appLen: 245,
    appG: 1 / 12.5, transG: 1 / 2,
    ih: 45,
    ihRadiusM: 3500,
  },
  pc3: {
    label: "PC-3",
    fatoMin: 1, sa: 0.25, maxSlope: 3, maxSA: 4,
    splay: 0.15,
    innerG: 1 / 2, outerG: 1 / 8,
    innerLenFactor: 7,
    outerLenM: 300,
    // Approach/departure surface length from Safety Area edge (m)
    appLen: 1220,
    appG: 1 / 8, transG: 1 / 2,
    ih: 45,
    ihRadiusM: 4000,
  },
};
/**
 * Design helicopter library — D (m) ≈ main rotor diameter / regulatory reference dimension; mtow kg; xw kt typical op limit.
 * Verify against AFM / TCDS for operational compliance.
 */
export const HELIS = [
  // —— Sikorsky ——
  { id: "s92", nm: "Sikorsky S-92", D: 20.9, mtow: 12565, cat: "heavy", xw: 25, tp: "heli", len: 20.9, wid: 3.2, rtr: 17.2, dw: "high" },
  { id: "s76d", nm: "Sikorsky S-76D", D: 13.4, mtow: 5300, cat: "medium", xw: 20, tp: "heli", len: 13.4, wid: 2.4, rtr: 13.4, dw: "medium" },
  { id: "s76cpp", nm: "Sikorsky S-76C++", D: 13.4, mtow: 5300, cat: "medium", xw: 20, tp: "heli", len: 13.4, wid: 2.4, rtr: 13.4, dw: "medium" },
  { id: "uh60", nm: "Sikorsky S-70 / UH-60 Black Hawk", D: 16.4, mtow: 9980, cat: "medium", xw: 22, tp: "heli", len: 16.4, wid: 2.4, rtr: 16.4, dw: "high" },
  { id: "ch53k", nm: "Sikorsky CH-53K King Stallion", D: 24.0, mtow: 39600, cat: "heavy", xw: 28, tp: "heli", len: 24.0, wid: 4.9, rtr: 24.0, dw: "high" },
  { id: "mh60", nm: "Sikorsky MH-60 Seahawk", D: 16.4, mtow: 10000, cat: "medium", xw: 22, tp: "heli", len: 16.4, wid: 2.4, rtr: 16.4, dw: "high" },
  // —— Leonardo ——
  { id: "aw139", nm: "Leonardo AW139", D: 16.6, mtow: 7000, cat: "medium", xw: 20, tp: "heli", len: 16.6, wid: 2.9, rtr: 13.8, dw: "high" },
  { id: "aw169", nm: "Leonardo AW169", D: 14.6, mtow: 4800, cat: "medium", xw: 20, tp: "heli", len: 14.6, wid: 2.8, rtr: 12.1, dw: "medium" },
  { id: "aw189", nm: "Leonardo AW189", D: 15.9, mtow: 8300, cat: "medium", xw: 22, tp: "heli", len: 15.9, wid: 3.0, rtr: 14.0, dw: "high" },
  { id: "aw101", nm: "Leonardo AW101 Merlin", D: 18.6, mtow: 14600, cat: "heavy", xw: 25, tp: "heli", len: 18.6, wid: 3.5, rtr: 18.6, dw: "high" },
  { id: "aw109", nm: "Leonardo AW109 GrandNew", D: 11.0, mtow: 3175, cat: "light", xw: 17, tp: "heli", len: 11.0, wid: 2.0, rtr: 11.0, dw: "medium" },
  { id: "aw119kx", nm: "Leonardo AW119Kx", D: 10.8, mtow: 3150, cat: "light", xw: 17, tp: "heli", len: 10.8, wid: 1.9, rtr: 10.8, dw: "medium" },
  { id: "aw609", nm: "Leonardo AW609", D: 11.0, mtow: 7600, cat: "medium", xw: 20, tp: "heli", len: 17.2, wid: 2.7, rtr: 11.0, dw: "medium" },
  // —— Airbus ——
  { id: "h175", nm: "Airbus H175", D: 14.8, mtow: 7800, cat: "medium", xw: 22, tp: "heli", len: 14.8, wid: 2.8, rtr: 14.8, dw: "high" },
  { id: "h160", nm: "Airbus H160", D: 13.5, mtow: 6050, cat: "medium", xw: 20, tp: "heli", len: 13.5, wid: 2.6, rtr: 13.5, dw: "medium" },
  { id: "h155", nm: "Airbus H155 (EC155)", D: 12.5, mtow: 4850, cat: "medium", xw: 18, tp: "heli", len: 12.5, wid: 2.4, rtr: 12.5, dw: "medium" },
  { id: "h145", nm: "Airbus H145 (EC145)", D: 13.6, mtow: 3800, cat: "light", xw: 15, tp: "heli", len: 13.6, wid: 2.4, rtr: 11.0, dw: "medium" },
  { id: "h135", nm: "Airbus H135 (EC135)", D: 12.2, mtow: 2980, cat: "light", xw: 15, tp: "heli", len: 12.2, wid: 2.2, rtr: 10.2, dw: "low" },
  { id: "h130", nm: "Airbus H130 (EC130)", D: 11.0, mtow: 2500, cat: "light", xw: 15, tp: "heli", len: 11.0, wid: 2.1, rtr: 11.0, dw: "low" },
  { id: "h125", nm: "Airbus H125 (AS350)", D: 11.0, mtow: 2250, cat: "light", xw: 15, tp: "heli", len: 11.0, wid: 2.1, rtr: 11.0, dw: "low" },
  { id: "h120", nm: "Airbus H120 (EC120)", D: 10.2, mtow: 1715, cat: "light", xw: 15, tp: "heli", len: 10.2, wid: 2.0, rtr: 10.2, dw: "low" },
  { id: "h215", nm: "Airbus H215 (Super Puma)", D: 15.1, mtow: 9300, cat: "medium", xw: 22, tp: "heli", len: 15.1, wid: 3.0, rtr: 15.1, dw: "high" },
  { id: "h225", nm: "Airbus H225 (EC225)", D: 16.2, mtow: 11200, cat: "heavy", xw: 25, tp: "heli", len: 16.2, wid: 3.2, rtr: 16.2, dw: "high" },
  // —— Bell ——
  { id: "bell505", nm: "Bell 505 Jet Ranger X", D: 10.7, mtow: 1678, cat: "light", xw: 15, tp: "heli", len: 10.7, wid: 2.0, rtr: 10.7, dw: "low" },
  { id: "bell407", nm: "Bell 407", D: 11.3, mtow: 1270, cat: "light", xw: 15, tp: "heli", len: 11.3, wid: 2.0, rtr: 11.3, dw: "low" },
  { id: "bell407gxi", nm: "Bell 407GXi", D: 11.3, mtow: 1270, cat: "light", xw: 15, tp: "heli", len: 11.3, wid: 2.0, rtr: 11.3, dw: "low" },
  { id: "bell412", nm: "Bell 412EP / EPi", D: 17.1, mtow: 5398, cat: "medium", xw: 20, tp: "heli", len: 17.1, wid: 2.8, rtr: 14.0, dw: "high" },
  { id: "bell429", nm: "Bell 429", D: 14.0, mtow: 3402, cat: "light", xw: 17, tp: "heli", len: 14.0, wid: 2.4, rtr: 11.0, dw: "medium" },
  { id: "bell429wlg", nm: "Bell 429WLG", D: 14.0, mtow: 3402, cat: "light", xw: 17, tp: "heli", len: 14.0, wid: 2.4, rtr: 11.0, dw: "medium" },
  { id: "bell430", nm: "Bell 430", D: 12.8, mtow: 2041, cat: "light", xw: 17, tp: "heli", len: 12.8, wid: 2.3, rtr: 12.8, dw: "medium" },
  { id: "bell525", nm: "Bell 525 Relentless", D: 15.9, mtow: 9100, cat: "medium", xw: 22, tp: "heli", len: 15.9, wid: 2.9, rtr: 15.9, dw: "high" },
  { id: "bell_ah1z", nm: "Bell AH-1Z Viper", D: 14.6, mtow: 8390, cat: "medium", xw: 22, tp: "heli", len: 14.6, wid: 2.4, rtr: 14.6, dw: "high" },
  { id: "bell_uh1y", nm: "Bell UH-1Y Venom", D: 14.6, mtow: 8390, cat: "medium", xw: 22, tp: "heli", len: 14.6, wid: 2.4, rtr: 14.6, dw: "high" },
  { id: "bell206b", nm: "Bell 206B JetRanger", D: 10.2, mtow: 726, cat: "light", xw: 12, tp: "heli", len: 10.2, wid: 1.8, rtr: 10.2, dw: "low" },
  { id: "bell206l", nm: "Bell 206L LongRanger", D: 11.3, mtow: 1157, cat: "light", xw: 15, tp: "heli", len: 11.3, wid: 2.0, rtr: 11.3, dw: "low" },
  { id: "bell222", nm: "Bell 222 / 230", D: 12.8, mtow: 3629, cat: "light", xw: 17, tp: "heli", len: 12.8, wid: 2.3, rtr: 12.8, dw: "medium" },
  // —— MD Helicopters ——
  { id: "md500e", nm: "MD 500E", D: 8.0, mtow: 1361, cat: "light", xw: 12, tp: "heli", len: 8.0, wid: 1.4, rtr: 8.0, dw: "low" },
  { id: "md520n", nm: "MD 520N", D: 8.4, mtow: 1361, cat: "light", xw: 12, tp: "heli", len: 8.4, wid: 1.4, rtr: 8.4, dw: "low" },
  { id: "md530f", nm: "MD 530F", D: 8.4, mtow: 1519, cat: "light", xw: 12, tp: "heli", len: 8.4, wid: 1.4, rtr: 8.4, dw: "low" },
  { id: "md600n", nm: "MD 600N", D: 8.4, mtow: 2132, cat: "light", xw: 15, tp: "heli", len: 8.4, wid: 1.5, rtr: 8.4, dw: "low" },
  { id: "md902", nm: "MD 902 Explorer", D: 10.0, mtow: 3130, cat: "light", xw: 17, tp: "heli", len: 10.0, wid: 1.8, rtr: 10.0, dw: "medium" },
  // —— Robinson ——
  { id: "r22", nm: "Robinson R22", D: 7.7, mtow: 635, cat: "light", xw: 10, tp: "heli", len: 7.7, wid: 1.1, rtr: 7.7, dw: "low" },
  { id: "r44", nm: "Robinson R44", D: 10.1, mtow: 1134, cat: "light", xw: 12, tp: "heli", len: 10.1, wid: 1.3, rtr: 10.1, dw: "low" },
  { id: "r66", nm: "Robinson R66", D: 10.1, mtow: 1270, cat: "light", xw: 12, tp: "heli", len: 10.1, wid: 1.3, rtr: 10.1, dw: "low" },
  // —— Enstrom ——
  { id: "enstrom480b", nm: "Enstrom 480B", D: 9.4, mtow: 1225, cat: "light", xw: 12, tp: "heli", len: 9.4, wid: 1.5, rtr: 9.4, dw: "low" },
  // —— Boeing ——
  { id: "ch47f", nm: "Boeing CH-47F Chinook", D: 18.3, mtow: 22680, cat: "heavy", xw: 25, tp: "heli", len: 30.2, wid: 3.5, rtr: 18.3, dw: "high" },
  { id: "ah64e", nm: "Boeing AH-64E Apache", D: 14.6, mtow: 10000, cat: "medium", xw: 22, tp: "heli", len: 14.6, wid: 2.4, rtr: 14.6, dw: "high" },
  // —— Other manufacturers ——
  { id: "nh90", nm: "NHI NH90", D: 16.2, mtow: 10600, cat: "heavy", xw: 25, tp: "heli", len: 16.2, wid: 3.2, rtr: 16.2, dw: "high" },
  { id: "ka32", nm: "Kamov Ka-32", D: 15.9, mtow: 12700, cat: "medium", xw: 22, tp: "heli", len: 15.9, wid: 3.5, rtr: 15.9, dw: "high" },
  { id: "ka62", nm: "Kamov Ka-62", D: 15.2, mtow: 6800, cat: "medium", xw: 20, tp: "heli", len: 15.2, wid: 2.8, rtr: 15.2, dw: "medium" },
  { id: "mi8_17", nm: "Mi-8 / Mi-17", D: 21.2, mtow: 13000, cat: "heavy", xw: 25, tp: "heli", len: 21.2, wid: 3.2, rtr: 21.2, dw: "high" },
  { id: "mi171a2", nm: "Mi-171A2", D: 21.2, mtow: 13000, cat: "heavy", xw: 25, tp: "heli", len: 21.2, wid: 3.2, rtr: 21.2, dw: "high" },
  { id: "mi38", nm: "Mi-38", D: 21.2, mtow: 15600, cat: "heavy", xw: 25, tp: "heli", len: 21.2, wid: 3.3, rtr: 21.2, dw: "high" },
  { id: "kazan_ansat", nm: "Kazan Ansat", D: 11.5, mtow: 3600, cat: "light", xw: 17, tp: "heli", len: 11.5, wid: 2.0, rtr: 11.5, dw: "medium" },
  { id: "hal_dhruv", nm: "HAL Dhruv ALH", D: 13.2, mtow: 5750, cat: "medium", xw: 18, tp: "heli", len: 13.2, wid: 2.4, rtr: 13.2, dw: "medium" },
  { id: "kai_surion", nm: "KAI Surion", D: 13.2, mtow: 8709, cat: "medium", xw: 20, tp: "heli", len: 13.2, wid: 2.5, rtr: 13.2, dw: "medium" },
  { id: "avic_ac313", nm: "AVIC AC313", D: 18.9, mtow: 13000, cat: "heavy", xw: 25, tp: "heli", len: 18.9, wid: 3.5, rtr: 18.9, dw: "high" },
  { id: "avic_z15", nm: "AVIC Z-15", D: 14.8, mtow: 7000, cat: "medium", xw: 20, tp: "heli", len: 14.8, wid: 2.8, rtr: 14.8, dw: "medium" },
  // —— eVTOL ——
  { id: "ehang216", nm: "EHang 216", D: 6.0, mtow: 600, cat: "light", xw: 10, tp: "evtol", len: 5.6, wid: 5.6, rtr: 0, dw: "low", pax: 2 },
  { id: "joby_s4", nm: "Joby S4", D: 10.7, mtow: 2177, cat: "light", xw: 12, tp: "evtol", len: 10.7, wid: 7.0, rtr: 0, dw: "low", pax: 4 },
  { id: "lilium_jet", nm: "Lilium Jet", D: 13.9, mtow: 3175, cat: "light", xw: 15, tp: "evtol", len: 13.9, wid: 8.5, rtr: 0, dw: "low", pax: 6 },
  { id: "custom", nm: "Custom (enter D-value)", D: 0, mtow: 0, cat: "medium", xw: 15, tp: "heli", len: 0, wid: 0, rtr: 0, dw: "medium" },
];
export const OBS_TYPES = ["building","tower","tree","antenna","crane","powerline","terrain_high","fence","other"];
export const SOIL_DATA = [
  { value: "rock", label: "Rock", cbr: 80 },
  { value: "firm", label: "Firm", cbr: 50 },
  { value: "compacted", label: "Compacted", cbr: 30 },
  { value: "mixed", label: "Mixed", cbr: 15 },
  { value: "soft", label: "Soft/Clay", cbr: 5 },
  { value: "sand", label: "Sand", cbr: 8 },
];
export const PROJ_TYPES = ["helipad","heliport","hospital","rooftop","offshore","military","private"];
export const FACILITY_TYPES = [{ v: "heliport", l: "Heliport" }, { v: "hospital_pad", l: "Hospital Pad" }, { v: "vertiport", l: "Vertiport" }];
export const MODES = [{ v: "feasibility", l: "Feasibility" }, { v: "hybrid", l: "Hybrid" }, { v: "compliance", l: "Compliance" }, { v: "vertiport", l: "Vertiport" }];
export const COORD_SYS = [{ v: "wgs84", l: "WGS 84" }, { v: "utm", l: "UTM" }, { v: "local", l: "Local Grid" }];
export const ELEV_REF = [{ v: "amsl", l: "AMSL" }, { v: "agl", l: "AGL" }];
export const SENS_TYPES = [{ v: "residential", l: "Residential" }, { v: "fuel", l: "Fuel Storage" }, { v: "school", l: "School" }, { v: "hospital_zone", l: "Hospital" }, { v: "sensitive", l: "Other Sensitive" }];
export const SENS_LEVELS = ["low", "medium", "high"];


export const WT = { wind: 0.20, obs: 0.20, ter: 0.15, acc: 0.15, geo: 0.20, env: 0.10 };

export const STEPS_DEF = [{ l: "Project", i: "📋" }, { l: "Site", i: "📍" }, { l: "Zones", i: "⬚" }, { l: "Data", i: "📊" }, { l: "Score", i: "⚡" }, { l: "Results", i: "🏆" }];

export const SRC_LEVELS = {
  survey: { label: "Survey/Measured", weight: 1.0, color: "#10b981", icon: "✓" },
  documented: { label: "Documented/Published", weight: 0.85, color: "#2563eb", icon: "◉" },
  estimated: { label: "Estimated/Calculated", weight: 0.6, color: "#f59e0b", icon: "~" },
  assumed: { label: "Assumed/Default", weight: 0.3, color: "#ef4444", icon: "?" },
};
export const SRC_OPTIONS = Object.entries(SRC_LEVELS).map(([k, v]) => ({ v: k, l: v.label }));
