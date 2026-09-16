import type { Coordinates } from "../types/shared";

export interface GeocodeResult {
  coordinates: Coordinates;
  address: string;
  source: "kakao" | "nominatim" | "manual";
}

// Kakao 로컬 REST API (서버 측 키 사용)
async function geocodeKakao(address: string, key: string): Promise<GeocodeResult | null> {
  const url =
    "https://dapi.kakao.com/v2/local/search/address.json?query=" +
    encodeURIComponent(address);
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao geocode HTTP ${res.status}`);
  const json = (await res.json()) as {
    documents?: {
      address_name?: string;
      x?: string; // lng
      y?: string; // lat
    }[];
  };
  const doc = json.documents?.[0];
  if (!doc || !doc.x || !doc.y) return null;
  return {
    coordinates: { lat: parseFloat(doc.y), lng: parseFloat(doc.x) },
    address: doc.address_name ?? address,
    source: "kakao",
  };
}

// Nominatim(OSM) 폴백 — 키 불필요
async function geocodeNominatim(address: string): Promise<GeocodeResult | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&q=" +
    encodeURIComponent(address);
  const res = await fetch(url, {
    headers: { "User-Agent": "PungsuMate/0.1 (standalone dev)" },
  });
  if (!res.ok) throw new Error(`Nominatim geocode HTTP ${res.status}`);
  const json = (await res.json()) as {
    lat?: string;
    lon?: string;
    display_name?: string;
  }[];
  const hit = json[0];
  if (!hit || !hit.lat || !hit.lon) return null;
  return {
    coordinates: { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) },
    address: hit.display_name ?? address,
    source: "nominatim",
  };
}

export async function geocodeAddress(
  address: string,
  kakaoKey?: string,
): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("주소가 비어 있음");

  // 1차: Kakao (키 있을 때)
  if (kakaoKey) {
    try {
      const r = await geocodeKakao(trimmed, kakaoKey);
      if (r) return r;
    } catch {
      // 폴백으로 진행
    }
  }
  // 2차: Nominatim
  const r = await geocodeNominatim(trimmed);
  if (r) return r;
  throw new Error("ADDRESS_NOT_FOUND");
}
