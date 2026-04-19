# COMPLIANCE_REF → ICAO / GACAR mapping

This file mirrors `src/data/complianceCitations.js` (`COMPLIANCE_REFERENCE_DETAIL`) for readers who prefer Markdown. **Clause numbers are not hard-coded** where the official PDF was not machine-verified in this repository—always confirm against the **current** ICAO Annex 14 Vol II amendment and **current** GACAR Part 138 on the GACA website.

| Key | ICAO Annex 14 Vol II (typical) | GACAR Part 138 (typical) |
|-----|--------------------------------|---------------------------|
| `ICAO_FATO_SA` | Ch.3 — FATO & safety area dimensions | Certification / physical characteristics — verify § |
| `ICAO_TLOF` | Ch.3 — TLOF vs FATO | Same — verify § |
| `ICAO_SA_WIDTH` | Ch.3 — Safety area strip | Same — verify § |
| `GACAR_SLOPE` | Ch.3 — Slopes (with PC limits) | FATO slopes — verify § |
| `ICAO_SA_SLOPE` | Ch.3 — SA grading | Same — verify § |
| `WIND_COVERAGE` | Meteorological / wind study practice (Doc 9157, national rules) | Operating limitations — verify § |
| `ICAO_ORIENTATION` | Ch.3 — FATO orientation vs wind | Same — verify § |
| `GACAR_XWIND` | Operating limits (aircraft RFM) | Crosswind / ops limits — verify § |
| `ICAO_OLS_18` | Ch.4 — OLS (approach/departure; 1:2 inner + outer segment per PC in engine) | Obstacle environment — verify § |
| `ICAO_OLS_12` | Ch.4 — Transitional surfaces | Same — verify § |
| `ICAO_OLS_IH` | Ch.4 — Inner horizontal surface (IHS) | Obstacle limitation — verify § |
| `GACAR_OBS_2D` | Ch.4 — Vicinity obstacles | Same — verify § |
| `ICAO_OBS_LIT` | Ch.5–6 — Marking & lighting | Same — verify § |
| `GACAR_EMER_ACCESS` | Rescue / access (also national rules) | Emergency access — verify § |
| `GACAR_BUILDING_CLR` | Third-party protection (project rule in tool) | Built environment — verify § |
| `GACAR_ROAD` | Access (manual / national) | Ground access — verify § |
| `SBC_SOIL` | Not a single Annex table | SBC / geotechnical study |
| `GACAR_FLOOD` | Ch.3 — Site hazards | Drainage / hazards — verify § |
| `ICAO_EARTHWORKS` | Ch.3 — Earthworks | Construction — verify § |

**Programmatic access:** import `COMPLIANCE_REFERENCE_DETAIL` from `src/data/complianceCitations.js`.
