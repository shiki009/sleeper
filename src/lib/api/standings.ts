const ESPN_STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports";

interface EspnStandingsEntry {
  team: { displayName: string };
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

    let rank = 1;
    for (const group of data.children ?? []) {
      for (const entry of group.standings?.entries ?? []) {
        map.set(entry.team.displayName, rank++);
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
