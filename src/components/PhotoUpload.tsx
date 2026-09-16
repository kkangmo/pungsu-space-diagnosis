import { useRef, useState } from "react";
import { apiClient } from "../api/client";

interface PhotoUploadProps {
  onAnalyze: (photos: File[]) => void;
  loading: boolean;
}

export function PhotoUpload({ onAnalyze, loading }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxPhotos = apiClient.validation.maxPhotos;
  const maxBytes = apiClient.validation.maxBytes;

  const addFiles = (files: FileList | File[]) => {
    setError(null);
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) {
      setError("이미지 파일만 업로드할 수 있어요.");
      return;
    }

    const merged = [...photos, ...incoming];
    if (merged.length > maxPhotos) {
      setError(`사진은 최대 ${maxPhotos}장까지 업로드할 수 있어요.`);
      return;
    }
    const tooBig = incoming.find((f) => f.size > maxBytes);
    if (tooBig) {
      setError(`"${tooBig.name}" 용량이 너무 큽니다. 10MB 이하로 올려주세요.`);
      return;
    }

    setPhotos(merged);
    setPreviews(merged.map((f) => URL.createObjectURL(f)));
  };

  const removeAt = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    const nextPhotos = photos.filter((_, i) => i !== idx);
    const nextPreviews = previews.filter((_, i) => i !== idx);
    setPhotos(nextPhotos);
    setPreviews(nextPreviews);
  };

  const handleSubmit = () => {
    if (photos.length === 0) return;
    onAnalyze(photos);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-accent-500 bg-accent-300/10"
            : "border-cream-200 bg-cream-50 hover:border-accent-300"
        }`}
      >
        <svg
          className="h-8 w-8 text-accent-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16V4m0 0L8 8m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"
          />
        </svg>
        <p className="text-sm font-medium text-ink-900">
          집 외관·주변 환경 사진을 올려주세요
        </p>
        <p className="text-xs text-ink-500">최대 {maxPhotos}장 · 10MB 이하 · 드래그앤드롭 또는 클릭</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-xs leading-relaxed text-ink-500">
        사진에 타인의 얼굴이나 민감한 정보가 담기지 않도록 주의해 주세요.
        업로드된 사진은 분석 후 저장하지 않고 즉시 폐기됩니다.
      </p>

      {error && (
        <p className="rounded-lg bg-caution/10 px-3 py-2 text-sm text-caution" role="alert">
          {error}
        </p>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-lg">
              <img
                src={src}
                alt={`업로드 미리보기 ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
                className="absolute right-1 top-1 rounded-full bg-ink-900/70 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`${i + 1}번 사진 삭제`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || photos.length === 0}
        className="w-full rounded-xl bg-accent-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "사진 분석 중..." : `${photos.length}장 사진으로 분석하기`}
      </button>
    </div>
  );
}
