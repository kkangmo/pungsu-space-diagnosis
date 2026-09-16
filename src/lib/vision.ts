// 사진 기반 지리풍수 분석 — 비전 AI 호출부
// [INTEGRATE] 배포 시 이 로직은 Cloudflare Worker의 /api/photo/analyze 로 이전.
// 클라이언트는 multipart 업로드만 담당.

export interface VisionDetection {
  element: string;          // shape | entrance | frontSpace | surroundings | roadFront | utilities | facingBuilding | balance | interior
  value: string;            // 검출된 값
  observation: string;      // 관찰 결과(사실)
  interpretation: string;   // 전통 풍수 관점 해석(상징·문화)
  sentiment: "good" | "normal" | "caution" | "neutral";
  confidence: number;       // 0~1
}

export interface VisionReport {
  detections: VisionDetection[];
  sceneType: "exterior" | "interior" | "unknown";
  uninterpretable: boolean; // "이해할 수 없는 이미지" (예: 사람 얼굴 클로즈업)
  note?: string;
}

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// 검출 항목 명세 — 시스템 지시문
const DETECTION_SPEC = `당신은 한국 전통 풍수(形局)의 지리적 관점을 이미지로 관찰하는 비전 보조자입니다.
운명을 판정하지 마세요. 오직 "관찰된 사실"과 "전통 풍수에서 상징으로 여기던 해석"만 분리해 반환하세요.

[검출 항목]
- shape: 건물 전체 형태 (정방형/장방형/ㄱ자·ㄴ자형/삼각·부정형/계단형)
- entrance: 출입문 위치와 방향, 현관 앞 공간 (마당/도로/주차장)
- surroundings: 건물 뒤·옆 수목, 산, 자연 요소
- roadFront: 앞쪽 도로 형태 (곧은 길/곡선/막다른 길)
- utilities: 전신주, 고압선, 현수막 접근 여부
- facingBuilding: 마주보는 건물 존재와 높이 비교
- balance: 색·재질 균형, 외관 정비 상태
- interior: (실내인 경우) 현관 위치·거울, 거실 구조, 침실·화장실 문 관계, 계단 위치, 창 방향

[출력 규칙]
1. 각 요소를 observation(사실)과 interpretation(전통 풍수 상징·문화 참고) 두 층으로 분리
2. 효능 단정/결과 예언 금지 ("재물운이 들어온다" 등). "~로 여기곤 합니다(참고)" 수준만
3. 위험·주술적 행위 지시 금지
4. 이미지가 주거 환경과 무관하거나(사람 얼굴 클로즈업 등) 이해할 수 없으면 uninterpretable=true
5. 반드시 아래 JSON 스키마로만 응답 (다른 설명 금지)

{
  "sceneType": "exterior" | "interior" | "unknown",
  "uninterpretable": boolean,
  "note": "추가 설명 (선택)",
  "detections": [
    { "element": "shape", "value": "장방형", "observation": "사실", "interpretation": "전통 풍수 관점 해석", "sentiment": "good|normal|caution|neutral", "confidence": 0.0~1.0 }
  ]
}`;

export async function analyzePhotosWithVision(
  images: { mimeType: string; base64: string }[],
  apiKey: string,
): Promise<VisionReport> {
  const parts: unknown[] = [{ text: DETECTION_SPEC + "\n\n위 규칙에 따라 다음 이미지(들)를 분석해 JSON으로만 답하세요." }];
  for (const img of images) {
    parts.push({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VISION_HTTP_${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    return {
      detections: [],
      sceneType: "unknown",
      uninterpretable: true,
      note: "모델이 응답을 생성하지 못했습니다.",
    };
  }
  return parseReport(text);
}

function parseReport(text: string): VisionReport {
  // JSON 추출 (모델이 코드블록을 씌울 수 있음)
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<VisionReport>;
    const detections = (parsed.detections ?? []).filter(
      (d) => d && d.element && d.observation,
    );
    return {
      detections,
      sceneType: parsed.sceneType ?? "unknown",
      uninterpretable: Boolean(parsed.uninterpretable),
      note: parsed.note,
    };
  } catch {
    return {
      detections: [],
      sceneType: "unknown",
      uninterpretable: true,
      note: "모델 응답을 해석하지 못했습니다.",
    };
  }
}
