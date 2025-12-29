"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type YearSelectorProps = {
  year: number;
  onChange: (year: number) => void;
};

export function YearSelector({ year, onChange }: YearSelectorProps) {
  const handlePrevYear = () => onChange(year - 1);
  const handleNextYear = () => onChange(year + 1);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrevYear}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          "text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200",
          "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
          "transition-colors"
        )}
        aria-label="Previous year"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      
      <div className={cn(
        "min-w-[100px] rounded-xl border px-4 py-2 text-center",
        "border-zinc-300 bg-white shadow-sm",
        "dark:border-zinc-700 dark:bg-zinc-900",
        "text-lg font-bold text-zinc-900 dark:text-zinc-50"
      )}>
        {year}
      </div>
      
      <button
        onClick={handleNextYear}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          "text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200",
          "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
          "transition-colors"
        )}
        aria-label="Next year"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

