"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SportFilter } from "@/components/SportFilter";
import { DatePicker } from "@/components/DatePicker";
import { GameList } from "@/components/GameList";

function getDefaultDate(): string {
  return new Date().toISOString().split("T")[0];
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sport = (searchParams.get("sport") || "football") as
    | "all"
    | "football"
    | "nba"
    | "nhl";
  const date = searchParams.get("date") || getDefaultDate();

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        params.set(k, v);
      }
      router.replace(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-display bg-gradient-to-r from-[#1e3a5f] via-[#2563eb] to-[#1e3a5f] bg-clip-text text-transparent dark:from-blue-400 dark:via-blue-300 dark:to-blue-400">
          Which games are worth watching?
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-lg">
          Excitement scores without spoilers. No scores, no outcomes — just how
          watchable each game is.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <SportFilter
          value={sport}
          onChange={(v) => updateParams({ sport: v })}
        />
        <DatePicker
          date={date}
          onChange={(d) => updateParams({ date: d })}
        />
      </div>

      <GameList sport={sport} date={date} />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
