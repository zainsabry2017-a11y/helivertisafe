export function parseGeoJSON(text) {
  const gj = JSON.parse(text);
  const polys = [], pts = [];
  const extract = (geom, props) => {
    if (geom.type === "Polygon") {
      const ring = geom.coordinates[0].map(c => ({ x: c[0], y: c[1], z: c[2] || 0 }));
      polys.push({ vertices: ring, props: props || {} });
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach(poly => {
        const ring = poly[0].map(c => ({ x: c[0], y: c[1], z: c[2] || 0 }));
        polys.push({ vertices: ring, props: props || {} });
      });
    } else if (geom.type === "Point") {
      pts.push({ x: geom.coordinates[0], y: geom.coordinates[1], z: geom.coordinates[2] || 0, props: props || {} });
    } else if (geom.type === "LineString") {
      const ring = geom.coordinates.map(c => ({ x: c[0], y: c[1], z: c[2] || 0 }));
      polys.push({ vertices: ring, props: props || {}, open: true });
    }
  };
  if (gj.type === "FeatureCollection") gj.features.forEach(f => extract(f.geometry, f.properties));
  else if (gj.type === "Feature") extract(gj.geometry, gj.properties);
  else if (gj.geometry) extract(gj.geometry, {});
  return { polys, pts, count: polys.length + pts.length };
}
