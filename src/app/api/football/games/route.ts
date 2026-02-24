import { NextRequest, NextResponse } from "next/server";
import { getMatchesByDate } from "@/lib/api/football-data";
import { calculateFootballExcitement, detectFootballEasterEggs } from "@/lib/scoring/football";
import { type GameSummary } from "@/lib/scoring/types";

function mapStatus(status: string): "finished" | "in_progress" | "scheduled" {
  if (status === "FINISHED") return "finished";
  if (status === "SCHEDULED") return "scheduled";
  return "in_progress";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date =
    searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const matches = await getMatchesByDate(date);

    const games: GameSummary[] = matches
      .map((match) => {
        const status = mapStatus(match.status);
        const excitement =
          status === "finished"
            ? calculateFootballExcitement(match)
            : undefined;

        const easterEggs =
          status === "finished"
            ? detectFootballEasterEggs(match)
            : undefined;

        return {
          id: `football-${match.id}`,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          competition: match.competition,
          sport: "football" as const,
          status,
          excitement,
          easterEggs,
          date: match.utcDate,
        };
      })
      .sort(
        (a, b) => (b.excitement?.score ?? -1) - (a.excitement?.score ?? -1)
      );

    return NextResponse.json(
      { games, date },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Football API error:", error);
    return NextResponse.json(
      { games: [], date, error: "Failed to fetch football data" },
      { status: 500 }
    );
  }
}
