/** Per-zone data completeness for Data Input / Score readiness UI. */
export function zoneCompleteness(z) {
  const checks = {
    wind: z.wind.ps > 0,
    obs: z.obs.length > 0,
    terrain: z.ter.slope > 0 || z.ter.elevPts > 0,
    access: z.acc.rd > 0 || (z.acc.nodes || []).length > 0,
    sens: (z.sens || []).length > 0,
  };
  const filled = Object.values(checks).filter(Boolean).length;
  return { ...checks, pct: Math.round((filled / 5) * 100), filled, total: 5 };
}
