import type { AnalysisItem, AnalysisResult, Grade } from "../types/shared";
import { RULES } from "./config";
import type { VisionReport, VisionDetection } from "./vision";

const DISCLAIMER =
  "본 서비스는 전통문화 데이터의 참고 정보입니다. 실제 운명 판단이나 의료·종교적 조언을 대체하지 않습니다.";

// 요소별 한국어 라벨 (UI 표시용)
const ELEMENT_LABELS: Record<string, string> = {
  shape: "건물 형태",
  entrance: "출입문·현관",
  frontSpace: "현관 앞 공간",
  surroundings: "뒷편 수목·산",
  roadFront: "앞쪽 도로 형태",
  utilities: "전신주·고압선",
  facingBuilding: "마주보는 건물",
  balance: "색·재질 균형",
  interior: "실부 구조",
};

const SENTIMENT_SCORE: Record<string, number> = {
  good: 85,
  normal: 60,
  caution: 35,
  neutral: 60,
};

function clampScore(v: number): number {
  const r = RULES.scoreRange;
  return Math.round(Math.max(r.floor, Math.min(r.ceiling, v)));
}

function toGrade(sentiment: string): Grade {
  if (sentiment === "good") return "good";
  if (sentiment === "caution") return "caution";
  if (sentiment === "normal" || sentiment === "neutral") return "normal";
  return "unknown";
}

function buildPhotoSuggestions(detections: VisionDetection[]): string[] {
  const out: string[] = [];
  const caution = detections.filter((d) => d.sentiment === "caution");
  const normal = detections.filter((d) => d.sentiment === "normal" || d.sentiment === "neutral");

  for (const d of caution) {
    if (out.length >= RULES.suggestions.maxCount) break;
    out.push(
      `${ELEMENT_LABELS[d.element] ?? d.element}: ${d.observation} 실내라면 가구 배치·수납·빛·정리정돈 수준에서 점검해 보세요.`,
    );
  }
  for (const d of normal) {
    if (out.length >= RULES.suggestions.maxCount) break;
    out.push(`${ELEMENT_LABELS[d.element] ?? d.element}: ${d.observation}`);
  }
  while (out.length < RULES.suggestions.minCount) {
    out.push(
      "주택 외관과 주변 정비 상태를 살펴보고, 정리정돈과 채광 환경을 점검해 보세요.",
    );
  }
  return out.slice(0, RULES.suggestions.maxCount);
}

export function scorePhotoReport(report: VisionReport): AnalysisResult {
  // 1. 이해할 수 없는 이미지 → 중립 문구 반환 (절대 단정 판정 금지)
  if (report.uninterpretable || report.detections.length === 0) {
    return {
      module: "photo",
      totalScore: RULES.scoreRange.floor,
      items: [
        {
          key: "vision.uninterpretable",
          label: "사진 관찰",
          grade: "unknown",
          score: 0,
          observation:
            report.note ??
            "이 사진에서는 주거 환경의 특징을 충분히 관찰하기 어렵습니다. 다른 각도의 사진을 올려주시면 좋습니다.",
          interpretation:
            "전통 풍수 관점 해석은 관찰이 가능할 때만 제공합니다. 참고 정보입니다.",
        },
      ],
      suggestions: [
        "건물 전체가 담긴 사진, 현관이 잘 보이는 사진을 올려보세요.",
      ],
      dataGaps: ["사진 관찰 결과"],
      disclaimer: DISCLAIMER,
      createdAt: new Date().toISOString(),
    };
  }

  // 2. 규칙 엔진: detections → AnalysisItems (가중치는 rules.json)
  const items: AnalysisItem[] = report.detections.map((d) => ({
    key: `vision.${d.element}`,
    label: ELEMENT_LABELS[d.element] ?? d.element,
    grade: toGrade(d.sentiment),
    score: SENTIMENT_SCORE[d.sentiment] ?? 60,
    observation: d.observation,
    interpretation: d.interpretation,
  }));

  // 동일 element가 여러 장에서 중복 검출되면 가중 평균으로 병합
  const merged = new Map<string, AnalysisItem>();
  const counts = new Map<string, number>();
  for (const it of items) {
    const prev = merged.get(it.key);
    const n = (counts.get(it.key) ?? 0) + 1;
    counts.set(it.key, n);
    if (!prev) {
      merged.set(it.key, it);
    } else {
      merged.set(it.key, {
        ...prev,
        score: Math.round((prev.score * (n - 1) + it.score) / n),
        observation: prev.observation,
        interpretation: prev.interpretation,
      });
    }
  }

  const mergedItems = Array.from(merged.values());

  // 3. 종합 지표: elementWeights 가중 평균
  const w = RULES.vision.elementWeights;
  let weightSum = 0;
  let weighted = 0;
  for (const it of mergedItems) {
    const key = it.key.replace("vision.", "");
    const weight = w[key] ?? 0;
    weightSum += weight;
    weighted += weight * it.score;
  }
  const totalScore = weightSum > 0 ? weighted / weightSum : 60;

  return {
    module: "photo",
    totalScore: clampScore(totalScore),
    items: mergedItems,
    suggestions: buildPhotoSuggestions(report.detections),
    dataGaps: report.sceneType === "unknown" ? ["장면 분류(실내/실외)"] : [],
    disclaimer: DISCLAIMER,
    createdAt: new Date().toISOString(),
  };
}
