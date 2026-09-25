import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { K } from "../../utils/theme.js";
import { DEG, clamp } from "../../utils/coords.js";
import { calcGeom, getHeli } from "../../data/models.js";
import { zonePadCenter } from "../../engine/geometry.js";
import { calculateDownwash } from "../../engine/downwash.js";
import { HELIS, PC_DATA } from "../../data/constants.js";

/**
 * High-Performance, Precision 3D Helipad, OLS Limitation Surface & Rotor Downwash Visualizer.
 * Fully compliant with ICAO Annex 14 Vol II, Saudi GACAR Part 138, and FAA AC 150/5390.
 *
 * Supports dynamic per-flight aircraft switching and performance class configuration,
 * with exact geometric width capping, 2-stage slope gradients, and downwash outwash profiles.
 */
export const Obs3D = forwardRef(function Obs3D({ zone, proj, size = 520, onSnapshotReady }, ref) {
  const mountRef = useRef(null);
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const animStateRef = useRef({ rotorAngle: 0, beaconTime: 0, autoRotate: false });

  // Camera navigation & interaction state
  const dragRef = useRef({
    active: false,
    rightActive: false,
    px: 0,
    py: 0,
    rotX: 0.58, // elevation angle
    rotY: 0.78, // azimuth angle
    panX: 0,
    panY: 0,
    panZ: 0,
    zoom: 1.0,
    baseCamDist: 180,
  });

  // Per-Flight Aircraft & Performance Class Selection
  const [selectedHeliId, setSelectedHeliId] = useState(() => proj?.dh || "bell412");
  const [selectedPc, setSelectedPc] = useState(() => proj?.pc || "pc1");

  // Keep synced if parent project changes
  useEffect(() => {
    if (proj?.dh) setSelectedHeliId(proj.dh);
    if (proj?.pc) setSelectedPc(proj.pc);
  }, [proj?.dh, proj?.pc]);

  // Dynamic Flight Project Context
  const activeProj = useMemo(() => ({
    ...proj,
    dh: selectedHeliId,
    pc: selectedPc,
  }), [proj, selectedHeliId, selectedPc]);

  const G = useMemo(() => calcGeom(activeProj), [activeProj]);
  const heli = useMemo(() => getHeli(activeProj), [activeProj]);
  const cent = useMemo(() => (zone ? zonePadCenter(zone) : { x: 0, y: 0 }), [zone]);
  const downwash = useMemo(() => calculateDownwash(heli, proj?.elev || 0), [heli, proj?.elev]);

  // Layer toggles & visual modes
  const [showApproach, setShowApproach] = useState(true);
  const [showTransitional, setShowTransitional] = useState(true);
  const [showInnerHoriz, setShowInnerHoriz] = useState(false);
  const [showDownwash, setShowDownwash] = useState(true);
  const [showAircraft, setShowAircraft] = useState(true);
  const [showRings, setShowRings] = useState(true);
  const [showFlightPath, setShowFlightPath] = useState(true);
  const [showRotorAnim, setShowRotorAnim] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [approachHeading, setApproachHeading] = useState(() => (zone?.wind?.pd !== undefined ? zone.wind.pd : 0));
  const [hoveredObs, setHoveredObs] = useState(null);
  const [error, setError] = useState(null);

  // References to dynamic objects for live updates without full scene rebuild
  const approachGroupRef = useRef(null);
  const transitionalGroupRef = useRef(null);
  const flightPathGroupRef = useRef(null);
  const downwashGroupRef = useRef(null);
  const downwashParticlesRef = useRef(null);
  const ihMeshRef = useRef(null);
  const aircraftGroupRef = useRef(null);
  const rotorRef = useRef(null);
  const tailRotorRef = useRef(null);
  const ringsGroupRef = useRef(null);
  const beaconLightsRef = useRef([]);
  const obstacleMeshesRef = useRef([]);
  const lightsGroupRef = useRef(null);

  // Sync approach heading when zone primary wind changes
  useEffect(() => {
    if (zone?.wind?.pd !== undefined) {
      setApproachHeading(zone.wind.pd);
    }
  }, [zone?.wind?.pd]);

  useImperativeHandle(ref, () => ({
    capturePng: () => {
      const r = rendererRef.current;
      const s = sceneRef.current;
      const c = cameraRef.current;
      if (!r || !s || !c) return null;
      r.render(s, c);
      try {
        return r.domElement.toDataURL("image/png");
      } catch (e) {
        console.warn("Obs3D capture:", e);
        return null;
      }
    },
  }));

  // Camera preset transitions
  const setCameraPreset = (preset) => {
    const dr = dragRef.current;
    dr.panX = 0;
    dr.panY = 0;
    dr.panZ = 0;
    if (preset === "iso") {
      dr.rotX = 0.58;
      dr.rotY = 0.78;
      dr.zoom = 1.0;
    } else if (preset === "top") {
      dr.rotX = Math.PI / 2 - 0.001; // top-down 2D
      dr.rotY = 0;
      dr.zoom = 1.15;
    } else if (preset === "glideslope") {
      const rad = (approachHeading * Math.PI) / 180;
      dr.rotX = 0.14; // ~8 degree glideslope viewpoint
      dr.rotY = rad + Math.PI;
      dr.zoom = 0.85;
    } else if (preset === "profile") {
      const rad = (approachHeading * Math.PI) / 180;
      dr.rotX = 0.05; // side elevation profile
      dr.rotY = rad + Math.PI / 2;
      dr.zoom = 1.1;
    }
  };

  // Helper: Create high-contrast TLOF canvas texture
  const createPadTexture = (fatoSize, tlofSize, dValue, mtowKg, isVertiport) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = "#273549";
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 1024;
      const ry = Math.random() * 1024;
      ctx.fillRect(rx, ry, Math.random() * 4 + 1, Math.random() * 4 + 1);
    }

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 14;
    ctx.setLineDash([48, 36]);
    ctx.strokeRect(32, 32, 960, 960);
    ctx.setLineDash([]);

    const tlofRatio = Math.min(0.85, Math.max(0.45, tlofSize / fatoSize));
    const padW = 960 * tlofRatio;
    const padOffset = (1024 - padW) / 2;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(padOffset, padOffset, padW, padW);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 18;
    ctx.strokeRect(padOffset + 10, padOffset + 10, padW - 20, padW - 20);

    const cx = 512, cy = 512;
    const circleR = padW * 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 16;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.floor(padW * 0.32)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(isVertiport ? "V" : "H", cx, cy);

    ctx.font = `700 ${Math.floor(padW * 0.065)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`D = ${dValue.toFixed(1)}m`, cx, padOffset + padW * 0.12);
    const mtowT = (mtowKg / 1000).toFixed(1);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`MAX ${mtowT}t`, cx, padOffset + padW * 0.88);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  };

  // Helper: Procedural 3D Helicopter / eVTOL Aircraft Model
  const createAircraftModel = (dVal, heliMeta, isVertiport) => {
    const group = new THREE.Group();
    const scale = dVal / 16.0;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: isVertiport ? 0x06b6d4 : 0x2563eb,
      metalness: 0.75,
      roughness: 0.25,
      emissive: isVertiport ? 0x0891b2 : 0x1d4ed8,
      emissiveIntensity: 0.15,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.72,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      ior: 1.45,
    });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

    const cabinGeo = new THREE.ConeGeometry(1.6 * scale, 6.5 * scale, 12);
    cabinGeo.rotateZ(Math.PI / 2);
    cabinGeo.scale(1, 0.75, 0.85);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0.5 * scale, 1.8 * scale, 0);
    cabin.castShadow = true;
    group.add(cabin);

    const noseGeo = new THREE.SphereGeometry(1.25 * scale, 16, 12);
    noseGeo.scale(1.2, 0.7, 0.75);
    const nose = new THREE.Mesh(noseGeo, glassMat);
    nose.position.set(-1.8 * scale, 1.8 * scale, 0);
    group.add(nose);

    const boomGeo = new THREE.CylinderGeometry(0.32 * scale, 0.55 * scale, 7.5 * scale, 10);
    boomGeo.rotateZ(Math.PI / 2);
    const boom = new THREE.Mesh(boomGeo, bodyMat);
    boom.position.set(5.2 * scale, 2.0 * scale, 0);
    boom.castShadow = true;
    group.add(boom);

    const finGeo = new THREE.BoxGeometry(1.2 * scale, 1.8 * scale, 0.15 * scale);
    const fin = new THREE.Mesh(finGeo, bodyMat);
    fin.position.set(8.8 * scale, 2.7 * scale, 0);
    group.add(fin);

    const hStabGeo = new THREE.BoxGeometry(0.6 * scale, 0.1 * scale, 2.2 * scale);
    const hStab = new THREE.Mesh(hStabGeo, bodyMat);
    hStab.position.set(7.5 * scale, 2.1 * scale, 0);
    group.add(hStab);

    const skidGeo = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 7.0 * scale, 8);
    skidGeo.rotateZ(Math.PI / 2);
    const leftSkid = new THREE.Mesh(skidGeo, darkMetal);
    leftSkid.position.set(0, 0.3 * scale, 1.2 * scale);
    const rightSkid = new THREE.Mesh(skidGeo, darkMetal);
    rightSkid.position.set(0, 0.3 * scale, -1.2 * scale);
    group.add(leftSkid, rightSkid);

    const strutGeo = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 1.4 * scale, 6);
    const s1 = new THREE.Mesh(strutGeo, darkMetal);
    s1.position.set(-1.5 * scale, 1.0 * scale, 0.65 * scale);
    s1.rotation.x = 0.4;
    const s2 = new THREE.Mesh(strutGeo, darkMetal);
    s2.position.set(-1.5 * scale, 1.0 * scale, -0.65 * scale);
    s2.rotation.x = -0.4;
    const s3 = new THREE.Mesh(strutGeo, darkMetal);
    s3.position.set(1.5 * scale, 1.0 * scale, 0.65 * scale);
    s3.rotation.x = 0.4;
    const s4 = new THREE.Mesh(strutGeo, darkMetal);
    s4.position.set(1.5 * scale, 1.0 * scale, -0.65 * scale);
    s4.rotation.x = -0.4;
    group.add(s1, s2, s3, s4);

    const mastGeo = new THREE.CylinderGeometry(0.18 * scale, 0.18 * scale, 0.9 * scale, 10);
    const mast = new THREE.Mesh(mastGeo, darkMetal);
    mast.position.set(0.2 * scale, 3.2 * scale, 0);
    group.add(mast);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0.2 * scale, 3.7 * scale, 0);
    const rRadius = (heliMeta?.rtr || dVal * 0.9) / 2;
    const bladeGeo = new THREE.BoxGeometry(rRadius, 0.05 * scale, 0.38 * scale);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const blade = new THREE.Mesh(bladeGeo, darkMetal);
      blade.position.set(Math.cos(angle) * (rRadius / 2), 0, Math.sin(angle) * (rRadius / 2));
      blade.rotation.y = -angle;
      rotorGroup.add(blade);

      const tipGeo = new THREE.BoxGeometry(rRadius * 0.15, 0.06 * scale, 0.39 * scale);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(Math.cos(angle) * (rRadius * 0.925), 0, Math.sin(angle) * (rRadius * 0.925));
      tip.rotation.y = -angle;
      rotorGroup.add(tip);
    }
    group.add(rotorGroup);

    const tailRotorGroup = new THREE.Group();
    tailRotorGroup.position.set(9.0 * scale, 2.7 * scale, 0.22 * scale);
    const tailBladeGeo = new THREE.BoxGeometry(0.12 * scale, 1.6 * scale, 0.04 * scale);
    const tb1 = new THREE.Mesh(tailBladeGeo, darkMetal);
    const tb2 = new THREE.Mesh(tailBladeGeo, darkMetal);
    tb2.rotation.z = Math.PI / 2;
    tailRotorGroup.add(tb1, tb2);
    group.add(tailRotorGroup);

    const navGeo = new THREE.SphereGeometry(0.12 * scale, 8, 8);
    const redLight = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    redLight.position.set(0, 1.8 * scale, 1.4 * scale);
    const greenLight = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    greenLight.position.set(0, 1.8 * scale, -1.4 * scale);
    const tailBeacon = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    tailBeacon.position.set(9.2 * scale, 3.2 * scale, 0);
    group.add(redLight, greenLight, tailBeacon);

    const beacon = new THREE.PointLight(0xff2222, 1.5, 20 * scale);
    beacon.position.set(0.2 * scale, 3.9 * scale, 0);
    group.add(beacon);

    return { group, rotorGroup, tailRotorGroup, beacon };
  };

  // Helper: Create Windsock
  const createWindsock = (height, headingDeg) => {
    const group = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, height, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = height / 2;
    group.add(pole);

    const ringGeo = new THREE.TorusGeometry(0.45, 0.04, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height;
    group.add(ring);

    const sockGeo = new THREE.ConeGeometry(0.45, 2.2, 12, 1, true);
    sockGeo.rotateZ(Math.PI / 2);
    const sockMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
      roughness: 0.7,
    });
    const sock = new THREE.Mesh(sockGeo, sockMat);
    sock.position.set(1.1, height, 0);
    group.rotation.y = -((headingDeg - 90) * Math.PI) / 180;
    group.add(sock);

    return group;
  };

  /**
   * Helper: Create ICAO Annex 14 Vol II Approach/Take-off Climb Surface
   * Accurate to Performance Class & Helicopter D:
   * - Inner width = Safety Area Width (geom.tot)
   * - Splay expands at geom.splay until capped at geom.maxWidth (e.g. 7D for PC-1, 4D for PC-2, 3D for PC-3)
   * - Continues parallel after reaching maximum width to outer limit (geom.appLen)
   * - 2-Stage elevation gradient (innerLenM @ innerG, outerLenM @ outerG)
   */
  const buildApproachSurfaces = (geom, maxDist) => {
    const group = new THREE.Group();
    const saHalf = geom.tot / 2; // Outer boundary of safety area
    const innerW = saHalf;
    const maxHalfW = (geom.maxWidth || geom.tot * 2) / 2;
    const appLen = Math.min(geom.appLen, maxDist * 1.15);
    const splay = geom.splay || 0.1;

    // Distance where splay reaches maximum regulatory width
    const splayEndDist = splay > 0 && maxHalfW > innerW ? (maxHalfW - innerW) / splay : appLen;

    const innerLen = Math.min(geom.innerLenM || appLen * 0.35, appLen);
    const innerH = innerLen * geom.innerG;
    const outerLen = appLen - innerLen;
    const totalH = innerH + outerLen * geom.outerG;
    const baseY = 0.22;

    const getW = (s) => Math.min(maxHalfW, innerW + s * splay);
    const getH = (s) => (s <= innerLen ? s * geom.innerG : innerH + (s - innerLen) * geom.outerG);

    // Build key stations along corridor
    const stations = [0];
    if (innerLen > 0 && innerLen < appLen) stations.push(innerLen);
    if (splayEndDist > 0 && splayEndDist < appLen && Math.abs(splayEndDist - innerLen) > 2) {
      stations.push(splayEndDist);
    }
    stations.push(appLen);
    stations.sort((a, b) => a - b);

    const appMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      emissive: 0xd97706,
      emissiveIntensity: 0.12,
      depthWrite: false,
    });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.75 });
    const clLineMat = new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 4, gapSize: 2 });
    const threshMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });

    const createFan = (dirSign) => {
      const fanGroup = new THREE.Group();

      // Create quad meshes between consecutive stations
      for (let i = 0; i < stations.length - 1; i++) {
        const sA = stations[i];
        const sB = stations[i + 1];

        const zA = dirSign * (saHalf + sA);
        const zB = dirSign * (saHalf + sB);
        const yA = baseY + getH(sA);
        const yB = baseY + getH(sB);
        const wA = getW(sA);
        const wB = getW(sB);

        const v0 = [-wA, yA, zA];
        const v1 = [wA, yA, zA];
        const v2 = [wB, yB, zB];
        const v3 = [-wB, yB, zB];

        const vertices = new Float32Array([
          ...v0, ...v1, ...v2,
          ...v0, ...v2, ...v3,
        ]);
        const segGeom = new THREE.BufferGeometry();
        segGeom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
        segGeom.computeVertexNormals();

        const segMesh = new THREE.Mesh(segGeom, appMat);
        fanGroup.add(segMesh);
      }

      // Approach Inner Edge Threshold Marker Line
      const threshPts = [new THREE.Vector3(-innerW, baseY + 0.05, dirSign * saHalf), new THREE.Vector3(innerW, baseY + 0.05, dirSign * saHalf)];
      const threshLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(threshPts), threshMat);
      fanGroup.add(threshLine);

      // Threshold Inset Green LED Markers
      const threshLightGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 8);
      const threshLightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      for (let k = -innerW + 1; k <= innerW; k += Math.max(2.5, innerW / 4)) {
        const tl = new THREE.Mesh(threshLightGeo, threshLightMat);
        tl.position.set(k, baseY + 0.08, dirSign * saHalf);
        fanGroup.add(tl);
      }

      // Outer boundary wireframe edge lines tracing the full path
      const leftBoundary = stations.map((s) => new THREE.Vector3(-getW(s), baseY + getH(s), dirSign * (saHalf + s)));
      const rightBoundary = stations.map((s) => new THREE.Vector3(getW(s), baseY + getH(s), dirSign * (saHalf + s)));
      const fullBoundary = [
        ...leftBoundary,
        ...rightBoundary.slice().reverse(),
        leftBoundary[0],
      ];
      const edgeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(fullBoundary), lineMat);
      fanGroup.add(edgeLine);

      // Centerline glideslope trace
      const clPoints = stations.map((s) => new THREE.Vector3(0, baseY + getH(s), dirSign * (saHalf + s)));
      const clGeom = new THREE.BufferGeometry().setFromPoints(clPoints);
      const clLine = new THREE.Line(clGeom, clLineMat);
      clLine.computeLineDistances();
      fanGroup.add(clLine);

      // Distance crossbars every 50m
      for (let dist = 50; dist < appLen; dist += 50) {
        const curW = getW(dist);
        const curY = baseY + getH(dist);
        const curZ = dirSign * (saHalf + dist);
        const barPts = [
          new THREE.Vector3(-curW, curY, curZ),
          new THREE.Vector3(curW, curY, curZ),
        ];
        const barLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(barPts),
          new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35 })
        );
        fanGroup.add(barLine);
      }

      return fanGroup;
    };

    group.add(createFan(-1));
    group.add(createFan(1));
    return { group, appLen, totalH, saHalf, getW, getH };
  };

  // Helper: Create ICAO Transitional Surfaces (1:2 / 50%)
  const buildTransitionalSurfaces = (geom, appLen, maxDist, saHalf) => {
    const group = new THREE.Group();
    const transLen = Math.min(maxDist * 0.45, 110);
    const transH = transLen * (geom.transG || 0.5);
    const baseY = 0.22;

    const tMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      emissive: 0x0891b2,
      emissiveIntensity: 0.08,
      depthWrite: false,
    });
    const tLineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5 });

    const leftGeo = new THREE.BufferGeometry();
    leftGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      -saHalf, baseY, -saHalf,  -saHalf, baseY, saHalf,  -saHalf - transLen, baseY + transH, saHalf,
      -saHalf, baseY, -saHalf,  -saHalf - transLen, baseY + transH, saHalf,  -saHalf - transLen, baseY + transH, -saHalf,
    ]), 3));
    leftGeo.computeVertexNormals();
    group.add(new THREE.Mesh(leftGeo, tMat));

    const rightGeo = new THREE.BufferGeometry();
    rightGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      saHalf, baseY, -saHalf,  saHalf, baseY, saHalf,  saHalf + transLen, baseY + transH, saHalf,
      saHalf, baseY, -saHalf,  saHalf + transLen, baseY + transH, saHalf,  saHalf + transLen, baseY + transH, -saHalf,
    ]), 3));
    rightGeo.computeVertexNormals();
    group.add(new THREE.Mesh(rightGeo, tMat));

    const leftWire = [
      new THREE.Vector3(-saHalf, baseY, -saHalf),
      new THREE.Vector3(-saHalf - transLen, baseY + transH, -saHalf),
      new THREE.Vector3(-saHalf - transLen, baseY + transH, saHalf),
      new THREE.Vector3(-saHalf, baseY, saHalf),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftWire), tLineMat));

    const rightWire = [
      new THREE.Vector3(saHalf, baseY, -saHalf),
      new THREE.Vector3(saHalf + transLen, baseY + transH, -saHalf),
      new THREE.Vector3(saHalf + transLen, baseY + transH, saHalf),
      new THREE.Vector3(saHalf, baseY, saHalf),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightWire), tLineMat));

    return group;
  };

  // Helper: Create 3D Approach Flight Path
  const buildFlightPath = (saHalf, appLen, totalH) => {
    const group = new THREE.Group();
    const glidePoints = [];
    const numPoints = 20;

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const z = -(saHalf + appLen * (1 - t));
      const y = 0.4 + (totalH + 12) * Math.pow(1 - t, 1.25);
      glidePoints.push(new THREE.Vector3(0, y, z));
    }

    const pathGeom = new THREE.BufferGeometry().setFromPoints(glidePoints);
    const pathMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 3,
      gapSize: 2,
      linewidth: 2,
    });
    const pathLine = new THREE.Line(pathGeom, pathMat);
    pathLine.computeLineDistances();
    group.add(pathLine);

    const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let i = 2; i <= numPoints; i += 4) {
      const pt = glidePoints[i];
      const bm = new THREE.Mesh(beaconGeo, beaconMat);
      bm.position.copy(pt);
      group.add(bm);
    }

    return group;
  };

  // Helper: Create 3D Rotor Downwash & Ground Outwash Visualization Layer
  const buildDownwashVisualization = (dw, geom) => {
    const group = new THREE.Group();
    const R = dw.rotorRadiusM;
    const rotorH = 3.8 * (geom.D / 16.0);

    const rTop = R;
    const rBottom = R * 0.76;
    const tubeGeo = new THREE.CylinderGeometry(rBottom, rTop, rotorH - 0.22, 32, 4, true);
    tubeGeo.rotateX(Math.PI);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.position.y = 0.22 + (rotorH - 0.22) / 2;
    group.add(tubeMesh);

    const spiralGeo = new THREE.BufferGeometry();
    const spiralPts = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const angle = t * Math.PI * 6;
      const curR = rTop + (rBottom - rTop) * t;
      const curY = rotorH - (rotorH - 0.22) * t;
      spiralPts.push(new THREE.Vector3(Math.cos(angle) * curR, curY, Math.sin(angle) * curR));
    }
    spiralGeo.setFromPoints(spiralPts);
    const spiralLine = new THREE.Line(
      spiralGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
    );
    group.add(spiralLine);

    const createHazardDisc = (radiusM, colorHex, opacity) => {
      const discGeo = new THREE.RingGeometry(Math.max(0.5, radiusM - 1.2), radiusM, 64);
      const discMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.08;
      return disc;
    };

    if (dw.hazardRadii.r60Kt > 1) {
      group.add(createHazardDisc(dw.hazardRadii.r60Kt, 0xef4444, 0.55));
    }
    if (dw.hazardRadii.r45Kt > 1) {
      group.add(createHazardDisc(dw.hazardRadii.r45Kt, 0xf97316, 0.45));
    }
    if (dw.hazardRadii.r30Kt > 1) {
      group.add(createHazardDisc(dw.hazardRadii.r30Kt, 0xf59e0b, 0.35));
    }
    if (dw.hazardRadii.r15Kt > 1) {
      group.add(createHazardDisc(dw.hazardRadii.r15Kt, 0x06b6d4, 0.2));
    }

    const particleCount = 120;
    const particleData = [];
    const pGeom = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    const maxR = Math.max(dw.hazardRadii.r15Kt, 40);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1.0 + Math.random() * maxR;
      particleData.push({
        angle,
        dist,
        speed: 0.9 + Math.random() * 0.7,
      });
      pPositions[i * 3] = Math.cos(angle) * dist;
      pPositions[i * 3 + 1] = 0.16 + Math.random() * 0.35;
      pPositions[i * 3 + 2] = Math.sin(angle) * dist;
    }

    pGeom.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 1.4,
      transparent: true,
      opacity: 0.75,
    });
    const particleSystem = new THREE.Points(pGeom, pMat);
    group.add(particleSystem);

    return { group, particleSystem, particleData, maxR };
  };

  // Main Three.js Scene Setup & Initialization
  useEffect(() => {
    if (!mountRef.current || !zone || !THREE) return;
    let animId = null;

    try {
      const containerWidth = containerRef.current?.clientWidth || size;
      const w = containerWidth;
      const h = size;

      const scene = new THREE.Scene();
      const bgColor = nightMode ? 0x02050e : 0x040812;
      const fogColor = nightMode ? 0x02050e : 0x060c18;
      scene.background = new THREE.Color(bgColor);
      scene.fog = new THREE.FogExp2(fogColor, 0.0016);

      const camera = new THREE.PerspectiveCamera(46, w / h, 1, 3000);
      const obs = Array.isArray(zone.obs) ? zone.obs : [];
      const maxObsDist = Math.max(...obs.map((o) => o.d || 50), 120);
      const maxDist = Math.max(maxObsDist * 1.3, G.fato * 3, 140);

      dragRef.current.baseCamDist = maxDist * 2.2;
      const camDist = dragRef.current.baseCamDist * dragRef.current.zoom;

      camera.position.set(
        camDist * Math.sin(dragRef.current.rotY) * Math.cos(dragRef.current.rotX),
        camDist * Math.sin(dragRef.current.rotX),
        camDist * Math.cos(dragRef.current.rotY) * Math.cos(dragRef.current.rotX)
      );
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = nightMode ? 1.4 : 1.12;

      mountRef.current.innerHTML = "";
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;

      const lightsGroup = new THREE.Group();
      lightsGroupRef.current = lightsGroup;

      const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x091220, nightMode ? 0.2 : 0.55);
      lightsGroup.add(hemiLight);

      const ambLight = new THREE.AmbientLight(0x334155, nightMode ? 0.15 : 0.35);
      lightsGroup.add(ambLight);

      const sunLight = new THREE.DirectionalLight(0xfff7ed, nightMode ? 0.25 : 1.4);
      sunLight.position.set(maxDist * 1.2, maxDist * 1.8, maxDist * 0.9);
      sunLight.castShadow = !nightMode;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.bias = -0.0004;
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = maxDist * 8;
      sunLight.shadow.camera.left = -maxDist * 1.8;
      sunLight.shadow.camera.right = maxDist * 1.8;
      sunLight.shadow.camera.top = maxDist * 1.8;
      sunLight.shadow.camera.bottom = -maxDist * 1.8;
      lightsGroup.add(sunLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, nightMode ? 0.2 : 0.45);
      rimLight.position.set(-maxDist, maxDist * 0.6, -maxDist);
      lightsGroup.add(rimLight);
      scene.add(lightsGroup);

      const groundGeo = new THREE.PlaneGeometry(maxDist * 3, maxDist * 3);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x060c18,
        roughness: 0.95,
        metalness: 0.05,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      ground.receiveShadow = true;
      scene.add(ground);

      const grid = new THREE.GridHelper(maxDist * 2.4, 48, 0x1e3a8a, 0x0f172a);
      grid.position.y = 0.02;
      if (grid.material) {
        grid.material.transparent = true;
        grid.material.opacity = 0.35;
      }
      scene.add(grid);

      // Distance Range Rings
      const ringsGroup = new THREE.Group();
      ringsGroupRef.current = ringsGroup;
      for (let r = 50; r <= maxDist * 1.1; r += 50) {
        const ringGeo = new THREE.RingGeometry(r - 0.15, r + 0.15, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        ringsGroup.add(ring);
      }
      scene.add(ringsGroup);

      // North Arrow
      const northArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(-G.tot * 0.7, 0.1, -G.tot * 0.7),
        12,
        0xef4444,
        3.0,
        1.8
      );
      scene.add(northArrow);

      // ─── TLOF, FATO & SAFETY AREA COMPLEX ───
      const saBaseGeo = new THREE.BoxGeometry(G.tot, 0.12, G.tot);
      const saBaseMat = new THREE.MeshStandardMaterial({
        color: 0x111c30,
        roughness: 0.85,
        metalness: 0.1,
      });
      const saBase = new THREE.Mesh(saBaseGeo, saBaseMat);
      saBase.position.y = 0.06;
      saBase.receiveShadow = true;
      scene.add(saBase);

      const saEdges = new THREE.EdgesGeometry(saBaseGeo);
      const saLine = new THREE.LineSegments(
        saEdges,
        new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 })
      );
      saLine.position.y = 0.06;
      scene.add(saLine);

      const padTexture = createPadTexture(G.fato, G.tlof, G.D, heli.mtow, activeProj.facility === "vertiport" || heli.tp === "evtol");
      const fatoGeo = new THREE.BoxGeometry(G.fato, 0.3, G.fato);
      const fatoMat = new THREE.MeshStandardMaterial({
        map: padTexture,
        roughness: 0.65,
        metalness: 0.2,
      });
      const fatoPad = new THREE.Mesh(fatoGeo, fatoMat);
      fatoPad.position.y = 0.22;
      fatoPad.receiveShadow = true;
      fatoPad.castShadow = true;
      scene.add(fatoPad);

      const tlofHalf = G.tlof / 2;
      const tlofLightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const tlofLightGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 8);
      const beaconLights = [];

      for (let i = -tlofHalf + 1; i <= tlofHalf; i += Math.max(3, G.tlof / 5)) {
        [-tlofHalf, tlofHalf].forEach((side) => {
          const l1 = new THREE.Mesh(tlofLightGeo, tlofLightMat);
          l1.position.set(i, 0.38, side);
          scene.add(l1);
          const l2 = new THREE.Mesh(tlofLightGeo, tlofLightMat);
          l2.position.set(side, 0.38, i);
          scene.add(l2);
        });
      }

      const padSpot = new THREE.SpotLight(0x67e8f9, nightMode ? 4.5 : 2.5, G.fato * 3, Math.PI / 3, 0.4, 1.2);
      padSpot.position.set(0, G.fato * 0.9, 0);
      padSpot.target = fatoPad;
      scene.add(padSpot);

      const windsock = createWindsock(4.5, zone.wind?.pd || 0);
      windsock.position.set(G.tot * 0.68, 0, G.tot * 0.68);
      scene.add(windsock);

      // ─── 3D AIRCRAFT MODEL ───
      const { group: aircraft, rotorGroup, tailRotorGroup, beacon } = createAircraftModel(
        G.D,
        heli,
        activeProj.facility === "vertiport" || heli.tp === "evtol"
      );
      aircraft.position.set(0, 0.38, 0);
      aircraft.rotation.y = -((approachHeading * Math.PI) / 180);
      scene.add(aircraft);

      aircraftGroupRef.current = aircraft;
      rotorRef.current = rotorGroup;
      tailRotorRef.current = tailRotorGroup;
      beaconLightsRef.current = [beacon];

      // ─── ROTOR DOWNWASH & GROUND OUTWASH LAYER ───
      const dwVis = buildDownwashVisualization(downwash, G);
      scene.add(dwVis.group);
      downwashGroupRef.current = dwVis.group;
      downwashParticlesRef.current = dwVis;

      // ─── ICAO OLS SURFACES ───
      const { group: appSurfaces, appLen, totalH, saHalf } = buildApproachSurfaces(G, maxDist);
      appSurfaces.rotation.y = -((approachHeading * Math.PI) / 180);
      scene.add(appSurfaces);
      approachGroupRef.current = appSurfaces;

      const transSurfaces = buildTransitionalSurfaces(G, appLen, maxDist, saHalf);
      transSurfaces.rotation.y = -((approachHeading * Math.PI) / 180);
      scene.add(transSurfaces);
      transitionalGroupRef.current = transSurfaces;

      const flightPath = buildFlightPath(saHalf, appLen, totalH);
      flightPath.rotation.y = -((approachHeading * Math.PI) / 180);
      scene.add(flightPath);
      flightPathGroupRef.current = flightPath;

      const ihHeight = G.ih || 45;
      const ihRadius = Math.min(G.ihR || 3000, maxDist * 1.05);
      const ihGeo = new THREE.CylinderGeometry(ihRadius, ihRadius, 0.2, 64);
      const ihMat = new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.08,
        emissive: 0x6366f1,
        emissiveIntensity: 0.1,
        depthWrite: false,
      });
      const ihMesh = new THREE.Mesh(ihGeo, ihMat);
      ihMesh.position.y = ihHeight;
      ihMesh.visible = showInnerHoriz;
      scene.add(ihMesh);
      ihMeshRef.current = ihMesh;

      // ─── OBSTACLES & PENETRATION ───
      const obstacleMeshes = [];
      const trackRad = (approachHeading * Math.PI) / 180;
      const splay = G.splay || 0.1;
      const maxHalfW = (G.maxWidth || G.tot * 2) / 2;
      const innerLenM = G.innerLenM || 60;
      const innerG = G.innerG || 1 / 2;
      const outerG = G.outerG || G.appG || 1 / 22.22;
      const transG = G.transG || 0.5;

      obs.forEach((o, obsIdx) => {
        if (o.d <= 0 && (!o.corners || !o.corners.length)) return;

        let ox = 0, oz = 0;
        const isFence = String(o.tp || "").toLowerCase().includes("fence");

        if (o.corners && o.corners.length >= 2) {
          ox = o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length - cent.x;
          oz = o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length - cent.y;
        } else if (Number.isFinite(o.x) && Number.isFinite(o.y) && !(o.x === 0 && o.y === 0)) {
          ox = o.x - cent.x;
          oz = o.y - cent.y;
        } else {
          const brRad = ((o.br || 0) - 90) * DEG;
          ox = Math.cos(brRad) * o.d;
          oz = Math.sin(brRad) * o.d;
        }

        const bw = o.w || Math.max(5, (o.h || 10) * 0.4);
        const bl = o.l || bw;
        const bh = Math.max(o.h || 10, 1.5);

        const along = -(ox * Math.sin(trackRad) + oz * Math.cos(trackRad));
        const lateral = Math.abs(ox * Math.cos(trackRad) - oz * Math.sin(trackRad));

        let allowH = 45;
        let surfaceName = "Inner Horizontal (45m)";
        let insideApproach = false;

        if (Math.abs(along) >= saHalf) {
          const s = Math.abs(along) - saHalf;
          const halfWidthAtS = Math.min(maxHalfW, saHalf + s * splay);

          if (lateral <= halfWidthAtS) {
            insideApproach = true;
            surfaceName = `Approach Fan 1:${(1 / (s <= innerLenM ? innerG : outerG)).toFixed(0)}`;
            const inclineH = s <= innerLenM ? s * innerG : innerLenM * innerG + (s - innerLenM) * outerG;
            allowH = 0.22 + inclineH;
          } else {
            surfaceName = "Transitional Slope (1:2)";
            const fanH = s <= innerLenM ? s * innerG : innerLenM * innerG + (s - innerLenM) * outerG;
            allowH = 0.22 + fanH + (lateral - halfWidthAtS) * transG;
          }
        } else {
          if (lateral <= saHalf) {
            surfaceName = "Safety Area (Ground)";
            allowH = 0.22;
          } else {
            surfaceName = "Transitional Slope (1:2)";
            allowH = 0.22 + (lateral - saHalf) * transG;
          }
        }

        allowH = Math.min(allowH, G.ih || 45);
        const penetrates = bh > allowH;
        const statusColor = penetrates ? 0xef4444 : 0x10b981;

        const obsRadialDist = Math.hypot(ox, oz);
        const obsOutwash = downwash.getVelocityAtDistance(obsRadialDist);

        let mesh;
        if (isFence && o.corners && o.corners.length >= 2) {
          const pts = o.corners.map((c) => new THREE.Vector3(c.x - cent.x, 0.2 + bh / 2, c.y - cent.y));
          const fGeo = new THREE.BufferGeometry().setFromPoints(pts);
          mesh = new THREE.Line(fGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 }));
          scene.add(mesh);
        } else if (o.corners && o.corners.length >= 3) {
          const cx = o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length;
          const cy = o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length;
          const shape = new THREE.Shape(
            o.corners.map((c) => new THREE.Vector2(c.x - cx, c.y - cy))
          );
          const geo = new THREE.ExtrudeGeometry(shape, { depth: bh, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);

          const mat = new THREE.MeshStandardMaterial({
            color: statusColor,
            transparent: true,
            opacity: penetrates ? 0.85 : 0.65,
            emissive: statusColor,
            emissiveIntensity: penetrates ? 0.35 : 0.08,
            roughness: 0.35,
            metalness: 0.4,
          });
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(cx - cent.x, 0, cy - cent.y);
          mesh.castShadow = true;
          scene.add(mesh);

          const edgeLine = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: statusColor, linewidth: 2 })
          );
          edgeLine.position.copy(mesh.position);
          scene.add(edgeLine);
        } else {
          const isTower = String(o.tp || "").toLowerCase().includes("mast") || String(o.tp || "").toLowerCase().includes("crane");
          const geo = isTower
            ? new THREE.CylinderGeometry(0.8, bw / 2, bh, 8)
            : new THREE.BoxGeometry(bw, bh, bl);

          const mat = new THREE.MeshStandardMaterial({
            color: statusColor,
            transparent: true,
            opacity: penetrates ? 0.88 : 0.65,
            emissive: statusColor,
            emissiveIntensity: penetrates ? 0.35 : 0.08,
            roughness: 0.35,
            metalness: 0.35,
          });
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(ox, bh / 2, oz);
          mesh.castShadow = true;
          scene.add(mesh);

          const edgeLine = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: statusColor, linewidth: 2 })
          );
          edgeLine.position.set(ox, bh / 2, oz);
          scene.add(edgeLine);
        }

        if (mesh) {
          mesh.userData = {
            obstacle: o,
            index: obsIdx,
            ox, oz, bh,
            allowH,
            surfaceName,
            penetrates,
            insideApproach,
            clearance: penetrates ? -(bh - allowH) : (allowH - bh),
            downwashKt: obsOutwash.kt,
            downwashMs: obsOutwash.ms,
          };
          obstacleMeshes.push(mesh);
        }

        const hPoints = [new THREE.Vector3(ox, 0, oz), new THREE.Vector3(ox, bh, oz)];
        const hLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(hPoints),
          new THREE.LineBasicMaterial({ color: 0x94a3b8 })
        );
        scene.add(hLine);

        if (penetrates || bh > 20) {
          const topLight = new THREE.PointLight(0xef4444, 1.8, 25);
          topLight.position.set(ox, bh + 0.5, oz);
          scene.add(topLight);
          beaconLights.push(topLight);
        }

        if (penetrates && allowH < bh) {
          const penDiscGeo = new THREE.RingGeometry(bw * 0.35, bw * 0.75, 20);
          const penDiscMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
          });
          const penDisc = new THREE.Mesh(penDiscGeo, penDiscMat);
          penDisc.rotation.x = -Math.PI / 2;
          penDisc.position.set(ox, allowH, oz);
          scene.add(penDisc);

          const breachPts = [new THREE.Vector3(ox, allowH, oz), new THREE.Vector3(ox, bh, oz)];
          const breachLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(breachPts),
            new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 })
          );
          scene.add(breachLine);
        }

        const tracePts = [new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(ox, 0.25, oz)];
        const traceLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(tracePts),
          new THREE.LineBasicMaterial({ color: statusColor, transparent: true, opacity: 0.2 })
        );
        scene.add(traceLine);
      });

      obstacleMeshesRef.current = obstacleMeshes;
      beaconLightsRef.current = beaconLights;

      // ─── ANIMATION & RENDER LOOP ───
      const dr = dragRef.current;
      const animState = animStateRef.current;
      let lastTime = performance.now();

      const animate = (currentTime) => {
        animId = requestAnimationFrame(animate);
        const dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        if (animState.autoRotate) {
          dr.rotY += 0.004;
        }

        if (showRotorAnim && rotorRef.current) {
          rotorRef.current.rotation.y += 0.35;
          if (tailRotorRef.current) {
            tailRotorRef.current.rotation.x += 0.6;
          }
        }

        if (showDownwash && downwashParticlesRef.current?.particleSystem) {
          const { particleSystem, particleData, maxR } = downwashParticlesRef.current;
          const pos = particleSystem.geometry.attributes.position.array;
          for (let i = 0; i < particleData.length; i++) {
            const p = particleData[i];
            p.dist += p.speed * (dt * 24);
            if (p.dist > maxR) {
              p.dist = 0.8 + Math.random() * 2.0;
              p.angle = Math.random() * Math.PI * 2;
            }
            pos[i * 3] = Math.cos(p.angle) * p.dist;
            pos[i * 3 + 2] = Math.sin(p.angle) * p.dist;
          }
          particleSystem.geometry.attributes.position.needsUpdate = true;
        }

        animState.beaconTime += dt;
        const strobe = Math.sin(animState.beaconTime * 6) > 0.3 ? 1.8 : 0.2;
        beaconLightsRef.current.forEach((b) => {
          if (b) b.intensity = strobe;
        });

        const d = dr.baseCamDist * dr.zoom;
        camera.position.x = dr.panX + d * Math.sin(dr.rotY) * Math.cos(dr.rotX);
        camera.position.y = dr.panY + d * Math.sin(dr.rotX);
        camera.position.z = dr.panZ + d * Math.cos(dr.rotY) * Math.cos(dr.rotX);
        camera.lookAt(dr.panX, dr.panY, dr.panZ);

        renderer.render(scene, camera);
      };

      animate(performance.now());

      // ─── MOUSE & TOUCH CONTROLS ───
      const el = renderer.domElement;
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onMouseDown = (e) => {
        if (e.button === 2) {
          dr.rightActive = true;
        } else {
          dr.active = true;
        }
        dr.px = e.clientX;
        dr.py = e.clientY;
      };

      const onMouseMove = (e) => {
        const rect = el.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (!dr.active && !dr.rightActive && obstacleMeshesRef.current.length > 0) {
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(obstacleMeshesRef.current, false);
          if (intersects.length > 0) {
            const data = intersects[0].object.userData;
            if (data?.obstacle) {
              setHoveredObs(data);
              el.style.cursor = "pointer";
            }
          } else {
            setHoveredObs(null);
            el.style.cursor = "grab";
          }
        }

        const dx = e.clientX - dr.px;
        const dy = e.clientY - dr.py;
        dr.px = e.clientX;
        dr.py = e.clientY;

        if (dr.active) {
          dr.rotY += dx * 0.005;
          dr.rotX = clamp(dr.rotX + dy * 0.005, 0.04, Math.PI / 2 - 0.02);
        } else if (dr.rightActive) {
          const panSpeed = (dr.baseCamDist * dr.zoom) / 1200;
          dr.panX -= (dx * Math.cos(dr.rotY) + dy * Math.sin(dr.rotY) * Math.sin(dr.rotX)) * panSpeed;
          dr.panZ -= (-dx * Math.sin(dr.rotY) + dy * Math.cos(dr.rotY) * Math.sin(dr.rotX)) * panSpeed;
        }
      };

      const onMouseUp = () => {
        dr.active = false;
        dr.rightActive = false;
      };

      const onWheel = (e) => {
        e.preventDefault();
        dr.zoom = clamp(dr.zoom + (e.deltaY > 0 ? 0.08 : -0.08), 0.25, 3.5);
      };

      const onContextMenu = (e) => e.preventDefault();

      el.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("contextmenu", onContextMenu);

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newW = entry.contentRect.width;
          if (newW > 0 && rendererRef.current && cameraRef.current) {
            rendererRef.current.setSize(newW, size);
            cameraRef.current.aspect = newW / size;
            cameraRef.current.updateProjectionMatrix();
          }
        }
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        el.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("contextmenu", onContextMenu);
        renderer.dispose();
        rendererRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        if (mountRef.current) mountRef.current.innerHTML = "";
      };
    } catch (e) {
      console.error("Obs3D error:", e);
      queueMicrotask(() => setError(e));
      return () => {
        if (animId) cancelAnimationFrame(animId);
      };
    }
  }, [zone, size, G, cent, heli, nightMode, downwash]);

  // Synchronize Layer Visibilities & Heading dynamically
  useEffect(() => {
    if (approachGroupRef.current) {
      approachGroupRef.current.visible = showApproach;
      approachGroupRef.current.rotation.y = -((approachHeading * Math.PI) / 180);
    }
    if (transitionalGroupRef.current) {
      transitionalGroupRef.current.visible = showTransitional;
      transitionalGroupRef.current.rotation.y = -((approachHeading * Math.PI) / 180);
    }
    if (flightPathGroupRef.current) {
      flightPathGroupRef.current.visible = showFlightPath;
      flightPathGroupRef.current.rotation.y = -((approachHeading * Math.PI) / 180);
    }
    if (downwashGroupRef.current) {
      downwashGroupRef.current.visible = showDownwash;
    }
    if (aircraftGroupRef.current) {
      aircraftGroupRef.current.visible = showAircraft;
      aircraftGroupRef.current.rotation.y = -((approachHeading * Math.PI) / 180);
    }
    if (ihMeshRef.current) {
      ihMeshRef.current.visible = showInnerHoriz;
    }
    if (ringsGroupRef.current) {
      ringsGroupRef.current.visible = showRings;
    }
    animStateRef.current.autoRotate = autoRotate;
  }, [showApproach, showTransitional, showFlightPath, showDownwash, showInnerHoriz, showAircraft, showRings, autoRotate, approachHeading]);

  // Snapshot generation for reports
  useEffect(() => {
    if (!onSnapshotReady) return;
    const t = setTimeout(() => {
      const r = rendererRef.current;
      const s = sceneRef.current;
      const c = cameraRef.current;
      if (!r || !s || !c) return;
      r.render(s, c);
      try {
        onSnapshotReady(r.domElement.toDataURL("image/png"));
      } catch (err) {
        console.warn("Snapshot capture error:", err);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [zone?.id, size, onSnapshotReady]);

  // Styles
  const shell = {
    borderRadius: 14,
    border: "1px solid " + K.bd,
    background: "linear-gradient(170deg, #0b1528 0%, #070e1c 55%, #040812 100%)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
    overflow: "hidden",
    width: "100%",
    maxWidth: 760,
    margin: "0 auto",
  };

  const pillBtn = (active, onClick, label, icon) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.15s ease",
        background: active ? "linear-gradient(135deg, #0284c7, #2563eb)" : "rgba(15,23,42,0.75)",
        color: active ? "#ffffff" : K.dm,
        border: active ? "1px solid #38bdf8" : "1px solid " + K.bd,
        boxShadow: active ? "0 0 10px rgba(14,165,233,0.3)" : "none",
      }}
    >
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
      {label}
    </button>
  );

  if (error) {
    return (
      <div style={{ ...shell, padding: 24, textAlign: "center" }}>
        <div style={{ color: K.rd, fontSize: 13, fontWeight: 700 }}>3D OLS Rendering Error</div>
        <div style={{ color: K.dm, fontSize: 11, marginTop: 8 }}>{error.message}</div>
      </div>
    );
  }

  if (!zone) {
    return (
      <div style={{ ...shell, padding: "36px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: K.cy, letterSpacing: 2 }}>ICAO 3D OLS EXPLORER</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: K.tx, marginTop: 10 }}>Select a candidate zone to analyze</div>
        <div style={{ fontSize: 11, color: K.dm, marginTop: 8, lineHeight: 1.6, maxWidth: 360, margin: "8px auto 0" }}>
          Full 3D isometric simulation of FATO/TLOF footprint, Annex 14 Approach Fan (gradient 1:{Math.round(1 / G.appG)}),
          Transitional 1:2 surfaces, and obstacle penetration analysis.
        </div>
      </div>
    );
  }

  const obsCount = (zone.obs || []).length;
  const violationCount = (zone.obs || []).filter((o) => {
    const d = o.d || 0;
    const saHalf = G.tot / 2;
    const s = Math.max(0, d - saHalf);
    const allow = 0.22 + s * G.appG;
    return (o.h || 0) > allow;
  }).length;

  return (
    <div style={shell} ref={containerRef}>
      {/* ─── HEADER BAR: PER-FLIGHT SPECS & CONTROLS ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          borderBottom: "1px solid " + K.bd,
          background: "linear-gradient(90deg, rgba(37,99,235,0.14), rgba(6,182,212,0.06), transparent)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: K.cy, letterSpacing: 2 }}>PER-FLIGHT 3D OLS</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: violationCount > 0 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                color: violationCount > 0 ? "#f87171" : "#34d399",
                border: violationCount > 0 ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(16,185,129,0.4)",
              }}
            >
              {violationCount > 0 ? `${violationCount} PENETRATIONS` : "OLS CLEAR"}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: downwash.severityColor + "20",
                color: downwash.severityColor,
                border: "1px solid " + downwash.severityColor + "50",
              }}
            >
              💨 {downwash.vMaxKt.toFixed(0)} KT OUTWASH
            </span>
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, color: K.tx, marginTop: 4, letterSpacing: -0.4 }}>
            Zone {zone.lb} · {heli.nm} ({PC_DATA[selectedPc]?.label || "PC-1"})
          </div>
          <div style={{ fontSize: 9, color: K.mu, marginTop: 2 }}>
            Inner W: <strong style={{ color: K.tx }}>{G.tot.toFixed(1)}m</strong> · Splay: <strong style={{ color: K.tx }}>{(G.splay * 100).toFixed(0)}%</strong> · Max W: <strong style={{ color: K.tx }}>{G.maxWidth.toFixed(0)}m</strong> · Slope: <strong style={{ color: K.tx }}>1:{(1 / G.appG).toFixed(1)}</strong>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {pillBtn(nightMode, () => setNightMode(!nightMode), nightMode ? "Night" : "Day", nightMode ? "🌙" : "☀️")}
          <button
            type="button"
            onClick={() => {
              const r = rendererRef.current;
              const s = sceneRef.current;
              const c = cameraRef.current;
              if (!r || !s || !c) return;
              r.render(s, c);
              const url = r.domElement.toDataURL("image/png");
              const a = document.createElement("a");
              a.href = url;
              a.download = `HeliVertiSafe_3D_Zone_${zone.lb}_${new Date().toISOString().slice(0, 10)}.png`;
              a.click();
            }}
            style={{
              padding: "5px 11px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              background: "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(6,182,212,0.2))",
              color: K.cy,
              border: "1px solid " + K.cy + "60",
              boxShadow: "0 2px 8px rgba(6,182,212,0.2)",
            }}
            title="Download high-resolution 3D screenshot"
          >
            📸 Export PNG
          </button>
        </div>
      </div>

      {/* ─── DYNAMIC FLIGHT & PERFORMANCE CONFIGURATION ROW ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          padding: "8px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,20,38,0.75)",
        }}
      >
        {/* Aircraft selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: K.cy }}>🚁 FLIGHT:</span>
          <select
            value={selectedHeliId}
            onChange={(e) => setSelectedHeliId(e.target.value)}
            style={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid " + K.bd,
              borderRadius: 6,
              padding: "3px 8px",
              color: K.tx,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {HELIS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nm} (D={h.D}m{h.mtow ? ` · ${(h.mtow/1000).toFixed(1)}t` : ""})
              </option>
            ))}
          </select>
        </div>

        {/* Performance class selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: K.cy }}>⚡ CLASS:</span>
          <select
            value={selectedPc}
            onChange={(e) => setSelectedPc(e.target.value)}
            style={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid " + K.bd,
              borderRadius: 6,
              padding: "3px 8px",
              color: K.tx,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="pc1">PC-1 (Commercial CAT A · 4.5% / 1:22.22 · 10% splay)</option>
            <option value="pc2">PC-2 (General Commercial · 8.0% / 1:12.5 · 10% splay)</option>
            <option value="pc3">PC-3 (Light VFR · 12.5% / 1:8.0 · 15% splay)</option>
          </select>
        </div>

        {/* Approach track orientation dial */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: K.mu }}>TRACK:</span>
          <input
            type="range"
            min="0"
            max="359"
            value={approachHeading}
            onChange={(e) => setApproachHeading(parseInt(e.target.value, 10))}
            style={{ width: 70, accentColor: "#0ea5e9", cursor: "pointer" }}
            title={`Rotate Approach Track: ${approachHeading}°`}
          />
          <span style={{ fontSize: 10, fontWeight: 800, color: K.cy, minWidth: 28 }}>{approachHeading}°</span>
        </div>
      </div>

      {/* ─── TOOLBAR CONTROLS ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          padding: "6px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(7,14,28,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: K.mu, marginRight: 2 }}>CAM:</span>
          {pillBtn(false, () => setCameraPreset("iso"), "3D Iso", "🧊")}
          {pillBtn(false, () => setCameraPreset("top"), "2D Top", "📐")}
          {pillBtn(false, () => setCameraPreset("glideslope"), "Glideslope", "🛬")}
          {pillBtn(false, () => setCameraPreset("profile"), "Profile", "↔️")}
          {pillBtn(autoRotate, () => setAutoRotate(!autoRotate), autoRotate ? "Orbiting" : "Orbit", "🔄")}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9, color: K.dm }}>
          <span>FATO: <strong style={{ color: K.tx }}>{G.fato.toFixed(0)}m</strong></span>
          <span>•</span>
          <span>Safety Area: <strong style={{ color: K.tx }}>{G.tot.toFixed(0)}m</strong></span>
          <span>•</span>
          <span>Max Splay W: <strong style={{ color: "#38bdf8" }}>{G.maxWidth.toFixed(0)}m</strong></span>
        </div>
      </div>

      {/* ─── 3D VIEWPORT ─── */}
      <div style={{ position: "relative", width: "100%", height: size }}>
        <div
          ref={mountRef}
          style={{
            width: "100%",
            height: "100%",
            cursor: "grab",
            outline: "none",
          }}
        />

        {/* Left Layer Visibility Selector Overlay */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(5,11,22,0.85)",
            border: "1px solid " + K.bd,
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 8, fontWeight: 800, color: K.mu, letterSpacing: 1.2 }}>LAYERS</div>
          {pillBtn(showApproach, () => setShowApproach(!showApproach), `Approach 1:${(1 / G.appG).toFixed(0)}`, "📐")}
          {pillBtn(showTransitional, () => setShowTransitional(!showTransitional), "Transitional (1:2)", "🔷")}
          {pillBtn(showDownwash, () => setShowDownwash(!showDownwash), "Rotor Downwash", "💨")}
          {pillBtn(showFlightPath, () => setShowFlightPath(!showFlightPath), "Flight Path", "🛬")}
          {pillBtn(showInnerHoriz, () => setShowInnerHoriz(!showInnerHoriz), `Inner Horiz (+${G.ih}m)`, "🟣")}
          {pillBtn(showAircraft, () => setShowAircraft(!showAircraft), heli.nm.split(" ")[0], "🚁")}
          {pillBtn(showRings, () => setShowRings(!showRings), "Distance Rings", "🎯")}
          {pillBtn(showRotorAnim, () => setShowRotorAnim(!showRotorAnim), "Rotor Motion", "🌀")}
        </div>

        {/* Right Legend Card */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(5,11,22,0.88)",
            border: "1px solid " + K.bd,
            backdropFilter: "blur(12px)",
            minWidth: 160,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 8, fontWeight: 800, color: K.cy, letterSpacing: 1.2, marginBottom: 8 }}>
            LEGEND & DOWNWASH
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: K.dm }}>
              <div style={{ width: 14, height: 4, background: "#10b981", borderRadius: 1 }} />
              <span>FATO ({G.fato.toFixed(0)}m pad)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: K.dm }}>
              <div style={{ width: 14, height: 4, background: "#f59e0b", borderRadius: 1 }} />
              <span>Safety Area ({G.tot.toFixed(0)}m)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: K.dm }}>
              <div style={{ width: 14, height: 4, background: "#f59e0b", opacity: 0.5, borderRadius: 1 }} />
              <span>Approach Fan (Max {G.maxWidth.toFixed(0)}m)</span>
            </div>
            {showDownwash && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: "#f87171" }}>
                  <div style={{ width: 10, height: 2, background: "#ef4444" }} />
                  <span>Outwash &gt;60 kt ({downwash.hazardRadii.r60Kt}m)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: "#fbbf24" }}>
                  <div style={{ width: 10, height: 2, background: "#f59e0b" }} />
                  <span>Caution &gt;30 kt ({downwash.hazardRadii.r30Kt}m)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: "#38bdf8" }}>
                  <div style={{ width: 10, height: 2, background: "#06b6d4" }} />
                  <span>Perimeter &gt;15 kt ({downwash.hazardRadii.r15Kt}m)</span>
                </div>
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9, color: K.dm }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: "#ef4444" }} />
              <span>OLS Breach</span>
            </div>
          </div>
        </div>

        {/* Aerodynamic Downwash Telemetry Widget */}
        {showDownwash && (
          <div
            style={{
              position: "absolute",
              bottom: 42,
              left: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(5,11,22,0.92)",
              border: "1px solid " + downwash.severityColor + "60",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              maxWidth: 270,
              fontSize: 9,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, color: K.cy, letterSpacing: 1 }}>ROTOR DOWNWASH</span>
              <span style={{ fontWeight: 700, color: downwash.severityColor }}>{downwash.severity.toUpperCase()}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", marginTop: 6, color: K.dm }}>
              <div>Peak Outwash: <strong style={{ color: K.tx }}>{downwash.vMaxKt.toFixed(0)} kt</strong></div>
              <div>Induced (OGE): <strong style={{ color: K.tx }}>{downwash.viKt.toFixed(0)} kt</strong></div>
              <div>Disc Loading: <strong style={{ color: K.tx }}>{downwash.discLoadingKgM2.toFixed(1)} kg/m²</strong></div>
              <div>Rotor Diam: <strong style={{ color: K.tx }}>{heli.rtr || G.D}m</strong></div>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 6, paddingTop: 4, color: K.mu }}>
              Personnel 30 kt Limit: <strong style={{ color: "#fbbf24" }}>{downwash.hazardRadii.r30Kt}m radius</strong>
            </div>
          </div>
        )}

        {/* Hovered Obstacle Inspector Floating Tag */}
        {hoveredObs && (
          <div
            style={{
              position: "absolute",
              bottom: 42,
              right: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(8,16,32,0.95)",
              border: hoveredObs.penetrates ? "1px solid #ef4444" : "1px solid #10b981",
              backdropFilter: "blur(12px)",
              boxShadow: hoveredObs.penetrates
                ? "0 0 20px rgba(239,68,68,0.4)"
                : "0 0 20px rgba(16,185,129,0.3)",
              maxWidth: 270,
              zIndex: 10,
            }}
          >
            <div style={{ fontSize: 8, fontWeight: 800, color: hoveredObs.penetrates ? "#f87171" : "#34d399" }}>
              {hoveredObs.penetrates ? "⚠ OLS LIMIT BREACH" : "✓ OLS COMPLIANT"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: K.tx, marginTop: 2 }}>
              {hoveredObs.obstacle.nm || `Obstacle #${hoveredObs.index + 1}`}
            </div>
            <div style={{ fontSize: 10, color: K.cy, marginTop: 2, fontWeight: 600 }}>
              Surface: {hoveredObs.surfaceName}
            </div>
            <div style={{ fontSize: 10, color: K.dm, marginTop: 4 }}>
              Height: <strong style={{ color: K.tx }}>{hoveredObs.obstacle.h}m</strong> · Distance:{" "}
              <strong style={{ color: K.tx }}>{hoveredObs.obstacle.d}m</strong>
            </div>
            <div style={{ fontSize: 10, color: K.dm, marginTop: 2 }}>
              OLS Allowable: <strong style={{ color: K.tx }}>{hoveredObs.allowH.toFixed(1)}m</strong>
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: hoveredObs.penetrates ? "#f87171" : "#34d399",
                marginTop: 4,
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: 4,
              }}
            >
              {hoveredObs.penetrates
                ? `Breach: +${(-hoveredObs.clearance).toFixed(1)}m above surface`
                : `Clearance: ${hoveredObs.clearance.toFixed(1)}m`}
            </div>

            {/* Downwash Impact on this Obstacle */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 6, paddingTop: 4, fontSize: 9 }}>
              <span style={{ color: K.mu }}>Downwash at structure: </span>
              <strong style={{ color: hoveredObs.downwashKt > 30 ? "#f87171" : "#38bdf8" }}>
                {hoveredObs.downwashKt.toFixed(0)} kt ({hoveredObs.downwashMs.toFixed(1)} m/s)
              </strong>
            </div>
          </div>
        )}

        {/* Bottom Helper Bar */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 12px",
            borderRadius: 6,
            background: "rgba(5,11,22,0.85)",
            border: "1px solid " + K.bd,
            backdropFilter: "blur(8px)",
            fontSize: 9,
            color: K.dm,
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <span>🖱️ Left drag: Orbit</span>
          <span>•</span>
          <span>Right drag: Pan</span>
          <span>•</span>
          <span>Scroll: Zoom</span>
          <span>•</span>
          <span>Hover structure for OLS & Downwash</span>
        </div>
      </div>
    </div>
  );
});

Obs3D.displayName = "Obs3D";
