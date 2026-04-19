import { mkProj, mkLog, mkSite, mkExclusion, mkZone, mkObs, mkSens, mkAccNode, mkDest } from "./models.js";

export function loadDemo() {
  const p = mkProj({ nm: "Al Arab Hospital Helipad", cl: "Ministry of Health", pt: "hospital", pc: "pc2", dh: "h145", mode: "feasibility", facility: "hospital_pad", desc: "Rooftop helipad feasibility study for EMS operations", workflow: "draft", auditLog: [mkLog("Project Created", "Al Arab Hospital Helipad")] });
  const s = mkSite({ nm: "Hospital Rooftop", lat: 21.5433, lng: 39.1728, elev: 48, sw: 300, sh: 300, gc: 3, gr: 3, md: 2.5, rt: 42,
    exclusions: [mkExclusion({ nm: "Mechanical Plant", reason: "Heavy equipment below deck", x: 200, y: 200, w: 80, h: 80 }), mkExclusion({ nm: "Parking Structure", reason: "Occupied structure", x: 0, y: 200, w: 100, h: 100 })],
    destinations: [
      mkDest({ nm: "King Fahd Hospital", tp: "hospital", lat: 21.4858, lng: 39.1925, cruiseKt: 120, groundMin: 5, required: true, maxMinutes: 20 }),
      mkDest({ nm: "KAMC Jeddah", tp: "hospital", lat: 21.5782, lng: 39.1644, cruiseKt: 120, groundMin: 3, required: true, maxMinutes: 15 }),
      mkDest({ nm: "King Abdulaziz Airport", tp: "airport", lat: 21.6796, lng: 39.1565, cruiseKt: 130, groundMin: 0, required: false, maxMinutes: 30 }),
    ]
  });
  const zs = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) zs.push(mkZone(r, c, s));

  Object.assign(zs[0].wind, { pd: 340, ps: 12, pf: 45, sd: 160, ss: 8, sf: 25, calm: 20 });
  zs[0].obs = [mkObs({ nm: "Water Tank", tp: "building", h: 6, d: 120, br: 15, w: 8, l: 8 }), mkObs({ nm: "AC Units", tp: "other", h: 3, d: 85, br: 270, w: 12, l: 4 })];
  Object.assign(zs[0].ter, { slope: 1.2, side: 0.8, soil: "firm", elevMin: 46, elevMax: 49, elevAvg: 47.5, elevPts: 12 });
  Object.assign(zs[0].acc, { rd: 50, bd: 80, nodes: [mkAccNode({ nm: "Main Gate", tp: "gate", dist: 50, importance: 5 }), mkAccNode({ nm: "ER Entrance", tp: "hospital", dist: 80, importance: 5 })] });
  zs[0].src = { wind: "documented", obstacles: "survey", terrain: "survey", access: "survey" };
  zs[0].sens = [mkSens({ nm: "Staff Housing", tp: "residential", level: "medium", dist: 200, br: 90 })];

  Object.assign(zs[1].wind, { pd: 340, ps: 14, pf: 40, sd: 75, ss: 16, sf: 30, calm: 15 });
  zs[1].obs = [mkObs({ nm: "Elevator Shaft", tp: "building", h: 12, d: 65, br: 45, w: 6, l: 6 }), mkObs({ nm: "Antenna", tp: "antenna", h: 18, d: 110, br: 350, w: 2, l: 2 }), mkObs({ nm: "Stairwell", tp: "building", h: 4, d: 40, br: 180, w: 8, l: 5 })];
  Object.assign(zs[1].ter, { slope: 2.5, side: 1.8, soil: "compacted", cf: -0.5, elevMin: 45, elevMax: 50, elevAvg: 47, elevPts: 8 });
  Object.assign(zs[1].acc, { rd: 120, bd: 45 });
  zs[1].src = { wind: "documented", obstacles: "estimated", terrain: "estimated", access: "survey" };
  zs[1].sens = [mkSens({ nm: "ICU Wing", tp: "hospital_zone", level: "high", dist: 80, br: 180 }), mkSens({ nm: "Pharmacy", tp: "sensitive", level: "low", dist: 150, br: 45 })];

  Object.assign(zs[2].wind, { pd: 340, ps: 14, pf: 42, sd: 250, ss: 10, sf: 28, calm: 15 });
  zs[2].obs = [mkObs({ nm: "Tower Block", tp: "building", h: 28, d: 90, br: 20, w: 25, l: 35 }), mkObs({ nm: "Crane", tp: "crane", h: 35, d: 150, br: 310, w: 3, l: 3, perm: false, startDate: "2025-01", endDate: "2026-06" })];
  Object.assign(zs[2].ter, { slope: 4.5, side: 3.2, soil: "mixed", cf: -2.5, elevMin: 42, elevMax: 52, elevAvg: 46, elevPts: 4 });
  Object.assign(zs[2].acc, { road: false, rd: 350, bd: 25, emer: false, util: false });
  zs[2].src = { wind: "estimated", obstacles: "estimated", terrain: "assumed", access: "assumed" };
  zs[2].sens = [mkSens({ nm: "School", tp: "school", level: "high", dist: 120, br: 270 }), mkSens({ nm: "Fuel Tank", tp: "fuel", level: "high", dist: 60, br: 150 })];

  Object.assign(zs[3].wind, { pd: 340, ps: 11, pf: 48, sd: 200, ss: 7, sf: 22, calm: 25 });
  zs[3].obs = [mkObs({ nm: "Light Pole", tp: "other", h: 4, d: 140, br: 90, w: 1, l: 1 })];
  Object.assign(zs[3].ter, { slope: 0.8, side: 0.5, soil: "rock", elevMin: 47, elevMax: 49, elevAvg: 48, elevPts: 16 });
  Object.assign(zs[3].acc, { rd: 30, bd: 120, nodes: [mkAccNode({ nm: "Staff Parking", tp: "road", dist: 30, importance: 4 }), mkAccNode({ nm: "Emergency Bay", tp: "emergency", dist: 40, importance: 5 })] });
  zs[3].src = { wind: "survey", obstacles: "survey", terrain: "survey", access: "survey" };
  zs[3].sens = [mkSens({ nm: "Staff Residence", tp: "residential", level: "low", dist: 300, br: 45 })];

  Object.assign(zs[4].wind, { pd: 340, ps: 13, pf: 44, sd: 90, ss: 11, sf: 26, calm: 18 });
  zs[4].obs = [mkObs({ nm: "Parking", tp: "building", h: 9, d: 70, br: 200, w: 30, l: 40 }), mkObs({ nm: "Trees", tp: "tree", h: 8, d: 95, br: 120 })];
  Object.assign(zs[4].ter, { slope: 1.8, side: 1.2, soil: "firm", cf: -0.3, elevMin: 46, elevMax: 50, elevAvg: 48, elevPts: 10 });
  Object.assign(zs[4].acc, { rd: 80, bd: 70 });
  zs[4].src = { wind: "documented", obstacles: "survey", terrain: "estimated", access: "documented" };
  zs[4].sens = [mkSens({ nm: "Hospital Garden", tp: "hospital_zone", level: "medium", dist: 60, br: 90 }), mkSens({ nm: "Visitor Parking", tp: "residential", level: "low", dist: 140, br: 220 })];

  zs[5].on = false;

  Object.assign(zs[6].wind, { pd: 340, ps: 12, pf: 46, sd: 180, ss: 9, sf: 24, calm: 22 });
  zs[6].obs = [mkObs({ nm: "Generator", tp: "building", h: 5, d: 55, br: 260, w: 8, l: 12 })];
  Object.assign(zs[6].ter, { slope: 2.2, side: 1.5, soil: "compacted", cf: -1 });
  Object.assign(zs[6].acc, { rd: 150, bd: 55, util: false });
  zs[6].sens = [mkSens({ nm: "Oxygen Storage", tp: "fuel", level: "high", dist: 45, br: 180 }), mkSens({ nm: "Ambulance Bay", tp: "hospital_zone", level: "medium", dist: 90, br: 0 })];

  Object.assign(zs[7].wind, { pd: 340, ps: 15, pf: 43, sd: 60, ss: 18, sf: 27, calm: 12 });
  zs[7].obs = [mkObs({ nm: "Hospital Wing", tp: "building", h: 22, d: 80, br: 330, w: 40, l: 60 }), mkObs({ nm: "HVAC", tp: "other", h: 7, d: 50, br: 140, w: 10, l: 10 })];
  Object.assign(zs[7].ter, { slope: 3, side: 2.5, soil: "soft", cf: -1.5 });
  Object.assign(zs[7].acc, { rd: 200, bd: 35, emer: false });
  zs[7].sens = [mkSens({ nm: "Maternity Ward", tp: "hospital_zone", level: "high", dist: 35, br: 330 }), mkSens({ nm: "Mosque", tp: "sensitive", level: "medium", dist: 180, br: 90 })];

  zs[8].on = false;
  return { p, s, zs };
}
