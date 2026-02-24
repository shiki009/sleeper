"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Flame } from "lucide-react";
import { ExcitementMeter } from "./ExcitementMeter";
import { type GameSummary } from "@/lib/scoring/types";
import { getTeamLogo } from "@/lib/logos";

function getBadgeVariant(label: string) {
  switch (label) {
    case "Must Watch":
      return "destructive" as const;
    case "Good Watch":
      return "default" as const;
    case "Fair Game":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function getSportLabel(sport: string): string {
  switch (sport) {
    case "football":
      return "Football";
    case "nba":
      return "NBA";
    case "nhl":
      return "NHL";
    default:
      return "";
  }
}

function formatGameTime(dateStr: string): string | null {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return null;
  }
}

function isMustWatch(score?: number): boolean {
  return !!score && score >= 8;
}

interface GameCardProps {
  game: GameSummary;
}

export function GameCard({ game }: GameCardProps) {
  const [revealed, setRevealed] = useState(false);
  const { excitement } = game;
  const gameTime = formatGameTime(game.date);
  const mustWatch = isMustWatch(excitement?.score);
  const homeLogo = getTeamLogo(game.sport, game.homeTeam);
  const awayLogo = getTeamLogo(game.sport, game.awayTeam);

  return (
    <Card className={`card-hover ${mustWatch ? "must-watch-card" : ""}`}>
      <CardContent className="p-4 sm:p-5">
        {/* Meta bar */}
        <div className="flex items-center gap-1.5 mb-3 sm:mb-4">
          <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {getSportLabel(game.sport)}
          </span>
          <span className="text-muted-foreground/30">&middot;</span>
          <span className="text-xs text-muted-foreground truncate">
            {game.competition}
          </span>
          {gameTime && (
            <>
              <span className="text-muted-foreground/30">&middot;</span>
              <span className="text-xs text-muted-foreground">
                {gameTime}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Teams section */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2.5">
              {homeLogo && (
                <Image
                  src={homeLogo}
                  alt=""
                  width={28}
                  height={28}
                  className="w-7 h-7 object-contain"
                />
              )}
              <span className="font-semibold text-[15px] truncate">
                {game.homeTeam}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {awayLogo && (
                <Image
                  src={awayLogo}
                  alt=""
                  width={28}
                  height={28}
                  className="w-7 h-7 object-contain"
                />
              )}
              <span className="font-semibold text-[15px] truncate">
                {game.awayTeam}
              </span>
            </div>
          </div>

          {/* Excitement score */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            {excitement ? (
              <>
                <ExcitementMeter score={excitement.score} />
                <Badge variant={getBadgeVariant(excitement.label)}>
                  {mustWatch && <Flame className="w-3 h-3 mr-1" />}
                  {excitement.label}
                </Badge>
              </>
            ) : (
              <Badge variant="outline">
                {game.status === "scheduled" ? "Upcoming" : "In Progress"}
              </Badge>
            )}
          </div>
        </div>

        {/* Easter eggs */}
        {game.easterEggs && game.easterEggs.length > 0 && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/30">
            <button
              onClick={() => setRevealed((r) => !r)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{revealed ? "Hide easter eggs" : "Reveal easter eggs"}</span>
            </button>
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                revealed ? "grid-rows-[1fr] opacity-100 mt-1.5" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-wrap gap-1.5">
                  {game.easterEggs.map((egg) => (
                    <span
                      key={egg.id}
                      title={egg.tooltip}
                      className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/80 transition-colors cursor-default"
                    >
                      {egg.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
