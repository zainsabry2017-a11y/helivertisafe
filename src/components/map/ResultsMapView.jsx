import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { K, scoreCol } from "../../utils/theme.js";
import { calcGeom } from "../../data/models.js";
import { zoneCentroid, zonePadCenter } from "../../engine/geometry.js";
import {
  siteFootprintPolygon,
  localToLatLng,
  zoneToLatLngRing,
  polygonAreaM2,
  obstacleSitePosition,
  destinationLatLng,
} from "../../utils/mapGeo.js";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const OSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
});
const SAT = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles &copy; Esri", maxZoom: 19 }
);

function hexToRgb(hex) {
  const h = (hex || "#888").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function ResultsMapView({ site, zones, proj, sel, onSelectZone }) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const baseRef = useRef({ active: "osm" });
  const [satellite, setSatellite] = useState(true);

  const best = [...zones].filter((z) => z.on && z.sc).sort((a, b) => b.sc.tot - a.sc.tot)[0];
  const G = calcGeom(proj);

  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return;
    const lat = site.lat || 21.5;
    const lng = site.lng || 39.2;
    const map = L.map(wrapRef.current, { zoomControl: true }).setView([lat, lng], 16);
    SAT.addTo(map);
    baseRef.current.active = "sat";
    const fg = L.featureGroup().addTo(map);
    overlayRef.current = fg;
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 200);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(wrapRef.current);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (satellite) {
      if (baseRef.current.active === "sat") return;
      try {
        map.removeLayer(OSM);
      } catch {
        // ignore
      }
      SAT.addTo(map);
      baseRef.current.active = "sat";
    } else {
      if (baseRef.current.active === "osm") return;
      try {
        map.removeLayer(SAT);
      } catch {
        // ignore
      }
      OSM.addTo(map);
      baseRef.current.active = "osm";
    }
  }, [satellite]);

  useEffect(() => {
    const map = mapRef.current;
    const fg = overlayRef.current;
    if (!map || !fg) return;
    fg.clearLayers();

    const foot = siteFootprintPolygon(site);
    L.polygon(foot, {
      color: K.cy,
      weight: 2,
      fillOpacity: 0,
      dashArray: "8 4",
    }).addTo(fg);

    (site.exclusions || []).forEach((ex) => {
      const area =
        ex.corners && ex.corners.length >= 3
          ? ex.areaM2 ?? polygonAreaM2(ex.corners)
          : (ex.w || 0) * (ex.h || 0);
      const tip = `${ex.nm || "Exclusion"}${area > 0 ? ` · ${Math.round(area).toLocaleString()} m²` : ""}`;
      if (ex.corners && ex.corners.length >= 3) {
        const latlngs = ex.corners.map((c) => {
          const p = localToLatLng(site, c.x, c.y);
          return [p.lat, p.lng];
        });
        L.polygon(latlngs, {
          color: K.rd,
          weight: 2,
          dashArray: "5 4",
          fillColor: K.rd,
          fillOpacity: 0.12,
        })
          .bindTooltip(tip, { sticky: true })
          .addTo(fg);
      } else {
        const nw = localToLatLng(site, ex.x || 0, ex.y || 0);
        const ne = localToLatLng(site, (ex.x || 0) + (ex.w || 0), ex.y || 0);
        const se = localToLatLng(site, (ex.x || 0) + (ex.w || 0), (ex.y || 0) + (ex.h || 0));
        const swc = localToLatLng(site, ex.x || 0, (ex.y || 0) + (ex.h || 0));
        L.polygon(
          [
            [nw.lat, nw.lng],
            [ne.lat, ne.lng],
            [se.lat, se.lng],
            [swc.lat, swc.lng],
          ],
          { color: K.rd, weight: 1.5, dashArray: "5 4", fillColor: K.rd, fillOpacity: 0.1 }
        )
          .bindTooltip(tip, { sticky: true })
          .addTo(fg);
      }
    });

    (zones || []).forEach((z) => {
      if (!z.on) return;
      const ring = zoneToLatLngRing(site, z);
      if (!ring.length) return;
      const closed = [...ring, ring[0]];
      const sc = z.sc?.tot ?? null;
      const col = sc != null ? scoreCol(sc) : K.bd;
      const { r, g, b } = hexToRgb(col);
      const poly = L.polygon(closed, {
        color: sel === z.id ? "#fff" : col,
        weight: sel === z.id ? 3 : 1.5,
        fillColor: `rgb(${r},${g},${b})`,
        fillOpacity: sc != null ? 0.28 + (sc / 100) * 0.35 : 0.08,
      }).addTo(fg);

      if (z.sc) {
        const html = `<div style="font-size:12px;line-height:1.35">
          <b>${z.lb}</b><br/>
          <b style="color:${col}">${z.sc.tot}</b> /100 &nbsp; <span style="color:${col}">${z.sc.gr}</span><br/>
          W ${z.sc.bd.wind?.s ?? "—"} · O ${z.sc.bd.obs?.s ?? "—"} · T ${z.sc.bd.ter?.s ?? "—"}<br/>
          A ${z.sc.bd.acc?.s ?? "—"} · G ${z.sc.bd.geo?.s ?? "—"} · E ${z.sc.bd.env?.s ?? "—"}
        </div>`;
        poly.bindPopup(html);
      } else {
        poly.bindPopup(`<b>${z.lb}</b><br/>Not scored`);
      }

      poly.on("click", () => onSelectZone?.(z.id));
    });

    (zones || []).forEach((z) => {
      z.obs?.forEach((o) => {
        if (!(o.h > 0)) return;
        const tip = `${o.nm || "Obs"} · ${o.h}m`;
        if (o.corners && o.corners.length >= 3) {
          const latlngs = o.corners.map((c) => {
            const p = localToLatLng(site, c.x, c.y);
            return [p.lat, p.lng];
          });
          L.polygon(latlngs, {
            color: K.rd,
            weight: 1.5,
            fillColor: K.am,
            fillOpacity: 0.18,
          })
            .bindTooltip(tip, { sticky: true })
            .addTo(fg);
        } else {
          const { x, y } = obstacleSitePosition(z, o);
          const p = localToLatLng(site, x, y);
          L.circleMarker([p.lat, p.lng], {
            radius: 5,
            color: K.rd,
            fillColor: K.am,
            fillOpacity: 0.9,
            weight: 1,
          })
            .bindTooltip(tip, { direction: "top" })
            .addTo(fg);
        }
      });
    });

    if (best && best.sc) {
      const cent = zonePadCenter(best);
      const cGeo = localToLatLng(site, cent.x, cent.y);
      const cLat = cGeo.lat;
      const cLng = cGeo.lng;
      const half = G.fato / 2;
      const fRing = [
        localToLatLng(site, cent.x - half, cent.y - half),
        localToLatLng(site, cent.x + half, cent.y - half),
        localToLatLng(site, cent.x + half, cent.y + half),
        localToLatLng(site, cent.x - half, cent.y + half),
      ].map((p) => [p.lat, p.lng]);
      L.polygon(fRing, {
        color: K.gn,
        weight: 2,
        fillColor: K.gn,
        fillOpacity: 0.2,
      })
        .bindTooltip(`FATO ${G.fato.toFixed(0)}m — ${best.lb}`)
        .addTo(fg);

      // Pad center marker (best)
      L.circleMarker([cLat, cLng], {
        radius: 6,
        color: K.gn,
        weight: 2,
        fillColor: "#0b1120",
        fillOpacity: 0.9,
      })
        .bindTooltip(`Pad center — ${best.lb}`, { direction: "top" })
        .addTo(fg);

      const ori = best.sc.ori;
      if (ori) {
        const h = ori.oh;
        const appLen = Math.min(G.appLen, Math.max(site.sw, site.sh) * 0.35);
        const p1 = destinationLatLng(cLat, cLng, h - 90, appLen);
        const p2 = destinationLatLng(cLat, cLng, h + 90, appLen);
        L.polyline(
          [
            [cLat, cLng],
            [p1.lat, p1.lng],
          ],
          { color: K.cy, weight: 2, dashArray: "6 4" }
        )
          .bindTooltip("Approach")
          .addTo(fg);
        L.polyline(
          [
            [cLat, cLng],
            [p2.lat, p2.lng],
          ],
          { color: K.cy, weight: 2, dashArray: "6 4" }
        ).addTo(fg);
      }

      const pd = best.wind?.pd ?? 0;
      const ps = best.wind?.ps ?? 0;
      if (ps > 0) {
        const blowTo = (pd + 180) % 360;
        const wLen = Math.min(site.sw, site.sh) * 0.25;
        const tip = destinationLatLng(cLat, cLng, blowTo, wLen);
        L.polyline(
          [
            [cLat, cLng],
            [tip.lat, tip.lng],
          ],
          { color: K.bl, weight: 4, opacity: 0.85 }
        )
          .bindTooltip(`Wind ~${ps}kt from ${pd}°`)
          .addTo(fg);
        const wing = 12;
        const back = destinationLatLng(tip.lat, tip.lng, (blowTo + 180) % 360, wing);
        const left = destinationLatLng(tip.lat, tip.lng, (blowTo - 140) % 360, wing * 0.8);
        const right = destinationLatLng(tip.lat, tip.lng, (blowTo + 140) % 360, wing * 0.8);
        L.polygon(
          [
            [tip.lat, tip.lng],
            [left.lat, left.lng],
            [back.lat, back.lng],
            [right.lat, right.lng],
          ],
          { color: K.bl, fillColor: K.bl, fillOpacity: 0.9, weight: 1 }
        ).addTo(fg);
      }
    }

    // Selected zone pad marker (if any)
    const selZ = (zones || []).find((z) => z.id === sel);
    if (selZ && selZ.on) {
      const c = zonePadCenter(selZ);
      const p = localToLatLng(site, c.x, c.y);
      L.circleMarker([p.lat, p.lng], {
        radius: 5,
        color: K.cy,
        weight: 2,
        fillColor: "#0b1120",
        fillOpacity: 0.85,
      })
        .bindTooltip(`Pad center — ${selZ.lb}`, { direction: "top" })
        .addTo(fg);
    }

    fg.eachLayer((ly) => ly.bringToFront?.());
  }, [site, zones, proj, sel, best, G.fato, G.appLen]);

  return (
    <div
      id="hvs-results-map-host"
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid " + K.bd,
        background: K.sf,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid " + K.bd,
          background: K.pn,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: K.dm }}>GEO MAP</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: K.dm, cursor: "pointer" }}>
          <input type="checkbox" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} />
          Satellite imagery
        </label>
      </div>
      <div ref={wrapRef} style={{ height: 520, width: "100%" }} />
      <div style={{ padding: "6px 10px", fontSize: 9, color: K.mu }}>
        Zones colored by score · click a zone for details · FATO and approaches on best zone · wind arrow (when speed &gt; 0) shows downwind direction
      </div>
    </div>
  );
}
