"use client";

import React, { useEffect, useState } from "react";
import { X, ChevronRight, Lightbulb, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import useTutorHints from "@/app/store/use-tutor-hints";
import { useTldrawEditor } from "@/contexts/tldraw-editor-context";
import { LastEditPosition } from "@/hooks/use-activity-monitor";

type CanvasHintProps = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  panOffset: { x: number; y: number };
  zoomLevel: number;
  lastEditPosition?: LastEditPosition | null;
  className?: string;
};

const AUTO_DISMISS_DELAY = 20000; // 20 seconds

export default function CanvasHint({
  canvasRef,
  panOffset,
  zoomLevel,
  lastEditPosition,
  className,
}: CanvasHintProps) {
  const { activeHint, currentStatus, dismissHint, expandBubble, proactiveHintsEnabled } = useTutorHints();
  const { editor } = useTldrawEditor();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  // Determine if this is an error hint
  const isError = currentStatus === "wrong";

  // Only show for quick hints with position
  const shouldShow =
    proactiveHintsEnabled &&
    activeHint?.type === "quick" &&
    (activeHint.position || lastEditPosition) &&
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

  if (!shouldShow) {
    return null;
  }

  // Get position - prefer hint position, fallback to lastEditPosition
  const hintWorldPosition = activeHint?.position || lastEditPosition;
  
  if (!hintWorldPosition) {
    return null;
  }

  // Calculate screen position from world coordinates using tldraw editor
  let screenX: number;
  let screenY: number;

  if (editor) {
    // Use tldraw's coordinate conversion
    const screenPoint = editor.pageToViewport({ x: hintWorldPosition.x, y: hintWorldPosition.y });
    screenX = screenPoint.x;
    screenY = screenPoint.y;
  } else {
    // Fallback to manual calculation
    screenX = hintWorldPosition.x * zoomLevel + panOffset.x;
    screenY = hintWorldPosition.y * zoomLevel + panOffset.y;
  }

  // Hint dimensions - larger and more prominent
  const hintWidth = 280;
  const hintHeight = 120;
  const padding = 20;

  // Get viewport bounds
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const maxX = viewportWidth - hintWidth - padding;
  const maxY = viewportHeight - hintHeight - padding;

  // Position hint to the right and slightly above the edit position
  const constrainedX = Math.max(padding, Math.min(screenX + 30, maxX));
  const constrainedY = Math.max(padding, Math.min(screenY - hintHeight / 2, maxY));

  return (
    <div
      className={cn(
        "fixed z-50 pointer-events-auto",
        "transition-all duration-300 ease-out",
        isVisible 
          ? "opacity-100 translate-y-0 scale-100" 
          : "opacity-0 translate-y-2 scale-95",
        className
      )}
      style={{
        left: constrainedX,
        top: constrainedY,
        maxWidth: hintWidth,
      }}
    >
      <div className={cn(
        "rounded-xl overflow-hidden shadow-xl",
        "border-2",
        isError 
          ? "bg-red-50 border-red-300" 
          : "bg-white border-amber-300"
      )}>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-3 py-2 border-b",
          isError 
            ? "bg-red-100 border-red-200" 
            : "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-center gap-2">
            {isError ? (
              <>
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">Check This</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">Quick Hint</span>
              </>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className={cn(
              "p-1 rounded-lg transition-colors",
              isError 
                ? "hover:bg-red-200 text-red-500" 
                : "hover:bg-amber-100 text-amber-500"
            )}
            aria-label="Dismiss hint"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className={cn(
            "text-sm leading-relaxed",
            isError ? "text-red-800" : "text-slate-700"
          )}>
            {activeHint?.content}
          </p>
        </div>

        {/* Footer */}
        <div className={cn(
          "px-3 py-2 border-t",
          isError 
            ? "border-red-200 bg-red-50" 
            : "border-slate-100 bg-slate-50"
        )}>
          <button
            onClick={handleShowMore}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium transition-colors",
              isError 
                ? "text-red-600 hover:text-red-700" 
                : "text-indigo-600 hover:text-indigo-700"
            )}
          >
            <span>Need more help?</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pointer arrow pointing to the left (toward the edit location) */}
      <div
        className={cn(
          "absolute w-4 h-4 transform rotate-45",
          isError 
            ? "bg-red-50 border-l-2 border-b-2 border-red-300" 
            : "bg-white border-l-2 border-b-2 border-amber-300"
        )}
        style={{
          left: -8,
          top: hintHeight / 2 - 8,
        }}
      />
    </div>
  );
}
