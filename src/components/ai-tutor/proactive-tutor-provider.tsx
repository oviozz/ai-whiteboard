"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import useActivityMonitor, { useAutoActivityTracking, ActivityState } from "@/hooks/use-activity-monitor";
import useTutorHints, { AnalysisStatus, TutorHint } from "@/app/store/use-tutor-hints";
import useScreenshot from "@/hooks/use-screenshot";
import FloatingBubble from "./floating-bubble";
import CanvasHint from "./canvas-hint";
import { useCelebration } from "./celebration";

type ProactiveTutorProviderProps = {
  whiteboardID: Id<"whiteboards">;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  panOffset: { x: number; y: number };
  zoomLevel: number;
  children: React.ReactNode;
};

// Configuration
const IDLE_THRESHOLD_MS = 30000; // 30 seconds idle before first analysis
const STUCK_THRESHOLD_MS = 90000; // 90 seconds before considered stuck
const PERIODIC_ANALYSIS_INTERVAL_MS = 60000; // Check every 60 seconds when active
const MIN_ANALYSIS_INTERVAL_MS = 30000; // Minimum 30 seconds between analyses
const DEBOUNCE_MS = 2000; // Wait 2 seconds after activity stops

export default function ProactiveTutorProvider({
  whiteboardID,
  canvasRef,
  panOffset,
  zoomLevel,
  children,
}: ProactiveTutorProviderProps) {
  const { screenshotBlog } = useScreenshot();
  const generateUploadUrl = useMutation(api.whiteboardActions.generateUploadUrl);
  const analyzeProgress = useAction(api.ai.analyzeWhiteboardProgress);

  const {
    proactiveHintsEnabled,
    isAnalyzing,
    lastAnalysisTime,
    setAnalyzing,
    setAnalysisResult,
    setAnalysisError,
    showQuickHint,
    showDetailedHint,
  } = useTutorHints();

  const lastAnalysisRef = useRef<number>(0);
  const periodicCheckRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | null>(null);

  // Celebration hook
  const { celebrate, CelebrationComponent } = useCelebration();

  // Activity monitoring callbacks
  const handleStateChange = useCallback((state: ActivityState) => {
    console.log("[ProactiveTutor] Activity state changed:", state);
  }, []);

  const handleIdle = useCallback(() => {
    console.log("[ProactiveTutor] User went idle, scheduling analysis...");
    scheduleAnalysis("idle");
  }, []);

  const handleStuck = useCallback(() => {
    console.log("[ProactiveTutor] User appears stuck, triggering analysis...");
    scheduleAnalysis("stuck");
  }, []);

  // Setup activity monitor
  const {
    activityState,
    idleTime,
    recordActivity,
  } = useActivityMonitor({
    idleThreshold: IDLE_THRESHOLD_MS,
    stuckThreshold: STUCK_THRESHOLD_MS,
    onStateChange: handleStateChange,
    onIdle: handleIdle,
    onStuck: handleStuck,
    enabled: proactiveHintsEnabled,
  });

  // Auto-track DOM events for activity
  useAutoActivityTracking(recordActivity, proactiveHintsEnabled);

  // Schedule an analysis with debouncing
  const scheduleAnalysis = useCallback((trigger: "idle" | "stuck" | "periodic") => {
    if (!proactiveHintsEnabled || isAnalyzing) return;

    // Check minimum interval
    const now = Date.now();
    const timeSinceLastAnalysis = now - lastAnalysisRef.current;
    if (timeSinceLastAnalysis < MIN_ANALYSIS_INTERVAL_MS) {
      console.log("[ProactiveTutor] Skipping analysis - too soon since last");
      return;
    }

    // Clear any existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the analysis
    const delay = trigger === "stuck" ? 0 : DEBOUNCE_MS;
    debounceRef.current = setTimeout(() => {
      runAnalysis(trigger);
    }, delay);
  }, [proactiveHintsEnabled, isAnalyzing]);

  // Run the actual analysis
  const runAnalysis = useCallback(async (trigger: string) => {
    if (!proactiveHintsEnabled || isAnalyzing) return;

    console.log("[ProactiveTutor] Running analysis, trigger:", trigger);
    setAnalyzing(true);
    lastAnalysisRef.current = Date.now();

    try {
      // Take screenshot
      const screenshotBlob = await screenshotBlog();
      
      // Upload screenshot
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, { method: "POST", body: screenshotBlob });
      
      if (!uploadResult.ok) {
        throw new Error(`Screenshot upload failed: ${uploadResult.statusText}`);
      }
      
      const { storageId } = await uploadResult.json();

      // Call analysis action
      const result = await analyzeProgress({
        whiteboardID,
        screenshotStorageId: storageId,
        activityState,
        idleTimeMs: idleTime,
      });

      if (result.success && result.analysis) {
        const { status, briefHint, detailedGuidance, hintType } = result.analysis;
        
        let hint: TutorHint | undefined;
        
        if (hintType === "quick" && briefHint) {
          // For quick hints, try to position near center of canvas
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const worldX = (rect.width / 2 - panOffset.x) / zoomLevel;
            const worldY = (rect.height / 3 - panOffset.y) / zoomLevel;
            hint = {
              type: "quick",
              content: briefHint,
              position: { x: worldX, y: worldY },
              timestamp: Date.now(),
            };
          }
        } else if (hintType === "detailed" && (detailedGuidance || briefHint)) {
          hint = {
            type: "detailed",
            content: detailedGuidance || briefHint || "",
            timestamp: Date.now(),
          };
        }

        setAnalysisResult(status as AnalysisStatus, hint);
        console.log("[ProactiveTutor] Analysis complete:", status, hintType);

        // Celebrate if status improved to correct
        if (
          status === "correct" &&
          previousStatusRef.current !== "correct" &&
          previousStatusRef.current !== null
        ) {
          celebrate("confetti", "You got it right!");
        }
        previousStatusRef.current = status;
      } else {
        console.error("[ProactiveTutor] Analysis failed:", result.error);
        setAnalysisError(result.error || "Analysis failed");
      }
    } catch (error) {
      console.error("[ProactiveTutor] Analysis error:", error);
      setAnalysisError(error instanceof Error ? error.message : "Unknown error");
    }
  }, [
    proactiveHintsEnabled,
    isAnalyzing,
    whiteboardID,
    activityState,
    idleTime,
    panOffset,
    zoomLevel,
    canvasRef,
    setAnalyzing,
    setAnalysisResult,
    setAnalysisError,
    screenshotBlog,
    generateUploadUrl,
    analyzeProgress,
  ]);

  // Periodic analysis when user is active
  useEffect(() => {
    if (!proactiveHintsEnabled) {
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
        periodicCheckRef.current = null;
      }
      return;
    }

    periodicCheckRef.current = setInterval(() => {
      if (activityState === "active") {
        scheduleAnalysis("periodic");
      }
    }, PERIODIC_ANALYSIS_INTERVAL_MS);

    return () => {
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
        periodicCheckRef.current = null;
      }
    };
  }, [proactiveHintsEnabled, activityState, scheduleAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
      }
    };
  }, []);

  return (
    <>
      {children}
      
      {/* Floating AI Bubble */}
      <FloatingBubble />
      
      {/* Canvas Quick Hint Overlay */}
      <CanvasHint
        canvasRef={canvasRef}
        panOffset={panOffset}
        zoomLevel={zoomLevel}
      />

      {/* Celebration Animation */}
      <CelebrationComponent />
    </>
  );
}

