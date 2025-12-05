"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  X,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  GripHorizontal,
  Play,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import useTutorHints, { VideoSuggestion } from "@/app/store/use-tutor-hints";
import { useTldrawEditor } from "@/contexts/tldraw-editor-context";
import { useTldrawActivityMonitor } from "@/hooks/use-activity-monitor";

type CanvasHintProps = {
  className?: string;
};

const AUTO_DISMISS_DELAY = 30000; // 30 seconds

export default function CanvasHint({
  className,
}: CanvasHintProps) {
  const {
    activeHint,
    currentStatus,
    dismissHint,
    expandBubble,
    proactiveHintsEnabled,
    videos,
  } = useTutorHints();
  const { editor } = useTldrawEditor();
  
  // Track last edit position for hint placement
  const { lastEditPosition } = useTldrawActivityMonitor({
    editor,
    enabled: proactiveHintsEnabled,
  });
  
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [customPosition, setCustomPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Video state - track if video was opened
  const [videoOpened, setVideoOpened] = useState(false);

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
      // Reset custom position when new hint appears
      setCustomPosition(null);
      setVideoOpened(false);
      // Small delay for animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow, activeHint?.timestamp]);

  // Auto-dismiss after delay
  useEffect(() => {
    if (!shouldShow) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_DELAY);

    return () => clearTimeout(timer);
  }, [shouldShow, activeHint?.timestamp]);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!cardRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = cardRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      setCustomPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    },
    [isDragging, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDismiss = () => {
    setIsDismissing(true);
    setIsVisible(false);
    // Wait for animation to complete
    setTimeout(() => {
      dismissHint();
      setIsDismissing(false);
      setCustomPosition(null);
    }, 200);
  };

  const handleShowMore = () => {
    expandBubble();
  };

  const handleOpenVideo = (video: VideoSuggestion) => {
    setVideoOpened(true);
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(
        video.searchQuery
      )}`,
      "_blank"
    );
  };

  if (!shouldShow) {
    return null;
  }

  // Get position - prefer custom position, then hint position, fallback to lastEditPosition
  const hintWorldPosition = activeHint?.position || lastEditPosition;

  if (!hintWorldPosition && !customPosition) {
    return null;
  }

  // Calculate screen position
  let baseX: number;
  let baseY: number;

  if (customPosition) {
    baseX = customPosition.x;
    baseY = customPosition.y;
  } else if (editor && hintWorldPosition) {
    const screenPoint = editor.pageToViewport({
      x: hintWorldPosition.x,
      y: hintWorldPosition.y,
    });
    baseX = screenPoint.x + 30;
    baseY = screenPoint.y - 60;
  } else if (hintWorldPosition) {
    // Fallback: use world position directly (approximate)
    baseX = hintWorldPosition.x + 30;
    baseY = hintWorldPosition.y - 60;
  } else {
    return null;
  }

  // Constrain to viewport (only for initial position, not during drag)
  const padding = 20;
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;

  const constrainedX = customPosition
    ? baseX
    : Math.max(padding, Math.min(baseX, viewportWidth - 320 - padding));
  const constrainedY = customPosition
    ? baseY
    : Math.max(padding, Math.min(baseY, viewportHeight - 200 - padding));

  // Get relevant video if available
  const relevantVideo = videos.length > 0 ? videos[0] : null;

  return (
    <div
      ref={cardRef}
      className={cn(
        "fixed z-50 pointer-events-auto",
        "transition-all ease-out",
        isDragging ? "cursor-grabbing duration-0" : "duration-300",
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-2 scale-95",
        className
      )}
      style={{
        left: constrainedX,
        top: constrainedY,
        maxWidth: 300,
      }}
    >
      <div
        className={cn(
          "rounded-xl overflow-hidden shadow-xl",
          "border-2",
          isError ? "bg-red-50 border-red-300" : "bg-white border-amber-300"
        )}
      >
        {/* Drag Handle + Header */}
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 border-b",
            isError
              ? "bg-red-100 border-red-200"
              : "bg-amber-50 border-amber-200",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-slate-400" />
            {isError ? (
              <>
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">
                  Check This
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">
                  Quick Hint
                </span>
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
          <p
            className={cn(
              "text-sm leading-relaxed",
              isError ? "text-red-800" : "text-slate-700"
            )}
          >
            {activeHint?.content}
          </p>

          {/* Video Suggestion (when available) */}
          {relevantVideo && (
            <div className="mt-3 p-2.5 bg-gradient-to-r from-red-50 to-slate-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2.5">
                <button
                  onClick={() => handleOpenVideo(relevantVideo)}
                  className="w-12 h-12 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                >
                  <Play className="w-6 h-6 text-white fill-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 line-clamp-2">
                    {relevantVideo.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {relevantVideo.relevanceReason}
                  </p>
                  <button
                    onClick={() => handleOpenVideo(relevantVideo)}
                    className={cn(
                      "mt-1.5 text-xs font-medium flex items-center gap-1 transition-colors",
                      videoOpened
                        ? "text-green-600"
                        : "text-red-600 hover:text-red-700"
                    )}
                  >
                    {videoOpened ? (
                      "Opened in new tab ✓"
                    ) : (
                      <>
                        Watch on YouTube
                        <ExternalLink className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={cn(
            "px-3 py-2 border-t",
            isError
              ? "border-red-200 bg-red-50"
              : "border-slate-100 bg-slate-50"
          )}
        >
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

      {/* Pointer arrow pointing to the left (toward the edit location) - only when not dragged */}
      {!customPosition && (
        <div
          className={cn(
            "absolute w-4 h-4 transform rotate-45",
            isError
              ? "bg-red-50 border-l-2 border-b-2 border-red-300"
              : "bg-white border-l-2 border-b-2 border-amber-300"
          )}
          style={{
            left: -8,
            top: 40,
          }}
        />
      )}
    </div>
  );
}
