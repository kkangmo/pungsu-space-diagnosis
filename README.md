# 내 공간 풍수 진단 (풍수메이트 스탠드얼론 모듈)

한국 전통 풍수(形局) 원리를 GIS·공간데이터·이미지 분석으로 재해석하는 웹 모듈.

**프레임**: 전통문화 데이터의 IT 재해석. 운명 판정 톤이 아닌 "환경 관찰 지표 + 전통 상징·문화 참고 정보"로만 표현합니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

API 키 없이도 실행됩니다 (Nominatim 지오코딩 + OpenStreetMap 타일 + Overpass + OpenTopoData 모두 무료/키 불필요).

### API 키 (선택, 정확도 향상)

`.env.example`을 복사해 `.env` 작성:

```bash
cp .env.example .env
```

| 변수 | 효과 |
|---|---|
| `KAKAO_REST_KEY` | 한국 주소 지오코딩 정확도 대폭 향상 (없으면 Nominatim 폴백) |
| `GEMINI_API_KEY` | 사진 기반 분석 활성화 (없으면 안내 문구로 대체) |

> 모든 키는 서버 측(`process.env`)에서만 읽습니다. 클라이언트 번들에 노출되지 않습니다.

## 기능

- **모듈 A (위치 분석)**: 주소/핀 → 지오코딩 → 지도 → 배산·임수·도로·주변시설·녹지 판정 → 3단계 평가 + 100점 지표 + 실천 제안
- **모듈 B (사진 분석)**: 사진 업로드 → 비전 AI(Gemini) 검출 → 규칙 엔진 채점 → 관찰(사실)/해석(참고) 2층 분리
- **통합 대시보드**: A·B 결과 카드 + 통합 지표 + localStorage 저장

## 구조

```
src/
  components/        # UI (입력·지도·결과 카드·스켈레톤)
  lib/               # 도메인 로직 (지오코딩/Overpass/고도/채점/비전)
  config/rules.json  # 모든 임계값·가중치 — 이 파일만 수정하면 판정이 바뀜
  types/shared.ts    # 응답 스키마 단일 소스 (프론트·밝엔드 공유)
  api/client.ts      # API 클라이언트
server/apiPlugin.ts  # 서버 측 API 라우트 (키 보관소)
docs/
  design.md          # 설계서 (아키텍처·데이터 흐름·설정 스키마)
  api-contract.md    # API 계약 + 에러 코드표
```

## 도메인 조정

판정 기준은 `src/config/rules.json`에 있습니다. 거리 임계값·가중치·문구를 코드 수정 없이 조정할 수 있습니다.

## 표현 톤 규칙

- 효능 단정·결과 예언 금지 ("재물운이 들어온다" 등)
- "환경 관찰 지표" + "전통 풍수에서는 OO로 여기곤 합니다(참고)"
- 모든 결과 화면에 고지 박스 포함

## 빌드

```bash
npm run build      # 타입체크 + 프로덕션 빌드
npm run typecheck  # 타입체크만
```

## saju-app 연동

`docs/api-contract.md`와 코드 내 `// [INTEGRATE]` 주석을 참고하세요.
