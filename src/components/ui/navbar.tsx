"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { LogOut, Menu, X } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type NavbarProps = {
  items: NavItem[];
  onSignOut: () => Promise<void>;
};

export function Navbar({ items, onSignOut }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <nav className="relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 z-50">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex h-14 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                SIMPLE BUDGET
              </h1>
            </div>

            {/* Desktop navigation */}
            <div className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    item.active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  )}
                >
                  {item.label}
                </a>
              ))}
              <div className="ml-2 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
              <Button
                variant="ghost"
                size="icon"
                onClick={onSignOut}
                title="Sign out"
                className="ml-1 h-9 w-9 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9 relative z-50"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Full-screen mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white dark:bg-zinc-950 md:hidden">
          <div className="flex h-full flex-col">
            {/* Spacer for navbar height */}
            <div className="h-14" />
            
            {/* Menu content */}
            <div className="flex-1 overflow-y-auto px-8 py-12">
              <nav className="flex flex-col gap-2">
                {items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-4xl font-medium transition-colors py-3",
                      item.active
                        ? "text-zinc-900 dark:text-white"
                        : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                
                <div className="my-4 h-px bg-zinc-200 dark:bg-zinc-800" />
                
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignOut();
                  }}
                  className="flex items-center gap-3 text-4xl font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors py-3"
                >
                  <LogOut className="h-8 w-8" />
                  Sign out
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
