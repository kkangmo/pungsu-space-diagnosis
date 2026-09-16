import type { Coordinates } from "../types/shared";
import { bboxAround, distanceM, bearingDeg } from "./geo";

// OSM Overpass API 요소 (필요한 필드만)
export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  nodes?: number[];
}

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// 모든 공간 데이터를 단일 쿼리로 (네트워크 최소화)
function buildQuery(center: Coordinates, radiusM: number): string {
  const bbox = bboxAround(center, radiusM);
  return `[out:json][timeout:25];
(
  // 수계: 하천/강/호수/저수지
  node["natural"="water"](${bbox});
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
  way["waterway"](${bbox});
  relation["waterway"](${bbox});
  // 산림/녹지
  way["landuse"="forest"](${bbox});
  relation["landuse"="forest"](${bbox});
  way["natural"="wood"](${bbox});
  way["leisure"="park"](${bbox});
  way["landuse"="grass"](${bbox});
  // 도로/철도
  way["highway"](${bbox});
  way["railway"](${bbox});
  // 주변 시설 (묘지/변전소/쓰레기/기지국)
  node["historic"="grave"](${bbox});
  way["historic"="grave"](${bbox});
  way["landuse"="cemetery"](${bbox});
  way["amenity"="grave_yard"](${bbox});
  node["power"="substation"](${bbox});
  way["power"="substation"](${bbox});
  way["power"="generator"](${bbox});
  way["landuse"="landfill"](${bbox});
  node["amenity"="waste_plant"](${bbox});
  way["man_made"="wastewater_plant"](${bbox});
  node["man_made"="tower"](${bbox});
  node["power"="tower"](${bbox});
  node["telecom"="data_center"](${bbox});
);
out center geom;`;
}

export interface OverpassResult {
  waters: OsmElement[];
  forests: OsmElement[];
  parks: OsmElement[];
  roads: OsmElement[];
  railways: OsmElement[];
  facilities: OsmElement[];
  queryRadiusM: number;
}

function classify(el: OsmElement): keyof OverpassResult | null {
  const t = el.tags ?? {};
  if (t.natural === "water" || t.waterway) return "waters";
  if (t.landuse === "forest" || t.natural === "wood") return "forests";
  if (t.leisure === "park" || t.landuse === "grass") return "parks";
  if (t.railway) return "railways";
  if (t.highway) return "roads";
  if (
    t.historic === "grave" ||
    t.landuse === "cemetery" ||
    t.amenity === "grave_yard" ||
    t.power === "substation" ||
    t.power === "generator" ||
    t.landuse === "landfill" ||
    t.amenity === "waste_plant" ||
    t.man_made === "wastewater_plant" ||
    t.man_made === "tower" ||
    t.telecom === "data_center"
  ) {
    return "facilities";
  }
  return null;
}

// 요소의 대표 좌표 (노드/센터/지형 첫 점)
export function elementPoint(el: OsmElement): Coordinates | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  if (el.geometry && el.geometry.length > 0) {
    const pts = el.geometry;
    const mid = pts[Math.floor(pts.length / 2)];
    return { lat: mid.lat, lng: mid.lon };
  }
  return null;
}

// 요소의 모든 좌표 (라인/폴리곤 근접 판정용)
export function elementPoints(el: OsmElement): Coordinates[] {
  const pts: Coordinates[] = [];
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    pts.push({ lat: el.lat, lng: el.lon });
  }
  if (el.center) pts.push({ lat: el.center.lat, lng: el.center.lon });
  if (el.geometry) {
    for (const g of el.geometry) pts.push({ lat: g.lat, lng: g.lon });
  }
  return pts;
}

// 요소와의 최소 거리 (폴리곤/라인이면 가장 가까운 정점)
export function minDistanceTo(el: OsmElement, c: Coordinates): number {
  const pts = elementPoints(el);
  if (pts.length === 0) return Infinity;
  return Math.min(...pts.map((p) => distanceM(c, p)));
}

// 요소와의 방위 (대표 좌표 기준)
export function bearingTo(el: OsmElement, c: Coordinates): number | null {
  const pts = elementPoints(el);
  if (pts.length === 0) return null;
  let best = pts[0];
  let bestD = Infinity;
  for (const p of pts) {
    const d = distanceM(c, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return bearingDeg(c, best);
}

export async function queryOverpass(
  center: Coordinates,
  radiusM = 800,
): Promise<OverpassResult> {
  const query = buildQuery(center, radiusM);
  let lastErr: unknown = null;

  for (const url of OVERPASS_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass는 기본(브라우저형) User-Agent를 406으로 차단함.
          // OSM 사용 정책상 연락 가능한 설명형 UA 권장.
          "User-Agent": "PungsuMate/0.1 (standalone dev; contact: dev@pungsumate.local)",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      const elements = json.elements ?? [];

      const result: OverpassResult = {
        waters: [],
        forests: [],
        parks: [],
        roads: [],
        railways: [],
        facilities: [],
        queryRadiusM: radiusM,
      };
      for (const el of elements) {
        const k = classify(el);
        if (k && k !== "queryRadiusM") result[k].push(el);
      }
      return result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Overpass 요청 실패");
}
