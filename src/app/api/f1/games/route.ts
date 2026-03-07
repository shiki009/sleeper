import { NextRequest, NextResponse } from "next/server";
import { getEventsByDate } from "@/lib/api/f1";
import { getF1Standings } from "@/lib/api/standings";
import {
  calculateQualifyingExcitement,
  detectQualifyingEasterEggs,
  calculateRaceExcitement,
  detectRaceEasterEggs,
  predictRaceExcitement,
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

    const games: GameSummary[] = [];

    for (const event of events) {
      // ── Qualifying card ──
      // Show on the qualifying day with its own excitement score
      if (event.qualifying) {
        const qualFinished = event.qualifying.finished;

        let excitement;
        let easterEggs;

        if (qualFinished && event.qualifying.results.length > 0) {
          excitement = calculateQualifyingExcitement(
            event.qualifying.results,
            standings
          );
          easterEggs = detectQualifyingEasterEggs(event.qualifying.results);
        }

        const status = qualFinished
          ? ("finished" as const)
          : ("scheduled" as const);

        games.push({
          id: `f1-qual-${event.id}`,
          homeTeam: event.name,
          awayTeam: "Qualifying",
          competition: "Formula 1",
          sport: "f1" as const,
          status,
          excitement,
          easterEggs,
          date: event.qualifying.date,
        });
      }

      // ── Race card ──
      // Show on race day with actual score (finished) or prediction (upcoming)
      const raceFinished = event.race.finished;
      const hasRaceResults = raceFinished && event.race.results.length >= 2;

      let excitement;
      let easterEggs;

      if (hasRaceResults) {
        excitement = calculateRaceExcitement(event, standings);
        easterEggs = detectRaceEasterEggs(event);
      } else {
        // Predict based on qualifying results + standings
        excitement = predictRaceExcitement({
          qualifyingResults: event.qualifying?.results,
          standings,
        });
      }

      const status = raceFinished
        ? ("finished" as const)
        : event.race.status === "STATUS_SCHEDULED"
          ? ("scheduled" as const)
          : ("in_progress" as const);

      games.push({
        id: `f1-race-${event.id}`,
        homeTeam: event.name,
        awayTeam: "Race",
        competition: "Formula 1",
        sport: "f1" as const,
        status,
        excitement,
        easterEggs,
        date: event.race.date,
      });
    }

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
