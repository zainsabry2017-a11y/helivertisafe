import React from "react";
import { K, gradeCol, scoreCol } from "../../utils/theme.js";

export function ZGrid({ zones, sel, onSel, cols, rows, sm }) {
  const total = cols * rows;
  const isLarge = total > 64;
  const isHuge = total > 400;
  const cellH = isHuge ? 8 : isLarge ? 16 : sm ? 38 : 52;
  const gap = isHuge ? 1 : isLarge ? 1 : 3;
  const fontSize = isHuge ? 0 : isLarge ? 6 : sm ? 8 : 9;

  return (
    <div style={{ maxHeight: isLarge ? 200 : "auto", overflowY: isLarge ? "auto" : "visible", overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ", 1fr)", gap, padding: 2, minWidth: isLarge ? cols * (cellH + gap) : "auto" }}>
        {zones.map(z => {
          const s = z.sc?.tot, g = z.sc?.gr;
          const isActive = z.id === sel;
          const bg = !z.on ? K.mu : s != null ? scoreCol(s) : K.bd;
          const op = !z.on ? 0.12 : s != null ? 0.2 + (s / 100) * 0.5 : 0.12;
          return (
            <div key={z.id} onClick={() => onSel(z.id)} title={z.lb + (s != null ? " — " + s + "/100 (" + g + ")" : "")} style={{
              background: `rgba(${parseInt(bg.slice(1,3),16)},${parseInt(bg.slice(3,5),16)},${parseInt(bg.slice(5,7),16)},${op})`,
              border: isHuge ? "none" : "2px solid " + (isActive ? "#fff" : "transparent"),
              borderRadius: isHuge ? 1 : isLarge ? 3 : 6,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              cursor: "pointer", height: cellH, transition: "all 0.15s",
              boxShadow: isActive ? "0 0 8px " + bg + "50" : "none",
              outline: isHuge && isActive ? "1px solid #fff" : "none"
            }}>
              {fontSize > 0 && <span style={{ fontSize, fontWeight: 700, color: z.on ? "#ffffffcc" : "#ffffff44", lineHeight: 1 }}>{z.lb}</span>}
              {!isLarge && s != null && <span style={{ fontSize: sm ? 11 : 15, fontWeight: 800, color: "#fff", textShadow: "0 0 6px " + bg + "60" }}>{s}</span>}
              {!isLarge && g && <span style={{ fontSize: 9, fontWeight: 700, color: gradeCol(g) }}>{g}</span>}
            </div>
          );
        })}
      </div>
      {isLarge && <div style={{ fontSize: 8, color: K.mu, marginTop: 2, textAlign: "center" }}>{total} zones | Hover for details | Click to select</div>}
    </div>
  );
}
