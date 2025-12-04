"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor, TLShapeId } from "tldraw";

export type ActivityState = "active" | "idle" | "stuck";
export type DrawingState = "drawing" | "paused" | "idle";

type ActivityMonitorConfig = {
  idleThreshold?: number; // Time in ms before considered idle (default: 30000)
  stuckThreshold?: number; // Time in ms of idle before considered stuck (default: 90000)
  onStateChange?: (state: ActivityState) => void;
  onIdle?: () => void;
  onStuck?: () => void;
  onActive?: () => void;
  enabled?: boolean;
};

type ActivityMonitorReturn = {
  activityState: ActivityState;
  lastActivityTime: number;
  idleTime: number;
  recordActivity: () => void;
  reset: () => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
};

const DEFAULT_IDLE_THRESHOLD = 30000; // 30 seconds
const DEFAULT_STUCK_THRESHOLD = 90000; // 90 seconds

export default function useActivityMonitor(
  config: ActivityMonitorConfig = {}
): ActivityMonitorReturn {
  const {
    idleThreshold = DEFAULT_IDLE_THRESHOLD,
    stuckThreshold = DEFAULT_STUCK_THRESHOLD,
    onStateChange,
    onIdle,
    onStuck,
    onActive,
    enabled: initialEnabled = true,
  } = config;

  const [activityState, setActivityState] = useState<ActivityState>("active");
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [idleTime, setIdleTime] = useState(0);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);

  const previousStateRef = useRef<ActivityState>("active");
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Record user activity
  const recordActivity = useCallback(() => {
    if (!isEnabled) return;
    
    const now = Date.now();
    setLastActivityTime(now);
    setIdleTime(0);
    
    if (activityState !== "active") {
      setActivityState("active");
    }
  }, [isEnabled, activityState]);

  // Reset the monitor
  const reset = useCallback(() => {
    setActivityState("active");
    setLastActivityTime(Date.now());
    setIdleTime(0);
    previousStateRef.current = "active";
  }, []);

  // Enable/disable monitoring
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled) {
      reset();
    }
  }, [reset]);

  // Check activity state periodically
  useEffect(() => {
    if (!isEnabled) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkActivity = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;
      setIdleTime(timeSinceActivity);

      let newState: ActivityState = "active";

      if (timeSinceActivity >= stuckThreshold) {
        newState = "stuck";
      } else if (timeSinceActivity >= idleThreshold) {
        newState = "idle";
      }

      if (newState !== activityState) {
        setActivityState(newState);
      }
    };

    // Check every second
    checkIntervalRef.current = setInterval(checkActivity, 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isEnabled, lastActivityTime, idleThreshold, stuckThreshold, activityState]);

  // Handle state change callbacks
  useEffect(() => {
    if (activityState !== previousStateRef.current) {
      const prevState = previousStateRef.current;
      previousStateRef.current = activityState;

      // Call state change callback
      onStateChange?.(activityState);

      // Call specific callbacks
      if (activityState === "active" && prevState !== "active") {
        onActive?.();
      } else if (activityState === "idle" && prevState === "active") {
        onIdle?.();
      } else if (activityState === "stuck" && prevState !== "stuck") {
        onStuck?.();
      }
    }
  }, [activityState, onStateChange, onIdle, onStuck, onActive]);

  return {
    activityState,
    lastActivityTime,
    idleTime,
    recordActivity,
    reset,
    setEnabled,
    isEnabled,
  };
}

// Helper hook to automatically track common DOM events
export function useAutoActivityTracking(
  recordActivity: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const events = [
      "mousedown",
      "mousemove", 
      "keydown",
      "touchstart",
      "touchmove",
      "wheel",
      "pointerdown",
    ];

    // Throttle the activity recording to avoid excessive calls
    let lastRecordTime = 0;
    const throttleMs = 500;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastRecordTime > throttleMs) {
        lastRecordTime = now;
        recordActivity();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [recordActivity, enabled]);
}

// ============================================
// TLDraw-Specific Activity Monitor
// ============================================

export type LastEditPosition = {
  x: number;
  y: number;
  shapeId?: TLShapeId;
};

type TldrawActivityConfig = {
  editor: Editor | null;
  pauseThreshold?: number; // Time in ms after drawing stops to trigger "paused" (default: 2000)
  idleThreshold?: number; // Time in ms after pause to trigger "idle" (default: 10000)
  onDrawingPause?: (position: LastEditPosition | null) => void;
  onDrawingIdle?: () => void;
  onDrawingStart?: () => void;
  enabled?: boolean;
};

type TldrawActivityReturn = {
  drawingState: DrawingState;
  lastEditPosition: LastEditPosition | null;
  timeSinceLastEdit: number;
  isDrawing: boolean;
  hasRecentActivity: boolean;
};

const DEFAULT_PAUSE_THRESHOLD = 2000; // 2 seconds
const DEFAULT_IDLE_THRESHOLD_TLDRAW = 10000; // 10 seconds

/**
 * Hook that monitors tldraw editor activity specifically
 * - Detects when user stops drawing/editing (2s pause)
 * - Tracks the position of the last edited shape for hint placement
 * - More precise than generic DOM event monitoring
 */
export function useTldrawActivityMonitor(
  config: TldrawActivityConfig
): TldrawActivityReturn {
  const {
    editor,
    pauseThreshold = DEFAULT_PAUSE_THRESHOLD,
    idleThreshold = DEFAULT_IDLE_THRESHOLD_TLDRAW,
    onDrawingPause,
    onDrawingIdle,
    onDrawingStart,
    enabled = true,
  } = config;

  const [drawingState, setDrawingState] = useState<DrawingState>("idle");
  const [lastEditPosition, setLastEditPosition] = useState<LastEditPosition | null>(null);
  const [timeSinceLastEdit, setTimeSinceLastEdit] = useState(0);
  const [lastEditTime, setLastEditTime] = useState<number>(0);

  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStateRef = useRef<DrawingState>("idle");
  const wasDrawingRef = useRef(false);

  // Get the center position of a shape
  const getShapePosition = useCallback((shapeId: TLShapeId): LastEditPosition | null => {
    if (!editor) return null;
    
    const bounds = editor.getShapePageBounds(shapeId);
    if (!bounds) return null;
    
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      shapeId,
    };
  }, [editor]);

  // Handle drawing activity detected
  const handleDrawingActivity = useCallback((changedShapeIds: TLShapeId[]) => {
    if (!enabled) return;
    
    const now = Date.now();
    setLastEditTime(now);
    setTimeSinceLastEdit(0);

    // Get position of the most recently changed shape
    if (changedShapeIds.length > 0) {
      const lastShapeId = changedShapeIds[changedShapeIds.length - 1];
      const position = getShapePosition(lastShapeId);
      if (position) {
        setLastEditPosition(position);
      }
    }

    // Transition to drawing state
    if (drawingState !== "drawing") {
      setDrawingState("drawing");
    }

    // Clear existing timeouts
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // Set pause timeout (triggers after user stops for pauseThreshold ms)
    pauseTimeoutRef.current = setTimeout(() => {
      setDrawingState("paused");
    }, pauseThreshold);

    // Set idle timeout (triggers after longer inactivity)
    idleTimeoutRef.current = setTimeout(() => {
      setDrawingState("idle");
    }, idleThreshold);
  }, [enabled, drawingState, pauseThreshold, idleThreshold, getShapePosition]);

  // Subscribe to tldraw store changes
  useEffect(() => {
    if (!editor || !enabled) return;

    const unsubscribe = editor.store.listen(
      (entry) => {
        // Get the changed shape IDs from the store update
        const changedShapeIds: TLShapeId[] = [];
        
        for (const record of Object.values(entry.changes.added)) {
          if (record.typeName === 'shape') {
            changedShapeIds.push(record.id as TLShapeId);
          }
        }
        
        for (const [, to] of Object.values(entry.changes.updated)) {
          if (to.typeName === 'shape') {
            changedShapeIds.push(to.id as TLShapeId);
          }
        }

        if (changedShapeIds.length > 0) {
          handleDrawingActivity(changedShapeIds);
        }
      },
      { scope: 'document', source: 'user' }
    );

    return () => {
      unsubscribe();
    };
  }, [editor, enabled, handleDrawingActivity]);

  // Track time since last edit
  useEffect(() => {
    if (!enabled || lastEditTime === 0) return;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastEditTime;
      setTimeSinceLastEdit(elapsed);
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, lastEditTime]);

  // Handle state change callbacks
  useEffect(() => {
    if (drawingState !== previousStateRef.current) {
      const prevState = previousStateRef.current;
      previousStateRef.current = drawingState;

      if (drawingState === "drawing" && prevState !== "drawing") {
        wasDrawingRef.current = true;
        onDrawingStart?.();
      } else if (drawingState === "paused" && wasDrawingRef.current) {
        onDrawingPause?.(lastEditPosition);
      } else if (drawingState === "idle" && prevState !== "idle") {
        onDrawingIdle?.();
        wasDrawingRef.current = false;
      }
    }
  }, [drawingState, lastEditPosition, onDrawingPause, onDrawingIdle, onDrawingStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    drawingState,
    lastEditPosition,
    timeSinceLastEdit,
    isDrawing: drawingState === "drawing",
    hasRecentActivity: timeSinceLastEdit < pauseThreshold,
  };
}

