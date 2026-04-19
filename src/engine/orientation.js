import { DEG } from "../utils/coords.js";
import { getXwLim } from "../data/models.js";
import { angDiff } from "./geometry.js";

export const xwComp = (ws, wd, h) => Math.abs(ws * Math.sin(angDiff(wd, h) * DEG));
export const hwComp = (ws, wd, h) => ws * Math.cos(angDiff(wd, h) * DEG);

export function calcOrientation(z, p) {
  const { pd, ps, pf, sd, ss, sf, calm } = z.wind;
  const lim = getXwLim(p);
  if (ps === 0 && ss === 0) return { oh: 0, hp: "00/18", us: 100, xm: 0, lim, hwP: 0, hwS: 0, tw: false, ok: true, all: [], reason: "No wind data" };
  const res = [];
  for (let h = 0; h < 180; h += 5) {
    const h2 = h + 180;
    const hP = Math.max(hwComp(ps, pd, h), hwComp(ps, pd, h2));
    const xP = xwComp(ps, pd, h);
    const hS = Math.max(hwComp(ss, sd, h), hwComp(ss, sd, h2));
    const xS = xwComp(ss, sd, h);
    const tw = Math.min(hwComp(ps, pd, h), hwComp(ps, pd, h2)) < -5;
    let us = calm;
    if (xP <= lim) us += pf;
    if (xS <= lim) us += sf;
    const ac = pf + sf + calm;
    if (ac < 100) us += (100 - ac) * 0.5;
    res.push({ h, hp: String(Math.round(h/10)).padStart(2,"0") + "/" + String(Math.round(h2/10)).padStart(2,"0"), us: Math.min(100, Math.round(us*10)/10), xP: Math.round(xP*10)/10, xS: Math.round(xS*10)/10, xm: Math.round(Math.max(xP,xS)*10)/10, hwP: Math.round(hP*10)/10, hwS: Math.round(hS*10)/10, tw });
  }
  res.sort((a,b) => b.us !== a.us ? b.us - a.us : a.xm !== b.xm ? a.xm - b.xm : (b.hwP+b.hwS) - (a.hwP+a.hwS));
  const best = res[0];
  return { oh: best.h, hp: best.hp, us: best.us, xm: best.xm, lim, hwP: best.hwP, hwS: best.hwS, tw: best.tw, ok: best.us >= 95, all: res, reason: best.us >= 95 ? best.hp + " — " + best.us + "% usability, XW " + best.xm + "kt" : "Best " + best.hp + " — only " + best.us + "%" };
}
