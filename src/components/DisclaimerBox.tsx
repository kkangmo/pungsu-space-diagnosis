export function DisclaimerBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-cream-200 bg-cream-100 p-4">
      <div className="flex gap-2.5">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-ink-500"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8" strokeWidth="1.5" />
          <path strokeWidth="1.5" strokeLinecap="round" d="M10 9v5M10 6h.01" />
        </svg>
        <p className="text-xs leading-relaxed text-ink-700">{text}</p>
      </div>
    </div>
  );
}
