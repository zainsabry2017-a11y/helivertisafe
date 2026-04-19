/**
 * Wind rose import (5.2): CSV rows, METAR paste, 8/16/36 sector tables.
 * Bins: { dirDeg, kt, pct } — dir = centre of sector (wind FROM), meteorological.
 */

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Parse flexible CSV: Direction(°), Speed(kt), Frequency(%) variants */
export function parseWindRoseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) throw new Error("Need a header row and at least one data row.");
  const head = lines[0].split(/[,;\t]/).map((c) => normHeader(c));
  let idxD = head.findIndex((h) => /direction|azimuth|bear/.test(h) || h === "dir" || /^dir[ec]?/.test(h));
  let idxS = head.findIndex((h) => /speed|knot|kt\b/.test(h));
  let idxF = head.findIndex((h) => /freq|percent|%/.test(h));
  if (idxD < 0 || idxS < 0) {
    if (head.length >= 2) {
      idxD = 0;
      idxS = 1;
      idxF = head.length >= 3 ? 2 : -1;
    } else throw new Error("Could not detect Direction and Speed columns.");
  }
  const bins = [];
  let calmPct = 0;
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(/[,;\t]/).map((c) => c.trim());
    if (cols.length < 2) continue;
    const dRaw = cols[idxD].toUpperCase();
    if (/CALM|VAR|VRB/.test(dRaw)) {
      const p = idxF >= 0 ? parseFloat(String(cols[idxF]).replace("%", "")) || 0 : 0;
      calmPct += p;
      continue;
    }
    let dir = parseFloat(cols[idxD]);
    if (!Number.isFinite(dir)) continue;
    dir = ((dir % 360) + 360) % 360;
    const kt = parseFloat(cols[idxS]) || 0;
    let pct = idxF >= 0 ? parseFloat(String(cols[idxF]).replace("%", "")) : NaN;
    if (!Number.isFinite(pct)) pct = 100 / Math.max(1, lines.length - 1);
    bins.push({ dirDeg: dir, kt, pct });
  }
  return { bins, calmPct };
}

/** Multiple METAR/TAF lines — wind groups like 27008KT, 21015G25KT */
export function parseMetarWindPaste(text) {
  const bins = [];
  const re = /\b(?:VRB|(\d{3}))(\d{2,3})(?:G(\d{2,3}))?KT\b/gi;
  for (const line of text.split(/\r?\n/)) {
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m[1]) {
        const dir = parseInt(m[1], 10);
        const kt = parseInt(m[2], 10);
        bins.push({ dirDeg: dir, kt, pct: 1 });
      }
    }
  }
  if (!bins.length) throw new Error("No wind groups found (expect e.g. 27008KT).");
  const by = new Map();
  for (const b of bins) {
    const key = `${b.dirDeg}|${b.kt}`;
    by.set(key, (by.get(key) || 0) + 1);
  }
  const tot = bins.length;
  const out = [];
  for (const [key, n] of by) {
    const [d, k] = key.split("|").map(Number);
    out.push({ dirDeg: d, kt: k, pct: (100 * n) / tot });
  }
  return { bins: out, calmPct: 0 };
}

/**
 * Table: first row = direction labels (N, NNE, … or degrees), first col = header or
 * whitespace-separated counts/percent per direction.
 * Supports pasted column of numbers matching nDirs.
 */
export function parseWindRoseTable(text, nDirs = 16) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("Need header + data rows.");
  const sep = /[,;\t]|\s{2,}/;
  const headTok = lines[0].split(sep).map((t) => t.trim()).filter(Boolean);
  const cardToDeg = {
N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  const dirs = [];
  for (const t of headTok) {
    const u = t.toUpperCase();
    if (cardToDeg[u] != null) dirs.push(cardToDeg[u]);
    else if (/^\d+$/.test(u)) dirs.push(parseInt(u, 10) % 360);
  }
  if (dirs.length !== nDirs) {
    if (headTok.length === nDirs) {
      const step = 360 / nDirs;
      for (let i = 0; i < nDirs; i++) dirs.push(i * step);
    } else {
      const step = 360 / nDirs;
      dirs.length = 0;
      for (let i = 0; i < nDirs; i++) dirs.push(i * step + step / 2);
    }
  }
  const dataRows = lines.slice(1);
  const freq = new Array(nDirs).fill(0);
  for (const row of dataRows) {
    const cells = row.split(sep).map((c) => c.trim()).filter(Boolean);
    for (let i = 0; i < Math.min(cells.length, nDirs); i++) {
      const v = parseFloat(cells[i].replace("%", ""));
      if (Number.isFinite(v)) freq[i] += v;
    }
  }
  if (!freq.some((f) => f > 0)) {
    const nums = lines[lines.length - 1].split(sep).map((c) => parseFloat(c)).filter((n) => Number.isFinite(n));
    if (nums.length >= nDirs) for (let i = 0; i < nDirs; i++) freq[i] = nums[i];
  }
  const mx = Math.max(...freq, 1e-6);
  const norm = freq.map((f) => (f / mx) * 30);
  const bins = [];
  for (let i = 0; i < nDirs; i++) {
    if (freq[i] > 0) bins.push({ dirDeg: dirs[i] ?? (i * (360 / nDirs) + 180 / nDirs), kt: norm[i], pct: freq[i] });
  }
  const sum = bins.reduce((s, b) => s + b.pct, 0);
  if (sum > 0) for (const b of bins) b.pct = (b.pct * 100) / sum;
  return { bins, calmPct: Math.max(0, 100 - sum) };
}

/** Collapse raw rows into n equal sectors (for charting). */
export function rebinRose(bins, calmPct, nSectors = 16) {
  const step = 360 / nSectors;
  const acc = Array.from({ length: nSectors }, (_, i) => ({
    dirDeg: i * step + step / 2,
    sumPct: 0,
    sumSpPct: 0,
  }));
  for (const b of bins) {
    const i = Math.min(nSectors - 1, Math.floor(((b.dirDeg % 360) / 360) * nSectors));
    acc[i].sumPct += b.pct;
    acc[i].sumSpPct += b.pct * (b.kt || 0);
  }
  const out = [];
  for (const a of acc) {
    if (a.sumPct <= 0) out.push({ dirDeg: a.dirDeg, kt: 0, pct: 0 });
    else out.push({ dirDeg: a.dirDeg, kt: a.sumSpPct / Math.max(a.sumPct, 1e-6), pct: a.sumPct });
  }
  const c = Math.max(0, calmPct || 0);
  return { roseBins: out, calm: c };
}

/** Angular difference 0–180 */
function angSep(a, b) {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

/** Derive primary / secondary / calm for existing engine. */
export function primarySecondaryFromBins(roseBins, calmPct) {
  const sorted = [...roseBins].filter((b) => b.pct > 0).sort((a, b) => b.pct - a.pct);
  const top = sorted[0] || { dirDeg: 0, kt: 0, pct: 0 };
  let sec = { dirDeg: 0, kt: 0, pct: 0 };
  for (let i = 1; i < sorted.length; i++) {
    if (angSep(sorted[i].dirDeg, top.dirDeg) >= 30) {
      sec = sorted[i];
      break;
    }
  }
  let calm = calmPct || 0;
  const cov = roseBins.reduce((s, b) => s + b.pct, 0);
  if (calm <= 0 && cov < 99.5) calm = Math.max(0, 100 - cov);
  return {
    pd: Math.round(top.dirDeg),
    ps: Math.round(top.kt * 10) / 10,
    pf: Math.round(top.pct * 10) / 10,
    sd: Math.round(sec.dirDeg),
    ss: Math.round(sec.kt * 10) / 10,
    sf: Math.round(sec.pct * 10) / 10,
    calm: Math.round(calm * 10) / 10,
  };
}

/** Merge-ready wind object for reducer */
export function applyImportToWind(parsed, nSectors = 16) {
  const { roseBins, calm } = rebinRose(parsed.bins, parsed.calmPct, nSectors);
  const ps = primarySecondaryFromBins(roseBins, calm);
  return {
    ...ps,
    roseBins,
    seasonal: "none",
  };
}
