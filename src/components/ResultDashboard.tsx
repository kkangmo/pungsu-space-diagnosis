import type { AnalysisResult } from "../types/shared";
import { AnalysisItemCard } from "./AnalysisItemCard";
import { BearingDial, ScoreDial } from "./ScoreDial";
import { DisclaimerBox } from "./DisclaimerBox";
import { MapView } from "./MapView";

interface ResultCardProps {
  result: AnalysisResult;
  title: string;
}

function ResultCard({ result, title }: ResultCardProps) {
  const isGeo = result.module === "geo";
  return (
    <section className="space-y-4 rounded-2xl border border-cream-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-ink-900">{title}</h3>
        <span className="text-xs text-ink-500">
          {new Date(result.createdAt).toLocaleString("ko-KR")}
        </span>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ScoreDial score={result.totalScore} />
        {isGeo && result.address && (
          <p className="text-center text-sm text-ink-700">
            {result.address}
            {result.coordinates && (
              <span className="block text-xs text-ink-500">
                위도 {result.coordinates.lat.toFixed(4)}, 경도{" "}
                {result.coordinates.lng.toFixed(4)}
              </span>
            )}
          </p>
        )}
      </div>

      {isGeo && result.coordinates && (
        <MapView center={result.coordinates} height={200} />
      )}

      {isGeo && result.bearing && <BearingDial bearing={result.bearing} />}
      {isGeo && (
        <p className="text-xs text-ink-500">
          좌향은 지도 데이터로 추정한 값입니다. 실제 현관 방향과 다를 수 있어요.
        </p>
      )}

      {result.dataGaps.length > 0 && (
        <div className="rounded-lg bg-cream-100 px-3 py-2 text-xs text-ink-500">
          일부 항목은 데이터가 부족해 보완이 필요합니다:{" "}
          {result.dataGaps.join(", ")}
        </div>
      )}

      <div className="divide-y divide-cream-200 border-t border-cream-200">
        {result.items.map((item) => (
          <AnalysisItemCard key={item.key} item={item} />
        ))}
      </div>

      {result.suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink-900">오늘 실천 제안</h4>
          <ul className="space-y-2">
            {result.suggestions.map((s, i) => (
              <li
                key={i}
                className="flex gap-2.5 rounded-lg bg-cream-50 px-3 py-2.5 text-sm leading-relaxed text-ink-700"
              >
                <span className="shrink-0 font-semibold text-accent-600">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DisclaimerBox text={result.disclaimer} />
    </section>
  );
}

interface ResultDashboardProps {
  geoResult: AnalysisResult | null;
  photoResult: AnalysisResult | null;
  onReset: () => void;
  onSave: () => void;
  saved: boolean;
}

export function ResultDashboard({
  geoResult,
  photoResult,
  onReset,
  onSave,
  saved,
}: ResultDashboardProps) {
  const results = [geoResult, photoResult].filter(
    (r): r is AnalysisResult => r !== null,
  );

  if (results.length === 0) return null;

  const avg =
    results.reduce((a, r) => a + r.totalScore, 0) / results.length;

  return (
    <div className="space-y-5">
      <section className="flex flex-col items-center gap-2 rounded-2xl border border-cream-200 bg-cream-50 p-5">
        <ScoreDial score={avg} label="통합 환경 지표" size={120} />
        <p className="text-center text-sm text-ink-700">
          {geoResult && photoResult
            ? "주소 분석과 사진 분석 결과를 함께 반영했어요."
            : geoResult
              ? "주소 기반 위치 분석 결과예요. 사진 분석을 더하면 더 풍부한 관찰을 받을 수 있어요."
              : "사진 기반 분석 결과예요. 주소 분석을 더하면 더 풍부한 관찰을 받을 수 있어요."}
        </p>
      </section>

      {geoResult && <ResultCard result={geoResult} title="위치 기반 공간 분석" />}
      {photoResult && <ResultCard result={photoResult} title="사진 기반 공간 분석" />}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saved}
          className="flex-1 rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-cream-100 disabled:opacity-50"
        >
          {saved ? "저장했어요" : "결과 저장하기"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-500"
        >
          다시 분석하기
        </button>
      </div>
      <p className="text-center text-xs text-ink-500">
        저장하지 않고 종료하려면 그냥 페이지를 닫으셔도 좋아요.
      </p>
    </div>
  );
}
