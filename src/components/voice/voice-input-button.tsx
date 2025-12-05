"use client";

import React, { useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import useVoiceState from "@/app/store/use-voice-state";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { toast } from "sonner";

type VoiceInputButtonProps = {
  onTranscript: (transcript: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

export default function VoiceInputButton({
  onTranscript,
  className,
  size = "md",
  showLabel = false,
}: VoiceInputButtonProps) {
  const {
    isVoiceEnabled,
    voiceState,
    setVoiceEnabled,
    setVoiceState,
    setTranscript,
    setInterimTranscript,
    setError,
    clearTranscript,
  } = useVoiceState();

  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    clearTranscript: clearVoiceTranscript,
  } = useVoiceInput({
    continuous: true,
    interimResults: true,
    silenceTimeout: 1500,
    onStateChange: setVoiceState,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setTranscript(text);
      } else {
        setInterimTranscript(text);
      }
    },
    onFinalTranscript: (text) => {
      if (text.trim()) {
        onTranscript(text.trim());
        clearVoiceTranscript();
        clearTranscript();
      }
    },
    onError: (err) => {
      setError(err);
      toast.error(err);
    },
  });

  // Sync voice state with listening state
  useEffect(() => {
    if (isVoiceEnabled && !isListening && voiceState === "idle") {
      startListening();
    } else if (!isVoiceEnabled && isListening) {
      stopListening();
    }
  }, [isVoiceEnabled, isListening, voiceState, startListening, stopListening]);

  // Toggle voice
  const handleToggle = useCallback(() => {
    if (!isSupported) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    if (isVoiceEnabled) {
      stopListening();
      setVoiceEnabled(false);
    } else {
      setVoiceEnabled(true);
      // startListening will be called by the effect
    }
  }, [isSupported, isVoiceEnabled, stopListening, setVoiceEnabled]);

  // Size classes
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const iconSizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  // Get button state styling
  const getButtonStyle = () => {
    if (!isSupported) {
      return "bg-slate-200 text-slate-400 cursor-not-allowed";
    }

    if (voiceState === "error") {
      return "bg-red-100 text-red-600 hover:bg-red-200";
    }

    if (voiceState === "listening") {
      return "bg-red-500 text-white animate-pulse";
    }

    if (voiceState === "processing") {
      return "bg-orange-500 text-white";
    }

    return "bg-slate-100 text-slate-600 hover:bg-slate-200";
  };

  // Get icon
  const getIcon = () => {
    if (!isSupported) {
      return <MicOff className={iconSizeClasses[size]} />;
    }

    if (voiceState === "error") {
      return <AlertCircle className={iconSizeClasses[size]} />;
    }

    if (voiceState === "processing") {
      return <Loader2 className={cn(iconSizeClasses[size], "animate-spin")} />;
    }

    if (voiceState === "listening") {
      return <Mic className={iconSizeClasses[size]} />;
    }

    return <Mic className={iconSizeClasses[size]} />;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={!isSupported}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-200",
          sizeClasses[size],
          getButtonStyle()
        )}
        title={
          !isSupported
            ? "Speech recognition not supported"
            : isVoiceEnabled
              ? "Stop listening"
              : "Start voice input"
        }
      >
        {getIcon()}

        {/* Listening indicator ring */}
        {voiceState === "listening" && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            <span className="absolute -inset-1 rounded-full border-2 border-red-400/50 animate-pulse" />
          </>
        )}
      </button>

      {showLabel && (
        <span className="text-xs text-slate-500">
          {voiceState === "listening"
            ? "Listening..."
            : voiceState === "processing"
              ? "Processing..."
              : "Voice"}
        </span>
      )}

      {/* Show interim transcript while speaking */}
      {isVoiceEnabled && (transcript || interimTranscript) && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg max-w-xs">
          <span className="text-sm text-slate-600 truncate">
            {transcript || interimTranscript}
          </span>
          <button
            type="button"
            onClick={() => {
              clearVoiceTranscript();
              clearTranscript();
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

