import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate } from "@/lib/api/nhl";
import { calculateNhlExcitement, detectNhlEasterEggs } from "@/lib/scoring/nhl";
import { type GameSummary } from "@/lib/scoring/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date =
    searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const allGames = await getGamesByDate(date);

    const games: GameSummary[] = allGames.map((game) => {
      const isFinished = game.status === "STATUS_FINAL";
      const excitement = isFinished ? calculateNhlExcitement(game) : undefined;

      const easterEggs = isFinished ? detectNhlEasterEggs(game) : undefined;

      return {
        id: `nhl-${game.id}`,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        competition: "NHL",
        sport: "nhl" as const,
        status: isFinished
          ? ("finished" as const)
          : game.status === "STATUS_SCHEDULED"
            ? ("scheduled" as const)
            : ("in_progress" as const),
        excitement,
        easterEggs,
        date: game.date,
      };
    });

    games.sort(
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
    console.error("NHL API error:", error);
    return NextResponse.json(
      { games: [], date, error: "Failed to fetch NHL data" },
      { status: 500 }
    );
  }
}
