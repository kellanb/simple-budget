"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type YearSelectorProps = {
  year: number;
  onChange: (year: number) => void;
};

// Generate years from 2000 to 2050
const AVAILABLE_YEARS = Array.from({ length: 51 }, (_, i) => 2000 + i);

export function YearSelector({ year, onChange }: YearSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedYearRef = useRef<HTMLButtonElement>(null);
  
  const handlePrevYear = () => onChange(year - 1);
  const handleNextYear = () => onChange(year + 1);
  
  const handleSelectYear = (selectedYear: number) => {
    onChange(selectedYear);
    setDropdownOpen(false);
  };
  
  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);
  
  // Scroll selected year into view when dropdown opens
  useEffect(() => {
    if (dropdownOpen && selectedYearRef.current) {
      selectedYearRef.current.scrollIntoView({ block: "center" });
    }
  }, [dropdownOpen]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrevYear}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          "text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200",
          "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
          "transition-colors"
        )}
        aria-label="Previous year"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      
      {/* Year button with dropdown wrapper */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            "flex min-w-[120px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2",
            "border-zinc-300 bg-white shadow-sm",
            "dark:border-zinc-700 dark:bg-zinc-900",
            "text-sm font-semibold text-zinc-900 dark:text-zinc-50",
            "hover:bg-zinc-50 dark:hover:bg-zinc-800",
            "outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
            "transition-colors"
          )}
        >
          <span>{year}</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-zinc-500 transition-transform",
            dropdownOpen && "rotate-180"
          )} />
        </button>
        
        {/* Year dropdown */}
        {dropdownOpen && (
          <div
            ref={dropdownRef}
            className={cn(
              "absolute left-0 top-full z-50 mt-1",
              "w-28 max-h-64 overflow-y-auto",
              "rounded-xl border border-zinc-200 bg-white py-1 shadow-lg",
              "dark:border-zinc-700 dark:bg-zinc-900"
            )}
          >
            <div className="flex flex-col">
              {AVAILABLE_YEARS.map((y) => (
                <button
                  key={y}
                  ref={y === year ? selectedYearRef : undefined}
                  onClick={() => handleSelectYear(y)}
                  className={cn(
                    "px-4 py-2 text-sm text-left transition-colors",
                    y === year
                      ? "bg-blue-600 font-semibold text-white"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={handleNextYear}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          "text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200",
          "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
          "transition-colors"
        )}
        aria-label="Next year"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

