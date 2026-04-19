import React from "react";
import { K } from "../../utils/theme.js";

// ═══ SMALL COMPONENTS ═══
export function Tag({ children, color = K.bl }) {
  return <span style={{ display: "inline-block", padding: "0.25rem 0.65rem", borderRadius: 4, fontSize: "0.875rem", fontWeight: 700, background: color + "15", color, border: "1px solid " + color + "25", letterSpacing: 0.3, backdropFilter: "blur(4px)" }}>{children}</span>;
}
