"use client";

interface ExcitementMeterProps {
  score: number; // 1-10
  predicted?: boolean;
}

function getStrokeColor(score: number, predicted?: boolean): string {
  if (predicted) {
    if (score >= 8) return "#818cf8"; // indigo-400
    if (score >= 6) return "#a78bfa"; // violet-400
    if (score >= 4) return "#94a3b8"; // slate-400
    return "#cbd5e1"; // slate-300
  }
  if (score >= 8) return "#ef4444";
  if (score >= 6) return "#f59e0b";
  if (score >= 4) return "#94a3b8";
  return "#cbd5e1";
}

function getTextColorClass(score: number, predicted?: boolean): string {
  if (predicted) {
    if (score >= 8) return "text-indigo-400";
    if (score >= 6) return "text-violet-400";
    if (score >= 4) return "text-slate-400";
    return "text-slate-300";
  }
  if (score >= 8) return "text-red-500";
  if (score >= 6) return "text-amber-500";
  if (score >= 4) return "text-slate-400";
  return "text-slate-300";
}

export function ExcitementMeter({ score, predicted }: ExcitementMeterProps) {
  const radius = 28;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const dashOffset = circumference - progress;
  const isHigh = score >= 8 && !predicted;

  // Dashed pattern for predicted scores
  const trackDasharray = predicted ? "4 3" : undefined;
  const progressDasharray = predicted
    ? `${progress} ${circumference}`
    : `${circumference}`;
  const progressDashoffset = predicted ? 0 : dashOffset;

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
        {/* Track circle -- dashed when predicted */}
        <circle
          cx="33"
          cy="33"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={trackDasharray}
          className="text-muted/50"
        />
        {/* Progress arc */}
        <circle
          cx="33"
          cy="33"
          r={radius}
          fill="none"
          stroke={getStrokeColor(score, predicted)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={progressDasharray}
          strokeDashoffset={progressDashoffset}
          style={{ transitionDuration: '900ms' }}
          className="transition-all ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold tabular-nums leading-none ${getTextColorClass(score, predicted)}`}>
          {score.toFixed(1)}
        </span>
        <span className="text-[9px] text-muted-foreground mt-0.5">/ 10</span>
      </div>
    </div>
  );
}
