"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SportFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const SPORTS = [
  { value: "all", label: "All Sports" },
  { value: "football", label: "Football" },
  { value: "nba", label: "NBA" },
  { value: "nhl", label: "NHL" },
];

export function SportFilter({ value, onChange }: SportFilterProps) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="h-11 rounded-full bg-muted/40 border border-border/30 p-1.5 overflow-x-auto scrollbar-hide">
        {SPORTS.map((sport) => (
          <TabsTrigger
            key={sport.value}
            value={sport.value}
            className="sport-trigger rounded-full px-4 py-1.5 text-caption data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:font-semibold"
          >
            {sport.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
