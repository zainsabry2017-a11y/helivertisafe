import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { K } from "../../utils/theme.js";
import { DEG, clamp } from "../../utils/coords.js";
import { calcGeom } from "../../data/models.js";
import { zonePadCenter } from "../../engine/geometry.js";

export const Obs3D = forwardRef(function Obs3D({ zone, proj, size = 460, onSnapshotReady }, ref) {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const dragRef = useRef({ active: false, px: 0, py: 0, rotX: 0.6, rotY: 0.5, zoom: 1.0 });
  const [error, setError] = useState(null);

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

  const G = useMemo(() => calcGeom(proj), [proj]);
  const cent = useMemo(() => zone ? zonePadCenter(zone) : { x: 0, y: 0 }, [zone]);

  const isFenceObstacle = (o) => {
    const tp = String(o?.tp || "").toLowerCase();
    if (tp === "fence") return true;
    const nm = String(o?.nm || "").toLowerCase();
    return nm.includes("fence");
  };

  useEffect(() => {
    if (!mountRef.current || !zone || !THREE) return;
    try {

    const w = size, h = size;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070d18);
    scene.fog = new THREE.FogExp2(0x0a1428, 0.0022);

    const camera = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
    const obs = Array.isArray(zone.obs) ? zone.obs : [];
    const maxDist = Math.max(...obs.map(o => o.d || 50), 100);
    const maxH = Math.max(...obs.map(o => o.h || 10), 25);
    const camDist = maxDist * 2;
    camera.position.set(camDist * 0.7, camDist * 0.5, camDist * 0.7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setSize(w, h);
    // Keep startup fast; 3D panel is schematic (not photoreal).
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    // Lights — presentation / review quality
    const hemi = new THREE.HemisphereLight(0x8eb4ff, 0x0a1220, 0.42);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(0x5a7ab8, 0.28);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(maxDist * 0.9, maxDist * 1.55, maxDist * 0.65);
    dir.castShadow = true;
    if (dir.shadow) {
      dir.shadow.mapSize.width = 1024;
      dir.shadow.mapSize.height = 1024;
      dir.shadow.camera.near = 1;
      dir.shadow.camera.far = maxDist * 8;
      dir.shadow.camera.left = -maxDist * 2;
      dir.shadow.camera.right = maxDist * 2;
      dir.shadow.camera.top = maxDist * 2;
      dir.shadow.camera.bottom = -maxDist * 2;
    }
    scene.add(dir);
    const pt = new THREE.PointLight(0x38bdf8, 0.35, maxDist * 5);
    pt.position.set(-maxDist * 0.4, maxDist * 0.45, maxDist * 0.4);
    scene.add(pt);
    const rim = new THREE.DirectionalLight(0xa5b4fc, 0.35);
    rim.position.set(-maxDist * 0.8, maxDist * 0.4, -maxDist * 0.6);
    scene.add(rim);

    const axes = new THREE.AxesHelper(Math.min(18, maxDist * 0.12));
    axes.position.y = 0.02;
    scene.add(axes);

    // Ground grid
    const gridH = new THREE.GridHelper(maxDist * 2, 24, 0x2563eb, 0x0f1729);
    const gMat = gridH.material;
    if (Array.isArray(gMat)) {
      gMat.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.22;
      });
    } else {
      gMat.transparent = true;
      gMat.opacity = 0.22;
    }
    scene.add(gridH);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(maxDist * 2, maxDist * 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x090f1a, transparent: true, opacity: 0.88, roughness: 0.92, metalness: 0.04 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // FATO
    const fatoGeo = new THREE.BoxGeometry(G.fato, 0.3, G.fato);
    const fatoMat = new THREE.MeshStandardMaterial({ color: 0x10b981, transparent: true, opacity: 0.38, emissive: 0x059669, emissiveIntensity: 0.18, roughness: 0.45, metalness: 0.12 });
    const fato = new THREE.Mesh(fatoGeo, fatoMat);
    fato.position.y = 0.15;
    scene.add(fato);

    // FATO edge glow
    const fatoEdge = new THREE.EdgesGeometry(fatoGeo);
    const fatoLine = new THREE.LineSegments(fatoEdge, new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 }));
    fatoLine.position.y = 0.15;
    scene.add(fatoLine);

    // Safety area wireframe
    const saGeo = new THREE.BoxGeometry(G.tot, 0.05, G.tot);
    const saEdge = new THREE.EdgesGeometry(saGeo);
    const saLine = new THREE.LineSegments(saEdge, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 1 }));
    saLine.position.y = 0.05;
    scene.add(saLine);

    // 1:22.22 Approach surface (transparent planes — both directions)
    const appLen = Math.min(G.appLen, maxDist * 0.8);
    const appH = appLen * G.appG;
    const innerW = G.tot / 2;
    const outerW = innerW + appLen * G.splay;
    // Front approach
    const appGeo1 = new THREE.BufferGeometry();
    appGeo1.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-innerW,0.5,0, innerW,0.5,0, outerW,appH,-appLen, -outerW,appH,-appLen]), 3));
    appGeo1.setIndex([0,1,2, 0,2,3]);
    appGeo1.computeVertexNormals();
    scene.add(new THREE.Mesh(appGeo1, new THREE.MeshStandardMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.06, side: THREE.DoubleSide, emissive: 0xf59e0b, emissiveIntensity: 0.08 })));
    // Back approach
    const appGeo2 = new THREE.BufferGeometry();
    appGeo2.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-innerW,0.5,0, innerW,0.5,0, outerW,appH,appLen, -outerW,appH,appLen]), 3));
    appGeo2.setIndex([0,1,2, 0,2,3]);
    appGeo2.computeVertexNormals();
    scene.add(new THREE.Mesh(appGeo2, new THREE.MeshStandardMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.06, side: THREE.DoubleSide, emissive: 0xf59e0b, emissiveIntensity: 0.08 })));
    // 1:22.22 wireframe edges
    const appEdgePts1 = [new THREE.Vector3(-innerW,0.5,0), new THREE.Vector3(-outerW,appH,-appLen), new THREE.Vector3(outerW,appH,-appLen), new THREE.Vector3(innerW,0.5,0)];
    const appEdgePts2 = [new THREE.Vector3(-innerW,0.5,0), new THREE.Vector3(-outerW,appH,appLen), new THREE.Vector3(outerW,appH,appLen), new THREE.Vector3(innerW,0.5,0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(appEdgePts1), new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.4 })));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(appEdgePts2), new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.4 })));

    // 1:2 Transitional surface (left and right sides)
    const transLen = Math.min(maxDist * 0.4, 80);
    const transH = transLen * G.transG;
    const tMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.05, side: THREE.DoubleSide, emissive: 0x06b6d4, emissiveIntensity: 0.06 });
    // Left side
    const tGeo1 = new THREE.BufferGeometry();
    tGeo1.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-innerW,0.5,-appLen, -innerW,0.5,appLen, -innerW-transLen,transH,appLen, -innerW-transLen,transH,-appLen]), 3));
    tGeo1.setIndex([0,1,2, 0,2,3]); tGeo1.computeVertexNormals();
    scene.add(new THREE.Mesh(tGeo1, tMat));
    // Right side
    const tGeo2 = new THREE.BufferGeometry();
    tGeo2.setAttribute("position", new THREE.BufferAttribute(new Float32Array([innerW,0.5,-appLen, innerW,0.5,appLen, innerW+transLen,transH,appLen, innerW+transLen,transH,-appLen]), 3));
    tGeo2.setIndex([0,1,2, 0,2,3]); tGeo2.computeVertexNormals();
    scene.add(new THREE.Mesh(tGeo2, tMat));
    // Transitional wireframe
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-innerW,0.5,0), new THREE.Vector3(-innerW-transLen,transH,0)]), new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.4 })));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(innerW,0.5,0), new THREE.Vector3(innerW+transLen,transH,0)]), new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.4 })));

    // Obstacles
    obs.forEach((o) => {
      if (o.d <= 0 && (!o.corners || !o.corners.length)) return;
      const a18 = o.d > 0 ? o.d * G.appG : 0;
      const pen18 = o.d > 0 ? o.h > a18 : false;
      const a12 = o.d > 0 ? o.d * G.transG : 0;
      const pen12 = o.d > 0 ? o.h > a12 : false;
      const pen = pen18;
      const color = pen ? 0xef4444 : pen12 ? 0xf59e0b : 0x10b981;
      const emissive = color;
      let ox, oz;
      const isFence = isFenceObstacle(o);
      if (o.corners && o.corners.length >= (isFence ? 2 : 3)) {
        ox = o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length - cent.x;
        oz = o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length - cent.y;
      } else if (Number.isFinite(o.x) && Number.isFinite(o.y) && !(o.x === 0 && o.y === 0)) {
        ox = o.x - cent.x;
        oz = o.y - cent.y;
      } else {
        const rad = (o.br - 90) * DEG;
        ox = Math.cos(rad) * o.d;
        oz = Math.sin(rad) * o.d;
      }
      const bw = o.w || Math.max(4, o.h * 0.3);
      const bl = o.l || bw;
      const bh = Math.max(o.h, 1);

      // Fence: draw as connected polyline
      if (isFence && o.corners && o.corners.length >= 2) {
        const h = Math.max(0.6, Number(o.h) || 1.2);
        const baseY = 0.2;
        const pts = o.corners.map((c) => ({ x: c.x - cent.x, z: c.y - cent.y }));

        // Rails (bottom + top)
        const bottom = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, baseY, p.z)));
        const top = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, baseY + h, p.z)));
        const railMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
        scene.add(new THREE.Line(bottom, railMat));
        scene.add(new THREE.Line(top, railMat));

        // Posts
        const spacingM = 3; // visual + performance balance
        const postR = 0.18;
        const postGeo = new THREE.CylinderGeometry(postR, postR, h, 10);
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.55,
          emissive: 0x0ea5e9,
          emissiveIntensity: 0.08,
          roughness: 0.65,
          metalness: 0.08,
        });

        const addPost = (x, z) => {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(x, baseY + h / 2, z);
          p.castShadow = true;
          scene.add(p);
        };

        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const segLen = Math.hypot(dx, dz);
          if (segLen <= 0.001) continue;
          const n = Math.max(1, Math.floor(segLen / spacingM));
          for (let k = 0; k <= n; k++) {
            const t = k / n;
            addPost(a.x + dx * t, a.z + dz * t);
          }
        }
        return;
      }

      // Building / object: if polygon footprint exists, extrude it (supports 3+ corners)
      if (o.corners && o.corners.length >= 3) {
        const cx = o.corners.reduce((s, c) => s + c.x, 0) / o.corners.length;
        const cy = o.corners.reduce((s, c) => s + c.y, 0) / o.corners.length;
        const shape = new THREE.Shape(
          o.corners.map((c, idx) => {
            const x = c.x - cx;
            const y = c.y - cy;
            return idx === 0 ? new THREE.Vector2(x, y) : new THREE.Vector2(x, y);
          })
        );
        const geo = new THREE.ExtrudeGeometry(shape, { depth: bh, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.72,
          emissive,
          emissiveIntensity: pen ? 0.22 : 0.08,
          roughness: 0.48,
          metalness: 0.18,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx - cent.x, 0, cy - cent.y);
        mesh.castShadow = true;
        scene.add(mesh);
        const edge = new THREE.EdgesGeometry(geo);
        const eLine = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color }));
        eLine.position.copy(mesh.position);
        scene.add(eLine);
      } else {
        // Fallback: box using W/L/H
        const geo = new THREE.BoxGeometry(bw, bh, bl);
        const mat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.72,
          emissive,
          emissiveIntensity: pen ? 0.22 : 0.08,
          roughness: 0.48,
          metalness: 0.18,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ox, bh / 2, oz);
        mesh.castShadow = true;
        scene.add(mesh);
        const edge = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color }));
        line.position.set(ox, bh / 2, oz);
        scene.add(line);
      }

      // Height line from ground to top
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ox, 0, oz), new THREE.Vector3(ox, bh, oz)]), new THREE.LineBasicMaterial({ color: 0x8896ab })));

      // Penetration marker — red ring at approach allowable height
      if (o.d > 0 && pen18) {
        const penRingGeo = new THREE.RingGeometry(bw * 0.3, bw * 0.5, 16);
        const penRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const penRing = new THREE.Mesh(penRingGeo, penRingMat);
        penRing.rotation.x = -Math.PI / 2;
        penRing.position.set(ox, a18, oz);
        scene.add(penRing);
        // Line showing excess penetration
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ox, a18, oz), new THREE.Vector3(ox, bh, oz)]), new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 })));
      }

      // Connection line to FATO center
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(ox, 0.2, oz)]), new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.15 })));
    });

    // Animation + rotation
    const dr = dragRef.current;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const r = dr.rotY, el = dr.rotX, z = dr.zoom;
      const d = camDist * z;
      camera.position.x = d * Math.sin(r) * Math.cos(el);
      camera.position.y = d * Math.sin(el);
      camera.position.z = d * Math.cos(r) * Math.cos(el);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    // Mouse drag rotation
    const el = renderer.domElement;
    const onDown = (e) => { dr.active = true; dr.px = e.clientX; dr.py = e.clientY; };
    const onMove = (e) => { if (!dr.active) return; dr.rotY += (e.clientX - dr.px) * 0.005; dr.rotX = clamp(dr.rotX + (e.clientY - dr.py) * 0.005, 0.1, 1.4); dr.px = e.clientX; dr.py = e.clientY; };
    const onUp = () => { dr.active = false; };
    const onWheel = (e) => { e.preventDefault(); dr.zoom = clamp(dr.zoom + (e.deltaY > 0 ? 0.08 : -0.08), 0.3, 3.0); };
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    } catch (e) {
      queueMicrotask(() => setError(e));
      return;
    }

    return () => {
      cancelAnimationFrame(frameRef.current);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, [zone, proj, size, G, cent]);

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
      } catch {
        // ignore
      }
    }, 700);
    return () => clearTimeout(t);
  }, [zone?.id, size, onSnapshotReady]);

  const shell = {
    radius: 12,
    border: "1px solid " + K.bd,
    background: "linear-gradient(165deg, " + K.pn + " 0%, " + K.sf + " 55%, #060a12 100%)",
    boxShadow: "0 16px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
    overflow: "hidden",
  };
  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 8px",
    borderRadius: 6,
    background: "rgba(5,10,18,0.72)",
    border: "1px solid " + K.bd,
    backdropFilter: "blur(10px)",
    fontSize: 9,
    color: K.dm,
  };

  if (error) {
    return (
      <div style={{ ...shell, padding: 20, textAlign: "center", maxWidth: size + 32 }}>
        <div style={{ color: K.rd, fontSize: 11, fontWeight: 700 }}>3D visualization error</div>
        <div style={{ color: K.dm, fontSize: 10, marginTop: 6 }}>{error.message}</div>
      </div>
    );
  }
  if (!zone) {
    return (
      <div style={{ ...shell, padding: "28px 24px", textAlign: "center", maxWidth: size + 32 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: K.cy, letterSpacing: 2 }}>OLS · 3D</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: K.tx, marginTop: 8 }}>Select a zone to visualize</div>
        <div style={{ fontSize: 10, color: K.dm, marginTop: 6, lineHeight: 1.5, maxWidth: 320, margin: "8px auto 0" }}>The isometric view shows FATO, simplified 1:22.22 / 1:2 surfaces, and Inner Horizontal ({G.ih}m) context.</div>
      </div>
    );
  }

  const legendRows = [
    { c: "#10b981", l: "FATO pad", w: 18, h: 4 },
    { c: "#f59e0b", l: "Approach (per PC)", w: 18, h: 4 },
    { c: "#06b6d4", l: "1:2 transitional", w: 18, h: 4 },
    { c: "#10b981", l: "Obstacle clear", dot: 7 },
    { c: "#f59e0b", l: "Pen. 1:2", dot: 7 },
    { c: "#ef4444", l: "Pen. approach", dot: 7 },
  ];

  return (
    <div style={shell}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px 12px",
          borderBottom: "1px solid " + K.bd,
          background: "linear-gradient(90deg, rgba(37,99,235,0.08), transparent)",
        }}
      >
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: K.cy, letterSpacing: 2.2 }}>3D OLS · ISOMETRIC</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: K.tx, marginTop: 4, letterSpacing: -0.3 }}>{zone.lb}</div>
          <div style={{ fontSize: 9, color: K.mu, marginTop: 4, lineHeight: 1.45 }}>
            Schematic limitation surfaces — design review only. Not a regulatory OLS submission.
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...pill, fontWeight: 700, color: K.tx, fontSize: 10 }}>{zone.obs.length} structures</div>
          <div style={{ fontSize: 8, color: K.mu, marginTop: 6, fontWeight: 600 }}>FATO {G.fato.toFixed(0)} m · D {G.D.toFixed(1)} m</div>
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
              a.download = "HeliVertiSafe_OLS3D_" + (zone.lb || "zone").replace(/\s+/g, "_") + ".png";
              a.click();
            }}
            style={{
              marginTop: 8,
              padding: "5px 10px",
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 700,
              cursor: "pointer",
              background: K.bl + "22",
              color: K.cy,
              border: "1px solid " + K.cy + "44",
            }}
          >
            ⬇ PNG
          </button>
        </div>
      </div>
      <div style={{ padding: 10, position: "relative" }}>
        <div
          ref={mountRef}
          style={{
            width: size,
            height: size,
            margin: "0 auto",
            borderRadius: 8,
            overflow: "hidden",
            cursor: "grab",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: 18,
            ...pill,
            fontSize: 8,
            fontWeight: 600,
            color: K.dm,
          }}
        >
          Drag — orbit · Scroll — zoom · Origin at FATO center
        </div>
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(5,10,18,0.78)",
            border: "1px solid " + K.bd,
            backdropFilter: "blur(12px)",
            minWidth: 148,
          }}
        >
          <div style={{ fontSize: 7, fontWeight: 800, color: K.cy, letterSpacing: 1.2, marginBottom: 8 }}>LEGEND</div>
          {legendRows.map((row, idx) => (
            <div key={row.l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: idx === legendRows.length - 1 ? 0 : 5 }}>
              {row.dot ? (
                <div style={{ width: row.dot, height: row.dot, borderRadius: 2, background: row.c, flexShrink: 0 }} />
              ) : (
                <div style={{ width: row.w, height: row.h, borderRadius: 1, background: row.c, flexShrink: 0, opacity: 0.95 }} />
              )}
              <span style={{ fontSize: 8, color: K.dm, lineHeight: 1.2 }}>{row.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

Obs3D.displayName = "Obs3D";
