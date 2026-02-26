# Sleeper — Project Instructions

> Spoiler-free sports excitement ratings. Next.js 14 + Radix UI + Tailwind CSS.

## What This App Does

Sleeper tells sports fans which games are worth watching -- without revealing scores or outcomes. It fetches completed game data from ESPN APIs, runs excitement-scoring algorithms per sport, and presents spoiler-free "watchability" ratings on a scale of 1-10. Supports Football (soccer), NBA, and NHL.

## Tech Stack

- **Framework**: Next.js 14.2 (App Router, React 18)
- **UI Primitives**: Radix UI (`@radix-ui/react-tabs`, `@radix-ui/react-slot`)
- **Styling**: Tailwind CSS 3.4 + `tailwindcss-animate` + CSS custom properties (HSL design tokens)
- **Component Variants**: `class-variance-authority` (cva)
- **Class Merging**: `clsx` + `tailwind-merge` (via `cn()` utility)
- **Icons**: Lucide React
- **Testing**: Vitest 4
- **External APIs**: ESPN public APIs (scoreboard, summary, standings)
- **Auth**: None
- **Database**: None
- **State Management**: React `useState` + URL search params

## Directory Structure

```
src/
  app/
    api/{sport}/games/route.ts   -- API routes (one per sport)
    {sport}/page.tsx             -- Sport-specific pages
    page.tsx                     -- Home page (all sports)
    layout.tsx                   -- Root layout (server component)
    error.tsx                    -- Error boundary
    globals.css                  -- Tailwind + CSS custom properties + animations
  components/
    ui/                          -- Radix-based primitives (shadcn/ui style)
      badge.tsx
      button.tsx
      card.tsx
      tabs.tsx
    DatePicker.tsx               -- Date navigation
    ExcitementMeter.tsx          -- Circular SVG score gauge
    GameCard.tsx                 -- Individual game card
    GameList.tsx                 -- Game list with loading/empty states
    Header.tsx                   -- Site header with nav
    SportFilter.tsx              -- Sport tab filter (Radix Tabs)
  lib/
    api/                         -- ESPN API clients (one per sport)
      football-data.ts
      nba.ts
      nhl.ts
      standings.ts
    scoring/                     -- Excitement algorithms (one per sport)
      types.ts                   -- Shared types (GameSummary, ExcitementResult, EasterEgg)
      football.ts
      nba.ts
      nhl.ts
      __tests__/                 -- Vitest tests
        types.test.ts
        football.test.ts
        nba.test.ts
        nhl.test.ts
    logos.ts                     -- Team logo URL registry
    utils.ts                    -- cn() utility
```

## Layer Architecture

This project has a simpler architecture than a full-stack app. Features follow this order:

```
types --> api-client --> scoring-algorithm --> api-route --> components --> pages
```

| Layer | Location | Purpose |
|-------|----------|---------|
| Types | `lib/scoring/types.ts` | Shared types: `GameSummary`, `ExcitementResult`, `EasterEgg` |
| API Client | `lib/api/{sport}.ts` | Fetch + parse data from ESPN APIs |
| Standings | `lib/api/standings.ts` | Fetch league standings for ranking bonuses |
| Scoring | `lib/scoring/{sport}.ts` | Excitement algorithms + easter egg detection |
| API Route | `app/api/{sport}/games/route.ts` | Next.js Route Handler (GET) |
| UI Primitives | `components/ui/` | Radix-based components (Button, Card, Badge, Tabs) |
| Components | `components/` | Feature components (GameCard, GameList, etc.) |
| Pages | `app/{sport}/page.tsx` | Client pages with date/sport filtering |

## Naming Conventions

- **Files**: `PascalCase.tsx` for components, `kebab-case.ts` for lib files, `route.ts` for API routes
- **Components**: `PascalCase` (function name and export)
- **Functions**: `camelCase` -- `calculateFootballExcitement`, `getGamesByDate`, `detectNbaEasterEggs`
- **Types/Interfaces**: `PascalCase` -- `GameSummary`, `ExcitementResult`, `NbaGameData`
- **Constants**: `UPPER_SNAKE_CASE` for config objects (`LEAGUES`, `NAV_LINKS`, `SPORTS`)
- **Imports**: Always use `@/` alias (e.g., `@/lib/scoring/types`, `@/components/ui/card`)
- **Test files**: `{module}.test.ts` inside `__tests__/` directory

## API Route Pattern

Every API route in `app/api/{sport}/games/route.ts` follows this exact flow:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getGamesByDate } from "@/lib/api/{sport}";
import { get{Sport}Standings } from "@/lib/api/standings";
import { calculate{Sport}Excitement, detect{Sport}EasterEggs } from "@/lib/scoring/{sport}";
import { type GameSummary } from "@/lib/scoring/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    // 1. Fetch game data + standings in parallel
    const [allGames, standings] = await Promise.all([
      getGamesByDate(date),
      get{Sport}Standings(),
    ]);

    // 2. Map to GameSummary with excitement scores
    const games: GameSummary[] = allGames.map((game) => {
      const isFinished = /* check status */;
      const homeRank = standings.get(game.homeTeam.name);
      const awayRank = standings.get(game.awayTeam.name);
      const excitement = isFinished
        ? calculate{Sport}Excitement(game, homeRank, awayRank)
        : undefined;
      const easterEggs = isFinished ? detect{Sport}EasterEggs(game) : undefined;

      return {
        id: `{sport}-${game.id}`,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        competition: "...",
        sport: "{sport}" as const,
        status,  // "finished" | "in_progress" | "scheduled"
        clock: status === "in_progress" ? game.clock : undefined,
        excitement,
        easterEggs,
        date: game.date,
      };
    });

    // 3. Sort by excitement score descending
    games.sort((a, b) => (b.excitement?.score ?? -1) - (a.excitement?.score ?? -1));

    // 4. Return with cache headers
    return NextResponse.json(
      { games, date },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("{Sport} API error:", error);
    return NextResponse.json(
      { games: [], date, error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
```

**Key rules**: Always parallel-fetch game data + standings, compute excitement only for finished games, sort by excitement score, use cache headers.

## ESPN API Client Pattern

Every API client in `lib/api/{sport}.ts` follows:

```typescript
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/{category}/{league}";

// 1. Define ESPN response interfaces
interface EspnCompetitor { /* ... */ }
interface EspnEvent { /* ... */ }

// 2. Define output data types
export interface {Sport}GameData {
  id: string;
  homeTeam: { name: string; score: number };
  awayTeam: { name: string; score: number };
  status: string;
  date: string;
  // ... sport-specific fields
}

// 3. Helper to fetch event summary (detailed stats, goals, plays)
async function fetchSummary(eventId: string): Promise<SummaryResponse> {
  const res = await fetch(`${ESPN_BASE}/summary?event=${eventId}`, {
    next: { revalidate: 86400 },  // 24h cache for completed games
  });
  if (!res.ok) return {};
  return res.json();
}

// 4. Main function: fetch scoreboard + enrich finished games with summary
export async function getGamesByDate(date: string): Promise<{Sport}GameData[]> {
  const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${espnDate}`, {
    next: { revalidate: 300 },  // 5 min cache for scoreboard
  });
  if (!res.ok) return [];
  // ... parse events, fetch summaries for finished games
}
```

**Key rules**: Use `next: { revalidate }` for ISR caching, scoreboard gets 5min cache, summary gets 24h cache, return `[]` on error.

## Scoring Algorithm Pattern

Every scoring module in `lib/scoring/{sport}.ts` follows:

```typescript
import { type {Sport}GameData } from "../api/{sport}";
import { clampScore, getLabel, type ExcitementResult, type EasterEgg } from "./types";

const BASE_SCORE = 4.5;  // Starting point

// Individual factor functions: each returns a positive or negative modifier
function totalGoalsPoints(total: number): number { /* ... */ }
function closenessPoints(margin: number): number { /* ... */ }
function comebackPoints(game: {Sport}GameData): number { /* ... */ }
// ... more factors

// Main calculation: BASE_SCORE + sum of all factors, clamped to [1, 10]
export function calculate{Sport}Excitement(
  game: {Sport}GameData,
  homeRank?: number,
  awayRank?: number,
): ExcitementResult {
  let points = BASE_SCORE;
  points += totalGoalsPoints(/* ... */);
  points += closenessPoints(/* ... */);
  // ... more factors
  points += standingsBonus(homeRank, awayRank);

  const score = clampScore(points);
  return { score, label: getLabel(score) };
}

// Easter eggs: special badges for notable game attributes
export function detect{Sport}EasterEggs(game: {Sport}GameData): EasterEgg[] {
  const eggs: EasterEgg[] = [];
  // Check for each possible easter egg condition
  if (/* cardiac finish condition */) {
    eggs.push({ id: "cardiac", emoji: "...", label: "Cardiac Finish", tooltip: "..." });
  }
  // ... more conditions
  return eggs;
}
```

**Key rules**: Base score of ~4.5, individual factor functions return small modifiers (+/- 0.2 to 2.0), `clampScore()` enforces [1, 10] range, `getLabel()` maps to "Must Watch" / "Good Watch" / "Fair Game" / "Skip It".

## Component Pattern

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type GameSummary } from "@/lib/scoring/types";

interface GameCardProps {
  game: GameSummary;
}

export function GameCard({ game }: GameCardProps) {
  const [revealed, setRevealed] = useState(false);
  // ... render with Tailwind classes, Lucide icons, ui/ primitives
}
```

**Key rules**: All interactive components use `"use client"`, typed props via interfaces, Tailwind for styling, Radix-based `components/ui/` primitives.

## Page Pattern

```typescript
"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DatePicker } from "@/components/DatePicker";
import { GameList } from "@/components/GameList";

function {Sport}Content() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") || getDefaultDate();

  const setDate = useCallback(
    (d: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", d);
      router.replace(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-title ...">...</h1>
        <DatePicker date={date} onChange={setDate} />
      </div>
      <GameList sport="{sport}" date={date} />
    </div>
  );
}

export default function {Sport}Page() {
  return (
    <Suspense>
      <{Sport}Content />
    </Suspense>
  );
}
```

**Key rules**: Pages are client components wrapped in Suspense, use URL search params for state, no auth checks (public app).

## UI Primitives (components/ui/)

Built with Radix UI + `class-variance-authority` (shadcn/ui style):

```typescript
// components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center ...",
  {
    variants: {
      variant: { default: "...", destructive: "...", outline: "...", ghost: "...", link: "..." },
      size: { default: "h-10 px-4 py-2", sm: "h-8 ...", lg: "h-11 ...", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

## Design Tokens

All colors use HSL CSS custom properties defined in `globals.css`. Light and dark themes:

```css
:root {
  --background: 40 14% 95%;    /* warm off-white */
  --primary: 213 56% 24%;      /* dark navy */
  --card: 0 0% 100%;           /* pure white */
  --muted: 40 10% 93%;
  /* ... */
}
.dark {
  --background: 215 28% 7%;
  --primary: 217 72% 56%;
  /* ... */
}
```

## Testing Pattern

Tests use Vitest, located in `__tests__/` directories:

```typescript
import { describe, it, expect } from "vitest";
import { calculateFootballExcitement, detectFootballEasterEggs } from "../football";
import type { FootballMatch } from "../../api/football-data";

// Factory function for test data
function makeMatch(overrides: Partial<FootballMatch> = {}): FootballMatch {
  return {
    id: "1",
    status: "FINISHED",
    utcDate: "2026-02-22T20:00:00Z",
    homeTeam: { id: "home", name: "Home FC" },
    awayTeam: { id: "away", name: "Away FC" },
    competition: "Premier League",
    homeScore: 0,
    awayScore: 0,
    goals: [],
    cards: [],
    ...overrides,
  };
}

describe("calculateFootballExcitement", () => {
  it("gives a low score for a boring 0-0 with no stats", () => {
    const match = makeMatch({ homeScore: 0, awayScore: 0, goals: [] });
    const result = calculateFootballExcitement(match);
    expect(result.score).toBeLessThan(4);
    expect(result.label).toBe("Skip It");
  });
});
```

**Key rules**: Use factory functions with `Partial<T>` overrides, test both calculation and easter egg detection, use `describe/it/expect` from Vitest.

## Route Structure

```
app/
  page.tsx                         -- Home (all sports, sport + date filters)
  layout.tsx                       -- Root layout (Header + main content)
  error.tsx                        -- Error boundary
  football/page.tsx                -- Football only
  nba/page.tsx                     -- NBA only
  nhl/page.tsx                     -- NHL only
  api/football/games/route.ts      -- Football API
  api/nba/games/route.ts           -- NBA API
  api/nhl/games/route.ts           -- NHL API
```

## Key Utilities

- `cn(...classes)` -- Tailwind class merger (`clsx` + `tailwind-merge`)
- `clampScore(score)` -- Clamp to [1, 10] with 1 decimal
- `getLabel(score)` -- Map score to "Must Watch" / "Good Watch" / "Fair Game" / "Skip It"
- `getTeamLogo(sport, teamName)` -- Look up team logo URL from static registry

## Domains

football (soccer), nba, nhl -- each with its own API client, scoring algorithm, API route, and easter egg detection.

## Adding a New Sport

To add a new sport (e.g., MLB):

1. **API Client**: Create `lib/api/mlb.ts` with `getGamesByDate()` and ESPN API integration
2. **Standings**: Add `getMlbStandings()` to `lib/api/standings.ts`
3. **Scoring**: Create `lib/scoring/mlb.ts` with `calculateMlbExcitement()` and `detectMlbEasterEggs()`
4. **Tests**: Create `lib/scoring/__tests__/mlb.test.ts`
5. **API Route**: Create `app/api/mlb/games/route.ts`
6. **Logos**: Add team logos to `lib/logos.ts`
7. **UI**: Update `SportFilter` and `GameList` to include the new sport
8. **Page**: Create `app/mlb/page.tsx`
9. **Nav**: Add link to `Header.tsx`'s `NAV_LINKS`
10. **Images**: Add remote pattern to `next.config.mjs`

## Agent Pipelines

4 pipelines, 13 agent files. Full documentation in `.claude/agents/README.md`.

### Quick Reference

| Pipeline | Command | When | Stages |
|----------|---------|------|--------|
| **Feature** | `@sleeper-orchestrator` | New feature (multiple layers) | planner -> architect -> implementor -> tester -> reviewer |
| **Bugfix** | `@sleeper-bug-orchestrator` | Bug, unknown root cause | triager -> fixer -> tester -> reviewer |
| **Hotfix** | `@sleeper-hotfix-orchestrator` | Bug, known root cause | fixer -> reviewer |
| **Refactor** | `@sleeper-refactor-orchestrator` | Restructure code | analyzer -> executor -> tester -> reviewer |

### Choosing the Right Pipeline

```
"I need a new feature"                    -> @sleeper-orchestrator
"Something is broken, not sure why"       -> @sleeper-bug-orchestrator
"Something is broken, I know the cause"   -> @sleeper-hotfix-orchestrator
"I want to restructure this code"         -> @sleeper-refactor-orchestrator
"Single-file fix, trivial change"         -> just do it directly
```

### Artifact Directories

Each pipeline writes to its own directory under `.planning/` (gitignored):

```
.planning/
  features/{slug}/      -- feature pipeline
  bugs/{slug}/          -- bugfix pipeline
  hotfixes/{slug}/      -- hotfix pipeline
  refactors/{slug}/     -- refactor pipeline
```
