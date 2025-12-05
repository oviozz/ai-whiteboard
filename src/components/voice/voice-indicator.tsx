"use client";

import React from "react";
import { Mic, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import useVoiceState from "@/app/store/use-voice-state";

type VoiceIndicatorProps = {
  className?: string;
  showTranscript?: boolean;
  compact?: boolean;
};

/**
 * Visual indicator for voice input state
 * Shows when voice is enabled, listening, processing, or has errors
 */
export default function VoiceIndicator({
  className,
  showTranscript = true,
  compact = false,
}: VoiceIndicatorProps) {
  const {
    isVoiceEnabled,
    voiceState,
    transcript,
    interimTranscript,
    error,
  } = useVoiceState();

  // Don't show if voice is not enabled
  if (!isVoiceEnabled && voiceState === "idle") {
    return null;
  }

  // Compact mode - just show a small indicator
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all",
          voiceState === "listening" && "bg-red-100 text-red-600",
          voiceState === "processing" && "bg-orange-100 text-orange-600",
          voiceState === "error" && "bg-red-100 text-red-600",
          voiceState === "idle" && isVoiceEnabled && "bg-slate-100 text-slate-600",
          className
        )}
      >
        {voiceState === "listening" && (
          <>
            <Mic className="w-3 h-3 animate-pulse" />
            <span>Listening</span>
          </>
        )}
        {voiceState === "processing" && (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing</span>
          </>
        )}
        {voiceState === "error" && (
          <>
            <AlertCircle className="w-3 h-3" />
            <span>Error</span>
          </>
        )}
        {voiceState === "idle" && isVoiceEnabled && (
          <>
            <Mic className="w-3 h-3" />
            <span>Voice On</span>
          </>
        )}
      </div>
    );
  }

  // Full indicator with transcript
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300",
        voiceState === "listening" && "bg-red-50 border border-red-200",
        voiceState === "processing" && "bg-orange-50 border border-orange-200",
        voiceState === "error" && "bg-red-50 border border-red-200",
        voiceState === "idle" && isVoiceEnabled && "bg-slate-50 border border-slate-200",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full",
          voiceState === "listening" && "bg-red-500 text-white",
          voiceState === "processing" && "bg-orange-500 text-white",
          voiceState === "error" && "bg-red-500 text-white",
          voiceState === "idle" && isVoiceEnabled && "bg-slate-400 text-white"
        )}
      >
        {voiceState === "listening" && <Mic className="w-4 h-4" />}
        {voiceState === "processing" && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {voiceState === "error" && <AlertCircle className="w-4 h-4" />}
        {voiceState === "idle" && isVoiceEnabled && (
          <Mic className="w-4 h-4" />
        )}
      </div>

      {/* Status and transcript */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              voiceState === "listening" && "text-red-700",
              voiceState === "processing" && "text-orange-700",
              voiceState === "error" && "text-red-700",
              voiceState === "idle" && isVoiceEnabled && "text-slate-600"
            )}
          >
            {voiceState === "listening" && "Listening..."}
            {voiceState === "processing" && "Processing..."}
            {voiceState === "error" && "Error"}
            {voiceState === "idle" && isVoiceEnabled && "Voice Mode"}
          </span>

          {/* Animated dots for listening */}
          {voiceState === "listening" && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Transcript display */}
        {showTranscript && (transcript || interimTranscript) && (
          <p className="text-sm text-slate-600 truncate mt-0.5">
            {transcript || interimTranscript}
          </p>
        )}

        {/* Error display */}
        {error && (
          <p className="text-xs text-red-600 mt-0.5">{error}</p>
        )}
      </div>

      {/* Pulse animation for listening */}
      {voiceState === "listening" && (
        <div className="relative w-3 h-3">
          <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
          <span className="absolute inset-0 bg-red-500 rounded-full" />
        </div>
      )}
    </div>
  );
}

/**
 * Floating voice indicator that shows in corner of screen
 */
export function FloatingVoiceIndicator({ className }: { className?: string }) {
  const { isVoiceEnabled, voiceState, interimTranscript, transcript } = useVoiceState();

  if (!isVoiceEnabled) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 right-4 z-50",
        "flex items-center gap-3 px-4 py-3 rounded-2xl",
        "bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg",
        "transition-all duration-300 ease-out",
        "animate-in slide-in-from-bottom-4 fade-in",
        className
      )}
    >
      {/* Animated mic icon */}
      <div
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-full",
          voiceState === "listening" && "bg-red-500",
          voiceState === "processing" && "bg-orange-500",
          voiceState === "idle" && "bg-slate-400"
        )}
      >
        {voiceState === "listening" && (
          <>
            <Mic className="w-5 h-5 text-white relative z-10" />
            <span className="absolute inset-0 bg-red-500/50 rounded-full animate-ping" />
          </>
        )}
        {voiceState === "processing" && (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        )}
        {voiceState === "idle" && <Mic className="w-5 h-5 text-white" />}
      </div>

      {/* Content */}
      <div className="flex flex-col min-w-0 max-w-[200px]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              voiceState === "listening" && "text-red-600",
              voiceState === "processing" && "text-orange-600",
              voiceState === "idle" && "text-slate-600"
            )}
          >
            {voiceState === "listening" && "Listening..."}
            {voiceState === "processing" && "Processing..."}
            {voiceState === "idle" && "Voice Ready"}
          </span>
          
          {/* Sound wave animation */}
          {voiceState === "listening" && (
            <div className="flex items-center gap-0.5 h-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-0.5 bg-red-500 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 8}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: "0.5s",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Show what's being said */}
        {(transcript || interimTranscript) && (
          <p className="text-xs text-slate-500 truncate">
            "{transcript || interimTranscript}"
          </p>
        )}
      </div>

      {/* AI indicator */}
      <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0" />
    </div>
  );
}

