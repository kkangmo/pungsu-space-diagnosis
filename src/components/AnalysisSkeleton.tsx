// 로딩 중 "풍수 관찰 중..." 스켈레톤
export function AnalysisSkeleton({ message = "풍수 관찰 중..." }: { message?: string }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="skeleton h-5 w-5 rounded-full" />
        <p className="text-sm font-medium text-ink-700">{message}</p>
      </div>
      <div className="skeleton h-32 w-full rounded-xl" />
      <div className="space-y-2">
        <div className="skeleton h-12 w-full rounded-lg" />
        <div className="skeleton h-12 w-full rounded-lg" />
        <div className="skeleton h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
