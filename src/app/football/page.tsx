"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DatePicker } from "@/components/DatePicker";
import { GameList } from "@/components/GameList";

function getDefaultDate(): string {
  return new Date().toISOString().split("T")[0];
}

function FootballContent() {
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
        <h1 className="text-2xl sm:text-title bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] bg-clip-text text-transparent dark:from-blue-400 dark:to-blue-300">Football</h1>
        <DatePicker date={date} onChange={setDate} />
      </div>
      <GameList sport="football" date={date} />
    </div>
  );
}

export default function FootballPage() {
  return (
    <Suspense>
      <FootballContent />
    </Suspense>
  );
}
