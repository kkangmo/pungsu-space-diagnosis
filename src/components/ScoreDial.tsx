import type { Bearing } from "../types/shared";

interface ScoreDialProps {
  score: number;
  label?: string;
  size?: number;
}

// 종합 지표 + 방위 다이얼 (SVG)
export function ScoreDial({ score, label = "종합 환경 지표", size = 132 }: ScoreDialProps) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  const color = clamped >= 70 ? "#5C7F5F" : clamped >= 45 ? "#B08A4A" : "#A8574A";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label} ${Math.round(clamped)}점`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EBE2D5"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink-900"
          style={{ fontSize: size * 0.26, fontWeight: 700 }}
        >
          {Math.round(clamped)}
        </text>
      </svg>
      <span className="text-sm text-ink-500">{label}</span>
    </div>
  );
}

// 방위 나침반 (0=북, 시계방향)
export function BearingDial({ bearing }: { bearing: Bearing }) {
  const deg = bearing.correctedByUser ?? bearing.estimated;
  const label = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  const isCorrected = bearing.correctedByUser !== undefined;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16 rounded-full border-2 border-cream-200 bg-cream-50">
        {label.map((l, i) => (
          <span
            key={l}
            className="absolute text-[9px] text-ink-500"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${i * 45}deg) translateY(-22px) rotate(${-i * 45}deg)`,
            }}
          >
            {l}
          </span>
        ))}
        <div
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{ transform: `translate(-50%, -100%) rotate(${deg}deg)`, height: "50%" }}
        >
          <div className="w-0.5 h-full bg-accent-600 mx-auto" />
        </div>
        <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-600" />
      </div>
      <div className="text-sm">
        <div className="font-semibold text-ink-900">좌향(坐向) 추정: {label[idx]}쪽</div>
        <div className="text-ink-500 text-xs">
          {Math.round(deg)}도 · 추정값{isCorrected ? " (사용자 보정 적용)" : ""}
        </div>
      </div>
    </div>
  );
}
