/**
 * Report template configs — each key toggles PDF sections (Phase 4.2).
 */
export const REPORT_TEMPLATE_IDS = ["full", "executive", "compliance", "comparison"];

/** @typedef {typeof SECTION_DEFAULTS} ReportSections */

const SECTION_DEFAULTS = {
  cover: true,
  toc: true,
  executive: true,
  site: true,
  mapImage: true,
  sitePlanImage: true,
  ols3dImage: true,
  designParams: true,
  responseTime: true,
  zoneComparison: true,
  wind: true,
  obstacles: true,
  terrain: true,
  compliance: true,
  complianceFailuresOnly: false,
  dataQuality: true,
  recommendations: true,
  audit: true,
  assumptions: true,
  comparisonTable: false,
};

export const REPORT_TEMPLATES = {
  full: {
    id: "full",
    label: "Full Report",
    description: "All sections — suitable for technical review (~20+ pages depending on data).",
    sections: { ...SECTION_DEFAULTS, toc: true, comparisonTable: false },
  },
  executive: {
    id: "executive",
    label: "Executive Summary",
    description: "Cover, recommendation, site snapshot, map, zone scores, brief compliance, actions.",
    sections: {
      ...SECTION_DEFAULTS,
      toc: false,
      designParams: false,
      sitePlanImage: true,
      ols3dImage: false,
      responseTime: true,
      wind: false,
      obstacles: false,
      terrain: false,
      compliance: true,
      complianceFailuresOnly: true,
      dataQuality: false,
      audit: false,
      assumptions: true,
    },
  },
  compliance: {
    id: "compliance",
    label: "Compliance Report",
    description: "Regulatory matrix with FAIL/WARN emphasis, OLS summary, audit trail.",
    sections: {
      ...SECTION_DEFAULTS,
      toc: true,
      executive: false,
      mapImage: false,
      sitePlanImage: false,
      ols3dImage: true,
      zoneComparison: false,
      wind: false,
      obstacles: true,
      terrain: false,
      compliance: true,
      complianceFailuresOnly: false,
      dataQuality: false,
      recommendations: true,
    },
  },
  comparison: {
    id: "comparison",
    label: "Comparison Report",
    description: "Current project vs saved scenarios — sites, best zones, scores, compliance.",
    sections: {
      ...SECTION_DEFAULTS,
      toc: true,
      executive: false,
      wind: false,
      obstacles: false,
      terrain: false,
      dataQuality: false,
      recommendations: false,
      audit: false,
      assumptions: true,
      zoneComparison: true,
      comparisonTable: true,
    },
  },
};

export function getReportTemplate(id) {
  return REPORT_TEMPLATES[id] || REPORT_TEMPLATES.full;
}
