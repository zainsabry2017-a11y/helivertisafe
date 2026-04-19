import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import { K } from "../../utils/theme.js";
import {
  siteFootprintPolygon,
  localToLatLng,
  siteSizeFromLatBounds,
  exclusionFromLatLngRing,
  polygonAreaM2,
  obstacleSitePosition,
} from "../../utils/mapGeo.js";
import { mkExclusion } from "../../data/models.js";

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
  {
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  }
);

async function nominatimSearch(query) {
  if (!query.trim()) return [];
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
    encodeURIComponent(query.trim()) +
    "&limit=6";
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "HelivertiSafe/0.1 (site planning; local dev)",
    },
  });
  if (!res.ok) return [];
  return res.json();
}

export function SiteDefinitionMap({ site, zones, dp }) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const baseRef = useRef({ osm: null, sat: null, active: "osm" });
  const siteRef = useRef(site);
  const dpRef = useRef(dp);
  siteRef.current = site;
  dpRef.current = dp;

  const [satellite, setSatellite] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [drawHint, setDrawHint] = useState("");

  const defaultLat = site.lat || 21.5;
  const defaultLng = site.lng || 39.2;

  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return;
    const map = L.map(wrapRef.current, { zoomControl: true }).setView([defaultLat, defaultLng], site.lat ? 16 : 11);
    OSM.addTo(map);
    baseRef.current = { osm: OSM, sat: SAT, active: "osm" };

    const overlay = L.featureGroup().addTo(map);
    overlayRef.current = overlay;

    map.on("click", (e) => {
      if (map.pm?.globalDrawModeEnabled?.()) return;
      dpRef.current({ type: "US", payload: { lat: e.latlng.lat, lng: e.latlng.lng } });
    });

    map.on("pm:create", (e) => {
      const layer = e.layer;
      const shape = String(e.shape || "").toLowerCase();
      if (shape === "rectangle") {
        const b = layer.getBounds();
        const { lat, lng, sw, sh } = siteSizeFromLatBounds(b);
        const area = Math.round(sw * sh);
        setDrawHint(`Rectangle → site ${sw}×${sh} m (${area.toLocaleString()} m²)`);
        dpRef.current({ type: "US", payload: { lat, lng, sw, sh } });
        map.removeLayer(layer);
        return;
      }
      if (shape === "polygon") {
        let raw = layer.getLatLngs()[0];
        if (!raw || raw.length < 3) {
          map.removeLayer(layer);
          return;
        }
        let ring = raw.map((ll) => [ll.lat, ll.lng]);
        const a0 = ring[0];
        const aL = ring[ring.length - 1];
        if (a0[0] !== aL[0] || a0[1] !== aL[1]) ring = [...ring, a0];
        const s = siteRef.current;
        const { corners, box, areaM2 } = exclusionFromLatLngRing(s, ring);
        setDrawHint(`Polygon exclusion · ${corners.length - 1} vertices · ${Math.round(areaM2).toLocaleString()} m²`);
        const ex = mkExclusion({
          nm: `Exclusion — ${Math.round(areaM2)} m²`,
          reason: "Drawn on map (polygon)",
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          corners: corners.slice(0, -1),
          areaM2,
        });
        dpRef.current({
          type: "US",
          payload: { exclusions: [...(s.exclusions || []), ex] },
        });
        map.removeLayer(layer);
      }
    });

    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: true,
      drawCircle: false,
      drawCircleMarker: false,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

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
    const { osm, sat } = baseRef.current;
    if (!map || !osm || !sat) return;
    if (satellite) {
      if (baseRef.current.active !== "sat") {
        map.removeLayer(osm);
        sat.addTo(map);
        baseRef.current.active = "sat";
      }
    } else if (baseRef.current.active !== "osm") {
      map.removeLayer(sat);
      osm.addTo(map);
      baseRef.current.active = "osm";
    }
  }, [satellite]);

  useEffect(() => {
    const map = mapRef.current;
    const fg = overlayRef.current;
    if (!map || !fg) return;
    fg.clearLayers();

    const foot = siteFootprintPolygon(site);
    const siteArea = (site.sw || 0) * (site.sh || 0);
    L.polygon(foot, {
      color: K.cy,
      weight: 2,
      fillColor: K.cy,
      fillOpacity: 0.08,
    })
      .bindTooltip(`Study area ${site.sw}×${site.sh} m (${Math.round(siteArea).toLocaleString()} m²)`, { sticky: true })
      .addTo(fg);

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
          dashArray: "6 4",
          fillColor: K.rd,
          fillOpacity: 0.18,
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
          { color: K.rd, weight: 1.5, dashArray: "6 4", fillColor: K.rd, fillOpacity: 0.15 }
        )
          .bindTooltip(tip, { sticky: true })
          .addTo(fg);
      }
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
            color: K.am,
            weight: 1.5,
            fillColor: K.am,
            fillOpacity: 0.18,
            dashArray: "4 3",
          })
            .bindTooltip(tip, { sticky: true })
            .addTo(fg);
        } else {
          const { x, y } = obstacleSitePosition(z, o);
          const p = localToLatLng(site, x, y);
          L.circleMarker([p.lat, p.lng], { radius: 6, color: K.am, fillColor: K.am, fillOpacity: 0.85, weight: 1 })
            .bindTooltip(tip, { direction: "top" })
            .addTo(fg);
        }
      });
    });

    L.marker([site.lat || defaultLat, site.lng || defaultLng], {
      draggable: true,
      title: "Site center",
    })
      .on("dragend", (ev) => {
        const ll = ev.target.getLatLng();
        dpRef.current({ type: "US", payload: { lat: ll.lat, lng: ll.lng } });
      })
      .bindTooltip("Site center (drag or click map)", { direction: "top" })
      .addTo(fg);

  }, [site, zones, defaultLat, defaultLng]);

  const runSearch = useCallback(async () => {
    setSearchBusy(true);
    try {
      const hits = await nominatimSearch(searchQ);
      setSearchHits(hits);
    } finally {
      setSearchBusy(false);
    }
  }, [searchQ]);

  const pickHit = useCallback(
    (h) => {
      const lat = parseFloat(h.lat);
      const lng = parseFloat(h.lon);
      const map = mapRef.current;
      if (map) map.setView([lat, lng], 16, { animate: true });
      dp({ type: "US", payload: { lat, lng } });
      setSearchHits([]);
      setSearchQ(h.display_name || "");
    },
    [dp]
  );

  return (
    <div
      style={{
        marginBottom: 16,
        width: "100%",
        maxWidth: "100%",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid " + K.bd,
        background: K.sf,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          padding: "8px 10px",
          borderBottom: "1px solid " + K.bd,
          background: K.pn,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: K.dm, letterSpacing: 0.5 }}>MAP</span>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search place (Nominatim)…"
          style={{
            flex: 1,
            minWidth: 160,
            background: "rgba(21,34,54,0.6)",
            border: "1px solid " + K.bd,
            borderRadius: 6,
            padding: "6px 10px",
            color: K.tx,
            fontSize: 12,
          }}
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searchBusy}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: searchBusy ? "wait" : "pointer",
            background: K.bl,
            color: "#fff",
            border: "none",
          }}
        >
          {searchBusy ? "…" : "Search"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: K.dm, cursor: "pointer" }}>
          <input type="checkbox" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} />
          Satellite
        </label>
      </div>
      {searchHits.length > 0 && (
        <div
          style={{
            maxHeight: 140,
            overflowY: "auto",
            borderBottom: "1px solid " + K.bd,
            background: K.rs,
          }}
        >
          {searchHits.map((h) => (
            <div
              key={h.place_id}
              onClick={() => pickHit(h)}
              style={{
                padding: "6px 10px",
                fontSize: 11,
                color: K.tx,
                cursor: "pointer",
                borderBottom: "1px solid " + K.bd,
              }}
            >
              {h.display_name}
            </div>
          ))}
        </div>
      )}
      <div ref={wrapRef} style={{ height: 400, width: "100%" }} />
      <div style={{ padding: "6px 10px", fontSize: 9, color: K.mu, lineHeight: 1.4 }}>
        {drawHint ? (
          <span style={{ color: K.gn, fontWeight: 600 }}>{drawHint} · </span>
        ) : null}
        Click map (when not drawing) or drag marker to set site center · Rectangle → site size &amp; area · Polygon → exclusion zone (true shape + area; grid cells use polygon overlap) · Obstacles from all zones
      </div>
    </div>
  );
}
