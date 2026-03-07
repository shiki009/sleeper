const ESPN_STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports";

interface EspnStandingsEntry {
  team: { displayName: string };
  stats?: Array<{ name: string; displayValue: string }>;
}

interface EspnStandingsResponse {
  children?: Array<{
    standings?: {
      entries?: EspnStandingsEntry[];
    };
  }>;
}

async function fetchStandingsMap(url: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return map;
    const data: EspnStandingsResponse = await res.json();

    let positional = 1;
    for (const group of data.children ?? []) {
      for (const entry of group.standings?.entries ?? []) {
        const seedStat = entry.stats?.find(
          (s) => s.name === "playoffSeed" || s.name === "rank"
        );
        const rank = seedStat ? parseInt(seedStat.displayValue) || positional : positional;
        map.set(entry.team.displayName, rank);
        positional++;
      }
    }
  } catch {
    // Silently fail — standings are a bonus, not critical
  }
  return map;
}

export async function getFootballStandings(
  leagueSlug: string
): Promise<Map<string, number>> {
  return fetchStandingsMap(
    `${ESPN_STANDINGS_BASE}/soccer/${leagueSlug}/standings`
  );
}

export async function getNbaStandings(): Promise<Map<string, number>> {
  return fetchStandingsMap(
    `${ESPN_STANDINGS_BASE}/basketball/nba/standings`
  );
}

export async function getNhlStandings(): Promise<Map<string, number>> {
  return fetchStandingsMap(
    `${ESPN_STANDINGS_BASE}/hockey/nhl/standings`
  );
}

export async function getF1Standings(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/v2/sports/racing/f1/standings",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return map;
    const data = await res.json();

    for (const group of data.children ?? []) {
      if (group.name !== "Driver Standings") continue;
      for (const entry of group.standings?.entries ?? []) {
        const name = entry.athlete?.displayName ?? entry.athlete?.name;
        const rankStat = entry.stats?.find(
          (s: { name: string }) => s.name === "rank"
        );
        const rank = rankStat ? parseInt(rankStat.displayValue) || 0 : 0;
        if (name && rank > 0) {
          map.set(name, rank);
        }
      }
    }
  } catch {
    // Silently fail — standings are a bonus
  }
  return map;
}
