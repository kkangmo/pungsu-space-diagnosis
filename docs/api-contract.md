# API 계약 문서 — "내 공간 풍수 진단" 스탠드얼론

> `saju-app` 연동을 위한 API 계약. 응답 스키마의 단일 소스는 `src/types/shared.ts` 입니다.

- 기본 URL (스탠드얼론): `http://localhost:5173`
- 배포 (Cloudflare Worker/Pages Functions) 시: 동일 경로, 환경변수만 Worker Secret으로 이전
- 모든 응답은 `UTF-8` JSON

---

## 1. 엔드포인트

### `POST /api/geo/analyze` — 주소 기반 위치 분석

**요청** (application/json)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `address` | string | 둘 중 하나 | 도로명/지번 주소 |
| `coordinates` | `{ lat, lng }` | 둘 중 하나 | 수동 핀 (주소 탐색 실패 시 사용) |
| `bearingCorrection` | number | 선택 | 사용자가 보정한 좌향 (0=북, 시계방향) |

```jsonc
// 예시 1: 주소
{ "address": "서울특별시 종로구 사직로 161" }

// 예시 2: 수동 핀
{ "coordinates": { "lat": 37.5759, "lng": 126.9768 } }

// 예시 3: 좌향 보정
{ "address": "서울특별시 종로구 사직로 161", "bearingCorrection": 180 }
```

**응답 200** — `AnalysisResult`

```jsonc
{
  "module": "geo",
  "totalScore": 78,
  "items": [
    {
      "key": "mountain",              // mountain | water | road | facilities | green
      "label": "배산 (뒤쪽 고지대·산림)",
      "grade": "good",                // good | normal | caution | unknown
      "score": 85,                    // 0~100
      "observation": "뒷방향(북) 102m 이내에 산림 또는 고도 상승이 관찰됩니다.",
      "interpretation": "전통 풍수에서는 ... 참고 정보입니다."
    }
    // ... water, road, facilities, green
  ],
  "suggestions": ["도로 형상 항목이 주의 단계입니다. ..."],
  "address": "지도에서 지정한 위치 (37.5759, 126.9768)",
  "coordinates": { "lat": 37.5759, "lng": 126.9768 },
  "bearing": {
    "estimated": 92.14,
    "correctedByUser": 180,          // 선택 — 사용자 보정값
    "unit": "도 (0=북, 시계방향)"
  },
  "dataGaps": [],                    // "정보 부족" 항목명 배열
  "disclaimer": "본 서비스는 전통문화 데이터의 참고 정보입니다. ...",
  "createdAt": "2026-09-16T10:16:41.656Z"
}
```

---

### `POST /api/photo/analyze` — 사진 기반 지리풍수 분석

**요청** (multipart/form-data)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `photos` | File (반복) | 필수 | 1~5장, 각 10MB 이하, `image/*` |
| `bearingCorrection` | string(number) | 선택 | 사용자가 보정한 좌향 |

**응답 200** — `AnalysisResult`

```jsonc
{
  "module": "photo",
  "totalScore": 62,
  "items": [
    {
      "key": "vision.shape",         // vision.<element>
      "label": "건물 형태",
      "grade": "normal",
      "score": 60,
      "observation": "정방형에 가까운 평면입니다.",
      "interpretation": "전통 풍수에서는 ... 참고 정보입니다."
    }
  ],
  "suggestions": ["건물 형태: ... 실내라면 가구 배치·수납·빛·정리정돈 수준에서 점검해 보세요."],
  "dataGaps": [],
  "disclaimer": "본 서비스는 전통문화 데이터의 참고 정보입니다. ...",
  "createdAt": "2026-09-16T10:20:00.000Z"
}
```

- 사진은 분석 즉시 폐기됩니다 (서버에 저장되지 않음).
- 비전 모델이 "이해할 수 없는 이미지"로 판단하면 `items`에 `vision.uninterpretable` (grade=`unknown`) 항목 하나만 반환합니다.

---

## 2. 에러 응답 형식

모든 에러는 HTTP 상태 코드 + 아래 본문을 반환합니다.

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자에게 보여 줄 한국어 안내 문구"
  }
}
```

## 3. 에러 코드 표

| code | HTTP | 발생 조건 | 클라이언트 대응 |
|---|---|---|---|
| `INVALID_ADDRESS` | 400 | 주소·좌표 둘 다 없음 | 주소 입력 또는 핀 지정 유도 |
| `NO_PHOTO` | 400 | 사진 0장 | 사진 업로드 유도 |
| `TOO_MANY_PHOTOS` | 400 | 5장 초과 | 개수 제한 안내 |
| `PHOTO_TOO_LARGE` | 400 | 10MB 초과 | 용량 제한 안내 |
| `ADDRESS_NOT_FOUND` | 404 | 주소 지오코딩 실패 | 수동 핀 지정 유도 |
| `ROUTE_NOT_FOUND` | 404 | 알 수 없는 `/api/*` 경로 | — |
| `VISION_NOT_CONFIGURED` | 503 | `GEMINI_API_KEY` 미설정 | 사진 분석 비활성화 안내 |
| `VISION_FAILED` | 502 | 비전 모델 호출 실패 | 사진 재업로드 유도 |
| `INTERNAL_ERROR` | 500 | 처리 중 예외 | 재시도 유도 |

> 일부 외부 API(Overpass/DEM)가 실패해도 **전체 요청은 실패하지 않습니다**. 해당 항목은 `grade: "unknown"` + `dataGaps`에 이름이 추가됩니다.

---

## 4. 연동 시 변경 지점

코드에서 `// [INTEGRATE]` 주석이 표시된 지점:

| 파일 | 위치 | 내용 |
|---|---|---|
| `server/apiPlugin.ts` | 파일 상단 | Vite 플러그인 → Cloudflare Worker 핸들러로 이전 (로직은 그대로) |
| `src/api/client.ts` | `BASE_URL` | 배포 도메인으로 변경 (또는 동일 origin 유지) |
| `src/lib/storage.ts` | `resultStorage` | localStorage → 서버 저장 API로 교체 |
| `src/lib/vision.ts` | 파일 상단 | Worker로 로직 이전 (클라이언트는 multipart만) |
| `src/components/MapView.tsx` | 파일 상단 | Leaflet+OSM → Kakao Maps JS SDK 교체 (도메인 제한 키 필요) |

**응답 스키마 단일 소스**: `src/types/shared.ts`의 `AnalysisResult`를 백엔드와 프론트가 공유합니다. 스키마 변경 시 이 파일만 수정하면 양쪽에 반영됩니다.

---

## 5. 검증 결과 (Definition of Done)

- [x] 두 모듈 모두 실제 데이터로 동작 — 테스트 좌표 3곳으로 확인
  - 서울 종로구 경복궁 일대 (37.5759, 126.9768): 총점 78 — 철도 47m 근접 정확 감지
  - 부산 해운대 인근 (35.1796, 129.0756): 총점 71 — 해안 임수(수계 500m 이내) 정상 감지
  - 대전 도심 (36.3504, 127.3845): 총점 55 — 내륙 도심이라 배산·임수가 주의 단계로 산출되는지 확인
  - (참고) 제주 (33.5563, 126.7803): Overpass 서버 504 장애 상황에서 전체 실패 없이 항목이 "정보 부족"으로 무정지 저하되는지 확인
- [x] 설정 파일 조정으로 판정 변경 확인 — `railwayMaxDistanceM` 200→20 시 도로 등급 caution(35)→good(85), 총점 78→85
- [x] API 계약 문서 완성 (이 문서)
- [x] 빌드 에러 0 (`tsc --noEmit` + `vite build` 통과)
- [x] API 키가 코드에 없음 — `.env`는 `.gitignore`에 포함, 모든 키는 `process.env`에서만 읽음
- [x] 사진 분석(모듈 B)은 `GEMINI_API_KEY` 설정 전까지 503 `VISION_NOT_CONFIGURED`로 안전하게 대기 (키만 넣으면 바로 동작)
