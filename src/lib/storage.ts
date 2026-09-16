import type { AnalysisResult } from "../types/shared";

const STORAGE_KEY = "pungsumate.space.results.v1";

interface StoredResult {
  results: AnalysisResult[];
  savedAt: string;
}

// [INTEGRATE] 스탠드얼론 단계: localStorage. 연동 시 서버 저장 API로 교체.
export const resultStorage = {
  load(): AnalysisResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StoredResult;
      return Array.isArray(parsed.results) ? parsed.results : [];
    } catch {
      return [];
    }
  },

  save(result: AnalysisResult): void {
    try {
      const prev = this.load();
      const next: StoredResult = {
        results: [result, ...prev].slice(0, 20),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장 공간 부족 등 — 조용히 무시 (사용자에게 "저장 안 됨" 안내는 UI에서)
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 무시
    }
  },
};
