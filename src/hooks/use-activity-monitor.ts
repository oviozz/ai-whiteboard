"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ActivityState = "active" | "idle" | "stuck";

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

