export function parseWKT(text) {
  const polys = [];
  const matches = text.matchAll(/POLYGON\s*\(\(([\d\s.,-]+)\)\)/gi);
  for (const m of matches) {
    const verts = m[1].split(",").map(s => { const p = s.trim().split(/\s+/); return { x: parseFloat(p[0]) || 0, y: parseFloat(p[1]) || 0, z: parseFloat(p[2]) || 0 }; });
    polys.push({ vertices: verts });
  }
  return { polys, count: polys.length };
}
