import React, { useState, useEffect } from "react";

// ═══ CONFETTI EFFECT ═══
export function Confetti({ active }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (!active) { queueMicrotask(() => setParticles([])); return; }
    const ps = Array.from({ length: 50 }, (_, i) => ({
      id: i, x: 50 + Math.random() * 0, y: 0,
      vx: (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 6,
      color: ["#10b981", "#06b6d4", "#f59e0b", "#2563eb", "#a78bfa", "#ef4444"][i % 6],
      size: 4 + Math.random() * 4, rot: Math.random() * 360,
      dur: 2 + Math.random(),
      delay: Math.random() * 0.5,
    }));
    queueMicrotask(() => setParticles(ps));
    const timer = setTimeout(() => queueMicrotask(() => setParticles([])), 3000);
    return () => clearTimeout(timer);
  }, [active]);
  if (!particles.length) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      <style>{`@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
      {particles.map(p => <div key={p.id} style={{ position: "absolute", left: (50 + p.vx * 10) + "%", top: -10, width: p.size, height: p.size * 0.6, background: p.color, borderRadius: 1, animation: "confettiFall " + p.dur + "s ease-out forwards", animationDelay: p.delay + "s", transform: "rotate(" + p.rot + "deg)" }} />)}
    </div>
  );
}
