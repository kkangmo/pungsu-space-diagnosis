import { useState } from "react";
import type { AnalysisResult, Coordinates } from "./types/shared";
import { apiClient, ApiClientError } from "./api/client";
import { resultStorage } from "./lib/storage";
import { AddressInput } from "./components/AddressInput";
import { PhotoUpload } from "./components/PhotoUpload";
import { AnalysisSkeleton } from "./components/AnalysisSkeleton";
import { ResultDashboard } from "./components/ResultDashboard";

type Tab = "address" | "photo" | "both";

const TABS: { id: Tab; label: string }[] = [
  { id: "address", label: "주소 입력" },
  { id: "photo", label: "사진 업로드" },
  { id: "both", label: "둘 다" },
];

function isVisionDisabled(code: string): boolean {
  return code === "VISION_NOT_CONFIGURED";
}

function toMessage(e: unknown): string {
  if (e instanceof ApiClientError || e instanceof Error) return e.message;
  return "분석 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("address");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("풍수 관찰 중...");
  const [error, setError] = useState<string | null>(null);
  const [geoResult, setGeoResult] = useState<AnalysisResult | null>(null);
  const [photoResult, setPhotoResult] = useState<AnalysisResult | null>(null);
  const [saved, setSaved] = useState(false);

  const needsAddress = tab === "address" || tab === "both";
  const needsPhoto = tab === "photo" || tab === "both";

  const handleAnalyzeAddress = async (req: {
    address?: string;
    coordinates?: Coordinates;
  }) => {
    setError(null);
    setSaved(false);
    setLoading(true);
    setLoadingMessage("주변 공간 데이터를 관찰하고 있어요...");
    try {
      setGeoResult(null);
      const result = await apiClient.analyzeGeo(req);
      setGeoResult(result);
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePhotos = async (photos: File[]) => {
    setError(null);
    setSaved(false);
    setLoading(true);
    setLoadingMessage("사진에서 환경 단서를 찾고 있어요...");
    try {
      setPhotoResult(null);
      const result = await apiClient.analyzePhotos(photos);
      setPhotoResult(result);
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (geoResult) resultStorage.save(geoResult);
    if (photoResult) resultStorage.save(photoResult);
    setSaved(true);
  };

  const handleReset = () => {
    setGeoResult(null);
    setPhotoResult(null);
    setError(null);
    setSaved(false);
  };

  const hasAnyResult = geoResult !== null || photoResult !== null;

  return (
    <div className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="mb-6 space-y-1.5">
        <h1 className="text-xl font-bold text-ink-900">내 공간 풍수 진단</h1>
        <p className="text-sm leading-relaxed text-ink-500">
          주소나 사진으로 주변 환경을 관찰하고, 전통 풍수 관점의 참고 정보를
          받아보세요.
        </p>
      </header>

      {!hasAnyResult && (
        <>
          <div className="mb-5 flex gap-1 rounded-xl bg-cream-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors aria-selected:bg-white aria-selected:text-ink-900 aria-selected:shadow-sm text-ink-500"
                aria-selected={tab === t.id}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div
              className="mb-4 rounded-xl bg-caution/10 px-4 py-3 text-sm leading-relaxed text-caution"
              role="alert"
            >
              {error}
            </div>
          )}

          {loading && <AnalysisSkeleton message={loadingMessage} />}

          {!loading && needsAddress && (
            <section className="space-y-3 rounded-2xl border border-cream-200 bg-white p-5">
              <h2 className="text-base font-bold text-ink-900">위치 분석</h2>
              <AddressInput onAnalyze={handleAnalyzeAddress} loading={loading} />
            </section>
          )}

          {!loading && needsPhoto && (
            <section className="space-y-3 rounded-2xl border border-cream-200 bg-white p-5">
              <h2 className="text-base font-bold text-ink-900">사진 분석</h2>
              <PhotoUpload onAnalyze={handleAnalyzePhotos} loading={loading} />
              {error && isVisionDisabled(error) && (
                <p className="text-xs leading-relaxed text-ink-500">
                  사진 분석은 현재 서버에 API 키가 설정되어 있지 않아 비활성화됩니다.
                  .env의 GEMINI_API_KEY를 확인해 주세요.
                </p>
              )}
            </section>
          )}
        </>
      )}

      {hasAnyResult && (
        <ResultDashboard
          geoResult={geoResult}
          photoResult={photoResult}
          onReset={handleReset}
          onSave={handleSave}
          saved={saved}
        />
      )}
    </div>
  );
}
