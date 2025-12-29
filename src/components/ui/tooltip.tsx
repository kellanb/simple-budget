"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
  content: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: number;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

export function Tooltip({
  content,
  children,
  className,
  maxWidth = 280,
  position = "top",
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Calculate position when visible
  useEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const padding = 8;

    let x = 0;
    let y = 0;

    switch (position) {
      case "top":
        x = trigger.left + trigger.width / 2 - tooltip.width / 2;
        y = trigger.top - tooltip.height - padding;
        break;
      case "bottom":
        x = trigger.left + trigger.width / 2 - tooltip.width / 2;
        y = trigger.bottom + padding;
        break;
      case "left":
        x = trigger.left - tooltip.width - padding;
        y = trigger.top + trigger.height / 2 - tooltip.height / 2;
        break;
      case "right":
        x = trigger.right + padding;
        y = trigger.top + trigger.height / 2 - tooltip.height / 2;
        break;
    }

    // Keep within viewport
    x = Math.max(padding, Math.min(x, window.innerWidth - tooltip.width - padding));
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltip.height - padding));

    setCoords({ x, y });
  }, [isVisible, position]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Don't show tooltip if content is empty
  if (!content) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={cn("inline-block", className)}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            "fixed z-[100] rounded-lg px-3 py-2 text-sm",
            "bg-zinc-900 text-white shadow-lg",
            "dark:bg-zinc-100 dark:text-zinc-900",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
          style={{
            left: coords.x,
            top: coords.y,
            maxWidth,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}

// TruncatedText component - shows tooltip on hover when text is truncated
type TruncatedTextProps = {
  text: string;
  className?: string;
  maxWidth?: string; // Tailwind class like "max-w-[200px]"
};

export function TruncatedText({
  text,
  className,
  maxWidth = "max-w-[200px]",
}: TruncatedTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (element) {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    }
  }, [text]);

  const content = (
    <span
      ref={textRef}
      className={cn(
        "block truncate",
        maxWidth,
        className
      )}
    >
      {text}
    </span>
  );

  if (!isTruncated) {
    return content;
  }

  return (
    <Tooltip content={text}>
      {content}
    </Tooltip>
  );
}

