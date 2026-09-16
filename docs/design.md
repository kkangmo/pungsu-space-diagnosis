# 설계서 — 풍수메이트 "내 공간 풍수 진단" 스탠드얼론 모듈

> 전통 풍수(形局) 원리를 GIS·공간데이터·비전 분석으로 재해석하는 모듈.
> **프레임**: "전통문화 데이터의 IT 재해석" — 운명 판정 톤 금지, 환경 관찰 지표 + 전통 상징 정보로만 표현.

---

## 1. 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트 (React + TS + Vite)         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ AddressInput │  │ PhotoUpload  │  │ ResultDashboard   │  │
│  │ (주소/핀)    │  │ (최대 5장)   │  │ (A·B 통합 카드)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────▲──────────┘  │
│         │                 │                   │             │
│         ▼                 ▼                   │             │
│  ┌──────────────────────────────────┐         │             │
│  │      API 클라이언트 (fetch)      │         │             │
│  │  POST /api/geo/analyze           │         │             │
│  │  POST /api/photo/analyze         │         │             │
│  └──────────────┬───────────────────┘         │             │
└─────────────────┼─────────────────────────────┼─────────────┘
                  │  (개발: Vite dev 서버 내 API 라우트)        │
                  │  (배포: Cloudflare Worker — [INTEGRATE])   │
                  ▼                             │
┌─────────────────────────────────────────────────────────────┐
│                    서버 측 (키 보관소)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ Geocoding  │ │ Overpass   │ │ Elevation  │ │  Vision   │  │
│  │ Kakao/Nom. │ │ OSM 쿼리   │ │ OpenTopo   │ │  Gemini   │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬─────┘  │
└────────┼──────────────┼──────────────┼──────────────┼────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
   ┌──────────────────────────────────────────────────────┐
   │        규칙 엔진 (src/lib/analysis.ts)                │
   │   임계값·가중치 = src/config/rules.json 에서만 읽기    │
   └──────────────────────┬───────────────────────────────┘
                          ▼
                   공유 응답 타입 (src/types/shared.ts)
                   → ResultDashboard 렌더링
                   → localStorage 저장 (스탠드얼론 단계)
```

### 계층 책임
| 계층 | 파일 | 책임 |
|---|---|---|
| UI | `src/components/*` | 입력 수집, 결과 렌더링, 접이식 카드 |
| API 클라이언트 | `src/api/client.ts` | `/api/*` 호출, 에러 정규화 |
| API 라우트 | `vite.config.ts` 내 플러그인 | 서버 측 외부 API 호출, **키 환경변수만** |
| 도메인 로직 | `src/lib/*` | 지오코딩/Overpass/고도/비전/채점 |
| 설정 | `src/config/rules.json` | 모든 임계값·가중치·문구 (하드코딩 금지) |
| 타입 | `src/types/shared.ts` | 응답 스키마 단일 소스 (프론트·백엔드 공유) |

---

## 2. 데이터 흐름

### 모듈 A — 주소 기반 위치 분석
```
주소 입력
  → 지오코딩 (Kakao REST → 실패 시 Nominatim 폴백)
  → 좌표 확정 (실패 시 수동 핀 유도)
  → Overpass 단일 쿼리 (반경 500~800m, 수계/산림/도로/POI/녹지 동시)
      - 실패/타임아웃 시 해당 항목 "정보 부족", 나머지 계속
  → 고도 DEM 조회 (배산 판정용; 실패 시 "정보 부족")
  → 좌향 추정 (필지/도로 경계 장축) + 사용자 보정 옵션
  → 규칙 엔진 (rules.json 임계값 적용)
      - 배산 / 임수 / 도로 / 주변시설 / 녹지  → 3단계(양호/보통/주의)
  → 종합 지표 0~100 + 항목별 해설 + 실천 제안 1~3
  → 결과 카드 + localStorage 저장
```

### 모듈 B — 사진 기반 지리풍수 분석
```
사진 업로드 (최대 5장, 로컬 미리보기만)
  → 서버로 전송 (multipart)
  → 비전 모델 호출 (Gemini Flash; 검출 항목 명세를 시스템 지시문)
      - "이해할 수 없는 이미지" 감지 시 중립 문구 반환
  → 규칙 엔진 (rules.json 가중치표)
  → 관찰 결과(사실) / 전통 풍수 관점 해석(상징) 2층 분리
  → 종합 지표 + "주목할 만한 관찰" + "개선 제안"
  → 사진 즉시 폐기 (메모리 외 저장 금지)
  → 결과 카드
```

### 통합 화면
```
진입 (탭: 주소 / 사진 / 둘 다)
  → 로딩 ("풍수 관찰 중..." 스켈레톤)
  → A·B 각각 별도 카드 + 종합 요약
  → 고지 박스 (전통문화 참고 정보)
  → localStorage 저장 / 저장 없이 종료
```

---

## 3. 설정 파일 스키마 (`src/config/rules.json`)

모든 판정값은 이 파일에서만 읽습니다. 코드에 하드코딩 금지.

```jsonc
{
  "version": 1,
  "thresholds": {
    "distances": { "close": 100, "near": 300, "mid": 500, "far": 800 },
    "mountain": { "maxDistanceM": 500, "minElevationDiffM": 30, "forestMaxDistanceM": 300 },
    "water": { "maxDistanceM": 500, "gradedMaxDistanceM": 800 },
    "road": { "deadEndMaxM": 50, "railwayMaxDistanceM": 200, "majorRoadTypes": ["motorway","trunk","primary","secondary"] },
    "facilities": {
      "cemetery":    { "osmTags": ["historic=grave","landuse=cemetery","amenity=grave_yard"], "maxDistanceM": 500 },
      "substation":  { "osmTags": ["power=substation","power=generator"], "maxDistanceM": 300 },
      "waste":       { "osmTags": ["landuse=landfill","amenity=waste_plant","man_made=wastewater_plant"], "maxDistanceM": 500 },
      "tower":       { "osmTags": ["man_made=tower","power=tower","telecom=data_center"], "maxDistanceM": 100 }
    },
    "green": { "maxDistanceM": 200, "gradedMaxDistanceM": 500 }
  },
  "weights": {
    "mountain": 0.25, "water": 0.20, "road": 0.15,
    "facilities": 0.25, "green": 0.15
  },
  "grades": { "good": "양호", "normal": "보통", "caution": "주의" },
  "scoreRange": { "min": 0, "max": 100, "floor": 15, "ceiling": 95 },
  "vision": {
    "maxPhotos": 5,
    "maxBytes": 10485760,
    "elementWeights": { "shape": 0.20, "entrance": 0.20, "road": 0.15, "surroundings": 0.15, "balance": 0.15, "interior": 0.15 }
  },
  "suggestions": { "minCount": 1, "maxCount": 3 }
}
```

### 스키마 검증
- `src/lib/config.ts`가 로드 시 필수 키 누락/타입 오류를 검사하고, 실패 시 명시적 에러.

---

## 4. 응답 스키마 (공유 단일 소스: `src/types/shared.ts`)

```ts
export type Grade = "good" | "normal" | "caution" | "unknown";

export interface AnalysisItem {
  key: string;          // mountain | water | road | facilities | green | vision.*
  label: string;        // 한국어 항목명
  grade: Grade;
  score: number;        // 0~100
  observation: string;  // 관찰 결과(사실)
  interpretation: string; // 전통 풍수 관점 해석(참고)
}

export interface AnalysisResult {
  module: "geo" | "photo";
  totalScore: number;
  items: AnalysisItem[];
  suggestions: string[];   // 실천 제안 1~3
  address?: string;
  coordinates?: { lat: number; lng: number };
  bearing?: { estimated: number; correctedByUser?: number; unit: string };
  dataGaps: string[];      // "정보 부족" 항목
  disclaimer: string;
  createdAt: string;       // ISO
}
```

---

## 5. API 키 관리

| 변수 | 용도 | 필수 |
|---|---|---|
| `KAKAO_REST_KEY` | 지오코딩 (주소→좌표) | 아니요 — Nominatim 폴백 |
| `KAKAO_JS_KEY` | 지도 타일 | 아니요 — Leaflet+OSM 폴백 |
| `GEMINI_API_KEY` | 사진 분석 | 아니요 — 키 없으면 안내 문구 |

- `.env`는 `.gitignore`에 포함. `.env.example`만 커밋.
- 클라이언트 번들에 키 노출 금지 — 모든 외부 호출은 `/api/*` 서버 라우트 경유.

---

## 6. 표현 톤 규칙 (모든 문구 생성 시)

- 효능 단정/결과 예언 금지 ("재물운이 들어온다" 등)
- "환경 관찰 지표" + "전통 풍수에서는 OO로 여기곤 합니다(참고)"
- 위험/주술적 행위 실행 지시 금지
- 모든 결과 화면에 고지 박스 필수
- 점수 극단(0/100) 회피 — `rules.json`의 floor/ceiling 적용
