import type { AnalysisResult, GeoAnalyzeRequest } from "../types/shared";
import { RULES } from "../lib/config";

// [INTEGRATE] 배포 시 BASE_URL만 Worker/Pages 도메인으로 변경 (또는 동일 origin 유지)
const BASE_URL = "";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function handleResponse(res: Response): Promise<AnalysisResult> {
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = "요청을 처리하지 못했습니다.";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch {
      // JSON 아님
    }
    throw new ApiClientError(code, message);
  }
  return (await res.json()) as AnalysisResult;
}

export const apiClient = {
  async analyzeGeo(request: GeoAnalyzeRequest): Promise<AnalysisResult> {
    if (!request.address?.trim() && !request.coordinates) {
      throw new ApiClientError("INVALID_ADDRESS", "주소를 입력하거나 지도에서 핀을 지정해 주세요.");
    }
    const res = await fetch(`${BASE_URL}/api/geo/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return handleResponse(res);
  },

  async analyzePhotos(
    photos: File[],
    bearingCorrection?: number,
  ): Promise<AnalysisResult> {
    const form = new FormData();
    for (const p of photos) form.append("photos", p);
    if (bearingCorrection !== undefined) {
      form.append("bearingCorrection", String(bearingCorrection));
    }
    const res = await fetch(`${BASE_URL}/api/photo/analyze`, {
      method: "POST",
      body: form,
    });
    return handleResponse(res);
  },

  // 클라이언트 측 검증 규칙 (rules.json 기반)
  validation: {
    maxPhotos: RULES.vision.maxPhotos,
    maxBytes: RULES.vision.maxBytes,
  },
};
