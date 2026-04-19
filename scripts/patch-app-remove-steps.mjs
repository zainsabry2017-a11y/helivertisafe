import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "..", "src", "components", "App.jsx");
const s = fs.readFileSync(appPath, "utf8");

const start = s.indexOf("  // ═══ STEP RENDERS ═══");
const re =
  /\r?\n  const views = \[renderProject, renderSite, renderZones, renderData, renderScore, renderResults\];\r?\n\r?\n/;
const m = re.exec(s);
if (start === -1 || !m) throw new Error("markers not found");

const insert = `  const StepViews = [ProjectSetupStep, SiteDefinitionStep, ZoneManagerStep, DataInputStep, ScoreEngineStep, ResultsStep];
  const StepComponent = StepViews[step];

`;

const out = s.slice(0, start) + insert + s.slice(m.index + m[0].length);
fs.writeFileSync(appPath, out);
console.log("Patched App.jsx");
