import type { Coordinates } from "../types/shared";

// OpenTopoData 공개 DEM (키 불필요). 실패 시 호출자가 "정보 부족" 처리.
// 한국은 SRTM 30m 계측에 약 1~3m 정확도 오차가 있을 수 있음 — "추정값"으로 표기.

const ELEV_URL = "https://api.opentopodata.org/v1/srtm30m";

export async function getElevation(point: Coordinates): Promise<number | null> {
  try {
    const url = `${ELEV_URL}?locations=${point.lat},${point.lng}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PungsuMate/0.1 (standalone dev)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { elevation?: number }[];
    };
    const e = json.results?.[0]?.elevation;
    return typeof e === "number" ? e : null;
  } catch {
    return null;
  }
}

// 지점 주변 고도 샘플링 (배산 판정용: 북쪽이 더 높은지)
export async function sampleElevations(
  center: Coordinates,
): Promise<{ north: number | null; south: number | null; center: number | null }> {
  const offset = 0.0045; // 약 500m
  const north: Coordinates = { lat: center.lat + offset, lng: center.lng };
  const south: Coordinates = { lat: center.lat - offset, lng: center.lng };

  const [c, n, s] = await Promise.all([
    getElevation(center),
    getElevation(north),
    getElevation(south),
  ]);
  return { north: n, south: s, center: c };
}
