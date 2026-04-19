import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const appPath = path.join(root, "src", "components", "App.jsx");
const lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);

function slice(a, b) {
  return lines.slice(a - 1, b).join("\n");
}

/** Unwrap two leading spaces per line (content as inside App()). */
function dedent2(s) {
  return s
    .split("\n")
    .map((ln) => (ln.startsWith("  ") ? ln.slice(2) : ln))
    .join("\n");
}

function indent(s, n) {
  const pad = " ".repeat(n);
  return s
    .split("\n")
    .map((ln) => (ln.length ? pad + ln : ln))
    .join("\n");
}

const stepsDir = path.join(root, "src", "components", "steps");
fs.mkdirSync(stepsDir, { recursive: true });

const projectJsx = dedent2(slice(156, 211));
const siteJsx = dedent2(slice(215, 354));
const zonesJsx = dedent2(slice(358, 446));
const dataFnBody = dedent2(slice(465, 1039));
const scoreFnBody = dedent2(slice(1043, 1145));
const resultsFnBody = dedent2(slice(1150, 2133));

fs.writeFileSync(
  path.join(stepsDir, "ProjectSetupStep.jsx"),
  `import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import {
  PC_DATA, HELIS, PROJ_TYPES, FACILITY_TYPES, MODES, COORD_SYS, ELEV_REF,
} from "../../data/constants.js";
import { getXwLim, WORKFLOW_STATES } from "../../data/models.js";

export function ProjectSetupStep() {
  const { K, dp, proj, inp, lbl, sel_, G, hl } = useHvs();
  return (
${indent(projectJsx, 4)}
  );
}
`,
);

fs.writeFileSync(
  path.join(stepsDir, "SiteDefinitionStep.jsx"),
  `import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { parseAnyFile, importFileData } from "../../parsers/universal.js";
import { mkTerrainFeature } from "../../data/models.js";
import { SiteDefinitionMap } from "../map/SiteDefinitionMap.jsx";

export function SiteDefinitionStep() {
  const { K, dp, site, zones, sel, inp, lbl, btn, sel_ } = useHvs();
  return (
${indent(siteJsx, 4)}
  );
}
`,
);

fs.writeFileSync(
  path.join(stepsDir, "ZoneManagerStep.jsx"),
  `import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { clamp } from "../../utils/coords.js";
import { mkManualZone } from "../../data/models.js";
import { zoneArea } from "../../engine/geometry.js";
import { ZGrid } from "../ui/ZGrid.jsx";

export function ZoneManagerStep() {
  const { K, dp, site, zones, sel, selZ, inp, lbl, btn, G, genGrid } = useHvs();
  return (
${indent(zonesJsx, 4)}
  );
}
`,
);

fs.writeFileSync(
  path.join(stepsDir, "DataInputStep.jsx"),
  `import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { DEG } from "../../utils/coords.js";
import {
  OBS_TYPES, SOIL_DATA, SENS_TYPES, SENS_LEVELS, SRC_OPTIONS,
} from "../../data/constants.js";
import { mkObs } from "../../data/models.js";
import { zoneCentroid, obsNearestDist, decomposeSlope } from "../../engine/geometry.js";
import { calcResponseTime } from "../../engine/responseTime.js";
import { Tooltip } from "../ui/Tooltip.jsx";
import { OLSBar } from "../ui/OLSBar.jsx";
import { Tag } from "../ui/Tag.jsx";

export function DataInputStep() {
  const {
    K, dp, proj, site, zones, sel, selZ, inp, lbl, btn, chk, sel_, zf,
    obsView, setObsView, dataTab, setDataTab, hl, D, G, zoneCompleteness,
  } = useHvs();

${indent(dataFnBody, 2)}
}
`,
);

fs.writeFileSync(
  path.join(stepsDir, "ScoreEngineStep.jsx"),
  `import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { WT } from "../../data/constants.js";
import { getPc, getXwLim } from "../../data/models.js";

export function ScoreEngineStep() {
  const { K, dp, proj, zones, btn, D, hl, G, zoneCompleteness } = useHvs();

${indent(scoreFnBody, 2)}
}
`,
);

fs.writeFileSync(
  path.join(stepsDir, "ResultsStep.jsx"),
  `import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { gradeCol, scoreCol } from "../../utils/theme.js";
import {
  PC_DATA, HELIS, WT,
} from "../../data/constants.js";
import {
  getPc, getXwLim, mkObs,
} from "../../data/models.js";
import { checkCompliance } from "../../engine/compliance.js";
import { calcConfidence } from "../../engine/confidence.js";
import { genSuggestions } from "../../engine/suggestions.js";
import { ErrorBoundary } from "../ui/ErrorBoundary.jsx";
import { Obs3D } from "../charts/Obs3D.jsx";
import { WindRose } from "../charts/WindRose.jsx";
import { OLSChart } from "../charts/OLSChart.jsx";
import { ScoreRadar } from "../charts/ScoreRadar.jsx";
import { SitePlan } from "../charts/SitePlan.jsx";
import { Confetti } from "../ui/Confetti.jsx";
import { AnimScore } from "../ui/AnimScore.jsx";
import { RankingBars } from "../charts/RankingBars.jsx";
import { Heatmap } from "../charts/Heatmap.jsx";
import { ZGrid } from "../ui/ZGrid.jsx";
import { Tag } from "../ui/Tag.jsx";
import { ScoreBar } from "../ui/ScoreBar.jsx";
import { ResultsMapView } from "../map/ResultsMapView.jsx";

export function ResultsStep() {
  const {
    K, dp, proj, site, zones, sel, selZ, scored, tab, scenarios, recs,
    showConfetti, compareId, setCompareId, scenarioName, setScenarioName,
    inp, lbl, btn, sel_, D, hl, G,
  } = useHvs();

${indent(resultsFnBody, 2)}
}
`,
);

fs.writeFileSync(
  path.join(stepsDir, "index.js"),
  `export { ProjectSetupStep } from "./ProjectSetupStep.jsx";
export { SiteDefinitionStep } from "./SiteDefinitionStep.jsx";
export { ZoneManagerStep } from "./ZoneManagerStep.jsx";
export { DataInputStep } from "./DataInputStep.jsx";
export { ScoreEngineStep } from "./ScoreEngineStep.jsx";
export { ResultsStep } from "./ResultsStep.jsx";
`,
);

console.log("Wrote steps to", stepsDir);
