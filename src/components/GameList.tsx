"use client";

import { useEffect, useState } from "react";
import { GameCard } from "./GameCard";
import { type GameSummary } from "@/lib/scoring/types";

interface GameListProps {
  sport: "football" | "nba" | "nhl" | "all";
  date: string;
}

const clientCache = new Map<string, { games: GameSummary[]; ts: number }>();
const CLIENT_CACHE_TTL = 60_000; // 60 seconds

// Get the local date string (YYYY-MM-DD) for a UTC datetime
function getLocalDate(utcDateStr: string): string {
  try {
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

// Get previous day as YYYY-MM-DD
function getPrevDay(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// Sort scheduled games: those with predictions first (by score desc), then those without
function sortScheduledGames(games: GameSummary[]): GameSummary[] {
  return [...games].sort((a, b) => {
    const aScore = a.excitement?.predicted ? a.excitement.score : -1;
    const bScore = b.excitement?.predicted ? b.excitement.score : -1;
    return bScore - aScore;
  });
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <h2 className="section-label text-muted-foreground/70">
        {children}
      </h2>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border to-transparent" />
    </div>
  );
}

function SkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <div
      className="rounded-2xl border border-border/60 bg-card p-5 space-y-3"
      style={{
        opacity: 0,
        animation: `fadeIn 0.4s ease-out ${index * 100}ms forwards`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-32 rounded skeleton-shimmer" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full skeleton-shimmer" />
            <div className="h-3.5 w-28 rounded skeleton-shimmer" />
          </div>
          <div className="h-2 w-6 rounded skeleton-shimmer ml-8" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full skeleton-shimmer" />
            <div className="h-3.5 w-24 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-[80px] h-[80px] rounded-full border-4 border-muted" />
          <div className="h-5 w-20 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

function SleepingScoreboard() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="float-animation"
    >
      {/* Scoreboard body */}
      <rect x="20" y="30" width="80" height="60" rx="12" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
      {/* Screen */}
      <rect x="30" y="40" width="60" height="35" rx="6" fill="hsl(var(--card))" />
      {/* Closed eyes - left */}
      <path d="M42 55 Q47 60 52 55" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Closed eyes - right */}
      <path d="M62 55 Q67 60 72 55" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Mouth */}
      <path d="M52 65 Q57 68 62 65" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
      {/* Zzz */}
      <text x="82" y="28" fontSize="14" fontWeight="bold" fill="hsl(var(--primary))">z</text>
      <text x="90" y="20" fontSize="11" fontWeight="bold" fill="hsl(var(--primary))" opacity="0.7">z</text>
      <text x="96" y="14" fontSize="8" fontWeight="bold" fill="hsl(var(--primary))" opacity="0.4">z</text>
      {/* Stand */}
      <rect x="50" y="90" width="20" height="4" rx="2" fill="hsl(var(--border))" />
      <rect x="55" y="94" width="10" height="8" rx="2" fill="hsl(var(--border))" />
      <rect x="45" y="102" width="30" height="4" rx="2" fill="hsl(var(--border))" />
    </svg>
  );
}

export function GameList({ sport, date }: GameListProps) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [liveGames, setLiveGames] = useState<GameSummary[]>([]);
  const [scheduledGames, setScheduledGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cacheKey = `${sport}:${date}`;
    const cached = clientCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CLIENT_CACHE_TTL) {
      // Use cached data immediately -- no loading skeleton
      const forDate = cached.games;
      const finished = forDate
        .filter((g) => g.status === "finished" && g.excitement)
        .sort((a, b) => (b.excitement?.score ?? 0) - (a.excitement?.score ?? 0));
      const live = forDate.filter((g) => g.status === "in_progress");
      const scheduled = sortScheduledGames(
        forDate.filter((g) => g.status === "scheduled")
      );
      setGames(finished);
      setLiveGames(live);
      setScheduledGames(scheduled);
      setLoading(false);
      setError(forDate.length === 0 ? "No games found for this date." : null);
      return;
    }

    setLoading(true);
    setError(null);

    async function fetchGames() {
      const sports =
        sport === "all" ? ["football", "nba", "nhl"] : [sport];

      // Fetch both the selected date AND the previous day (ESPN date),
      // then filter to games whose local start time falls on the selected date.
      const prevDay = getPrevDay(date);
      const datesToFetch = [date, prevDay];

      const results = await Promise.allSettled(
        sports.flatMap((s) =>
          datesToFetch.map(async (d) => {
            const res = await fetch(`/api/${s}/games?date=${d}`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.games || []) as GameSummary[];
          })
        )
      );

      if (cancelled) return;

      const allGames = results.flatMap((r) =>
        r.status === "fulfilled" ? r.value : []
      );

      // Deduplicate by game id
      const seen = new Set<string>();
      const unique = allGames.filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });

      // Filter to games whose start time falls on the selected local date
      const forDate = unique.filter((g) => {
        if (!g.date) return true; // keep if no date info
        const localDate = getLocalDate(g.date);
        return localDate === date;
      });

      // Store in client cache
      clientCache.set(cacheKey, { games: forDate, ts: Date.now() });

      const finished = forDate
        .filter((g) => g.status === "finished" && g.excitement)
        .sort((a, b) => (b.excitement?.score ?? 0) - (a.excitement?.score ?? 0));

      const live = forDate.filter((g) => g.status === "in_progress");
      const scheduled = sortScheduledGames(
        forDate.filter((g) => g.status === "scheduled")
      );

      setGames(finished);
      setLiveGames(live);
      setScheduledGames(scheduled);
      setLoading(false);

      if (forDate.length === 0) {
        setError("No games found for this date.");
      }
    }

    fetchGames().catch(() => {
      if (!cancelled) {
        setError("Failed to load games. Please try again.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sport, date]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </div>
    );
  }

  if (error && games.length === 0 && liveGames.length === 0 && scheduledGames.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 text-muted-foreground"
        style={{ opacity: 0, animation: "fadeInUp 0.6s ease-out forwards" }}
      >
        <SleepingScoreboard />
        <p className="text-lg font-medium mt-6">Nothing to watch here</p>
        <p className="text-sm mt-1.5 text-center max-w-xs">
          No games found for this date. Try another day or switch sports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {liveGames.length > 0 && (
        <div className="space-y-4">
          <SectionHeader>Live Now</SectionHeader>
          {liveGames.map((game, i) => (
            <div
              key={game.id}
              className="card-entrance"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <GameCard game={game} />
            </div>
          ))}
        </div>
      )}

      {games.length > 0 && (
        <div className="space-y-4">
          {(liveGames.length > 0 || scheduledGames.length > 0) && (
            <SectionHeader>Finished</SectionHeader>
          )}
          {games.map((game, i) => {
            const delay = i * 80;
            return (
              <div
                key={game.id}
                className="card-entrance"
                style={{ animationDelay: `${delay}ms` }}
              >
                <GameCard game={game} />
              </div>
            );
          })}
        </div>
      )}

      {scheduledGames.length > 0 && (
        <div className="space-y-4">
          <SectionHeader>Upcoming</SectionHeader>
          {scheduledGames.map((game, i) => {
            const delay = i * 80;
            return (
              <div
                key={game.id}
                className="card-entrance"
                style={{ animationDelay: `${delay}ms` }}
              >
                <GameCard game={game} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
