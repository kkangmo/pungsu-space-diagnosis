export type Grade = "good" | "normal" | "caution" | "unknown";

export interface AnalysisItem {
  key: string;
  label: string;
  grade: Grade;
  score: number;
  observation: string;
  interpretation: string;
}

export interface Bearing {
  estimated: number;
  correctedByUser?: number;
  unit: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// [INTEGRATE] 응답 스키마 단일 소스 — 프론트와 백엔드가 이 타입을 공유함.
// 서버 이전 시 이 파일만 백엔드로 복사하면 됨.
export interface AnalysisResult {
  module: "geo" | "photo";
  totalScore: number;
  items: AnalysisItem[];
  suggestions: string[];
  address?: string;
  coordinates?: Coordinates;
  bearing?: Bearing;
  dataGaps: string[];
  disclaimer: string;
  createdAt: string;
}

export interface GeoAnalyzeRequest {
  address?: string;
  coordinates?: Coordinates;
  bearingCorrection?: number;
}

export interface PhotoAnalyzeRequest {
  // multipart/form-data: photos[], bearingCorrection?
  bearingCorrection?: number;
}

export class AnalysisError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}
