import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-60";

const variants: Record<string, string> = {
  default: "bg-blue-600 text-white hover:bg-blue-700",
  outline:
    "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800",
  secondary: "bg-zinc-900 text-white hover:bg-zinc-800",
};

const sizes: Record<string, string> = {
  default: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-xs",
  lg: "px-6 py-3 text-base",
  icon: "h-9 w-9 p-0",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
