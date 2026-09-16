import rules from "../config/rules.json";

interface RulesConfig {
  version: number;
  thresholds: {
    distances: { close: number; near: number; mid: number; far: number };
    mountain: { maxDistanceM: number; minElevationDiffM: number; forestMaxDistanceM: number };
    water: { maxDistanceM: number; gradedMaxDistanceM: number };
    road: {
      deadEndMaxM: number;
      railwayMaxDistanceM: number;
      majorRoadTypes: string[];
    };
    facilities: Record<
      string,
      { osmTags: string[]; maxDistanceM: number }
    >;
    green: { maxDistanceM: number; gradedMaxDistanceM: number };
  };
  weights: Record<string, number>;
  grades: { good: string; normal: string; caution: string };
  scoreRange: { min: number; max: number; floor: number; ceiling: number };
  vision: {
    maxPhotos: number;
    maxBytes: number;
    elementWeights: Record<string, number>;
  };
  suggestions: { minCount: number; maxCount: number };
}

function validate(cfg: RulesConfig): void {
  const weights = Object.values(cfg.weights);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 0.001) {
    throw new Error(`rules.json weights 합이 1이 아님: ${weightSum}`);
  }
  if (weights.length === 0) throw new Error("rules.json weights 누락");
  if (!cfg.grades.good || !cfg.grades.normal || !cfg.grades.caution) {
    throw new Error("rules.json grades 누락");
  }
  if (cfg.scoreRange.floor >= cfg.scoreRange.ceiling) {
    throw new Error("rules.json scoreRange.floor >= ceiling");
  }
}

// [INTEGRATE] 설정 파일 교체 지점: 도메인 조정 시 이 JSON 파일만 수정하면 됨 (코드 변경 불필요)
const config: RulesConfig = rules as RulesConfig;
validate(config);

export const RULES = config;
export type { RulesConfig };
