/**
 * Helicopter & eVTOL Rotor Downwash Aerodynamic Evaluation.
 * Based on Classical Actuator Disc Momentum Theory, FAA AC 150/5390,
 * NASA TM-84381 (Ground Outwash Velocity Profile), and UK CAA CAP 1264.
 */

export const AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m^3
export const GRAVITY = 9.80665; // m/s^2

/**
 * Calculates rotor downwash parameters for a given helicopter/aircraft.
 * @param {object} heli - Design helicopter metadata ({ mtow, rtr, D, dw, ... })
 * @param {number} [elevationM=0] - Site elevation AMSL in meters (for air density correction)
 */
export function calculateDownwash(heli, elevationM = 0) {
  const mtow = Math.max(heli?.mtow || 3000, 500); // kg
  const rtr = Math.max(heli?.rtr || heli?.D || 12, 4); // m
  const R = rtr / 2; // rotor radius
  const discArea = Math.PI * R * R; // m^2

  // Air density lapse with altitude (standard ISA troposphere model)
  const T0 = 288.15; // K
  const L = 0.0065; // K/m
  const T = Math.max(T0 - L * elevationM, 216.65);
  const rho = AIR_DENSITY_SEA_LEVEL * Math.pow(T / T0, (GRAVITY / (287.05 * L)) - 1);

  // Disc Loading (kg/m^2 and N/m^2)
  const weightN = mtow * GRAVITY;
  const discLoadingKg = mtow / discArea;
  const discLoadingN = weightN / discArea;

  // Mean Hover Induced Velocity OGE (m/s and knots)
  // v_i = sqrt(W / (2 * rho * A))
  const viMs = Math.sqrt(weightN / (2 * rho * discArea));
  const viKt = viMs * 1.94384;

  // Peak Ground Outwash Velocity (In Ground Effect - IGE)
  // At ground level, flow deflects radially with peak velocity ~ 1.5 - 1.6 * v_i at r ≈ 1.15 * R
  const peakOutwashFactor = 1.58;
  const vMaxMs = viMs * peakOutwashFactor;
  const vMaxKt = vMaxMs * 1.94384;
  const peakRadiusM = 1.15 * R;

  /**
   * Estimates ground outwash velocity (m/s and kt) at radial distance r (m) from pad center.
   * Empirical decay curve: V(r) drops off inversely beyond peak radius.
   */
  const getVelocityAtDistance = (rM) => {
    if (rM <= 0.2) return { ms: 0, kt: 0 };
    if (rM <= peakRadiusM) {
      // Inner build-up zone
      const ratio = rM / peakRadiusM;
      const ms = vMaxMs * Math.sin((ratio * Math.PI) / 2);
      return { ms, kt: ms * 1.94384 };
    }
    // Outer radial decay zone (decay exponent ~ 1.05)
    const decay = Math.pow(peakRadiusM / rM, 1.08);
    const ms = Math.max(0, vMaxMs * decay);
    return { ms, kt: ms * 1.94384 };
  };

  /**
   * Radial distance (m) to reach specific wind speed thresholds (knots).
   */
  const getRadiusForKnots = (targetKt) => {
    if (targetKt >= vMaxKt) return peakRadiusM;
    if (targetKt <= 2) return R * 8;
    // Solve: vMaxKt * (peakRadiusM / r)^1.08 = targetKt
    const r = peakRadiusM * Math.pow(vMaxKt / targetKt, 1 / 1.08);
    return Math.max(peakRadiusM, r);
  };

  // Regulatory & Personnel Hazard Distances
  const r60Kt = getRadiusForKnots(60); // Severe Debris & Structural Danger (>60 kt)
  const r45Kt = getRadiusForKnots(45); // Personnel Overturn & High Hazard (>45 kt)
  const r30Kt = getRadiusForKnots(30); // Pedestrian Instability & Loose Equipment (>30 kt)
  const r15Kt = getRadiusForKnots(15); // Safe Operational Perimeter (<15 kt)

  // Categorization
  let severity = "moderate";
  let severityLabel = "Moderate Downwash";
  let severityColor = "#06b6d4";

  if (vMaxKt > 65 || discLoadingKg > 45) {
    severity = "severe";
    severityLabel = "Severe Downwash (Heavy Category)";
    severityColor = "#ef4444";
  } else if (vMaxKt > 45 || discLoadingKg > 30) {
    severity = "high";
    severityLabel = "High Downwash (Medium Category)";
    severityColor = "#f59e0b";
  } else {
    severity = "low";
    severityLabel = "Low Downwash (Light Category)";
    severityColor = "#10b981";
  }

  return {
    mtow,
    rtr,
    rotorRadiusM: R,
    discAreaM2: discArea,
    discLoadingKgM2: discLoadingKg,
    discLoadingNM2: discLoadingN,
    airDensityKgM3: rho,
    viMs,
    viKt,
    vMaxMs,
    vMaxKt,
    peakRadiusM,
    hazardRadii: {
      r60Kt: Math.round(r60Kt * 10) / 10,
      r45Kt: Math.round(r45Kt * 10) / 10,
      r30Kt: Math.round(r30Kt * 10) / 10,
      r15Kt: Math.round(r15Kt * 10) / 10,
    },
    severity,
    severityLabel,
    severityColor,
    getVelocityAtDistance,
  };
}
