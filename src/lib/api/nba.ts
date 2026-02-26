const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

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
    odds?: EspnOdds[];
  }>;
}

interface ScoreboardResponse {
  events: EspnEvent[];
}

interface EspnPlay {
  id: string;
  period: { number: number };
  clock: { displayValue: string; value: number };
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
  text: string;
}

interface EspnOdds {
  overUnder?: number;
  spread?: number;
  homeTeamOdds?: { moneyLine?: number };
  awayTeamOdds?: { moneyLine?: number };
}

interface EspnTeamStats {
  team: { id: string; displayName: string };
  statistics: Array<{ name: string; displayValue: string }>;
}

interface SummaryResponse {
  plays?: EspnPlay[];
  boxscore?: { teams?: EspnTeamStats[] };
  winprobability?: Array<{ homeWinPercentage: number; playId: string }>;
  odds?: EspnOdds[];
  pickcenter?: EspnOdds[];
}

export interface NbaTeamStats {
  leadChanges: number;
  largestLead: number;
  fastBreakPoints: number;
  pointsInPaint: number;
  turnovers: number;
  totalTurnovers: number;
  fouls: number;
  technicalFouls: number;
}

export interface NbaPlay {
  period: number;
  clock: string;
  clockValue: number;
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
}

export interface NbaOdds {
  overUnder?: number;
  spread?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
}

export interface NbaGameData {
  id: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  status: string;
  period: number;
  date: string;
  plays: NbaPlay[];
  homeStats?: NbaTeamStats;
  awayStats?: NbaTeamStats;
  winProbSwings?: number; // count of big win-prob swings
  clock?: string;
  odds?: NbaOdds;
}

function parseOdds(espnOdds: EspnOdds[] | undefined): NbaOdds | undefined {
  if (!espnOdds || espnOdds.length === 0 || !espnOdds[0]) return undefined;
  const odds = espnOdds[0];

  const overUnder = odds.overUnder;
  const spread = odds.spread != null ? Math.abs(odds.spread) : undefined;
  const homeMoneyline = odds.homeTeamOdds?.moneyLine;
  const awayMoneyline = odds.awayTeamOdds?.moneyLine;

  if (overUnder == null && spread == null && homeMoneyline == null && awayMoneyline == null) {
    return undefined;
  }

  return { overUnder, spread, homeMoneyline, awayMoneyline };
}

function formatDate(date: string): string {
  return date.replace(/-/g, "");
}

function parseStat(
  stats: EspnTeamStats[] | undefined,
  teamId: string
): NbaTeamStats | undefined {
  if (!stats) return undefined;
  const entry = stats.find((t) => t.team.id === teamId);
  if (!entry) return undefined;

  const get = (name: string): number => {
    const s = entry.statistics.find((st) => st.name === name);
    return s ? parseFloat(s.displayValue) || 0 : 0;
  };

  return {
    leadChanges: get("leadChanges"),
    largestLead: get("largestLead"),
    fastBreakPoints: get("fastBreakPoints"),
    pointsInPaint: get("pointsInPaint"),
    turnovers: get("turnovers"),
    totalTurnovers: get("totalTurnovers"),
    fouls: get("fouls"),
    technicalFouls: get("technicalFouls"),
  };
}

function countWinProbSwings(
  wp: Array<{ homeWinPercentage: number }> | undefined
): number {
  if (!wp || wp.length < 2) return 0;
  let swings = 0;
  for (let i = 1; i < wp.length; i++) {
    const diff = Math.abs(wp[i].homeWinPercentage - wp[i - 1].homeWinPercentage);
    if (diff >= 0.15) swings++; // 15%+ swing = dramatic moment
  }
  return swings;
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

export async function getGamesByDate(date: string): Promise<NbaGameData[]> {
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

  const games: NbaGameData[] = [];

  for (const event of data.events || []) {
    const comp = event.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home")!;
    const away = comp.competitors.find((c) => c.homeAway === "away")!;

    if (!comp.status.type.completed) {
      const isInProgress = comp.status.type.name !== "STATUS_SCHEDULED";
      const clock =
        isInProgress && comp.status.displayClock
          ? `Q${comp.status.period} ${comp.status.displayClock}`
          : undefined;
      games.push({
        id: event.id,
        homeTeam: {
          name: home.team.displayName,
          score: parseInt(home.score) || 0,
        },
        awayTeam: {
          name: away.team.displayName,
          score: parseInt(away.score) || 0,
        },
        status: comp.status.type.name,
        period: comp.status.period,
        date: event.date,
        plays: [],
        clock,
        odds: parseOdds(comp.odds),
      });
      continue;
    }

    const summary = await fetchSummary(event.id);
    const summaryOdds = parseOdds(summary.odds) || parseOdds(summary.pickcenter);

    const plays: NbaPlay[] = (summary.plays || []).map((p) => ({
      period: p.period.number,
      clock: p.clock.displayValue,
      clockValue: p.clock.value,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      scoringPlay: p.scoringPlay,
    }));

    const boxTeams = summary.boxscore?.teams;

    games.push({
      id: event.id,
      homeTeam: {
        name: home.team.displayName,
        score: parseInt(home.score) || 0,
      },
      awayTeam: {
        name: away.team.displayName,
        score: parseInt(away.score) || 0,
      },
      status: comp.status.type.name,
      period: comp.status.period,
      date: event.date,
      plays,
      homeStats: parseStat(boxTeams, home.team.id),
      awayStats: parseStat(boxTeams, away.team.id),
      winProbSwings: countWinProbSwings(summary.winprobability),
      odds: parseOdds(comp.odds) || summaryOdds,
    });
  }

  return games;
}
