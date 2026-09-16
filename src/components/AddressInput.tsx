import { useState } from "react";
import type { Coordinates } from "../types/shared";
import { MapView } from "./MapView";

interface AddressInputProps {
  onAnalyze: (req: { address?: string; coordinates?: Coordinates }) => void;
  loading: boolean;
  initialCenter?: Coordinates;
}

const DEFAULT_CENTER: Coordinates = { lat: 37.5665, lng: 126.978 }; // 서울시청

export function AddressInput({ onAnalyze, loading, initialCenter }: AddressInputProps) {
  const [address, setAddress] = useState("");
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState<Coordinates | null>(initialCenter ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinMode) {
      if (!pin) return;
      onAnalyze({ coordinates: pin });
    } else {
      if (!address.trim()) return;
      onAnalyze({ address: address.trim() });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-ink-700">
          주소 입력
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={pinMode}
          placeholder="예) 서울특별시 종로구 사직로 161"
          className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-ink-500/60 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-300/40 disabled:bg-cream-100"
          inputMode="text"
          autoComplete="street-address"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPinMode((v) => !v)}
          className="text-sm font-medium text-accent-600 underline-offset-4 hover:underline"
          aria-pressed={pinMode}
        >
          {pinMode ? "주소 입력으로 돌아가기" : "주소를 모르면 지도에서 직접 고르기"}
        </button>
      </div>

      {pinMode && (
        <div className="space-y-2">
          <p className="text-sm text-ink-500">
            지도를 탭하거나 핀을 움직여 위치를 지정해 주세요.
          </p>
          <MapView
            center={pin ?? DEFAULT_CENTER}
            draggable
            onPick={(c) => setPin(c)}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (pinMode ? !pin : !address.trim())}
        className="w-full rounded-xl bg-accent-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "분석 중..." : "공간 풍수 분석하기"}
      </button>
    </form>
  );
}
