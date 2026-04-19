// Auto-extracted
export const K = { bg: "#050a12", sf: "#0b1120", pn: "#101d30", rs: "#152236", bd: "#1a2d4a", bl: "#2563eb", cy: "#06b6d4", gn: "#10b981", am: "#f59e0b", rd: "#ef4444", or: "#f97316", pu: "#a78bfa", tx: "#e1e7ef", dm: "#8896ab", mu: "#4e6380" };
export const gradeCol = (g) => ({ A: K.gn, B: K.bl, C: K.am, D: K.or, F: K.rd }[g] || K.mu);
export const scoreCol = (s) => s >= 80 ? K.gn : s >= 65 ? K.bl : s >= 50 ? K.am : s >= 35 ? K.or : K.rd;
