import { NextRequest, NextResponse } from "next/server";
import { getEventsByDate } from "@/lib/api/f1";
import { getF1Standings } from "@/lib/api/standings";
import {
  calculateF1Excitement,
  detectF1EasterEggs,
  predictF1Excitement,
} from "@/lib/scoring/f1";
import { type GameSummary } from "@/lib/scoring/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date =
    searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const [events, standings] = await Promise.all([
      getEventsByDate(date),
      getF1Standings(),
    ]);

    const games: GameSummary[] = events.map((event) => {
      const isFinished = event.status === "STATUS_FINAL";
      const isScheduled = event.status === "STATUS_SCHEDULED";

      let excitement;
      let easterEggs;

      if (isFinished && event.raceResults.length >= 2) {
        excitement = calculateF1Excitement(event, standings);
        easterEggs = detectF1EasterEggs(event);
      } else if (isScheduled || !isFinished) {
        excitement = predictF1Excitement({
          qualifyingResults: event.qualifyingResults,
          standings,
        });
      }

      // Only show driver names when the race has actually finished with results
      const hasRaceResults = isFinished && event.raceResults.length >= 2;
      const p1 = hasRaceResults ? event.raceResults[0].name : event.circuit || event.name;
      const p2 = hasRaceResults ? event.raceResults[1].name : "Race Weekend";

      const status = isFinished
        ? ("finished" as const)
        : isScheduled
          ? ("scheduled" as const)
          : ("in_progress" as const);

      return {
        id: `f1-${event.id}`,
        homeTeam: p1,
        awayTeam: p2,
        competition: event.name,
        sport: "f1" as const,
        status,
        excitement,
        easterEggs,
        date: event.endDate,
      };
    });

    games.sort(
      (a, b) => (b.excitement?.score ?? -1) - (a.excitement?.score ?? -1)
    );

    const allFinished =
      games.length > 0 && games.every((g) => g.status === "finished");
    const maxAge = allFinished ? 3600 : 60;

    return NextResponse.json(
      { games, date },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=60`,
        },
      }
    );
  } catch (error) {
    console.error("F1 API error:", error);
    return NextResponse.json(
      { games: [], date, error: "Failed to fetch F1 data" },
      { status: 500 }
    );
  }
}
