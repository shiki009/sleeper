export interface ExcitementResult {
  score: number; // 1-10
  label: string;
  predicted?: boolean; // true when score is a pre-game prediction
}

export interface EasterEgg {
  id: string;
  emoji: string;
  label: string;
  tooltip?: string;
}

export interface GameSummary {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  sport: "football" | "nba" | "nhl";
  status: "finished" | "in_progress" | "scheduled";
  clock?: string;
  excitement?: ExcitementResult;
  easterEggs?: EasterEgg[];
  date: string; // ISO date string
}

export function getLabel(score: number): string {
  if (score >= 8) return "Must Watch";
  if (score >= 6) return "Good Watch";
  if (score >= 4) return "Fair Game";
  return "Skip It";
}

export function clampScore(score: number): number {
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}
