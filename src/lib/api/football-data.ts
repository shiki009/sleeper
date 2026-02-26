const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// ESPN league slugs for top competitions
const LEAGUES = [
  { slug: "eng.1", name: "Premier League" },
  { slug: "esp.1", name: "La Liga" },
  { slug: "ger.1", name: "Bundesliga" },
  { slug: "ita.1", name: "Serie A" },
  { slug: "fra.1", name: "Ligue 1" },
  { slug: "uefa.champions", name: "Champions League" },
  { slug: "uefa.europa", name: "Europa League" },
  { slug: "uefa.europa.conf", name: "Conference League" },
];

interface EspnKeyEvent {
  type: { id?: string; text: string };
  clock: { value?: number; displayValue: string };
  team?: { id: string; displayName: string };
  participants?: Array<{
    athlete: { id: string; displayName: string };
  }>;
}

interface EspnSeriesCompetitor {
  id: string;
  score: string;
}

interface EspnCompetitor {
  id: string;
  homeAway: "home" | "away";
  team: {
    id: string;
    displayName: string;
  };
  score: string;
}

interface EspnOdds {
  overUnder?: number;
  spread?: number;
  homeTeamOdds?: {
    moneyLine?: number;
  };
  awayTeamOdds?: {
    moneyLine?: number;
  };
  drawOdds?: {
    moneyLine?: number;
  };
}

interface EspnEvent {
  id: string;
  date: string;
  name: string;
  competitions: Array<{
    id: string;
    competitors: EspnCompetitor[];
    status: {
      type: { name: string; completed: boolean; detail?: string };
    };
    series?: {
      title: string;
      competitors?: EspnSeriesCompetitor[];
    };
    leg?: { value: number };
    odds?: EspnOdds[];
  }>;
}

interface ScoreboardResponse {
  events: EspnEvent[];
}

interface EspnTeamStats {
  team: { id: string; displayName: string };
  statistics: Array<{ name: string; displayValue: string }>;
}

interface SummaryResponse {
  keyEvents?: EspnKeyEvent[];
  boxscore?: {
    teams?: EspnTeamStats[];
  };
}

export interface GoalEvent {
  minute: number;
  teamId: string;
  isOwnGoal?: boolean;
  isPenalty?: boolean;
}

export interface CardEvent {
  minute: number;
  teamId: string;
  cardType: "yellow" | "red";
}

export interface TeamStats {
  totalShots: number;
  shotsOnTarget: number;
  possessionPct: number;
  foulsCommitted: number;
  wonCorners: number;
  saves: number;
}

export interface FootballOdds {
  overUnder?: number;
  spread?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  drawMoneyline?: number;
}

export interface FootballMatch {
  id: string;
  status: string;
  utcDate: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  competition: string;
  homeScore: number;
  awayScore: number;
  goals: GoalEvent[];
  cards: CardEvent[];
  homeStats?: TeamStats;
  awayStats?: TeamStats;
  clock?: string;
  isKnockout?: boolean;
  knockoutRound?: string;
  aggregateDiff?: number;
  odds?: FootballOdds;
}

function parseStats(
  teamStats: EspnTeamStats[] | undefined,
  teamId: string
): TeamStats | undefined {
  if (!teamStats) return undefined;
  const entry = teamStats.find((t) => t.team.id === teamId);
  if (!entry) return undefined;

  const get = (name: string): number => {
    const stat = entry.statistics.find((s) => s.name === name);
    return stat ? parseFloat(stat.displayValue) || 0 : 0;
  };

  return {
    totalShots: get("totalShots"),
    shotsOnTarget: get("shotsOnTarget"),
    possessionPct: get("possessionPct"),
    foulsCommitted: get("foulsCommitted"),
    wonCorners: get("wonCorners"),
    saves: get("saves"),
  };
}

function parseMinute(displayValue: string): number {
  // "32'" -> 32, "45'+9'" -> 54, "90'+4'" -> 94
  const match = displayValue.match(/^(\d+)'(?:\+(\d+)')?$/);
  if (!match) return 0;
  return parseInt(match[1]) + (match[2] ? parseInt(match[2]) : 0);
}

function formatDateForEspn(date: string): string {
  // "2026-02-22" -> "20260222"
  return date.replace(/-/g, "");
}

function parseOdds(espnOdds: EspnOdds[] | undefined): FootballOdds | undefined {
  if (!espnOdds || espnOdds.length === 0) return undefined;
  const odds = espnOdds[0];

  const overUnder = odds.overUnder;
  const spread = odds.spread != null ? Math.abs(odds.spread) : undefined;
  const homeMoneyline = odds.homeTeamOdds?.moneyLine;
  const awayMoneyline = odds.awayTeamOdds?.moneyLine;
  const drawMoneyline = odds.drawOdds?.moneyLine;

  // Only return odds if at least one meaningful field is present
  if (
    overUnder == null &&
    spread == null &&
    homeMoneyline == null &&
    awayMoneyline == null &&
    drawMoneyline == null
  ) {
    return undefined;
  }

  return { overUnder, spread, homeMoneyline, awayMoneyline, drawMoneyline };
}

async function fetchSummary(
  league: string,
  eventId: string
): Promise<SummaryResponse> {
  const res = await fetch(
    `${ESPN_BASE}/${league}/summary?event=${eventId}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return {};
  return res.json();
}

export async function getMatchesByDate(
  date: string
): Promise<FootballMatch[]> {
  const espnDate = formatDateForEspn(date);

  const results = await Promise.allSettled(
    LEAGUES.map(async (league) => {
      const res = await fetch(
        `${ESPN_BASE}/${league.slug}/scoreboard?dates=${espnDate}`,
        { next: { revalidate: 300 } }
      );
      if (!res.ok) return [];
      const data: ScoreboardResponse = await res.json();

      const matches: FootballMatch[] = [];

      for (const event of data.events || []) {
        const comp = event.competitions[0];
        const home = comp.competitors.find((c) => c.homeAway === "home")!;
        const away = comp.competitors.find((c) => c.homeAway === "away")!;
        const completed = comp.status.type.completed;
        const statusName = comp.status.type.name;

        const goals: GoalEvent[] = [];
        const cards: CardEvent[] = [];
        let homeStats: TeamStats | undefined;
        let awayStats: TeamStats | undefined;

        // Only fetch detailed summary for finished games
        if (completed) {
          const summary = await fetchSummary(league.slug, event.id);

          for (const ke of summary.keyEvents || []) {
            const typeText = ke.type?.text || "";
            const minute = parseMinute(ke.clock?.displayValue || "");
            const teamId = ke.team?.id || "";

            if (typeText.startsWith("Goal") || typeText === "Penalty - Scored" || typeText === "Penalty - Loss of Lead Goal") {
              goals.push({
                minute,
                teamId,
                isPenalty: typeText.includes("Penalty"),
                isOwnGoal: typeText.includes("Own Goal"),
              });
            } else if (typeText === "Yellow Card") {
              cards.push({ minute, teamId, cardType: "yellow" });
            } else if (
              typeText === "Red Card" ||
              typeText === "Yellow Red Card"
            ) {
              cards.push({ minute, teamId, cardType: "red" });
            }
          }

          const boxTeams = summary.boxscore?.teams;
          homeStats = parseStats(boxTeams, home.team.id);
          awayStats = parseStats(boxTeams, away.team.id);
        }

        // Parse knockout metadata from series info
        const isKnockout = !!comp.series;
        const knockoutRound = comp.series?.title;
        let aggregateDiff: number | undefined;
        if (
          completed &&
          comp.series?.competitors &&
          comp.leg?.value === 2
        ) {
          const scores = comp.series.competitors.map((c) =>
            parseInt(c.score) || 0
          );
          if (scores.length === 2) {
            aggregateDiff = Math.abs(scores[0] - scores[1]);
          }
        }

        // Map ESPN status to our status
        let status = "FINISHED";
        let clock: string | undefined;
        if (!completed) {
          status = statusName === "STATUS_SCHEDULED" ? "SCHEDULED" : "IN_PROGRESS";
          if (status === "IN_PROGRESS") {
            clock = comp.status.type.detail;
          }
        }

        // Parse odds for all game statuses (ESPN may retain odds data for finished games)
        const odds = parseOdds(comp.odds);

        matches.push({
          id: event.id,
          status,
          utcDate: event.date,
          homeTeam: {
            id: home.team.id,
            name: home.team.displayName,
          },
          awayTeam: {
            id: away.team.id,
            name: away.team.displayName,
          },
          competition: league.name,
          homeScore: parseInt(home.score) || 0,
          awayScore: parseInt(away.score) || 0,
          goals,
          cards,
          homeStats,
          awayStats,
          clock,
          isKnockout: isKnockout || undefined,
          knockoutRound,
          aggregateDiff,
          odds,
        });
      }

      return matches;
    })
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
