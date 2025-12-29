"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type SpreadsheetContainerProps = {
  children: React.ReactNode;
  className?: string;
};

// Constants for zoom behavior
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const DEFAULT_SCALE = 1;
const ZOOM_STEP = 0.25;

export function SpreadsheetContainer({ children, className }: SpreadsheetContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_SCALE, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_SCALE, prev - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setScale(DEFAULT_SCALE);
  }, []);
  
  // Track pinch gesture state
  const pinchState = useRef<{
    initialDistance: number;
    initialScale: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  // Track last tap for double-tap detection
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  // Get distance between two touch points
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point of two touches
  const getTouchCenter = (touches: React.TouchList): { x: number; y: number } => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  // Handle double-tap to fit section or toggle zoom
  const handleDoubleTap = useCallback((x: number, y: number) => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    if (scale === DEFAULT_SCALE) {
      // Find the section element under the tap point
      const elementsAtPoint = document.elementsFromPoint(x, y);
      const sectionEl = elementsAtPoint.find(
        (el) => el.getAttribute("data-zoom-target") === "section"
      ) as HTMLElement | undefined;
      
      const containerRect = container.getBoundingClientRect();
      const viewportWidth = containerRect.width;
      
      let newScale: number;
      let targetScrollX: number;
      let targetScrollY: number;
      
      if (sectionEl) {
        // Fit the tapped section
        const sectionRect = sectionEl.getBoundingClientRect();
        const sectionWidth = sectionRect.width / scale; // Get unscaled width
        
        // Calculate scale to fit section width with some padding
        const padding = 32;
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (viewportWidth - padding) / sectionWidth));
        
        // Scroll to bring section into view (top-left of section)
        const sectionOffsetLeft = (sectionRect.left - containerRect.left + container.scrollLeft) / scale;
        const sectionOffsetTop = (sectionRect.top - containerRect.top + container.scrollTop) / scale;
        
        targetScrollX = sectionOffsetLeft * newScale - padding / 2;
        targetScrollY = sectionOffsetTop * newScale - padding / 2;
      } else {
        // Fallback: fit entire sheet width or zoom to 1.5x at tap point
        const contentWidth = content.scrollWidth / scale;
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, viewportWidth / contentWidth));
        
        // If calculated scale is close to current, just use 1.5x
        if (Math.abs(newScale - scale) < 0.1) {
          newScale = 1.5;
        }
        
        const relativeX = x - containerRect.left;
        const relativeY = y - containerRect.top;
        targetScrollX = (relativeX + container.scrollLeft) * newScale / scale - relativeX;
        targetScrollY = (relativeY + container.scrollTop) * newScale / scale - relativeY;
      }
      
      setScale(newScale);
      container.scrollTo(targetScrollX, targetScrollY);
    } else {
      // Reset to default scale
      setScale(DEFAULT_SCALE);
    }
  }, [scale]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch gesture
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      pinchState.current = {
        initialDistance: distance,
        initialScale: scale,
        centerX: center.x,
        centerY: center.y,
      };
    } else if (e.touches.length === 1) {
      // Check for double tap
      const now = Date.now();
      const touch = e.touches[0];
      
      if (lastTap.current) {
        const timeDiff = now - lastTap.current.time;
        const dx = touch.clientX - lastTap.current.x;
        const dy = touch.clientY - lastTap.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (timeDiff < 300 && distance < 50) {
          handleDoubleTap(touch.clientX, touch.clientY);
          lastTap.current = null;
          return;
        }
      }
      
      lastTap.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  }, [scale, handleDoubleTap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      const container = containerRef.current;
      
      if (!container) return;
      
      // Calculate new scale
      const scaleRatio = distance / pinchState.current.initialDistance;
      let newScale = pinchState.current.initialScale * scaleRatio;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      
      // Calculate scroll adjustment to keep pinch center stable
      const rect = container.getBoundingClientRect();
      const relativeX = pinchState.current.centerX - rect.left;
      const relativeY = pinchState.current.centerY - rect.top;
      
      const contentX = (container.scrollLeft + relativeX) / scale;
      const contentY = (container.scrollTop + relativeY) / scale;
      
      setScale(newScale);
      
      // Adjust scroll position
      const newScrollX = contentX * newScale - relativeX;
      const newScrollY = contentY * newScale - relativeY;
      
      container.scrollTo(newScrollX, newScrollY);
    }
  }, [scale]);

  const handleTouchEnd = useCallback(() => {
    pinchState.current = null;
  }, []);

  // Handle wheel zoom (desktop)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;
      
      const delta = -e.deltaY * 0.001;
      let newScale = scale * (1 + delta);
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      
      // Keep pointer position stable
      const contentX = (container.scrollLeft + relativeX) / scale;
      const contentY = (container.scrollTop + relativeY) / scale;
      
      setScale(newScale);
      
      const newScrollX = contentX * newScale - relativeX;
      const newScrollY = contentY * newScale - relativeY;
      
      container.scrollTo(newScrollX, newScrollY);
    }
  }, [scale]);

  // Attach wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-auto",
        className
      )}
      style={{ WebkitOverflowScrolling: "touch" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sizer div reflects scaled content size for proper scrollbars */}
      <div
        style={{
          width: `${100 / scale}%`,
          minWidth: "fit-content",
        }}
      >
        {/* Content container with transform scale */}
        <div
          ref={contentRef}
          className="origin-top-left"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {children}
        </div>
      </div>
      
      {/* Floating zoom controls */}
      <div className={cn(
        "fixed bottom-20 right-4 z-50",
        "flex flex-col gap-1"
      )}>
        {/* Zoom in button */}
        <button
          onClick={handleZoomIn}
          disabled={scale >= MAX_SCALE}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all",
            "bg-white border border-zinc-200 text-zinc-700",
            "hover:bg-zinc-50 hover:text-zinc-900",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300",
            "dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          )}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>

        {/* Zoom level indicator / reset button */}
        <button
          onClick={handleZoomReset}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all",
            "text-xs font-bold",
            scale !== DEFAULT_SCALE
              ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
              : "bg-white border border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
          )}
          aria-label={scale !== DEFAULT_SCALE ? "Reset zoom" : "Zoom level"}
        >
          {scale !== DEFAULT_SCALE ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <span>{Math.round(scale * 100)}%</span>
          )}
        </button>

        {/* Zoom out button */}
        <button
          onClick={handleZoomOut}
          disabled={scale <= MIN_SCALE}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all",
            "bg-white border border-zinc-200 text-zinc-700",
            "hover:bg-zinc-50 hover:text-zinc-900",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300",
            "dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          )}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
      </div>

      {/* Zoom indicator badge - shows when zoomed */}
      {scale !== DEFAULT_SCALE && (
        <div className={cn(
          "fixed bottom-32 right-16 z-50",
          "rounded-full bg-zinc-900/80 px-2 py-1",
          "text-xs font-medium text-white",
          "pointer-events-none",
          "dark:bg-zinc-100/80 dark:text-zinc-900"
        )}>
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}

