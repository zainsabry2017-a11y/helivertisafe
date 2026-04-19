import { DEG } from "../utils/coords.js";

export function calcResponseTime(dest, siteLat, siteLng) {
  let distKm = dest.distKm;
  if (distKm <= 0 && dest.lat && dest.lng && siteLat && siteLng) {
    // Haversine approximation
    const R = 6371;
    const dLat = (dest.lat - siteLat) * DEG, dLng = (dest.lng - siteLng) * DEG;
    const a = Math.sin(dLat/2)**2 + Math.cos(siteLat*DEG) * Math.cos(dest.lat*DEG) * Math.sin(dLng/2)**2;
    distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  if (distKm <= 0) return null;
  const speedKmh = (dest.cruiseKt || 120) * 1.852; // kt to km/h
  const flightMin = (distKm / speedKmh) * 60;
  const startupMin = 3; // engine start + liftoff
  const approachMin = 2; // approach + landing
  const groundMin = dest.groundMin || 0; // ground transport at destination
  const totalMin = startupMin + flightMin + approachMin + groundMin;
  const meetsReq = dest.maxMinutes > 0 ? totalMin <= dest.maxMinutes : true;
  return { distKm: Math.round(distKm * 10) / 10, flightMin: Math.round(flightMin * 10) / 10, totalMin: Math.round(totalMin * 10) / 10, startupMin, approachMin, groundMin, speedKmh: Math.round(speedKmh), meetsReq, maxMinutes: dest.maxMinutes };
}
