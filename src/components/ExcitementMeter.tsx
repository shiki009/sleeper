"use client";

interface ExcitementMeterProps {
  score: number; // 1-10
}

function getStrokeColor(score: number): string {
  if (score >= 8) return "#ef4444";
  if (score >= 6) return "#f59e0b";
  if (score >= 4) return "#94a3b8";
  return "#cbd5e1";
}

function getTextColorClass(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 6) return "text-amber-500";
  if (score >= 4) return "text-slate-400";
  return "text-slate-300";
}

export function ExcitementMeter({ score }: ExcitementMeterProps) {
  const radius = 28;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const dashOffset = circumference - progress;
  const isHigh = score >= 8;

  return (
    <div className={`relative w-[80px] h-[80px] ${isHigh ? "glow-pulse" : ""}`}>
      <svg viewBox="0 0 66 66" className="w-full h-full -rotate-90">
        {/* Subtle fill circle behind track */}
        <circle
          cx="33"
          cy="33"
          r={radius}
          fill="currentColor"
          className="text-muted/30"
        />
        <circle
          cx="33"
          cy="33"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/50"
        />
        <circle
          cx="33"
          cy="33"
          r={radius}
          fill="none"
          stroke={getStrokeColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transitionDuration: '900ms' }}
          className="transition-all ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold tabular-nums leading-none ${getTextColorClass(score)}`}>
          {score.toFixed(1)}
        </span>
        <span className="text-[9px] text-muted-foreground mt-0.5">/ 10</span>
      </div>
    </div>
  );
}
