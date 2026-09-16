import type { AnalysisItem, AnalysisResult, Coordinates, Grade } from "../types/shared";
import { RULES } from "./config";
import { bearingDeg, bearingLabel } from "./geo";
import {
  bearingTo,
  elementPoints,
  minDistanceTo,
  queryOverpass,
  type OsmElement,
  type OverpassResult,
} from "./overpass";
import { sampleElevations } from "./elevation";

const GRADE_SCORE: Record<Exclude<Grade, "unknown">, number> = {
  good: 85,
  normal: 60,
  caution: 35,
};

const DISCLAIMER =
  "본 서비스는 전통문화 데이터의 참고 정보입니다. 실제 운명 판단이나 의료·종교적 조언을 대체하지 않습니다.";

interface FacilityHit {
  category: string;
  label: string;
  el: OsmElement;
  dist: number;
}

// 1. 배산(背山): 뒤쪽(북쪽 사분면) 고지대/산림
function evalMountain(
  center: Coordinates,
  facingDeg: number,
  data: OverpassResult,
  elev: { north: number | null; south: number | null; center: number | null },
): AnalysisItem {
  const t = RULES.thresholds.mountain;
  const label = "배산 (뒤쪽 고지대·산림)";
  const gaps: string[] = [];

  // 산림 거리 (뒤쪽 우선)
  let forestDist = Infinity;
  let forestBehind = false;
  for (const f of data.forests) {
    const d = minDistanceTo(f, center);
    const b = bearingTo(f, center);
    if (d < forestDist) forestDist = d;
    if (b !== null && isBehindDir(b, facingDeg) && d <= t.maxDistanceM) {
      forestBehind = true;
    }
  }

  // 고도차 (북쪽이 남쪽보다 높으면 유리)
  let elevDiff: number | null = null;
  if (elev.north !== null && elev.south !== null) {
    elevDiff = elev.north - elev.south;
  } else if (elev.north !== null && elev.center !== null) {
    elevDiff = elev.north - elev.center;
  }

  if (elevDiff === null && !isFinite(forestDist)) gaps.push("주변 고도·산림 데이터");

  let grade: Exclude<Grade, "unknown">;
  let obs: string;

  // 스펙: 300m 안에 고도차 30m+ "또는" 산림 → 양호 (OR 조건)
  const forestNear = isFinite(forestDist) && forestDist <= t.forestMaxDistanceM;
  const elevRise = elevDiff !== null && elevDiff >= t.minElevationDiffM;

  if (forestBehind || forestNear) {
    grade = "good";
    obs = `뒷방향(${bearingLabel((facingDeg + 180) % 360)}) ${Math.round(forestDist)}m 이내에 산림이 관찰됩니다.`;
  } else if (elevRise) {
    grade = "good";
    obs = `뒷방향 지형이 앞쪽보다 ${Math.round(elevDiff!)}m 이상 높아, 뒤가 높은 지형입니다.`;
  } else if (isFinite(forestDist) && forestDist <= t.maxDistanceM) {
    grade = "normal";
    obs = `주변 ${Math.round(forestDist)}m 거리에 산림이 있으나, 뒷방향과 거리가 조금 멉니다.`;
  } else if (elevDiff !== null && elevDiff > 0) {
    grade = "normal";
    obs = `뒷방향 지형이 앞쪽보다 약간 높은 편입니다 (약 ${Math.round(elevDiff)}m).`;
  } else {
    grade = "caution";
    obs = `뒷방향에 산림이나 뚜렷한 고지대가 관찰되지 않습니다.`;
  }

  return {
    key: "mountain",
    label,
    grade,
    score: GRADE_SCORE[grade],
    observation: obs + (gaps.length ? " (일부 데이터 부족)" : ""),
    interpretation:
      "전통 풍수에서는 뒤에 산이나 높은 지대가 있어 '등을 받치는' 형국을 안정감 있는 터전으로 여기곤 합니다. 참고 정보입니다.",
  };
}

function isBehindDir(bearing: number, facingDeg: number): boolean {
  const diff = (((bearing - facingDeg + 540) % 360) - 180 + 360) % 360;
  return diff >= 135 && diff <= 225;
}

// 2. 임수(臨水): 앞·좌우 수계
function evalWater(center: Coordinates, facingDeg: number, data: OverpassResult): AnalysisItem {
  const t = RULES.thresholds.water;
  const label = "임수 (주변 하천·호수)";

  let best: { dist: number; front: boolean } | null = null;
  for (const w of data.waters) {
    const d = minDistanceTo(w, center);
    if (!isFinite(d)) continue;
    const b = bearingTo(w, center);
    const front = b !== null ? frontTest(b, facingDeg) : false;
    if (!best || d < best.dist) best = { dist: d, front };
  }

  let grade: Exclude<Grade, "unknown">;
  let obs: string;
  if (!best) {
    grade = "caution";
    obs = "주변 800m 이내에 하천·호수가 관찰되지 않습니다.";
  } else if (best.dist <= t.maxDistanceM) {
    grade = "good";
    obs = `${Math.round(best.dist)}m 거리에 하천/호수가 있으며, ${best.front ? "앞쪽 방향" : "옆쪽 방향"}에 위치합니다.`;
  } else if (best.dist <= t.gradedMaxDistanceM) {
    grade = "normal";
    obs = `${Math.round(best.dist)}m 거리에 하천/호수가 있어 산책 거리로 가깝습니다.`;
  } else {
    grade = "caution";
    obs = "주변 800m 이내에 하천·호수가 관찰되지 않습니다.";
  }

  return {
    key: "water",
    label,
    grade,
    score: GRADE_SCORE[grade],
    observation: obs,
    interpretation:
      "전통 풍수에서는 물을 생명과 흐름의 상징으로 여기며, 적당한 거리의 수계를 긍정적으로 참고합니다. 참고 정보입니다.",
  };
}

function frontTest(bearing: number, facingDeg: number): boolean {
  const diff = Math.abs(((bearing - facingDeg + 540) % 360) - 180);
  return diff < 67.5;
}

// 3. 도로 형상
function evalRoad(center: Coordinates, data: OverpassResult): AnalysisItem {
  const t = RULES.thresholds.road;
  const label = "도로 형상";

  // 가장 가까운 일반 도로
  let roadDist = Infinity;
  let roadType = "";
  for (const r of data.roads) {
    const hw = r.tags?.["highway"] ?? "";
    if (t.majorRoadTypes.includes(hw)) continue;
    const d = minDistanceTo(r, center);
    if (d < roadDist) {
      roadDist = d;
      roadType = hw;
    }
  }

  // 대로(주도로) 인접 여부
  let majorDist = Infinity;
  let majorType = "";
  for (const r of data.roads) {
    const hw = r.tags?.["highway"] ?? "";
    if (!t.majorRoadTypes.includes(hw)) continue;
    const d = minDistanceTo(r, center);
    if (d < majorDist) {
      majorDist = d;
      majorType = hw;
    }
  }

  // 철도 인접
  let railDist = Infinity;
  for (const r of data.railways) {
    const d = minDistanceTo(r, center);
    if (d < railDist) railDist = d;
  }

  // 막다른 길: 가장 가까운 도로가 cul-de-sac
  const deadEnd = data.roads.find(
    (r) => r.tags?.["highway"] === "service" || r.tags?.["noexit"] === "yes",
  );
  const deadEndDist = deadEnd ? minDistanceTo(deadEnd, center) : Infinity;

  let grade: Exclude<Grade, "unknown">;
  let obs: string;
  if (isFinite(majorDist) && majorDist <= t.deadEndMaxM) {
    grade = "caution";
    obs = `주 출입구 ${Math.round(majorDist)}m 이내로 대로(${majorType})가 직접 지나갑니다.`;
  } else if (isFinite(railDist) && railDist <= t.railwayMaxDistanceM) {
    grade = "caution";
    obs = `${Math.round(railDist)}m 이내에 철도가 지나갑니다.`;
  } else if (isFinite(deadEndDist) && deadEndDist > t.deadEndMaxM && deadEndDist <= 300) {
    grade = "caution";
    obs = `진입로가 막다른 길이며, 그 끝이 ${Math.round(deadEndDist)}m 이상 이어집니다.`;
  } else if (isFinite(roadDist)) {
    grade = "good";
    obs = `가장 가까운 도로는 ${roadType} 유형으로, 약 ${Math.round(roadDist)}m 거리에 있습니다.`;
  } else {
    grade = "normal";
    obs = "주변 도로 데이터가 충분하지 않아 보완이 필요합니다.";
  }

  return {
    key: "road",
    label,
    grade,
    score: GRADE_SCORE[grade],
    observation: obs,
    interpretation:
      "전통 풍수에서는 '곧은 길이 집을 바로 향하는' 형태보다, 부드럽게 휘거나 한결 덜 직선적인 동선을 선호하는 경향이 있습니다. 참고 정보입니다.",
  };
}

// 4. 주변 시설
function evalFacilities(center: Coordinates, data: OverpassResult): AnalysisItem {
  const t = RULES.thresholds.facilities;
  const label = "주변 시설 (묘지·변전소·쓰레기처리·기지국)";

  const hits: FacilityHit[] = [];
  const categoryLabels: Record<string, string> = {
    cemetery: "묘지/공원묘지",
    substation: "변전소/발전시설",
    waste: "쓰레기처리/하수처리장",
    tower: "기지국/송신탑",
  };

  for (const [cat, cfg] of Object.entries(t)) {
    for (const el of data.facilities) {
      const tags = el.tags ?? {};
      const matches = cfg.osmTags.some((tag) => {
        const [k, v] = tag.split("=");
        return tags[k] === v;
      });
      if (!matches) continue;
      const d = minDistanceTo(el, center);
      if (isFinite(d)) hits.push({ category: cat, label: categoryLabels[cat] ?? cat, el, dist: d });
    }
  }

  const violations = hits.filter((h) => h.dist <= t[h.category].maxDistanceM);
  violations.sort((a, b) => a.dist - b.dist);

  let grade: Exclude<Grade, "unknown">;
  let obs: string;
  if (violations.length === 0) {
    grade = "good";
    obs = hits.length
      ? `주변 시설 ${hits.length}곳이 확인되었으나, 참고 기준 거리보다 모두 멉니다.`
      : "참고 기준 내 특이사항이 되는 시설이 관찰되지 않았습니다.";
  } else {
    grade = "caution";
    obs = violations
      .map((v) => `${v.label} (${Math.round(v.dist)}m)`)
      .join(", ") + " 이(가) 기준 거리 내에 있습니다.";
  }

  return {
    key: "facilities",
    label,
    grade,
    score: GRADE_SCORE[grade],
    observation: obs,
    interpretation:
      "전통 풍수에서는 묘지나 쓰레기 처리 시설 등을 터전 주변의 부정적 환경 요소로 여기곤 했습니다. 참고 정보입니다.",
  };
}

// 5. 녹지 접근성
function evalGreen(center: Coordinates, data: OverpassResult): AnalysisItem {
  const t = RULES.thresholds.green;
  const label = "공원·녹지 접근성";

  let bestDist = Infinity;
  for (const g of [...data.parks, ...data.forests]) {
    const d = minDistanceTo(g, center);
    if (d < bestDist) bestDist = d;
  }

  let grade: Exclude<Grade, "unknown">;
  let obs: string;
  if (!isFinite(bestDist)) {
    grade = "caution";
    obs = "주변 500m 이내 공원·녹지가 관찰되지 않았습니다.";
  } else if (bestDist <= t.maxDistanceM) {
    grade = "good";
    obs = `${Math.round(bestDist)}m 거리에 공원 또는 숲이 있어 도보 접근이 쉽습니다.`;
  } else if (bestDist <= t.gradedMaxDistanceM) {
    grade = "normal";
    obs = `${Math.round(bestDist)}m 거리에 공원·녹지가 있습니다.`;
  } else {
    grade = "caution";
    obs = "주변 500m 이내 공원·녹지가 관찰되지 않았습니다.";
  }

  return {
    key: "green",
    label,
    grade,
    score: GRADE_SCORE[grade],
    observation: obs,
    interpretation:
      "전통 풍수에서 나무와 녹지를 생명력이 모이는 곳으로 여긴 점을 참고합니다. 참고 정보입니다.",
  };
}

// 좌향(坐向) 추정: 가장 가까운 도로 축에서 수직 방향
function estimateBearing(center: Coordinates, data: OverpassResult): number {
  let nearest: OsmElement | null = null;
  let nearestD = Infinity;
  for (const r of data.roads) {
    const d = minDistanceTo(r, center);
    if (d < nearestD) {
      nearestD = d;
      nearest = r;
    }
  }
  if (!nearest || !nearest.geometry || nearest.geometry.length < 2) {
    return 180; // 남향 디폴트
  }
  const pts = elementPoints(nearest);
  if (pts.length < 2) return 180;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const roadBearing = bearingDeg(a, b);
  // 도로에 수직인 방향 2개 중 남쪽이 향하는 쪽을 '향'으로 추정
  const perp1 = (roadBearing + 90) % 360;
  const perp2 = (roadBearing + 270) % 360;
  // 남반구에 가까운 방향(180도에 가까운)을 기본 '향'으로
  const diff1 = Math.min(Math.abs(perp1 - 180), 360 - Math.abs(perp1 - 180));
  const diff2 = Math.min(Math.abs(perp2 - 180), 360 - Math.abs(perp2 - 180));
  return diff1 <= diff2 ? perp1 : perp2;
}

function clampScore(v: number): number {
  const r = RULES.scoreRange;
  return Math.round(Math.max(r.floor, Math.min(r.ceiling, v)));
}

function buildSuggestions(items: AnalysisItem[]): string[] {
  const out: string[] = [];
  const cautionItems = items.filter((i) => i.grade === "caution");
  const normalItems = items.filter((i) => i.grade === "normal");

  for (const it of cautionItems) {
    if (out.length >= RULES.suggestions.maxCount) break;
    out.push(`${it.label} 항목이 주의 단계입니다. ${it.observation}`);
  }
  for (const it of normalItems) {
    if (out.length >= RULES.suggestions.maxCount) break;
    out.push(`${it.label}: ${it.observation} 실내에서는 채광과 환기를 챙기면 좋습니다.`);
  }
  while (out.length < RULES.suggestions.minCount) {
    out.push("주변 환경을 한 번 더 둘러보고, 거주 공간의 채광·환기·정리정돈을 점검해 보세요.");
  }
  return out.slice(0, RULES.suggestions.maxCount);
}

export interface GeoAnalysisInput {
  coordinates: Coordinates;
  address: string;
  bearingCorrection?: number;
}

export async function analyzeGeoLocation(input: GeoAnalysisInput): Promise<AnalysisResult> {
  const { coordinates, address } = input;
  const radius = Math.ceil(RULES.thresholds.water.gradedMaxDistanceM);

  // 외부 API 실패 시 해당 항목만 "정보 부족" — 전체 실패 금지
  let data: OverpassResult | null = null;
  const dataGaps: string[] = [];
  try {
    data = await queryOverpass(coordinates, radius);
  } catch {
    dataGaps.push("주변 공간 데이터");
  }

  let elev = { north: null as number | null, south: null as number | null, center: null as number | null };
  try {
    elev = await sampleElevations(coordinates);
  } catch {
    dataGaps.push("고도 데이터");
  }

  const effectiveData: OverpassResult = data ?? {
    waters: [],
    forests: [],
    parks: [],
    roads: [],
    railways: [],
    facilities: [],
    queryRadiusM: radius,
  };

  // 좌향 추정 (항상 "추정값" 명시, 사용자 보정 가능)
  const estimated = estimateBearing(coordinates, effectiveData);
  const bearing = {
    estimated,
    correctedByUser: input.bearingCorrection,
    unit: "도 (0=북, 시계방향)",
  };

  const items: AnalysisItem[] = [];
  if (!data) {
    // 공간 데이터 전체 실패 — 항목별로 unknown 처리
    for (const key of ["mountain", "water", "road", "facilities", "green"]) {
      items.push({
        key,
        label: labelFor(key),
        grade: "unknown",
        score: 0,
        observation: "주변 공간 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        interpretation: "",
      });
    }
    dataGaps.push("전체 공간 데이터");
  } else {
    items.push(evalMountain(coordinates, bearing.correctedByUser ?? estimated, effectiveData, elev));
    items.push(evalWater(coordinates, bearing.correctedByUser ?? estimated, effectiveData));
    items.push(evalRoad(coordinates, effectiveData));
    items.push(evalFacilities(coordinates, effectiveData));
    items.push(evalGreen(coordinates, effectiveData));
  }

  // 가중 평균 (unknown 항목은 가중치에서 제외 후 재정규화)
  let totalScore: number;
  const known = items.filter((i) => i.grade !== "unknown");
  if (known.length === 0) {
    totalScore = RULES.scoreRange.floor;
  } else {
    let weightSum = 0;
    let weighted = 0;
    for (const it of known) {
      const w = RULES.weights[it.key] ?? 0;
      weightSum += w;
      weighted += w * it.score;
    }
    totalScore = weightSum > 0 ? weighted / weightSum : 0;
  }

  return {
    module: "geo",
    totalScore: clampScore(totalScore),
    items,
    suggestions: buildSuggestions(items),
    address,
    coordinates,
    bearing,
    dataGaps: [...new Set(dataGaps)],
    disclaimer: DISCLAIMER,
    createdAt: new Date().toISOString(),
  };
}

function labelFor(key: string): string {
  const map: Record<string, string> = {
    mountain: "배산 (뒤쪽 고지대·산림)",
    water: "임수 (주변 하천·호수)",
    road: "도로 형상",
    facilities: "주변 시설 (묘지·변전소·쓰레기처리·기지국)",
    green: "공원·녹지 접근성",
  };
  return map[key] ?? key;
}
