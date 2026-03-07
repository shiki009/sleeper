const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/racing/f1";

const ESPN_CORE =
  "https://sports.core.api.espn.com/v2/sports/racing/leagues/f1";

interface EspnCompetitor {
  id: string;
  order?: number;
  winner?: boolean;
  athlete: {
    fullName: string;
    displayName: string;
    shortName: string;
    flag?: { href: string; alt: string };
  };
  statistics?: unknown[];
}

interface EspnCompetition {
  id: string;
  date: string;
  type: { id: string; abbreviation: string };
  competitors?: EspnCompetitor[];
  status?: {
    type: { name: string; completed: boolean };
  };
}

interface EspnEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  endDate: string;
  circuit?: { fullName: string; address?: { city: string; country: string } };
  competitions: EspnCompetition[];
  status: {
    type: { name: string; completed: boolean };
  };
}

interface ScoreboardResponse {
  events: EspnEvent[];
}

interface CoreCompetitor {
  id: string;
  order: number;
  winner: boolean;
  athlete: { $ref: string };
  vehicle?: { number: string; manufacturer: string; teamColor: string };
}

interface CoreCompetitionResponse {
  competitors?: CoreCompetitor[];
}

export interface F1Driver {
  id: string;
  name: string;
  team?: string;
  teamColor?: string;
}

export interface F1EventData {
  id: string;
  name: string;
  circuit: string;
  date: string;
  endDate: string;
  status: string; // uses the RACE competition status, not the event status
  qualifyingResults: F1Driver[];
  raceResults: F1Driver[];
}

function formatDate(date: string): string {
  return date.replace(/-/g, "");
}

async function fetchTeamInfo(
  eventId: string,
  raceCompId: string
): Promise<Map<string, { team: string; color: string }>> {
  const map = new Map<string, { team: string; color: string }>();
  try {
    const res = await fetch(
      `${ESPN_CORE}/events/${eventId}/competitions/${raceCompId}?lang=en&region=us`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return map;
    const data: CoreCompetitionResponse = await res.json();
    for (const c of data.competitors ?? []) {
      if (c.vehicle) {
        map.set(c.id, { team: c.vehicle.manufacturer, color: c.vehicle.teamColor });
      }
    }
  } catch {
    // Team info is optional
  }
  return map;
}

/**
 * Parse competitors into F1Driver[], but only when they have an `order` field.
 * Competitors without `order` are just entry lists (race hasn't happened).
 */
function parseCompetitors(
  competitors: EspnCompetitor[] | undefined,
  teamInfo?: Map<string, { team: string; color: string }>
): F1Driver[] {
  if (!competitors) return [];

  // If competitors don't have `order`, the session hasn't produced results yet
  const hasOrder = competitors.some((c) => c.order != null);
  if (!hasOrder) return [];

  return [...competitors]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((c) => {
      const info = teamInfo?.get(c.id);
      return {
        id: c.id,
        name: c.athlete.displayName,
        team: info?.team,
        teamColor: info?.color,
      };
    });
}

export async function getEventsByDate(date: string): Promise<F1EventData[]> {
  const espnDate = formatDate(date);
  let data: ScoreboardResponse;
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${espnDate}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const events: F1EventData[] = [];

  for (const event of data.events ?? []) {
    const qualComp = event.competitions.find(
      (c) => c.type.abbreviation === "Qual"
    );
    const raceComp = event.competitions.find(
      (c) => c.type.abbreviation === "Race"
    );
    if (!raceComp) continue;

    // Use the RACE competition's own status, not the event-level status.
    // The event status reflects the latest completed session (e.g. qualifying),
    // while the race may still be scheduled.
    const raceStatus = raceComp.status?.type.name ?? event.status.type.name;
    const raceFinished = raceComp.status?.type.completed ?? event.status.type.completed;

    // Fetch team info from core API for finished races
    let teamInfo: Map<string, { team: string; color: string }> | undefined;
    if (raceFinished) {
      teamInfo = await fetchTeamInfo(event.id, raceComp.id);
    }

    const qualifyingResults = parseCompetitors(qualComp?.competitors, teamInfo);
    const raceResults = parseCompetitors(raceComp.competitors, teamInfo);

    const circuit = event.circuit
      ? `${event.circuit.fullName}${event.circuit.address?.city ? `, ${event.circuit.address.city}` : ""}`
      : "";

    events.push({
      id: event.id,
      name: event.name.replace(/^(Louis Vuitton|Heineken|Lenovo|Gulf Air|Crypto\.com|AWS|Pirelli|Qatar Airways) /, ""),
      circuit,
      date: event.date,
      endDate: event.endDate,
      status: raceStatus,
      qualifyingResults,
      raceResults,
    });
  }

  return events;
}
