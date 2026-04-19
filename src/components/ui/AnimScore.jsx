import React, { useState, useEffect, useRef } from "react";

// ═══ ANIMATED SCORE COUNTER ═══
export function AnimScore({ value, color, size = 32 }) {
  const [display, setDisplay] = useState(typeof value === "number" ? value : 0);
  const ref = useRef(null);
  useEffect(() => {
    if (typeof value !== "number") return;
    let start = 0;
    const duration = 800;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <span style={{ fontSize: size, fontWeight: 800, color, transition: "color 0.3s" }}>{typeof value === "number" ? display : value}</span>;
}
