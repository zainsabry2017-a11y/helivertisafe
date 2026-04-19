export function parseKML(text) {
  const polys = [], pts = [];
  // Strip namespaces for easier parsing
  const clean = text.replace(/xmlns\s*=\s*"[^"]*"/g, "").replace(/kml:/g, "");
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, "text/xml");
  const parseCoordsStr = (str) => str.trim().split(/[\s\n]+/).filter(Boolean).map(s => { const p = s.split(","); return { x: parseFloat(p[0]) || 0, y: parseFloat(p[1]) || 0, z: parseFloat(p[2]) || 0 }; }).filter(p => !isNaN(p.x) && (p.x !== 0 || p.y !== 0));
  const getCoords = (parent, tag) => {
    const el = parent.getElementsByTagName(tag)[0];
    if (!el) return null;
    const coords = el.getElementsByTagName("coordinates")[0];
    return coords ? parseCoordsStr(coords.textContent) : null;
  };
  doc.querySelectorAll("Placemark").forEach(pm => {
    const nm = pm.querySelector("name")?.textContent || pm.querySelector("description")?.textContent || "";
    const polyCoords = getCoords(pm, "Polygon");
    const ptCoords = getCoords(pm, "Point");
    const lsCoords = getCoords(pm, "LineString");
    if (polyCoords && polyCoords.length >= 3) polys.push({ vertices: polyCoords, props: { name: nm } });
    if (lsCoords && lsCoords.length >= 2) polys.push({ vertices: lsCoords, props: { name: nm }, open: true });
    if (ptCoords && ptCoords.length) pts.push({ ...ptCoords[0], props: { name: nm } });
  });
  return { polys, pts, count: polys.length + pts.length };
}
