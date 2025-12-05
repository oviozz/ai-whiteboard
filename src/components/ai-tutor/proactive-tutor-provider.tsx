"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useTldrawEditor } from "@/contexts/tldraw-editor-context";
import useTutorHints from "@/app/store/use-tutor-hints";
import { useTldrawScreenshot } from "@/hooks/use-tldraw-screenshot";
import { getCanvasContext } from "@/lib/agent";
import { Id } from "../../../convex/_generated/dataModel";

type ProactiveTutorProviderProps = {
  whiteboardID: Id<"whiteboards">;
  children: React.ReactNode;
};

// Extract only meaningful visual properties from shapes for stable hashing
function extractStableShapeData(shapes: unknown[]): string {
  if (shapes.length === 0) return "empty";
  
  // Extract only properties that represent actual content changes
  const stableData = (shapes as Array<Record<string, unknown>>).map(shape => {
    // Only include properties that matter for content comparison
    return {
      type: shape.type,
      x: Math.round((shape.x as number) || 0),
      y: Math.round((shape.y as number) || 0),
      w: shape.props && typeof shape.props === 'object' ? Math.round((shape.props as Record<string, unknown>).w as number || 0) : 0,
      h: shape.props && typeof shape.props === 'object' ? Math.round((shape.props as Record<string, unknown>).h as number || 0) : 0,
      // For text shapes, include the text content
      text: shape.props && typeof shape.props === 'object' ? (shape.props as Record<string, unknown>).text : undefined,
      // For draw shapes, include simplified points (just count)
      pointCount: shape.props && typeof shape.props === 'object' && Array.isArray((shape.props as Record<string, unknown>).segments) 
        ? ((shape.props as Record<string, unknown>).segments as unknown[]).length 
        : undefined,
    };
  });
  
  return JSON.stringify(stableData);
}

// Generate a simple hash from canvas state for change detection
function generateCanvasHash(shapes: unknown[]): string {
  const stableData = extractStableShapeData(shapes);
  if (stableData === "empty") return "empty";
  
  // Create a simple hash from stable shape data
  let hash = 0;
  for (let i = 0; i < stableData.length; i++) {
    const char = stableData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * ProactiveTutorProvider - Monitors canvas changes and triggers AI review
 * 
 * Smart interval checking:
 * - Checks at regular intervals (default 12 seconds)
 * - Skips if canvas is empty
 * - Skips if no changes since last check
 * - Sends canvas screenshot + context to review API
 */
export default function ProactiveTutorProvider({
  whiteboardID: _whiteboardID,
  children,
}: ProactiveTutorProviderProps) {
  const { editor } = useTldrawEditor();
  const { captureScreenshot } = useTldrawScreenshot();
  
  const {
    proactiveHintsEnabled,
    isCheckingEnabled,
    checkIntervalMs,
    isAnalyzing,
    shouldCheck,
    updateCheckState,
    setAnalyzing,
    setAnalysisResult,
    setAnalysisError,
    setVideos,
  } = useTutorHints();

  // Refs for interval management
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Perform the actual review check
  const performCheck = useCallback(async () => {
    if (!editor) return;

    try {
      // Get current canvas state
      const context = getCanvasContext(editor);
      const shapeCount = context.shapes.length;
      const currentHash = generateCanvasHash(context.shapes);

      // Check if we should actually run the analysis
      if (!shouldCheck(currentHash, shapeCount)) {
        return;
      }

      // Start analyzing
      setAnalyzing(true);

      // Cancel any previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Capture screenshot
      let screenshotBase64: string | undefined;
      try {
        const blob = await captureScreenshot();
        if (blob) {
          const reader = new FileReader();
          screenshotBase64 = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("Screenshot capture failed:", e);
      }

      // Get viewport bounds
      const viewport = editor.getViewportPageBounds();

      // Call review API
      const response = await fetch("/api/whiteboard/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shapes: context.shapes,
          viewportBounds: {
            x: viewport.x,
            y: viewport.y,
            w: viewport.w,
            h: viewport.h,
          },
          screenshot: screenshotBase64,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Review API error: ${response.status}`);
      }

      const result = await response.json();

      // Update check state (prevents re-checking unchanged content)
      updateCheckState(currentHash, shapeCount);

      // Process the result
      if (result.status === "needs_help" || result.status === "error") {
        // Set video suggestion if available
        if (result.video) {
          setVideos([result.video]);
        }
        
        // Show hint if there's something to help with
        if (result.hint) {
          // Determine position for hint (near the problematic area if provided)
          const position = result.position || undefined;
          
          if (result.hintType === "detailed") {
            // For detailed hints, use the full bubble UI
            setAnalysisResult(
              result.status === "error" ? "wrong" : "stuck",
              {
                type: "detailed",
                content: result.hint,
                timestamp: Date.now(),
              }
            );
          } else {
            // For quick hints, pass the hint to setAnalysisResult to avoid race condition
            // (Previously showQuickHint was called then setAnalysisResult which cleared the hint)
            setAnalysisResult(
              result.status === "error" ? "wrong" : "stuck",
              {
                type: "quick",
                content: result.hint,
                position,
                timestamp: Date.now(),
              }
            );
          }
        }
      } else if (result.status === "correct" || result.status === "on_track") {
        // Everything looks good - just update status
        setAnalysisResult(result.status);
        // Clear any previous videos
        setVideos([]);
      } else {
        // No issues found
        setAnalysisResult("on_track");
        setVideos([]);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Request was cancelled - reset analyzing state
        setAnalyzing(false);
        return;
      }
      console.error("Review check error:", error);
      setAnalysisError((error as Error).message);
    } finally {
      // Always ensure we're not stuck in analyzing state
      // The setAnalysisResult/setAnalysisError should handle this,
      // but this is a safety net
      setTimeout(() => {
        const { isAnalyzing: stillAnalyzing } = useTutorHints.getState();
        if (stillAnalyzing) {
          setAnalyzing(false);
        }
      }, 30000); // Safety timeout after 30s
    }
  }, [
    editor,
    captureScreenshot,
    shouldCheck,
    updateCheckState,
    setAnalyzing,
    setAnalysisResult,
    setAnalysisError,
    setVideos,
  ]);

  // Set up interval checking
  useEffect(() => {
    if (!proactiveHintsEnabled || !isCheckingEnabled || !editor) {
      // Clear interval if disabled
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Run check at intervals - but only if not already analyzing
    checkIntervalRef.current = setInterval(() => {
      // Double-check we're not already analyzing before performing check
      const { isAnalyzing: currentlyAnalyzing } = useTutorHints.getState();
      if (!currentlyAnalyzing) {
        performCheck();
      }
    }, checkIntervalMs);

    // Initial check after canvas has had time to load and user has started working
    // Use a longer delay to avoid checking empty/loading canvas
    const initialTimer = setTimeout(() => {
      const { isAnalyzing: currentlyAnalyzing } = useTutorHints.getState();
      if (!currentlyAnalyzing) {
        performCheck();
      }
    }, 5000); // Wait 5 seconds before first check

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      clearTimeout(initialTimer);
      abortControllerRef.current?.abort();
    };
  }, [
    proactiveHintsEnabled,
    isCheckingEnabled,
    checkIntervalMs,
    editor,
    performCheck,
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return <>{children}</>;
}
