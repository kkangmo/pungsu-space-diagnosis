import type { Coordinates } from "../types/shared";

const EARTH_R = 6371000; // m

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Haversine 거리 (미터)
export function distanceM(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(Math.min(1, h)));
}

// 방위각 (0=북, 시계방향, 0~359.999)
export function bearingDeg(from: Coordinates, to: Coordinates): number {
  const fLat = toRad(from.lat);
  const tLat = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(tLat);
  const x =
    Math.cos(fLat) * Math.sin(tLat) -
    Math.sin(fLat) * Math.cos(tLat) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// 방위각을 16방위 한국어로 변환
const DIR16 = [
  "북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동",
  "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서",
];

export function bearingLabel(deg: number): string {
  return DIR16[Math.round(((deg % 360) / 22.5)) % 16];
}

// 좌표가 기준점 기준 어느 사분면인지 (뒤쪽 = 북쪽 사분면 판정용)
export function isBehind(from: Coordinates, to: Coordinates, facingDeg: number): boolean {
  const b = bearingDeg(from, to);
  let diff = ((b - facingDeg + 540) % 360) - 180;
  // 뒤쪽 = 시야 방향 기준 135~225도
  return Math.abs(diff) >= 135 && Math.abs(diff) <= 225;
}

export function isFront(from: Coordinates, to: Coordinates, facingDeg: number): boolean {
  const b = bearingDeg(from, to);
  let diff = ((b - facingDeg + 540) % 360) - 180;
  return Math.abs(diff) < 67.5;
}

// bbox 생성 (Overpass 쿼리용)
export function bboxAround(c: Coordinates, radiusM: number): string {
  const dLat = (radiusM / EARTH_R) * (180 / Math.PI);
  const dLng =
    (radiusM / (EARTH_R * Math.cos(toRad(c.lat)))) * (180 / Math.PI);
  return `${c.lat - dLat},${c.lng - dLng},${c.lat + dLat},${c.lng + dLng}`;
}
