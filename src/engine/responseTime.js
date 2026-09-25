import { DEG } from "../utils/coords.js";

export function calcResponseTime(dest, siteLat, siteLng) {
  if (!dest) return null;
  let distKm = typeof dest.distKm === "number" ? dest.distKm : (parseFloat(dest.distKm) || 0);
  if (distKm <= 0 && dest.lat && dest.lng && siteLat && siteLng) {
    // Haversine approximation
    const R = 6371;
    const dLat = (dest.lat - siteLat) * DEG, dLng = (dest.lng - siteLng) * DEG;
    const a = Math.sin(dLat/2)**2 + Math.cos(siteLat*DEG) * Math.cos(dest.lat*DEG) * Math.sin(dLng/2)**2;
    distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  if (!distKm || distKm <= 0) return null;
  const cruiseKt = typeof dest.cruiseKt === "number" ? dest.cruiseKt : (parseFloat(dest.cruiseKt) || 120);
  const groundMin = typeof dest.groundMin === "number" ? dest.groundMin : (parseFloat(dest.groundMin) || 0);
  const maxMinutes = typeof dest.maxMinutes === "number" ? dest.maxMinutes : (parseFloat(dest.maxMinutes) || 0);
  const speedKmh = cruiseKt * 1.852; // kt to km/h
  const flightMin = (distKm / speedKmh) * 60;
  const startupMin = 3; // engine start + liftoff
  const approachMin = 2; // approach + landing
  const totalMin = startupMin + flightMin + approachMin + groundMin;
  const meetsReq = maxMinutes > 0 ? totalMin <= maxMinutes : true;
  return {
    distKm: Math.round(distKm * 10) / 10,
    flightMin: Math.round(flightMin * 10) / 10,
    totalMin: Math.round(totalMin * 10) / 10,
    startupMin,
    approachMin,
    groundMin: Math.round(groundMin * 10) / 10,
    cruiseKt: Math.round(cruiseKt),
    speedKmh: Math.round(speedKmh),
    meetsReq,
    maxMinutes
  };
}
