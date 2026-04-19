# Regulatory engine reference (ICAO Annex 14 Vol II & GACAR Part 138)

This document describes **what Heli-VertiSafe actually computes**, how that relates to **ICAO** and **GACAR** concepts, and **what is not modeled**. It is **not** legal advice or an aerodrome certification package. Always verify dimensions, obstacle surfaces, and article numbers against the **official publications in force** at approval time.

## Equations implemented in code

| Symbol | Formula (as coded) | Typical regulatory intent | Code |
|--------|-------------------|---------------------------|------|
| D | User-selected rotor / reference dimension (m) | TDPH/RTD or declared D per procedure | `getD()` |
| FATO side | `fato = D × pc.fatoMin` (pc.fatoMin = 1) | Minimum FATO for square FATO case | `helipadFootprintMetres` |
| Safety area width | `sa = max(D × pc.sa, 3)` with pc.sa = 0.25 | 0.25D strip with ≥ 3 m minimum | same |
| TLOF Ø | `tlof = D × 0.83` | Minimum diameter of circular TLOF (0.83D) | `TLOF_DIAMETER_FACTOR` |
| Total pad | `tot = fato + 2×sa` | FATO plus safety areas on two sides (simplified rectangle model) | same |
| OLS corridor (directional) | Inner segment: `h = s × innerG` (1:2); outer: `+ (s−Lᵢ) × outerG` (per performance class); lateral limit `fato/2 + splay×s` | Annex 14 Vol II Ch.4 approach/departure (simplified) | `olsEngine.js` |
| OLS omni fallback | `h_max = min(d×appG, d×transG)` when no wind | Legacy radial screening | `evaluateObstacleOLS` |
| Inner horizontal (IHS) | `pIH` if `r ≤ ihRadiusM` and `h > ihHeightM` | Ch.4 IHS | `olsEngine.js`, `compliance.js` |
| Unlit penetration (compliance) | `h > maxObstacleHeightAtDistance(d, G.appG)` | Marking for penetrations | `compliance.js` |

Obstacle position uses `obsNearestVector` (nearest polygon corner or `d`,`br` via `db2xy`) relative to zone centroid — see `geometry.js`.

**Citation map:** `docs/COMPLIANCE_REF_MAP.md` and `src/data/complianceCitations.js` (`COMPLIANCE_REFERENCE_DETAIL`).

## Compliance table: requirement → implemented?

| Theme | Regulatory idea | In app? | Notes |
|------|-----------------|---------|--------|
| FATO + SA size | Ch. 3 dimensions | **Partial** | Compares zone size to `tot`; does not distinguish elevated vs ground heliport tables |
| TLOF vs FATO | TLOF within FATO | **Yes** | `G.tlof <= G.fato` |
| SA minimum | ≥ 3 m (and 0.25D) | **Yes** | `sa >= 3` |
| FATO slopes | Longitudinal / transverse limits | **Partial** | Uses `pc.maxSlope`; optional decomposition vs FATO heading in terrain scoring |
| SA slopes | Grading limits | **Partial** | `maxSA` check; not full SA grading model |
| Wind rose / coverage | Adequate wind data for orientation | **Model rule** | 95% coverage from entered fractions — not a substitute for ICAO Doc 9157 / national MET policy |
| FATO heading vs wind | Usability / headwind | **Yes** | `orientation.js` + compliance when `ori` present |
| Crosswind | Aircraft / class limits | **Yes** | `GACAR`-labelled check uses heli crosswind limit from catalog |
| Full OLS set | Take-off, approach, transitional, inner horizontal, etc. | **Partial** | `olsEngine.js`: directional corridors ±180°, segmented 1:2 + outer per PC, PC-specific `innerLenFactor`, `outerLenM`, `splay`; not full 3-D Annex frusta |
| Directional approaches | Surfaces aligned to FATO direction | **Yes** (when wind data present) | Uses `calcOrientation` heading; else omni radial |
| Inner horizontal (IH) | IHS height & radius | **No** | Inner horizontal surface (IHS) is not evaluated in the current engine build |
| Markings / lighting | Visual aids | **Partial** | Lighting toggle and narrative checks only |
| Rescue / fire fighting | RFF category | **No** | Not in compliance matrix |
| Vertiport / eVTOL addenda | eVTOL / vertiport amendments | **No** | Same heli-style D model; user must confirm applicability |

## Citation hygiene (`compliance.js`)

Clause numbers in standards change between **Amendments**. Display strings in the app are **indicative** reminders to compare Annex 14 Vol II and **GACAR Part 138** (and any Saudi-specific variants) to the project.

- **Do not** treat UI reference tags as proof of compliance.
- **Do** map each check to the current official text before submission.

## Single source for formulas

Implementations should import from `src/engine/regulatoryFormulas.js` so scoring, charts, and footprint math do not drift.

## Related files

- `src/data/constants.js` — `PC_DATA` (per-PC `innerLenFactor`, `outerLenM`, …)
- `src/data/models.js` — `calcGeom`
- `src/engine/olsEngine.js` — directional / omni OLS
- `src/engine/scoring.js` — `sObs`, `sWind`, …
- `src/engine/compliance.js` — pass/fail matrix
- `src/components/charts/OLSChart.jsx`, `src/components/ui/OLSBar.jsx` — envelope charts / approach bar
