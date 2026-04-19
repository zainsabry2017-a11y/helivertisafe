/**
 * Cross-reference map: app compliance keys ↔ ICAO Annex 14 Vol II & GACAR Part 138 topics.
 *
 * ICAO: Annex 14 Aerodromes, Volume II — Heliports. Widely distributed edition: 5th ed. (July 2020),
 * Corrigendum No. 1 (29 January 2021). Confirm section numbers against the amendment in force for your State.
 *
 * GACAR: Part 138 — Certification, Authorization and Operation of Heliports (GACA). Confirm subpart / article
 * numbers against the current PDF on https://www.gaca.gov.sa (titles vary by version).
 */

/** Official document identifiers for release notes / PDF exports */
export const ICAO_ANNEX14_VOL2 = "ICAO Annex 14 — Aerodromes, Volume II — Heliports (verify current edition/amendment)";
export const GACAR_PART_138 = "GACAR Part 138 — Certification, Authorization and Operation of Heliports (verify current GACA version)";

/**
 * Short strings shown in the compliance matrix (COMPLIANCE_REF).
 * Detailed mapping in COMPLIANCE_REFERENCE_DETAIL.
 */
export const COMPLIANCE_REF = {
  ICAO_FATO_SA: "ICAO Annex 14 Vol II — Ch.3 FATO & safety area",
  ICAO_TLOF: "ICAO Annex 14 Vol II — Ch.3 TLOF",
  ICAO_SA_WIDTH: "ICAO Annex 14 Vol II — Ch.3 Safety area",
  GACAR_SLOPE: "GACAR Part 138 — FATO/ground slopes (verify §)",
  ICAO_SA_SLOPE: "ICAO Annex 14 Vol II — Ch.3 Grading / SA slopes",
  WIND_COVERAGE: "Wind study completeness (≥95% tool target; verify national rules)",
  ICAO_ORIENTATION: "ICAO Annex 14 Vol II — Ch.3 FATO orientation / wind rose",
  GACAR_XWIND: "GACAR Part 138 — Operating limitations / wind (verify §)",
  ICAO_OLS_18: "ICAO Annex 14 Vol II — Ch.4 OLS (approach/departure; gradient modeled per PC in this engine)",
  ICAO_OLS_12: "ICAO Annex 14 Vol II — Ch.4 Transitional OLS (1:2 screening)",
  GACAR_OBS_2D: "GACAR Part 138 — Obstacle environment / vicinity (verify §)",
  ICAO_OBS_LIT: "ICAO Annex 14 Vol II — Ch.5–6 Marking & lighting",
  GACAR_EMER_ACCESS: "GACAR Part 138 — Emergency access (verify §)",
  GACAR_BUILDING_CLR: "GACAR Part 138 — Third-party protection / separation (verify §)",
  GACAR_ROAD: "GACAR Part 138 — Access / infrastructure (verify §)",
  SBC_SOIL: "National / project geotechnical criteria (e.g. SBC; verify)",
  GACAR_FLOOD: "GACAR Part 138 — Site hazards / drainage (verify §)",
  ICAO_EARTHWORKS: "ICAO Annex 14 Vol II — Ch.3 Site preparation",
};

/**
 * Amendment-sensitive mapping. Section numbers are indicative; verify against your Annex 14 Vol II edition.
 * GACAR articles are not hard-coded where the public PDF could not be machine-read here.
 */
export const COMPLIANCE_REFERENCE_DETAIL = {
  ICAO_FATO_SA: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — Physical characteristics: FATO dimensions and safety areas (dimensions in terms of D / TDPH as defined in the Annex).`,
    gacar: `${GACAR_PART_138}. Subpart B (certification) / physical characteristics — align with Annex 14 Vol II; verify article numbers in current GACA text.`,
  },
  ICAO_TLOF: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — TLOF size and relation to FATO (e.g. minimum circular TLOF Ø = 0.83D for a square FATO case).`,
    gacar: `${GACAR_PART_138}. Certification requirements incorporating ICAO SARPs — verify § in current issue.`,
  },
  ICAO_SA_WIDTH: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — Safety area: strip width (typically 0.25D with minimum width, e.g. 3 m).`,
    gacar: `${GACAR_PART_138}. Physical characteristics / safety areas — verify §.`,
  },
  GACAR_SLOPE: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — Slopes on FATO and safety area (PC-dependent maxima in national implementation).`,
    gacar: `${GACAR_PART_138}. FATO longitudinal and transverse slope limits — verify § (often cross-referenced to Annex 14 Vol II performance class).`,
  },
  ICAO_SA_SLOPE: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — Safety area grading / downward slopes.`,
    gacar: `${GACAR_PART_138}. Site grading — verify §.`,
  },
  WIND_COVERAGE: {
    icao: "ICAO Doc 9157 / national guidance on wind studies for heliports (Annex 14 Vol II does not replace meteorological regulations).",
    gacar: `${GACAR_PART_138}. Operating limitations and wind data for declared headings — verify §.`,
  },
  ICAO_ORIENTATION: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — FATO orientation vs wind (typically high usability / headwind objectives).`,
    gacar: `${GACAR_PART_138}. Operating limitations — verify §.`,
  },
  GACAR_XWIND: {
    icao: `${ICAO_ANNEX14_VOL2}. Operating limitations are often in OM; aircraft limits tie to Rotorcraft Flight Manual.`,
    gacar: `${GACAR_PART_138}. Crosswind and operating limits for published procedures — verify §.`,
  },
  ICAO_OLS_18: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 4 — Obstacle limitation surfaces: approach/departure outer segment (modeled per performance class in this tool) plus inner segment (commonly 1:2) and lateral splay; engine evaluates segmented + directional corridors.`,
    gacar: `${GACAR_PART_138}. Protection surfaces / obstacle control — verify §.`,
  },
  ICAO_OLS_12: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 4 — Transitional surfaces (simplified in app as radial 1:2 outside approach/departure corridors).`,
    gacar: `${GACAR_PART_138}. Obstacle environment — verify §.`,
  },
  GACAR_OBS_2D: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 4 — Obstacle control near FATO (tool uses 2D radius heuristic).`,
    gacar: `${GACAR_PART_138}. Vicinity obstacles — verify §.`,
  },
  ICAO_OBS_LIT: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapters 5–6 — Visual aids for obstacles penetrating OLS.`,
    gacar: `${GACAR_PART_138}. Marking / lighting obligations — verify §.`,
  },
  GACAR_EMER_ACCESS: {
    icao: "Rescue and firefighting / access often coordinated with national rules and Annex 14 Vol I where applicable.",
    gacar: `${GACAR_PART_138}. Emergency and rescue access — verify §.`,
  },
  GACAR_BUILDING_CLR: {
    icao: `${ICAO_ANNEX14_VOL2}. Obstacle environment and public safety (project rule: 30 m in tool).`,
    gacar: `${GACAR_PART_138}. Protection of third parties / built environment — verify §.`,
  },
  GACAR_ROAD: {
    icao: `${ICAO_ANNEX14_VOL2}. Access roads in national guidance / heliport manual.`,
    gacar: `${GACAR_PART_138}. Ground access — verify §.`,
  },
  SBC_SOIL: {
    icao: "Not in Annex 14 Vol II as a soil table — geotechnical verification per project.",
    gacar: "Saudi Building Code (SBC) / project geotechnical study — verify applicable national standard.",
  },
  GACAR_FLOOD: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — Site selection / drainage considerations.`,
    gacar: `${GACAR_PART_138}. Hazardous site conditions — verify §.`,
  },
  ICAO_EARTHWORKS: {
    icao: `${ICAO_ANNEX14_VOL2}. Chapter 3 — Earthworks and FATO preparation.`,
    gacar: `${GACAR_PART_138}. Construction / grading — verify §.`,
  },
};
