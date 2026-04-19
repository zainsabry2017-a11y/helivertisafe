export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return { points: [], count: 0 };
  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const xi = header.findIndex(h => ["x","easting","lon","longitude","e"].includes(h));
  const yi = header.findIndex(h => ["y","northing","lat","latitude","n"].includes(h));
  const zi = header.findIndex(h => ["z","elevation","elev","alt","amsl"].includes(h));
  const ni = header.findIndex(h => ["name","label","id","desc"].includes(h));
  const ti = header.findIndex(h => ["type","category","class","kind"].includes(h));
  const hi = header.findIndex(h => ["height","h","agl","obs_height","ht"].includes(h));
  const wi = header.findIndex(h => ["width","w","obs_width"].includes(h));
  const li = header.findIndex(h => ["length","l","obs_length","depth"].includes(h));
  const di = header.findIndex(h => ["distance","dist","d","range"].includes(h));
  const bi = header.findIndex(h => ["bearing","br","azimuth","az","direction"].includes(h));
  if (xi < 0 || yi < 0) return { points: [], count: 0 };
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length <= xi || cols.length <= yi) continue;
    if (!cols[xi] && !cols[yi]) continue;
    points.push({
      x: parseFloat(cols[xi]) || 0, y: parseFloat(cols[yi]) || 0, z: zi >= 0 ? parseFloat(cols[zi]) || 0 : 0,
      name: ni >= 0 ? cols[ni] : "P" + i, type: ti >= 0 ? cols[ti] : "",
      obsH: hi >= 0 ? parseFloat(cols[hi]) || 0 : 0,
      obsW: wi >= 0 ? parseFloat(cols[wi]) || 0 : 0,
      obsL: li >= 0 ? parseFloat(cols[li]) || 0 : 0,
      dist: di >= 0 ? parseFloat(cols[di]) || 0 : 0,
      bearing: bi >= 0 ? parseFloat(cols[bi]) || 0 : 0,
    });
  }
  return { points, count: points.length };
}
