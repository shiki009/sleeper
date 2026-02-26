const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl";

interface EspnCompetitor {
  id: string;
  homeAway: "home" | "away";
  team: { id: string; displayName: string };
  score: string;
}

interface EspnEvent {
  id: string;
  date: string;
  name: string;
  competitions: Array<{
    id: string;
    competitors: EspnCompetitor[];
    status: {
      type: { name: string; completed: boolean };
      period: number;
      displayClock?: string;
    };
  }>;
}

interface ScoreboardResponse {
  events: EspnEvent[];
}

interface EspnPlay {
  id: string;
  period: { number: number; type: string };
  clock: { displayValue: string; value: number };
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
  text: string;
  type: { id: string; text: string };
}

interface EspnTeamStats {
  team: { id: string; displayName: string };
  statistics: Array<{ name: string; displayValue: string }>;
}

interface SummaryResponse {
  plays?: EspnPlay[];
  boxscore?: { teams?: EspnTeamStats[] };
}

export interface NhlTeamStats {
  shotsTotal: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayOpportunities: number;
  shortHandedGoals: number;
  shootoutGoals: number;
  penalties: number;
  penaltyMinutes: number;
  takeaways: number;
  giveaways: number;
  faceoffPercent: number;
}

export interface NhlGoal {
  period: number;
  clock: string;
  teamId: string;
  text: string;
  homeScore: number;
  awayScore: number;
}

export interface NhlGameData {
  id: string;
  homeTeam: { id: string; name: string; score: number };
  awayTeam: { id: string; name: string; score: number };
  status: string;
  period: number;
  date: string;
  goals: NhlGoal[];
  homeStats?: NhlTeamStats;
  awayStats?: NhlTeamStats;
  clock?: string;
}

function formatDate(date: string): string {
  return date.replace(/-/g, "");
}

function parseStat(
  stats: EspnTeamStats[] | undefined,
  teamId: string
): NhlTeamStats | undefined {
  if (!stats) return undefined;
  const entry = stats.find((t) => t.team.id === teamId);
  if (!entry) return undefined;

  const get = (name: string): number => {
    const s = entry.statistics.find((st) => st.name === name);
    return s ? parseFloat(s.displayValue) || 0 : 0;
  };

  return {
    shotsTotal: get("shotsTotal"),
    hits: get("hits"),
    blockedShots: get("blockedShots"),
    powerPlayGoals: get("powerPlayGoals"),
    powerPlayOpportunities: get("powerPlayOpportunities"),
    shortHandedGoals: get("shortHandedGoals"),
    shootoutGoals: get("shootoutGoals"),
    penalties: get("penalties"),
    penaltyMinutes: get("penaltyMinutes"),
    takeaways: get("takeaways"),
    giveaways: get("giveaways"),
    faceoffPercent: get("faceoffPercent"),
  };
}

async function fetchSummary(eventId: string): Promise<SummaryResponse> {
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function getGamesByDate(date: string): Promise<NhlGameData[]> {
  const espnDate = formatDate(date);
  let data: ScoreboardResponse;
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${espnDate}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const games: NhlGameData[] = [];

  for (const event of data.events || []) {
    const comp = event.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home")!;
    const away = comp.competitors.find((c) => c.homeAway === "away")!;

    if (!comp.status.type.completed) {
      const isInProgress = comp.status.type.name !== "STATUS_SCHEDULED";
      let clock: string | undefined;
      if (isInProgress && comp.status.displayClock) {
        clock =
          comp.status.period >= 4
            ? `OT ${comp.status.displayClock}`
            : `P${comp.status.period} ${comp.status.displayClock}`;
      }
      games.push({
        id: event.id,
        homeTeam: {
          id: home.team.id,
          name: home.team.displayName,
          score: parseInt(home.score) || 0,
        },
        awayTeam: {
          id: away.team.id,
          name: away.team.displayName,
          score: parseInt(away.score) || 0,
        },
        status: comp.status.type.name,
        period: comp.status.period,
        date: event.date,
        goals: [],
        clock,
      });
      continue;
    }

    const summary = await fetchSummary(event.id);

    // Extract goals from scoring plays
    const goals: NhlGoal[] = (summary.plays || [])
      .filter((p) => p.scoringPlay)
      .map((p) => {
        // Determine which team scored from score change
        let teamId = "";
        // Find the previous play to compare scores
        const allPlays = summary.plays || [];
        const idx = allPlays.indexOf(p);
        if (idx > 0) {
          const prev = allPlays[idx - 1];
          if (p.homeScore > prev.homeScore) teamId = home.team.id;
          else teamId = away.team.id;
        } else {
          if (p.homeScore > 0) teamId = home.team.id;
          else teamId = away.team.id;
        }

        return {
          period: p.period.number,
          clock: p.clock.displayValue,
          teamId,
          text: p.text,
          homeScore: p.homeScore,
          awayScore: p.awayScore,
        };
      });

    const boxTeams = summary.boxscore?.teams;

    games.push({
      id: event.id,
      homeTeam: {
        id: home.team.id,
        name: home.team.displayName,
        score: parseInt(home.score) || 0,
      },
      awayTeam: {
        id: away.team.id,
        name: away.team.displayName,
        score: parseInt(away.score) || 0,
      },
      status: comp.status.type.name,
      period: comp.status.period,
      date: event.date,
      goals,
      homeStats: parseStat(boxTeams, home.team.id),
      awayStats: parseStat(boxTeams, away.team.id),
    });
  }

  return games;
}
