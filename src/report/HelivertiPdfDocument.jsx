import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Svg, Path, Circle, Line, Rect } from "@react-pdf/renderer";
import { calcResponseTime } from "../engine/responseTime.js";
import { recPdfPrefix } from "../components/ui/RecGlyphs.jsx";
import { zonePadCenter } from "../engine/geometry.js";
import { localToLatLng } from "../utils/mapGeo.js";

const PAL = {
  navy: "#1e3a5f",
  pass: "#166534",
  fail: "#b91c1c",
  warn: "#b45309",
  muted: "#64748b",
  border: "#94a3b8",
};

const styles = StyleSheet.create({
  coverPage: { padding: 48, fontFamily: "Helvetica", backgroundColor: "#f8fafc" },
  coverBrand: { fontSize: 11, color: PAL.navy, fontWeight: "bold", letterSpacing: 2, marginBottom: 24 },
  coverTitle: { fontSize: 22, fontWeight: "bold", color: "#0f172a", marginBottom: 8 },
  coverSub: { fontSize: 13, color: "#334155", marginBottom: 4 },
  coverMeta: { fontSize: 10, color: PAL.muted, marginTop: 20 },
  logoBox: { width: 64, height: 64, marginBottom: 20, justifyContent: "center", alignItems: "center" },
  page: { paddingTop: 42, paddingBottom: 40, paddingHorizontal: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  headerStripe: {
    position: "absolute",
    top: 14,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: PAL.navy,
    paddingBottom: 6,
  },
  headerCo: { fontSize: 9, fontWeight: "bold", color: PAL.navy },
  headerPg: { fontSize: 9, color: PAL.muted },
  footerStripe: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: PAL.border,
    paddingTop: 6,
  },
  footerTxt: { fontSize: 8, color: PAL.muted, textAlign: "center" },
  h1: { fontSize: 12, fontWeight: "bold", color: PAL.navy, marginBottom: 10, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  h2: { fontSize: 10, fontWeight: "bold", color: PAL.navy, marginBottom: 6, marginTop: 12 },
  p: { fontSize: 9, lineHeight: 1.45, marginBottom: 6, color: "#334155" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingVertical: 4 },
  cellL: { flex: 2.2, fontSize: 8 },
  cellM: { flex: 1.2, fontSize: 8, textAlign: "center" },
  cellS: { flex: 0.8, fontSize: 8, textAlign: "center" },
  th: { fontWeight: "bold", color: PAL.navy, fontSize: 8 },
  badgePass: { color: PAL.pass, fontWeight: "bold" },
  badgeFail: { color: PAL.fail, fontWeight: "bold" },
  badgeWarn: { color: PAL.warn, fontWeight: "bold" },
  boxRec: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#86efac", padding: 10, marginBottom: 8, borderRadius: 2 },
  tocWrap: { marginBottom: 16 },
  tocLine: { fontSize: 9, marginBottom: 4, color: "#475569" },
});

function statusStyle(st) {
  if (st === "PASS") return styles.badgePass;
  if (st === "FAIL") return styles.badgeFail;
  if (st === "WARN") return styles.badgeWarn;
  return { color: PAL.muted, fontWeight: "bold" };
}

export function HelivertiPdfDocument({
  template,
  proj,
  site,
  zones,
  scenarios: _scenarios,
  bestZone,
  rankedAll,
  hl,
  D,
  G,
  pcLabel,
  wt,
  comp,
  confBest,
  recs,
  mapImage,
  sitePlanImage,
  ols3dImage,
  windRoseImage,
  preparedBy,
  today,
  comparisonRows,
}) {
  const S = template.sections;
  const companyLine = proj.cl ? `${proj.cl} · Heli-VertiSafe` : "Heli-VertiSafe";
  const ori = bestZone?.sc?.ori;
  const bObs = bestZone?.sc?.bd?.obs;
  const padC = bestZone ? zonePadCenter(bestZone) : { x: 0, y: 0 };
  const padGeo = bestZone ? localToLatLng(site, padC.x, padC.y) : { lat: site.lat, lng: site.lng };

  const responseRows =
    (site.destinations || [])
      .map((d) => {
        const rt = calcResponseTime(d, site.lat, site.lng);
        return { d, rt };
      })
      .filter((x) => x.rt) || [];

  const obsRows = (bestZone?.obs || []).map((o) => {
    const pen = bObs?.pens?.find((p) => p.nm === o.nm);
    let st = "CLEAR";
    if (pen?.p18) st = "FAIL APCH";
    else if (pen?.p12) st = "WARN 1:2";
    return { nm: o.nm, tp: o.tp, h: o.h, d: o.d, br: o.br, st };
  });

  const terrainLines = [
    `FATO zone slope: ${bestZone?.ter?.slope ?? "—"}% (cross: ${bestZone?.ter?.side ?? "—"}%) — soil ${bestZone?.ter?.soil ?? "—"}`,
    ...(site.terrainFeatures || []).map((tf) => `${tf.nm}: peak ${tf.elevPeak} m, base ${tf.elevBase} m, radius ${tf.radius} m`),
  ];

  const compChecks =
    S.complianceFailuresOnly
      ? comp.checks.filter((c) => c.status === "FAIL" || c.status === "WARN")
      : comp.checks;

  const tocLines = [];
  if (S.executive) tocLines.push("Executive summary & recommendation");
  if (S.site) tocLines.push("Site information");
  if (S.mapImage) tocLines.push("Site map");
  if (S.sitePlanImage) tocLines.push("Site plan (top view)");
  if (S.designParams) tocLines.push("Design parameters");
  if (S.responseTime && responseRows.length) tocLines.push("Response time analysis");
  if (S.zoneComparison) tocLines.push("Zone comparison");
  if (S.wind) tocLines.push("Wind analysis");
  if (S.obstacles) tocLines.push("Obstacle & OLS analysis");
  if (S.ols3dImage) tocLines.push("3D OLS visualization");
  if (S.terrain) tocLines.push("Terrain analysis");
  if (S.compliance) tocLines.push("Compliance matrix");
  if (S.dataQuality) tocLines.push("Data quality");
  if (S.recommendations) tocLines.push("Recommendations");
  if (S.comparisonTable && comparisonRows?.length) tocLines.push("Scenario comparison");
  if (S.audit && (proj.auditLog || []).length) tocLines.push("Audit trail");
  if (S.assumptions) tocLines.push("Assumptions & limitations");

  const coverMark = (
    <Svg width={64} height={64} viewBox="0 0 88 88">
      <Rect x={6} y={6} width={76} height={76} rx={22} fill={PAL.navy} stroke="#2563eb" strokeWidth={1.25} />
      <Circle cx={44} cy={52} r={24} stroke="#0891b2" strokeWidth={1.75} fill="none" />
      <Circle cx={44} cy={52} r={15} stroke="#0891b2" strokeWidth={1} fill="none" opacity={0.5} />
      <Line x1={44} y1={28} x2={44} y2={14} stroke="#2563eb" strokeWidth={2} />
      <Line x1={44} y1={28} x2={29} y2={36} stroke="#2563eb" strokeWidth={2} />
      <Line x1={44} y1={28} x2={59} y2={36} stroke="#2563eb" strokeWidth={2} />
      <Circle cx={44} cy={28} r={3.5} fill="#2563eb" />
      <Path
        d="M32 40v16M56 40v16M32 48h24"
        stroke="#0891b2"
        strokeWidth={2.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );

  return (
    <Document>
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.logoBox}>{coverMark}</View>
        <Text style={styles.coverBrand}>HELI-VERTISAFE</Text>
        <Text style={styles.coverTitle}>Helipad feasibility assessment</Text>
        <Text style={styles.coverSub}>{proj.nm || "Project"}</Text>
        {site?.nm ? <Text style={styles.coverSub}>Site: {site.nm}</Text> : null}
        <Text style={styles.coverMeta}>Date: {today}</Text>
        <Text style={styles.coverMeta}>Prepared by: {preparedBy}</Text>
        <Text style={styles.coverMeta}>Reference: ICAO Annex 14 Vol II · GACAR Part 138 / 139 · {pcLabel}</Text>
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerStripe} fixed>
          <Text style={styles.headerCo}>{companyLine}</Text>
          <Text style={styles.headerPg} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
        <View style={styles.footerStripe} fixed>
          <Text style={styles.footerTxt}>Confidential · {proj.nm || "Project"}</Text>
        </View>

        {S.toc ? (
          <View style={styles.tocWrap}>
            <Text style={styles.h1}>Table of contents</Text>
            {tocLines.map((l, i) => (
              <Text key={i} style={styles.tocLine}>
                {i + 1}. {l}
              </Text>
            ))}
          </View>
        ) : null}

        {S.executive ? (
          <View>
            <Text style={styles.h1}>Executive summary</Text>
            <Text style={styles.p}>
              Assessment for {proj.nm} at {site.nm} (Lat {Number(site.lat).toFixed(4)}°, Lng {Number(site.lng).toFixed(4)}°, elev{" "}
              {site.elev} m AMSL). {rankedAll.length} scored zone(s) across {site.sw} m × {site.sh} m. Design aircraft: {hl.nm} (D = {D}
              m), {pcLabel}.
            </Text>
            <View style={styles.boxRec}>
              <Text style={{ fontSize: 9, fontWeight: "bold", color: PAL.pass, marginBottom: 4 }}>Best zone recommendation</Text>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: "#14532d" }}>
                Zone {bestZone.lb} — {bestZone.sc.tot}/100 (Grade {bestZone.sc.gr})
              </Text>
              <Text style={styles.p}>{bestZone.sc.rec}</Text>
              <Text style={styles.p}>
                Pad center: local {padC.x.toFixed(1)}, {padC.y.toFixed(1)} m · geo {Number(padGeo.lat).toFixed(5)}°, {Number(padGeo.lng).toFixed(5)}°
              </Text>
              {ori ? (
                <Text style={styles.p}>
                  Optimal heading {ori.hp} — {ori.us}% wind usability, crosswind {ori.xm} kt (limit {ori.lim} kt).
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {S.site ? (
          <View>
            <Text style={styles.h1}>Site information</Text>
            <View style={styles.row}>
              <Text style={[styles.cellL, styles.th]}>Field</Text>
              <Text style={[styles.cellL, styles.th]}>Value</Text>
            </View>
            {[
              ["Site name", site.nm],
              ["Coordinates", `${Number(site.lat).toFixed(5)}°, ${Number(site.lng).toFixed(5)}°`],
              ["Study area", `${site.sw} m × ${site.sh} m`],
              ["Grid", `${site.gc} × ${site.gr} (${zones.length} zones)`],
              ["Mag. declination", `${site.md}°`],
            ].map(([a, b], i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cellL}>{a}</Text>
                <Text style={styles.cellL}>{String(b)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {S.mapImage ? (
          <View>
            <Text style={styles.h1}>Site map</Text>
            {mapImage ? (
              <Image src={mapImage} style={{ width: 420, height: 236, marginBottom: 8 }} />
            ) : (
              <Text style={styles.p}>Map capture not available — refer to live Map tab in application.</Text>
            )}
          </View>
        ) : null}

        {S.sitePlanImage ? (
          <View>
            <Text style={styles.h1}>Site plan (top view)</Text>
            {sitePlanImage ? (
              <Image src={sitePlanImage} style={{ width: 420, height: 420, marginBottom: 8, objectFit: "contain" }} />
            ) : (
              <Text style={styles.p}>Plan capture not available — open Site Plan tab before export, or use live application.</Text>
            )}
          </View>
        ) : null}

        {S.designParams ? (
          <View>
            <Text style={styles.h1}>Design parameters</Text>
            <View style={styles.row}>
              <Text style={styles.cellL}>Aircraft</Text>
              <Text style={styles.cellL}>{hl.nm}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellL}>D-value / MTOW / category</Text>
              <Text style={styles.cellL}>
                {D} m · {hl.mtow} kg · {hl.cat}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellL}>Performance class</Text>
              <Text style={styles.cellL}>{pcLabel}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellL}>FATO / TLOF / SA footprint</Text>
              <Text style={styles.cellL}>
                {G.fato.toFixed(1)} m / {G.tlof.toFixed(1)} m / {G.sa.toFixed(1)} m (FATO+SA {G.tot.toFixed(1)} m)
              </Text>
            </View>
          </View>
        ) : null}

        {S.responseTime && responseRows.length > 0 ? (
          <View>
            <Text style={styles.h1}>Response time analysis</Text>
            <View style={styles.row}>
              <Text style={[{ flex: 1.8, fontSize: 8 }, styles.th]}>Destination</Text>
              <Text style={[{ flex: 0.8, fontSize: 8, textAlign: "center" }, styles.th]}>Dist</Text>
              <Text style={[{ flex: 0.8, fontSize: 8, textAlign: "center" }, styles.th]}>Flight</Text>
              <Text style={[{ flex: 0.8, fontSize: 8, textAlign: "center" }, styles.th]}>Ground</Text>
              <Text style={[{ flex: 0.8, fontSize: 8, textAlign: "center" }, styles.th]}>Total</Text>
              <Text style={[{ flex: 0.8, fontSize: 8, textAlign: "center" }, styles.th]}>Limit</Text>
              <Text style={[{ flex: 1.1, fontSize: 8, textAlign: "center" }, styles.th]}>Status</Text>
            </View>
            {responseRows.map(({ d, rt }, i) => (
              <View key={i} style={styles.row}>
                <Text style={{ flex: 1.8, fontSize: 8 }}>{d.nm}</Text>
                <Text style={{ flex: 0.8, fontSize: 8, textAlign: "center" }}>{rt.distKm} km</Text>
                <Text style={{ flex: 0.8, fontSize: 8, textAlign: "center" }}>{rt.flightMin}m</Text>
                <Text style={{ flex: 0.8, fontSize: 8, textAlign: "center" }}>{rt.groundMin ? `${rt.groundMin}m` : "0m"}</Text>
                <Text style={{ flex: 0.8, fontSize: 8, textAlign: "center", fontWeight: "bold" }}>{rt.totalMin}m</Text>
                <Text style={{ flex: 0.8, fontSize: 8, textAlign: "center" }}>{d.maxMinutes > 0 ? `≤ ${d.maxMinutes}m` : "-"}</Text>
                <Text style={[{ flex: 1.1, fontSize: 8, textAlign: "center" }, rt.meetsReq ? styles.badgePass : styles.badgeFail]}>
                  {d.maxMinutes > 0 ? (rt.meetsReq ? "MEETS" : "EXCEEDS") : "-"}
                </Text>
              </View>
            ))}
            <Text style={[styles.p, { fontSize: 7.5, color: PAL.muted, marginTop: 4 }]}>
              Total Time = Startup (3m) + Flight Time (@ ${(site.destinations?.[0]?.cruiseKt || 120)} kt) + Approach (2m) + Ground transfer.
            </Text>
          </View>
        ) : null}

        {S.zoneComparison && rankedAll.length ? (
          <View>
            <Text style={styles.h1}>Zone comparison</Text>
            <View style={styles.row}>
              <Text style={[styles.cellS, styles.th]}>#</Text>
              <Text style={[styles.cellL, styles.th]}>Zone</Text>
              <Text style={[styles.cellS, styles.th]}>W</Text>
              <Text style={[styles.cellS, styles.th]}>O</Text>
              <Text style={[styles.cellS, styles.th]}>T</Text>
              <Text style={[styles.cellS, styles.th]}>Tot</Text>
              <Text style={[styles.cellM, styles.th]}>Grade</Text>
            </View>
            {rankedAll.map((z, i) => (
              <View key={z.id} style={styles.row}>
                <Text style={styles.cellS}>{i + 1}</Text>
                <Text style={styles.cellL}>{z.lb}</Text>
                <Text style={styles.cellS}>{z.sc.bd.wind.s}</Text>
                <Text style={styles.cellS}>{z.sc.bd.obs.s}</Text>
                <Text style={styles.cellS}>{z.sc.bd.ter.s}</Text>
                <Text style={[styles.cellS, { fontWeight: "bold" }]}>{z.sc.tot}</Text>
                <Text style={[styles.cellM, i === 0 ? styles.badgePass : {}]}>{z.sc.gr}</Text>
              </View>
            ))}
            <Text style={[styles.p, { fontSize: 8, color: PAL.muted }]}>
              Weights: wind {(wt.wind * 100).toFixed(0)}% · obs {(wt.obs * 100).toFixed(0)}% · ter {(wt.ter * 100).toFixed(0)}% · acc{" "}
              {(wt.acc * 100).toFixed(0)}% · geo {(wt.geo * 100).toFixed(0)}% · env {(wt.env * 100).toFixed(0)}%
            </Text>
          </View>
        ) : null}

        {S.wind ? (
          <View>
            <Text style={styles.h1}>Wind analysis</Text>
            {windRoseImage ? (
              <Image src={windRoseImage} style={{ width: 220, height: 220, marginBottom: 8 }} />
            ) : (
              <Text style={styles.p}>
                Primary {bestZone?.wind?.pd ?? "—"}° @ {bestZone?.wind?.ps ?? "—"} kt; secondary {bestZone?.wind?.sd ?? "—"}° @ {bestZone?.wind?.ss ?? "—"} kt.
              </Text>
            )}
          </View>
        ) : null}

        {S.obstacles && obsRows.length ? (
          <View>
            <Text style={styles.h1}>Obstacle analysis & OLS</Text>
            <View style={styles.row}>
              <Text style={[styles.cellL, styles.th]}>Name</Text>
              <Text style={[styles.cellS, styles.th]}>H(m)</Text>
              <Text style={[styles.cellS, styles.th]}>D(m)</Text>
              <Text style={[styles.cellM, styles.th]}>OLS</Text>
            </View>
            {obsRows.map((o, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cellL}>{o.nm}</Text>
                <Text style={styles.cellS}>{o.h}</Text>
                <Text style={styles.cellS}>{o.d}</Text>
                <Text style={[styles.cellM, o.st === "FAIL APCH" ? styles.badgeFail : o.st === "WARN 1:2" ? styles.badgeWarn : styles.badgePass]}>{o.st}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {S.ols3dImage ? (
          <View>
            <Text style={styles.h1}>3D OLS visualization</Text>
            {ols3dImage ? (
              <Image src={ols3dImage} style={{ width: 400, height: 400, marginBottom: 8, objectFit: "contain" }} />
            ) : (
              <Text style={styles.p}>3D capture not available — open OLS Section tab once to cache the view, or export PNG from the 3D panel.</Text>
            )}
          </View>
        ) : null}

        {S.terrain ? (
          <View>
            <Text style={styles.h1}>Terrain analysis</Text>
            {terrainLines.map((line, i) => (
              <Text key={i} style={styles.p}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}

        {S.compliance ? (
          <View>
            <Text style={styles.h1}>Compliance matrix ({comp.summary.total} checks)</Text>
            <Text style={[styles.p, { fontWeight: "bold", color: comp.compliant ? PAL.pass : PAL.fail }]}>
              Overall: {comp.compliant ? "COMPLIANT" : "NON-COMPLIANT"} — {comp.summary.passed} pass · {comp.summary.failed} fail ·{" "}
              {comp.summary.warned} warn
            </Text>
            {S.complianceFailuresOnly && compChecks.length === 0 ? (
              <Text style={styles.p}>No FAIL or WARN items in automated check set for this view.</Text>
            ) : null}
            <View style={styles.row}>
              <Text style={[styles.cellS, styles.th]}>St</Text>
              <Text style={[styles.cellL, styles.th]}>Cat</Text>
              <Text style={[styles.cellL, styles.th]}>Reference / rule</Text>
              <Text style={[styles.cellL, styles.th]}>Finding</Text>
            </View>
            {(S.complianceFailuresOnly ? compChecks : comp.checks).map((c, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.cellS, statusStyle(c.status)]}>{c.status}</Text>
                <Text style={styles.cellL}>{c.cat}</Text>
                <Text style={styles.cellL}>{c.ref} — {c.rule}</Text>
                <Text style={[styles.cellL, { fontSize: 7 }]}>{c.detail}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {S.dataQuality && confBest ? (
          <View>
            <Text style={styles.h1}>Data quality</Text>
            <Text style={[styles.p, { fontWeight: "bold", color: confBest.gradeColor }]}>
              Overall {confBest.overall}% — {confBest.grade}
            </Text>
            {["wind", "obstacles", "terrain", "access"].map((cat) => {
              const d = confBest.details[cat];
              return (
                <View key={cat} style={styles.row}>
                  <Text style={styles.cellL}>{cat}</Text>
                  <Text style={styles.cellL}>{d.srcLabel}</Text>
                  <Text style={styles.cellS}>{d.score}%</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {S.recommendations && recs?.length ? (
          <View>
            <Text style={styles.h1}>Recommendations & actions</Text>
            {recs.map((r, i) => (
              <Text key={i} style={styles.p}>
                [{recPdfPrefix(r)}] {r.text}
                {r.detail ? ` — ${r.detail}` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        {S.comparisonTable && comparisonRows?.length ? (
          <View>
            <Text style={styles.h1}>Multi-scenario comparison</Text>
            <View style={styles.row}>
              <Text style={[styles.cellL, styles.th]}>Scenario</Text>
              <Text style={[styles.cellL, styles.th]}>Site</Text>
              <Text style={[styles.cellM, styles.th]}>Best Z</Text>
              <Text style={[styles.cellS, styles.th]}>Scr</Text>
              <Text style={[styles.cellM, styles.th]}>Comp</Text>
            </View>
            {comparisonRows.map((r, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cellL}>{r.scenarioName}</Text>
                <Text style={styles.cellL}>{r.siteNm}</Text>
                <Text style={styles.cellM}>{r.bestLb}</Text>
                <Text style={styles.cellS}>{r.score ?? "—"}</Text>
                <Text style={[styles.cellM, r.compliant ? styles.badgePass : styles.badgeFail]}>{r.compliant ? "PASS" : "FAIL"}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {S.audit && (proj.auditLog || []).length ? (
          <View>
            <Text style={styles.h1}>Appendix — audit trail</Text>
            {(proj.auditLog || []).map((log, i) => (
              <Text key={i} style={[styles.p, { fontSize: 8 }]}>
                {new Date(log.ts).toLocaleString("en-GB")} — {log.action}: {log.detail}
              </Text>
            ))}
          </View>
        ) : null}

        {S.assumptions ? (
          <View>
            <Text style={styles.h1}>Assumptions & limitations</Text>
            <Text style={styles.p}>• Wind frequencies are indicative; detailed meteorological study recommended.</Text>
            <Text style={styles.p}>• Obstacle geometry is as entered; survey required for certification.</Text>
            <Text style={styles.p}>• OLS check is simplified 2D logic; full 3D surfaces per ICAO required for authority submission.</Text>
            <Text style={styles.p}>• This output does not replace regulatory approval.</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
