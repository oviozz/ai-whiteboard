"use client";

import React, { useEffect, useState } from "react";
import { X, ChevronRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import useTutorHints from "@/app/store/use-tutor-hints";

type CanvasHintProps = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  panOffset: { x: number; y: number };
  zoomLevel: number;
  className?: string;
};

const AUTO_DISMISS_DELAY = 15000; // 15 seconds

export default function CanvasHint({
  canvasRef,
  panOffset,
  zoomLevel,
  className,
}: CanvasHintProps) {
  const { activeHint, dismissHint, expandBubble, proactiveHintsEnabled } = useTutorHints();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  // Only show for quick hints with position
  const shouldShow =
    proactiveHintsEnabled &&
    activeHint?.type === "quick" &&
    activeHint.position &&
    !isDismissing;

  // Animate in when hint appears
  useEffect(() => {
    if (shouldShow) {
      // Small delay for animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow]);

  // Auto-dismiss after delay
  useEffect(() => {
    if (!shouldShow) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_DELAY);

    return () => clearTimeout(timer);
  }, [shouldShow, activeHint?.timestamp]);

  const handleDismiss = () => {
    setIsDismissing(true);
    setIsVisible(false);
    // Wait for animation to complete
    setTimeout(() => {
      dismissHint();
      setIsDismissing(false);
    }, 200);
  };

  const handleShowMore = () => {
    expandBubble();
  };

  if (!shouldShow || !activeHint?.position) {
    return null;
  }

  // Calculate screen position from world coordinates
  const canvas = canvasRef.current;
  if (!canvas) return null;

  const screenX = activeHint.position.x * zoomLevel + panOffset.x;
  const screenY = activeHint.position.y * zoomLevel + panOffset.y;

  // Keep hint within bounds
  const hintWidth = 240;
  const hintHeight = 80;
  const padding = 16;

  const canvasRect = canvas.getBoundingClientRect();
  const maxX = canvasRect.width - hintWidth - padding;
  const maxY = canvasRect.height - hintHeight - padding;

  const constrainedX = Math.max(padding, Math.min(screenX + 20, maxX));
  const constrainedY = Math.max(padding, Math.min(screenY - hintHeight - 10, maxY));

  return (
    <div
      className={cn(
        "absolute z-40 pointer-events-auto",
        "transition-all duration-200 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        className
      )}
      style={{
        left: constrainedX,
        top: constrainedY,
        maxWidth: hintWidth,
      }}
    >
      <div className="bg-white border-2 border-amber-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-700">Quick Hint</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded hover:bg-amber-100 transition-colors"
            aria-label="Dismiss hint"
          >
            <X className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-3 py-2">
          <p className="text-sm text-slate-700 leading-snug">{activeHint.content}</p>
        </div>

        {/* Footer */}
        <div className="px-2 py-1.5 border-t border-slate-100 bg-slate-50">
          <button
            onClick={handleShowMore}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <span>Need more help?</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Pointer arrow */}
      <div
        className="absolute w-3 h-3 bg-white border-l-2 border-b-2 border-amber-200 transform rotate-[-45deg]"
        style={{
          bottom: -7,
          left: 20,
        }}
      />
    </div>
  );
}

