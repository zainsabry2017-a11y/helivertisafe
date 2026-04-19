import React from "react";

export function Tooltip({ text, children }) {
  return React.createElement("span", { title: text, style: { cursor: "help", borderBottom: text ? "1px dotted #4e6380" : "none" } }, children);
}

/** Alias used across step views (monolith name). */
export const Tip = Tooltip;
