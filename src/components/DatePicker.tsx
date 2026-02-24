"use client";

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  date: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function DatePicker({ date, onChange }: DatePickerProps) {
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-full border border-border/40 p-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8 rounded-full"
        onClick={() => onChange(addDays(date, -1))}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="min-w-[120px] text-center px-2">
        <div className="flex items-center justify-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent text-sm font-medium text-center cursor-pointer border-none outline-none"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDisplayDate(date)}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 sm:h-8 sm:w-8 rounded-full"
        onClick={() => onChange(addDays(date, 1))}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
