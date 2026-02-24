import { NextRequest, NextResponse } from "next/server";
import { getMatchesByDate } from "@/lib/api/football-data";
import { getFootballStandings } from "@/lib/api/standings";
import { calculateFootballExcitement, detectFootballEasterEggs } from "@/lib/scoring/football";
import { type GameSummary } from "@/lib/scoring/types";

const COMPETITION_TO_SLUG: Record<string, string | null> = {
  "Premier League": "eng.1",
  "La Liga": "esp.1",
  "Bundesliga": "ger.1",
  "Serie A": "ita.1",
  "Ligue 1": "fra.1",
  "Champions League": null,
};

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
    // Fetch matches and standings for all leagues in parallel
    const leagueSlugs = Object.values(COMPETITION_TO_SLUG).filter(
      (slug): slug is string => slug != null
    );
    const [matches, ...standingsResults] = await Promise.all([
      getMatchesByDate(date),
      ...leagueSlugs.map((slug) => getFootballStandings(slug)),
    ]);

    // Build a slug → standings map
    const standingsBySlug = new Map<string, Map<string, number>>();
    leagueSlugs.forEach((slug, i) => {
      standingsBySlug.set(slug, standingsResults[i]);
    });

    const games: GameSummary[] = matches
      .map((match) => {
        const status = mapStatus(match.status);

        // Look up ranks for this match's competition
        const slug = COMPETITION_TO_SLUG[match.competition] ?? undefined;
        const standings = slug ? standingsBySlug.get(slug) : undefined;
        const homeRank = standings?.get(match.homeTeam.name);
        const awayRank = standings?.get(match.awayTeam.name);

        const excitement =
          status === "finished"
            ? calculateFootballExcitement(match, homeRank, awayRank)
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
          clock: status === "in_progress" ? match.clock : undefined,
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
