import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/components/App.jsx");
const s = fs.readFileSync(appPath, "utf8").split(/\r?\n/);
const slice = (a, b) => s.slice(a - 1, b).join("\n");

const base = path.join(__dirname, "../src/components");

/** Adds export to top-level function (trim handles leading blank lines before component). */
function exp(fn) {
  return fn.trim().replace(/^function /, "export function ");
}

const files = {
  "ui/ErrorBoundary.jsx": `import React, { Component } from "react";

${slice(23, 37).replace(/^class ErrorBoundary/, "export class ErrorBoundary")}`,
  "ui/Tooltip.jsx": `import React from "react";

export function Tooltip({ text, children }) {
  return React.createElement("span", { title: text, style: { cursor: "help", borderBottom: text ? "1px dotted #4e6380" : "none" } }, children);
}
`,
  "charts/Obs3D.jsx": `import React, { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { K } from "../../utils/theme.js";
import { DEG, clamp } from "../../utils/coords.js";
import { calcGeom } from "../../data/models.js";
import { zoneCentroid } from "../../engine/geometry.js";

${exp(slice(45, 291))}
`,
  "charts/WindRose.jsx": `import React from "react";
import { K } from "../../utils/theme.js";
import { DEG } from "../../utils/coords.js";

${exp(slice(294, 329))}
`,
  "charts/OLSChart.jsx": `import React from "react";
import { K } from "../../utils/theme.js";
import { calcGeom } from "../../data/models.js";

${exp(slice(331, 380))}
`,
  "charts/ScoreRadar.jsx": `import React from "react";
import { K } from "../../utils/theme.js";
import { DEG } from "../../utils/coords.js";

${exp(slice(382, 399))}
`,
  "charts/SitePlan.jsx": `import React, { useState, useEffect } from "react";
import { K, gradeCol, scoreCol } from "../../utils/theme.js";
import { DEG } from "../../utils/coords.js";
import { calcGeom } from "../../data/models.js";
import { zoneCentroid } from "../../engine/geometry.js";

${exp(slice(403, 654))}
`,
  "ui/Confetti.jsx": `import React, { useState, useEffect } from "react";

${exp(slice(656, 678))}
`,
  "ui/AnimScore.jsx": `import React, { useState, useEffect, useRef } from "react";

${exp(slice(680, 700))}
`,
  "ui/OLSBar.jsx": `import React from "react";
import { K } from "../../utils/theme.js";

${exp(slice(702, 728))}
`,
  "charts/RankingBars.jsx": `import React from "react";
import { K, scoreCol } from "../../utils/theme.js";

${exp(slice(730, 754))}
`,
  "charts/Heatmap.jsx": `import React from "react";
import { K, scoreCol } from "../../utils/theme.js";

${exp(slice(756, 792))}
`,
  "ui/ZGrid.jsx": `import React from "react";
import { K, gradeCol, scoreCol } from "../../utils/theme.js";

${exp(slice(794, 830))}
`,
  "ui/Tag.jsx": `import React from "react";
import { K } from "../../utils/theme.js";

${exp(slice(832, 835))}
`,
  "ui/ScoreBar.jsx": `import React from "react";
import { K, scoreCol } from "../../utils/theme.js";

${exp(slice(837, 853))}
`,
};

for (const [rel, content] of Object.entries(files)) {
  const outPath = path.join(base, ...rel.split("/"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
}
console.log("Wrote", Object.keys(files).length, "files");
