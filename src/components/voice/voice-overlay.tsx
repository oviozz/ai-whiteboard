"use client";

import React, { useEffect, useCallback } from "react";
import { Mic, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import useVoiceState from "@/app/store/use-voice-state";

type VoiceOverlayProps = {
  onSend: (transcript: string) => void;
  onClose: () => void;
};

/**
 * Minimal voice indicator
 * Shows in top right when voice mode is active - just listening state with wave
 */
export default function VoiceOverlay({ onSend, onClose }: VoiceOverlayProps) {
  const {
    isVoiceEnabled,
    voiceState,
    transcript,
    interimTranscript,
    error,
    clearTranscript,
  } = useVoiceState();

  // Handle send
  const handleSend = useCallback(() => {
    const text = transcript || interimTranscript;
    if (text?.trim()) {
      onSend(text.trim());
      clearTranscript();
    }
    onClose();
  }, [transcript, interimTranscript, onSend, clearTranscript, onClose]);

  // Expose handleSend for keyboard shortcut
  useEffect(() => {
    (
      window as unknown as { __voiceOverlaySend: () => void }
    ).__voiceOverlaySend = handleSend;
    return () => {
      delete (window as unknown as { __voiceOverlaySend?: () => void })
        .__voiceOverlaySend;
    };
  }, [handleSend]);

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isVoiceEnabled) {
    return null;
  }

  return (
    <div
      className={cn(
        // Position near the voice button (right side, vertically centered but offset up)
        "fixed top-[calc(50%-80px)] right-16 z-[60]",
        "flex items-center gap-2",
        "bg-white/95 backdrop-blur-sm rounded-full",
        "border border-slate-200 shadow-lg",
        "px-3 py-2",
        "animate-in slide-in-from-right-2 fade-in duration-200"
      )}
    >
      {/* Mic icon */}
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center",
          voiceState === "listening" && "bg-red-500",
          voiceState === "processing" && "bg-orange-500",
          voiceState === "error" && "bg-red-600",
          voiceState === "idle" && "bg-slate-400"
        )}
      >
        {voiceState === "processing" ? (
          <Loader2 className="w-3 h-3 text-white animate-spin" />
        ) : (
          <Mic className="w-3 h-3 text-white" />
        )}
      </div>

      {/* Sound wave or status */}
      {voiceState === "listening" ? (
        <div className="flex items-end gap-0.5 h-4">
          {[...Array(5)].map((_, i) => {
            const heights = [8, 14, 10, 16, 12];
            return (
              <div
                key={i}
                className="w-0.5 bg-red-400 rounded-full animate-bounce"
                style={{
                  animationDelay: `${i * 0.08}s`,
                  animationDuration: "0.4s",
                  height: `${heights[i]}px`,
                }}
              />
            );
          })}
        </div>
      ) : (
        <span className="text-xs text-slate-500">
          {voiceState === "processing" && "Sending..."}
          {voiceState === "error" && "Error"}
        </span>
      )}

      {/* Keyboard hint */}
      <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[9px] text-slate-400">
        ⌘⇧A
      </kbd>

      {/* Close button */}
      <button
        onClick={onClose}
        className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
