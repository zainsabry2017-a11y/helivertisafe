/**
 * Phase 1.3 — shared domain types (JSDoc-friendly; use in .ts/.tsx or reference via /// <reference path="../types/hvs.d.ts" />).
 */

export type Weights = {
  wind: number;
  obs: number;
  ter: number;
  acc: number;
  geo: number;
  env: number;
};

export type WorkflowState = "draft" | "review" | "approved" | "issued";

export interface LogEntry {
  id: string;
  ts: string;
  action: string;
  detail: string;
}

export interface Project {
  id: string;
  nm: string;
  cl: string;
  pt: string;
  pc: "pc1" | "pc2" | "pc3";
  dh: string;
  cdv: number;
  mode: "feasibility" | "hybrid" | "compliance" | "vertiport";
  facility: "heliport" | "hospital_pad" | "vertiport";
  coordSys: "wgs84" | "utm" | "local";
  elevRef: "amsl" | "agl";
  desc: string;
  wt: Weights;
  workflow: WorkflowState;
  auditLog: LogEntry[];
}

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface WindData {
  pd: number;
  ps: number;
  pf: number;
  sd: number;
  ss: number;
  sf: number;
  calm: number;
  seasonal?: string;
}

export interface TerrainData {
  slope: number;
  slopeDir?: number;
  side: number;
  soil: string;
  cf: number;
  flood: boolean;
  elevMin: number;
  elevMax: number;
  elevAvg: number;
  elevPts: number;
}

export interface Obstacle {
  id: string;
  nm: string;
  tp: string;
  h: number;
  d: number;
  br: number;
  w: number;
  l: number;
  corners: Point3D[];
  elevAMSL?: number;
  x: number;
  y: number;
  perm?: boolean;
  lit?: boolean;
  verified?: boolean;
  confidence?: number;
  startDate?: string;
  endDate?: string;
}

export interface ScoreBreakdown {
  s: number;
  R: string[];
  pens?: unknown[];
}

export interface ScoreResult {
  tot: number;
  gr: string;
  rec?: string;
  ori?: { oh: number; hp: string; us: number; xm: number; lim: number };
  bd: Record<string, ScoreBreakdown>;
}

export interface Zone {
  id: string;
  lb: string;
  r: number;
  c: number;
  bw: number;
  bh: number;
  on: boolean;
  corners: Point3D[];
  wind: WindData;
  obs: Obstacle[];
  ter: TerrainData;
  acc: Record<string, unknown> & { nodes?: unknown[] };
  sens: unknown[];
  vport: Record<string, unknown>;
  src: Record<string, string>;
  sc: ScoreResult | null;
}
