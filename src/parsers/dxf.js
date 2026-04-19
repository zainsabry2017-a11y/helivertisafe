import { DEG } from "../utils/coords.js";
import { mkManualZone, mkObs } from "../data/models.js";

export function parseDXF(text) {
  const lines = text.split(/\r?\n/), entities = [];
  let i = 0;
  // Skip to ENTITIES
  while (i < lines.length) { if (lines[i++].trim() === "ENTITIES") break; }

  // Also extract BLOCKS for INSERT resolution
  const blocks = {};
  { let bi = 0;
    while (bi < lines.length) { if (lines[bi++].trim() === "BLOCKS") break; }
    let bName = null, bEnts = [];
    while (bi < lines.length - 1) {
      const bc = parseInt(lines[bi++].trim()), bv = lines[bi++].trim();
      if (bc === 0 && bv === "BLOCK") { bName = null; bEnts = []; }
      else if (bc === 2 && bName === null) bName = bv;
      else if (bc === 0 && bv === "ENDBLK") { if (bName) blocks[bName] = bEnts; bName = null; bEnts = []; }
      else if (bc === 0 && bv === "ENDSEC") break;
    }
  }

  let cur = null, verts = [], pr = {}, splinePts = [];

  const saveEntity = () => {
    if (cur === "LWPOLYLINE" && verts.length >= 2) entities.push({ type: "poly", verts: [...verts], closed: pr.cl, layer: pr.ly || "" });
    else if (cur === "POLYLINE" && verts.length >= 2) entities.push({ type: "poly", verts: [...verts], closed: pr.cl, layer: pr.ly || "" });
    else if (cur === "LINE") entities.push({ type: "line", x1: pr.x1||0, y1: pr.y1||0, z1: pr.z1||0, x2: pr.x2||0, y2: pr.y2||0, z2: pr.z2||0, layer: pr.ly||"" });
    else if (cur === "CIRCLE") entities.push({ type: "circ", cx: pr.cx||0, cy: pr.cy||0, cz: pr.cz||0, r: pr.r||0, layer: pr.ly||"" });
    else if (cur === "ARC") {
      // Convert arc to polyline approximation
      const cx=pr.cx||0, cy=pr.cy||0, cz=pr.cz||0, r=pr.r||1, sa=pr.sa||0, ea=pr.ea||360;
      const pts = [];
      let a = sa; const step = 5;
      const end = ea < sa ? ea + 360 : ea;
      while (a <= end) { pts.push({ x: cx + r * Math.cos(a * DEG), y: cy + r * Math.sin(a * DEG), z: cz }); a += step; }
      if (pts.length >= 2) entities.push({ type: "poly", verts: pts, closed: false, layer: pr.ly || "", fromArc: true });
    }
    else if (cur === "ELLIPSE") {
      const cx=pr.cx||0, cy=pr.cy||0, cz=pr.cz||0, mx=pr.mx||1, my=pr.my||0, ratio=pr.ratio||1, sa=pr.sa||0, ea=pr.ea||Math.PI*2;
      const majLen = Math.sqrt(mx*mx + my*my), majAng = Math.atan2(my, mx);
      const pts = [];
      for (let t = sa; t <= ea; t += 0.1) {
        const px = majLen * Math.cos(t), py = majLen * ratio * Math.sin(t);
        pts.push({ x: cx + px * Math.cos(majAng) - py * Math.sin(majAng), y: cy + px * Math.sin(majAng) + py * Math.cos(majAng), z: cz });
      }
      if (pts.length >= 3) entities.push({ type: "poly", verts: pts, closed: Math.abs(ea - sa - Math.PI*2) < 0.01, layer: pr.ly || "", fromEllipse: true });
    }
    else if (cur === "SPLINE" && splinePts.length >= 2) {
      // Approximate spline: use control/fit points directly
      entities.push({ type: "poly", verts: [...splinePts], closed: pr.cl, layer: pr.ly || "", fromSpline: true });
    }
    else if (cur === "3DFACE") {
      const pts = [];
      if (pr.x1 !== undefined) pts.push({ x: pr.x1, y: pr.y1||0, z: pr.z1||0 });
      if (pr.x2 !== undefined) pts.push({ x: pr.x2, y: pr.y2||0, z: pr.z2||0 });
      if (pr.x3 !== undefined) pts.push({ x: pr.x3, y: pr.y3||0, z: pr.z3||0 });
      if (pr.x4 !== undefined) pts.push({ x: pr.x4, y: pr.y4||0, z: pr.z4||0 });
      if (pts.length >= 3) entities.push({ type: "poly", verts: pts, closed: true, layer: pr.ly || "", from3DFace: true });
    }
    else if (cur === "HATCH") {
      // HATCH boundary paths — already collected as verts
      if (verts.length >= 3) entities.push({ type: "poly", verts: [...verts], closed: true, layer: pr.ly || "", fromHatch: true });
    }
    else if (cur === "INSERT") {
      // Block reference — resolve from blocks table
      const bk = blocks[pr.blockName];
      if (bk) entities.push({ type: "block", name: pr.blockName, x: pr.bx||0, y: pr.by||0, z: pr.bz||0, layer: pr.ly||"", scaleX: pr.sx||1, scaleY: pr.sy||1, rotation: pr.rot||0 });
    }
  };

  while (i < lines.length - 1) {
    const c = parseInt(lines[i++].trim()), val = lines[i++].trim();
    if (c === 0) {
      saveEntity();
      cur = val; verts = []; pr = {}; splinePts = [];
      if (val === "VERTEX") { /* POLYLINE vertex — handled below */ }
      if (val === "SEQEND" && entities.length && entities[entities.length-1]?.collecting) { entities[entities.length-1].collecting = false; }
      if (val === "ENDSEC") break;
    } else if (cur === "LWPOLYLINE") {
      if (c===8) pr.ly=val; else if (c===70) pr.cl=parseInt(val)&1;
      else if (c===10) verts.push({x:parseFloat(val),y:0,z:0});
      else if (c===20&&verts.length) verts[verts.length-1].y=parseFloat(val);
      else if (c===30&&verts.length) verts[verts.length-1].z=parseFloat(val);
    } else if (cur === "POLYLINE") {
      if (c===8) pr.ly=val; else if (c===70) pr.cl=parseInt(val)&1;
    } else if (cur === "VERTEX") {
      if (c===10) verts.push({x:parseFloat(val),y:0,z:0});
      else if (c===20&&verts.length) verts[verts.length-1].y=parseFloat(val);
      else if (c===30&&verts.length) verts[verts.length-1].z=parseFloat(val);
    } else if (cur === "LINE") {
      if(c===8) pr.ly=val;
      else if(c===10) pr.x1=parseFloat(val); else if(c===20) pr.y1=parseFloat(val); else if(c===30) pr.z1=parseFloat(val);
      else if(c===11) pr.x2=parseFloat(val); else if(c===21) pr.y2=parseFloat(val); else if(c===31) pr.z2=parseFloat(val);
    } else if (cur === "CIRCLE" || cur === "ARC") {
      if(c===8) pr.ly=val; else if(c===10) pr.cx=parseFloat(val); else if(c===20) pr.cy=parseFloat(val); else if(c===30) pr.cz=parseFloat(val);
      else if(c===40) pr.r=parseFloat(val);
      else if(c===50) pr.sa=parseFloat(val); else if(c===51) pr.ea=parseFloat(val);
    } else if (cur === "ELLIPSE") {
      if(c===8) pr.ly=val; else if(c===10) pr.cx=parseFloat(val); else if(c===20) pr.cy=parseFloat(val); else if(c===30) pr.cz=parseFloat(val);
      else if(c===11) pr.mx=parseFloat(val); else if(c===21) pr.my=parseFloat(val);
      else if(c===40) pr.ratio=parseFloat(val); else if(c===41) pr.sa=parseFloat(val); else if(c===42) pr.ea=parseFloat(val);
    } else if (cur === "SPLINE") {
      if(c===8) pr.ly=val; else if(c===70) pr.cl=parseInt(val)&1;
      else if(c===11) splinePts.push({x:parseFloat(val),y:0,z:0}); // fit points
      else if(c===21&&splinePts.length) splinePts[splinePts.length-1].y=parseFloat(val);
      else if(c===31&&splinePts.length) splinePts[splinePts.length-1].z=parseFloat(val);
      else if(c===10&&!splinePts.length) splinePts.push({x:parseFloat(val),y:0,z:0}); // control points fallback
      else if(c===20&&splinePts.length&&!splinePts[splinePts.length-1].y) splinePts[splinePts.length-1].y=parseFloat(val);
    } else if (cur === "3DFACE") {
      if(c===8) pr.ly=val;
      else if(c===10) pr.x1=parseFloat(val); else if(c===20) pr.y1=parseFloat(val); else if(c===30) pr.z1=parseFloat(val);
      else if(c===11) pr.x2=parseFloat(val); else if(c===21) pr.y2=parseFloat(val); else if(c===31) pr.z2=parseFloat(val);
      else if(c===12) pr.x3=parseFloat(val); else if(c===22) pr.y3=parseFloat(val); else if(c===32) pr.z3=parseFloat(val);
      else if(c===13) pr.x4=parseFloat(val); else if(c===23) pr.y4=parseFloat(val); else if(c===33) pr.z4=parseFloat(val);
    } else if (cur === "HATCH") {
      if(c===8) pr.ly=val;
      else if(c===10) verts.push({x:parseFloat(val),y:0,z:0});
      else if(c===20&&verts.length) verts[verts.length-1].y=parseFloat(val);
    } else if (cur === "INSERT") {
      if(c===8) pr.ly=val; else if(c===2) pr.blockName=val;
      else if(c===10) pr.bx=parseFloat(val); else if(c===20) pr.by=parseFloat(val); else if(c===30) pr.bz=parseFloat(val);
      else if(c===41) pr.sx=parseFloat(val); else if(c===42) pr.sy=parseFloat(val); else if(c===50) pr.rot=parseFloat(val);
    }
  }
  saveEntity();

  const closed = entities.filter(e => e.type==="poly" && e.closed && e.verts.length>=3);
  const open = entities.filter(e => e.type==="poly" && !e.closed);
  const allLines = entities.filter(e => e.type==="line");
  const circles = entities.filter(e => e.type==="circ");
  const blockRefs = entities.filter(e => e.type==="block");
  const layers = [...new Set(entities.map(e => e.layer).filter(Boolean))];

  return { entities, closed, open, allLines, circles, blockRefs, layers, count: entities.length };
}

export function dxfToData(parsed, siteW, siteH) {
  const zones = [], obs = [];
  const allPts = []; parsed.closed.forEach(p => p.verts.forEach(v => allPts.push(v)));
  if (!allPts.length) return { zones, obs };
  const xs = allPts.map(p=>p.x), ys = allPts.map(p=>p.y);
  const oX = Math.min(...xs), oY = Math.min(...ys);
  const threshArea = siteW * siteH * 0.02;
  for (const poly of parsed.closed) {
    const pts = poly.verts.map(v => ({ x: v.x - oX, y: v.y - oY, z: v.z || 0 }));
    let area = 0;
    for (let j=0;j<pts.length;j++) { const k=(j+1)%pts.length; area += pts[j].x*pts[k].y - pts[k].x*pts[j].y; }
    area = Math.abs(area)/2;
    if (area > threshArea) {
      zones.push(mkManualZone("D" + (zones.length+1), pts.length>=4 ? pts.slice(0,4) : [...pts, pts[pts.length-1]]));
    } else {
      const cx = pts.reduce((s,p)=>s+p.x,0)/pts.length, cy = pts.reduce((s,p)=>s+p.y,0)/pts.length;
      const pxs = pts.map(p=>p.x), pys = pts.map(p=>p.y);
      obs.push(mkObs({ nm: poly.layer||"DXF_"+(obs.length+1), corners: pts.length>=4?pts.slice(0,4):[...pts,pts[0]],
        x: cx, y: cy, w: Math.max(...pxs)-Math.min(...pxs), l: Math.max(...pys)-Math.min(...pys),
        d: Math.sqrt(cx*cx+cy*cy), br: Math.round(Math.atan2(cx,cy)*180/Math.PI) }));
    }
  }
  return { zones, obs };
}
