import type { AnalysisItem, Grade } from "../types/shared";

const GRADE_STYLES: Record<Grade, { color: string; bg: string; text: string }> = {
  good: { color: "text-good", bg: "bg-good/10", text: "양호" },
  normal: { color: "text-normal", bg: "bg-normal/10", text: "보통" },
  caution: { color: "text-caution", bg: "bg-caution/10", text: "주의" },
  unknown: { color: "text-ink-500", bg: "bg-cream-200", text: "정보 부족" },
};

// 접이식 항목 카드 (Progressive Disclosure)
export function AnalysisItemCard({ item }: { item: AnalysisItem }) {
  const s = GRADE_STYLES[item.grade];
  return (
    <details className="group border-b border-cream-200 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 px-1">
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.color}`}>
          {s.text}
        </span>
        <span className="flex-1 text-sm font-medium text-ink-900">{item.label}</span>
        <span className="text-sm tabular-nums text-ink-500">
          {item.grade === "unknown" ? "—" : Math.round(item.score)}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-ink-500 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeWidth="1.6" strokeLinecap="round" d="M5 8l5 5 5-5" />
        </svg>
      </summary>
      <div className="pb-4 pr-6 pl-1 space-y-2">
        <p className="text-sm leading-relaxed text-ink-700">{item.observation}</p>
        {item.interpretation && (
          <p className="text-sm leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">전통 풍수 관점(참고): </span>
            {item.interpretation}
          </p>
        )}
      </div>
    </details>
  );
}
