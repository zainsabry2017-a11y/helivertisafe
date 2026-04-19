import { uid, autoCalcCoords } from "../utils/coords.js";
import { mkProj, mkSite, mkObs, mkSens, mkAccNode, mkDest, mkExclusion, mkLog } from "../data/models.js";
import { calcAllScores, makeRecs } from "../engine/scoring.js";
import { loadDemo } from "../data/demo.js";
import { zonePadCenter } from "../engine/geometry.js";

const SKIP_UNDO = ["STEP", "TAB", "SEL"];
const MAX_UNDO = 30;

function reducer(state, action) {
  const { type, payload } = action;
  switch (type) {
    case "STEP": return { ...state, step: payload };
    case "TAB": return { ...state, tab: payload };
    case "UP": return { ...state, proj: { ...state.proj, ...payload }, scored: false };
    case "US": return { ...state, site: { ...state.site, ...payload }, scored: false };
    case "SZ": {
      const sel = payload.some((z) => z.id === state.sel) ? state.sel : payload[0]?.id ?? null;
      return { ...state, zones: payload, sel, scored: false };
    }
    case "SEL": return { ...state, sel: payload };
    case "ZF": {
      const { zid, sec, fld, val } = payload;
      return { ...state, zones: state.zones.map(z => z.id !== zid ? z : (sec ? { ...z, [sec]: { ...z[sec], [fld]: val }, sc: null } : { ...z, [fld]: val, sc: null })), scored: false };
    }
    case "WIND_IMPORT": {
      const { zid, wind } = payload;
      return {
        ...state,
        zones: state.zones.map((z) =>
          z.id !== zid ? z : { ...z, wind: { ...z.wind, ...wind }, src: { ...z.src, wind: "survey" }, sc: null }
        ),
        scored: false,
      };
    }
    case "OB_SURVEY": {
      const { zid, add } = payload;
      return {
        ...state,
        zones: state.zones.map((z) => {
          if (z.id !== zid) return z;
          const c = zonePadCenter(z);
          const fixed = add.map((o) => {
            const dx = (o.x || 0) - c.x;
            const dy = (o.y || 0) - c.y;
            const d = Math.hypot(dx, dy);
            const br = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
            return { ...o, d: Math.round(d * 10) / 10, br: Math.round(br) };
          });
          return { ...z, obs: [...z.obs, ...fixed], sc: null, src: { ...z.src, obstacles: "survey" } };
        }),
        scored: false,
      };
    }
    case "APPLY_TERRAIN_SLOPES": {
      const a = state.site.terrainAnalysis;
      if (!a?.zoneSlopes?.length) return state;
      const map = new Map(a.zoneSlopes.map((x) => [x.zoneId, x]));
      return {
        ...state,
        zones: state.zones.map((z) => {
          const sl = map.get(z.id);
          if (!sl) return z;
          return {
            ...z,
            ter: { ...z.ter, slope: sl.slopePct, slopeDir: Math.round(sl.dirDeg), elevPts: a.nPts || z.ter.elevPts },
            sc: null,
          };
        }),
        scored: false,
      };
    }
    case "AO": return { ...state, zones: state.zones.map(z => z.id !== payload ? z : { ...z, obs: [...z.obs, mkObs()], sc: null }), scored: false };
    case "UO": {
      const { zid, oid, fld, val } = payload;
      return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, obs: z.obs.map(o => o.id === oid ? autoCalcCoords(o, fld, val) : o), sc: null }), scored: false };
    }
    case "DO": {
      const { zid, oid } = payload;
      return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, obs: z.obs.filter(o => o.id !== oid), sc: null }), scored: false };
    }
    case "TOG": return { ...state, zones: state.zones.map(z => z.id === payload ? { ...z, on: !z.on, sc: null } : z), scored: false };
    case "ASENS": return { ...state, zones: state.zones.map(z => z.id !== payload ? z : { ...z, sens: [...(z.sens || []), mkSens()], sc: null }), scored: false };
    case "USENS": { const { zid, sid, fld, val } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, sens: (z.sens || []).map(s => s.id === sid ? autoCalcCoords(s, fld, val) : s), sc: null }), scored: false }; }
    case "DSENS": { const { zid, sid } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, sens: (z.sens || []).filter(s => s.id !== sid), sc: null }), scored: false }; }
    case "ANODE": { const { zid } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, acc: { ...z.acc, nodes: [...(z.acc.nodes || []), mkAccNode()] }, sc: null }), scored: false }; }
    case "UNODE": { const { zid, nid, fld, val } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, acc: { ...z.acc, nodes: (z.acc.nodes || []).map(n => n.id === nid ? autoCalcCoords(n, fld, val) : n) }, sc: null }), scored: false }; }
    case "DNODE": { const { zid, nid } = payload; return { ...state, zones: state.zones.map(z => z.id !== zid ? z : { ...z, acc: { ...z.acc, nodes: (z.acc.nodes || []).filter(n => n.id !== nid) }, sc: null }), scored: false }; }
    case "AEXCL": return { ...state, site: { ...state.site, exclusions: [...(state.site.exclusions || []), mkExclusion()] } };
    case "UEXCL": {
      const { eid, fld, val } = payload;
      return {
        ...state,
        site: {
          ...state.site,
          exclusions: (state.site.exclusions || []).map((e) => {
            if (e.id !== eid) return e;
            let next = { ...e, [fld]: val };
            if (["x", "y", "w", "h"].includes(fld) && e.corners && e.corners.length >= 3) {
              next = { ...next, corners: undefined, areaM2: undefined };
            }
            return next;
          }),
        },
      };
    }
    case "DEXCL": return { ...state, site: { ...state.site, exclusions: (state.site.exclusions || []).filter(e => e.id !== payload) } };
    case "ADEST": return { ...state, site: { ...state.site, destinations: [...(state.site.destinations || []), mkDest()] } };
    case "UDEST": { const { did, fld, val } = payload; return { ...state, site: { ...state.site, destinations: (state.site.destinations || []).map(d => d.id === did ? { ...d, [fld]: val } : d) } }; }
    case "DDEST": return { ...state, site: { ...state.site, destinations: (state.site.destinations || []).filter(d => d.id !== payload) } };
    case "RUN": {
      const zones = payload?.precomputedZones
        ? payload.precomputedZones
        : state.zones.map(z => ({ ...z, sc: z.on ? calcAllScores(z, state.proj) : null }));
      const log = [...(state.proj.auditLog || []), mkLog("Analysis Run", zones.filter(z => z.sc).length + " zones scored")];
      return { ...state, zones, recs: makeRecs(zones, state.proj), scored: true, step: 5, tab: "overview", proj: { ...state.proj, auditLog: log } };
    }
    case "SAVE_SCENARIO": {
      const snap = {
        id: uid(), name: payload, savedAt: new Date().toISOString(),
        proj: JSON.parse(JSON.stringify(state.proj)),
        site: JSON.parse(JSON.stringify(state.site)),
        zones: JSON.parse(JSON.stringify(state.zones)),
        recs: state.recs,
        bestZone: (() => { const rk = state.zones.filter(z => z.sc).sort((a, b) => b.sc.tot - a.sc.tot); return rk[0] || null; })(),
      };
      const log = [...(state.proj.auditLog || []), mkLog("Scenario Saved", payload)];
      return { ...state, scenarios: [...state.scenarios, snap], proj: { ...state.proj, auditLog: log } };
    }
    case "WORKFLOW": {
      const log = [...(state.proj.auditLog || []), mkLog("Status Changed", state.proj.workflow + " → " + payload)];
      return { ...state, proj: { ...state.proj, workflow: payload, auditLog: log } };
    }
    case "DEL_SCENARIO": return { ...state, scenarios: state.scenarios.filter(s => s.id !== payload) };
    case "DUP_SCENARIO": {
      const src = state.scenarios.find(s => s.id === payload);
      if (!src) return state;
      const dup = { ...JSON.parse(JSON.stringify(src)), id: uid(), name: src.name + " (copy)", savedAt: new Date().toISOString() };
      return { ...state, scenarios: [...state.scenarios, dup] };
    }
    case "LOAD_SCENARIO": {
      const snap = state.scenarios.find(s => s.id === payload);
      if (!snap) return state;
      return { ...state, proj: JSON.parse(JSON.stringify(snap.proj)), site: JSON.parse(JSON.stringify(snap.site)), zones: JSON.parse(JSON.stringify(snap.zones)), recs: snap.recs, scored: true, sel: snap.zones[0]?.id || null, step: 5, tab: "overview" };
    }
    case "WHATIF": {
      // Quick re-score with different helicopter or PC
      const newProj = { ...state.proj, ...payload };
      const zones = state.zones.map(z => ({ ...z, sc: z.on ? calcAllScores(z, newProj) : null }));
      return { ...state, proj: newProj, zones, recs: makeRecs(zones, newProj), scored: true };
    }
    case "DEMO": { const d = loadDemo(); return { step: 0, proj: d.p, site: d.s, zones: d.zs, sel: d.zs[0].id, recs: [], scored: false, tab: "overview", scenarios: state.scenarios || [] }; }
    case "IMPORT": {
      const d = payload;
      const log = [...(d.proj?.auditLog || []), mkLog("Project Imported", d.proj?.nm || "")];
      return { step: 0, proj: { ...d.proj, auditLog: log }, site: d.site, zones: d.zones, sel: d.zones[0]?.id || null, recs: [], scored: false, tab: "overview", scenarios: d.scenarios || state.scenarios || [] };
    }
    case "RESET": { return { step: 0, proj: mkProj(), site: mkSite(), zones: [], sel: null, recs: [], scored: false, tab: "overview", scenarios: state.scenarios || [] }; }
    case "APPLY_ALL": {
      // Apply section data from selected zone to all other zones
      const { section, fromZid } = payload;
      const src = state.zones.find(z => z.id === fromZid);
      if (!src) return state;
      return { ...state, zones: state.zones.map(z => {
        if (z.id === fromZid || !z.on) return z;
        if (section === "wind") return { ...z, wind: { ...src.wind }, src: { ...z.src, wind: src.src?.wind || z.src?.wind }, sc: null };
        if (section === "terrain") return { ...z, ter: { ...src.ter }, src: { ...z.src, terrain: src.src?.terrain || z.src?.terrain }, sc: null };
        if (section === "access") return { ...z, acc: { ...src.acc, nodes: JSON.parse(JSON.stringify(src.acc.nodes || [])) }, src: { ...z.src, access: src.src?.access || z.src?.access }, sc: null };
        return z;
      }), scored: false };
    }
    default: return state;
  }
}

export function undoReducer(historyState, action) {
  if (action.type === "UNDO") {
    if (historyState.past.length === 0) return historyState;
    const prev = historyState.past[historyState.past.length - 1];
    return { past: historyState.past.slice(0, -1), present: prev, future: [historyState.present, ...historyState.future].slice(0, MAX_UNDO) };
  }
  if (action.type === "REDO") {
    if (historyState.future.length === 0) return historyState;
    const next = historyState.future[0];
    return { past: [...historyState.past, historyState.present].slice(-MAX_UNDO), present: next, future: historyState.future.slice(1) };
  }
  const newPresent = reducer(historyState.present, action);
  if (newPresent === historyState.present) return historyState;
  if (SKIP_UNDO.includes(action.type)) return { ...historyState, present: newPresent };
  return { past: [...historyState.past, historyState.present].slice(-MAX_UNDO), present: newPresent, future: [] };
}
