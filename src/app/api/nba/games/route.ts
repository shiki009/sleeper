import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate } from "@/lib/api/nba";
import { getNbaStandings } from "@/lib/api/standings";
import { calculateNbaExcitement, detectNbaEasterEggs, predictNbaExcitement } from "@/lib/scoring/nba";
import { type GameSummary } from "@/lib/scoring/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date =
    searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const [allGames, standings] = await Promise.all([
      getGamesByDate(date),
      getNbaStandings(),
    ]);

    const games: GameSummary[] = allGames.map((game) => {
      const isFinished = game.status === "STATUS_FINAL";
      const homeRank = standings.get(game.homeTeam.name);
      const awayRank = standings.get(game.awayTeam.name);

      let excitement;
      let easterEggs;
      let predictedScore: number | undefined;

      if (isFinished) {
        excitement = calculateNbaExcitement(game, homeRank, awayRank);
        easterEggs = detectNbaEasterEggs(game);

        if (game.odds) {
          const prediction = predictNbaExcitement({
            odds: game.odds,
            homeRank,
            awayRank,
          });
          predictedScore = prediction.score;
        }
      } else if (game.status === "STATUS_SCHEDULED" && game.odds) {
        excitement = predictNbaExcitement({
          odds: game.odds,
          homeRank,
          awayRank,
        });
      }

      const status = isFinished
        ? ("finished" as const)
        : game.status === "STATUS_SCHEDULED"
          ? ("scheduled" as const)
          : ("in_progress" as const);

      return {
        id: `nba-${game.id}`,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        competition: "NBA",
        sport: "nba" as const,
        status,
        clock: status === "in_progress" ? game.clock : undefined,
        excitement,
        easterEggs,
        predictedScore,
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
    console.error("NBA API error:", error);
    return NextResponse.json(
      { games: [], date, error: "Failed to fetch NBA data" },
      { status: 500 }
    );
  }
}
