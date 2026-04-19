import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const monoPath = path.join(root, "src", "helivertisafe.monolith.jsx");
const lines = fs.readFileSync(monoPath, "utf8").split(/\r?\n/);

/** 1-based inclusive line range → join (end line inclusive). */
function lr(a, b) {
  return lines.slice(a - 1, b).join("\n");
}

function dedent2(s) {
  return s
    .split("\n")
    .map((ln) => (ln.startsWith("  ") ? ln.slice(2) : ln))
    .join("\n");
}

const stepsDir = path.join(root, "src", "components", "steps");

const projectJsx = lr(2178, 2233);
const zonesJsx = lr(2377, 2464);

let siteJsx = lr(2237, 2373);
siteJsx = siteJsx.replace(
  /^\s*<div style=\{\{ maxWidth: 560 \}\}>\s*\n\s*<h2 style=\{\{ fontSize: 22,/m,
  `<div>\n      <h2 style={{ fontSize: 22,`,
);
siteJsx = siteJsx.replace(
  /(<h2 style=\{\{ fontSize: 22, fontWeight: 800, color: K\.tx, margin: "0 0 (?:16|20)px", paddingBottom: 10, borderBottom: "2px solid " \+ K\.cy \+ "30" \}\}>Site Definition<\/h2>)/,
  `$1\n      <SiteDefinitionMap site={site} zones={zones} dp={dp} />\n      <div style={{ maxWidth: 560 }}>`,
);
if (!siteJsx.includes("SiteDefinitionMap")) {
  siteJsx = siteJsx.replace(
    "(<h2 style={{ fontSize: 22, fontWeight: 800, color: K.tx, margin: \"0 0 20px\", paddingBottom: 10, borderBottom: \"2px solid \" + K.cy + \"30\" }}>Site Definition</h2>)",
    "$1\n      <SiteDefinitionMap site={site} zones={zones} dp={dp} />\n      <div style={{ maxWidth: 560 }}>",
  );
}
siteJsx = siteJsx.replace(/\n    <\/div>\n  \);$/m, "\n      </div>\n    </div>\n  );");

const dataBody = dedent2(lr(2484, 3058));
const scoreBody = dedent2(lr(3062, 3163));
let resultsBody = dedent2(lr(3169, 4148));

resultsBody = resultsBody.replace(
  /const tabs = \[\{ id: "overview", l: "Overview" \}, \{ id: "siteplan"/,
  'const tabs = [{ id: "overview", l: "Overview" }, { id: "map", l: "Map" }, { id: "siteplan"',
);
resultsBody = resultsBody.replace(
  `        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14 }}>`,
  `        {tab === "map" ? (
          <ResultsMapView site={site} zones={zones} proj={proj} sel={sel} onSelectZone={(id) => dp({ type: "SEL", payload: id })} />
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14 }}>`,
);
resultsBody = resultsBody.replace(
  /(\n        <\/div>\n)(      <\/div>\n    \);$)/m,
  `$1        )}\n$2`,
);

fs.mkdirSync(stepsDir, { recursive: true });

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
${projectJsx}
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
${siteJsx}
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
${zonesJsx}
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

${dataBody}
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

${scoreBody}
}
`,
);

fs.writeFileSync(
  path.join(stepsDir, "ResultsStep.jsx"),
  `import React from "react";
import { useHvs } from "../../context/HvsContext.jsx";
import { gradeCol, scoreCol } from "../../utils/theme.js";
import { PC_DATA, HELIS, WT } from "../../data/constants.js";
import { getPc, getXwLim, mkObs, getHeli } from "../../data/models.js";
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

${resultsBody}
}
`,
);

console.log("Fixed steps from monolith →", stepsDir);
