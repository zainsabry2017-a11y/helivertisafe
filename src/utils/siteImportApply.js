import { parseAnyFile, importFileData } from "../parsers/universal.js";
import { mkTerrainFeature } from "../data/models.js";

export function buildImportPlainSummary(result) {
  const lines = [];
  if (result.boundary.length >= 3) {
    lines.push("Updated the site outline using " + result.boundary.length + " points from your file.");
  }
  if (result.zones.length) {
    lines.push("Created " + result.zones.length + " candidate zone(s) from closed shapes in the file.");
  }
  if (result.obstacles.length) {
    lines.push("Added " + result.obstacles.length + " obstacle(s) (structures the helicopter must stay clear of).");
  }
  if (result.terrainPts.length) {
    lines.push("Imported " + result.terrainPts.length + " ground elevation point(s) for terrain.");
  }
  if (!lines.length) {
    lines.push("We could not find usable areas or coordinate points. Try the sample file, or use “All formats” and check coordinates.");
  }
  return lines;
}

export function buildImportNextSteps(result) {
  const steps = [];
  if (result.boundary.length >= 3) steps.push("Check the site boundary on the map — it should wrap your whole study area.");
  if (result.zones.length) steps.push("Continue to Zone Manager to turn candidate zones on or off.");
  if (result.obstacles.length) steps.push("In Data Input, verify obstacle heights; they drive safety surfaces.");
  if (result.terrainPts.length) steps.push("Optional: use terrain tools to build a surface from elevation points.");
  if (!steps.length) steps.push("Draw your site on the map, or upload a file with X,Y coordinates (CSV) or shapes (GeoJSON).");
  return steps;
}

/**
 * Parse + apply site import (boundary, terrain, zones, obstacles). Dispatches same as SiteDefinitionStep.
 */
export function applySiteFileImport(text, fileName, { site, zones, sel, dp }) {
  const parsed = parseAnyFile(text, fileName);
  const result = importFileData(parsed, site.sw, site.sh);

  const summary = {
    format: parsed.format,
    total: parsed.count,
    boundary: result.boundary.length,
    zones: result.zones.length,
    obs: result.obstacles.length,
    terrain: result.terrainPts.length,
    plainLines: buildImportPlainSummary(result),
    nextSteps: buildImportNextSteps(result),
    fileName: fileName || "",
    at: new Date().toISOString(),
  };

  if (result.boundary.length >= 3) {
    dp({ type: "US", payload: { boundary: result.boundary } });
  }

  if (result.terrainPts.length) {
    dp({
      type: "US",
      payload: {
        terrainFeatures: [
          ...(site.terrainFeatures || []),
          mkTerrainFeature({
            nm: "Imported terrain",
            tp: "surface",
            points: result.terrainPts,
            elevPeak: Math.max(...result.terrainPts.map((p) => p.z)),
            elevBase: Math.min(...result.terrainPts.map((p) => p.z)),
          }),
        ],
      },
    });
  }

  if (result.zones.length) {
    const newZones = result.zones.map((z, i) => {
      if (i === 0 && result.obstacles.length) {
        return { ...z, obs: result.obstacles };
      }
      return z;
    });
    dp({ type: "SZ", payload: newZones });
  } else if (result.obstacles.length && zones.length) {
    const targetZ = sel || zones[0]?.id;
    if (targetZ) {
      const existingZ = zones.find((z) => z.id === targetZ);
      if (existingZ) {
        const updatedZones = zones.map((z) => (z.id === targetZ ? { ...z, obs: [...z.obs, ...result.obstacles] } : z));
        dp({ type: "SZ", payload: updatedZones });
      }
    }
  }

  dp({ type: "US", payload: { importResult: summary } });
}

export function applySiteImportError(dp, err) {
  dp({
    type: "US",
    payload: {
      importResult: {
        format: "Error",
        total: 0,
        boundary: 0,
        zones: 0,
        obs: 0,
        terrain: 0,
        error: err.message || String(err),
        plainLines: ["Something went wrong reading the file."],
        nextSteps: ["Try the sample CSV or GeoJSON, or use a UTF-8 text export from your GIS tool."],
      },
    },
  });
}
