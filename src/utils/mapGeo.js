import { zoneCentroid } from "../engine/geometry.js";

/** Meters per degree at a reference latitude (spherical approximation). */
export function metersPerDegree(latDeg) {
  const c = Math.cos((latDeg * Math.PI) / 180);
  return { mLat: 111320, mLng: 111320 * Math.max(0.2, Math.abs(c)) };
}

/** Site origin: NW corner at local (0,0), x east (m), y south (m). Center = (lat,lng) of site. */
export function siteNwCorner(site) {
  const lat = site.lat ?? 0;
  const lng = site.lng ?? 0;
  const sw = site.sw || 500;
  const sh = site.sh || 500;
  const { mLat, mLng } = metersPerDegree(lat);
  return {
    lat: lat + (sh / 2) / mLat,
    lng: lng - (sw / 2) / mLng,
    mLat,
    mLng,
  };
}

export function localToLatLng(site, x, y) {
  const nw = siteNwCorner(site);
  return {
    lat: nw.lat - (y / nw.mLat),
    lng: nw.lng + (x / nw.mLng),
  };
}

export function latLngToLocal(site, lat, lng) {
  const nw = siteNwCorner(site);
  return {
    x: (lng - nw.lng) * nw.mLng,
    y: (nw.lat - lat) * nw.mLat,
  };
}

/** Rectangle footprint [NW, NE, SE, SW] as {lat,lng} for Leaflet polygons. */
export function siteFootprintPolygon(site) {
  const sw = site.sw || 500;
  const sh = site.sh || 500;
  const nw = localToLatLng(site, 0, 0);
  const ne = localToLatLng(site, sw, 0);
  const se = localToLatLng(site, sw, sh);
  const swc = localToLatLng(site, 0, sh);
  return [
    [nw.lat, nw.lng],
    [ne.lat, ne.lng],
    [se.lat, se.lng],
    [swc.lat, swc.lng],
  ];
}

/** Zone corners in lat/lng (closed ring for Leaflet). */
export function zoneToLatLngRing(site, z) {
  if (z.corners && z.corners.length >= 3) {
    return z.corners.map((c) => {
      const p = localToLatLng(site, c.x, c.y);
      return [p.lat, p.lng];
    });
  }
  const w = site.sw / (site.gc || 1);
  const h = site.sh / (site.gr || 1);
  const x0 = (z.c || 0) * w;
  const y0 = (z.r || 0) * h;
  const pts = [
    [x0, y0],
    [x0 + w, y0],
    [x0 + w, y0 + h],
    [x0, y0 + h],
  ];
  return pts.map(([x, y]) => {
    const p = localToLatLng(site, x, y);
    return [p.lat, p.lng];
  });
}

/** Width/height (m) and center from a geographic axis-aligned bbox. */
export function siteSizeFromLatBounds(bounds) {
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();
  const midLat = (north + south) / 2;
  const { mLat, mLng } = metersPerDegree(midLat);
  const sw = Math.max(30, Math.round(Math.abs(east - west) * mLng));
  const sh = Math.max(30, Math.round(Math.abs(north - south) * mLat));
  return { lat: midLat, lng: (east + west) / 2, sw, sh };
}

/** Shoelace area (m²) for site-local corners {x,y}. */
export function polygonAreaM2(corners) {
  if (!corners || corners.length < 3) return 0;
  let a = 0;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += corners[i].x * corners[j].y - corners[j].x * corners[i].y;
  }
  return Math.abs(a) / 2;
}

/** Build exclusion corners (site m) + bbox + area from closed lat/lng ring [[lat,lng],...]. */
export function exclusionFromLatLngRing(site, ringLatLng) {
  const corners = ringLatLng.map(([lat, lng]) => {
    const p = latLngToLocal(site, lat, lng);
    return { x: p.x, y: p.y };
  });
  const box = exclusionBBoxFromLatLngRing(site, ringLatLng);
  const area = polygonAreaM2(corners);
  return { corners, box, areaM2: area };
}

/** Axis-aligned exclusion in site meters from polygon first ring (latlngs). */
export function exclusionBBoxFromLatLngRing(site, ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ll of ring) {
    const lat = Array.isArray(ll) ? ll[0] : ll.lat;
    const lng = Array.isArray(ll) ? ll[1] : ll.lng;
    const { x, y } = latLngToLocal(site, lat, lng);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/** Bearing in degrees clockwise from north; distance in meters. */
export function destinationLatLng(lat, lng, bearingDegFromNorth, distM) {
  const { mLat, mLng } = metersPerDegree(lat);
  const br = (bearingDegFromNorth * Math.PI) / 180;
  const dN = Math.cos(br) * distM;
  const dE = Math.sin(br) * distM;
  return { lat: lat + dN / mLat, lng: lng + dE / mLng };
}

export function obstacleSitePosition(z, o) {
  const cent = zoneCentroid(z);
  if (o.corners && o.corners.length >= 3) {
    const ox = o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length;
    const oy = o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length;
    return { x: ox, y: oy };
  }
  if (o.d > 0) {
    const rad = ((o.br || 0) - 90) * (Math.PI / 180);
    return { x: cent.x + Math.cos(rad) * o.d, y: cent.y + Math.sin(rad) * o.d };
  }
  return { x: cent.x, y: cent.y };
}
