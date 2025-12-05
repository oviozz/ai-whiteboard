"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type VoiceInputState = "idle" | "listening" | "processing" | "error";

export type VoiceInputConfig = {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceInputState) => void;
  silenceTimeout?: number; // Time in ms to wait after speech ends before processing
};

export type VoiceInputReturn = {
  state: VoiceInputState;
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => string; // Now returns the final transcript
  toggleListening: () => void;
  clearTranscript: () => void;
  getCurrentTranscript: () => string; // Get current transcript synchronously
};

const DEFAULT_SILENCE_TIMEOUT = 1500; // 1.5 seconds

/**
 * Hook for voice input using the Web Speech API
 * 
 * Features:
 * - Speech-to-text using browser's native SpeechRecognition
 * - Continuous listening mode
 * - Interim results for real-time feedback
 * - Automatic processing after silence
 * - Error handling
 */
export function useVoiceInput(config: VoiceInputConfig = {}): VoiceInputReturn {
  const {
    language = "en-US",
    continuous = true,
    interimResults = true,
    onTranscript,
    onFinalTranscript,
    onError,
    onStateChange,
    silenceTimeout = DEFAULT_SILENCE_TIMEOUT,
  } = config;

  const [state, setState] = useState<VoiceInputState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef("");
  const isStoppingRef = useRef(false);

  // Check browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  // Update state and notify
  const updateState = useCallback(
    (newState: VoiceInputState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  // Clear silence timeout
  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  // Process final transcript
  const processFinalTranscript = useCallback(() => {
    const finalText = accumulatedTranscriptRef.current.trim();
    if (finalText) {
      setTranscript(finalText);
      onFinalTranscript?.(finalText);
    }
    setInterimTranscript("");
    accumulatedTranscriptRef.current = "";
  }, [onFinalTranscript]);

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setError("Speech recognition not supported in this browser");
      setIsSupported(false);
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      updateState("listening");
      setError(null);
    };

    recognition.onend = () => {
      // If we're not intentionally stopping, might need to restart for continuous mode
      if (!isStoppingRef.current && continuous) {
        // Process any remaining transcript
        processFinalTranscript();
      }
      
      if (isStoppingRef.current) {
        updateState("idle");
        isStoppingRef.current = false;
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = getErrorMessage(event.error);
      
      // Don't treat "no-speech" as a critical error in continuous mode
      if (event.error === "no-speech" && continuous) {
        return;
      }
      
      // Don't treat "aborted" as error when intentionally stopping
      if (event.error === "aborted" && isStoppingRef.current) {
        return;
      }

      // For network errors, stop trying and reset state
      if (event.error === "network") {
        isStoppingRef.current = true;
        recognitionRef.current = null;
      }

      setError(errorMessage);
      updateState("error");
      onError?.(errorMessage);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      clearSilenceTimeout();

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;

        if (result.isFinal) {
          final += transcriptText + " ";
        } else {
          interim += transcriptText;
        }
      }

      // Accumulate final results
      if (final) {
        accumulatedTranscriptRef.current += final;
        const currentTranscript = accumulatedTranscriptRef.current.trim();
        setTranscript(currentTranscript);
        onTranscript?.(currentTranscript, true);
      }

      // Update interim results
      setInterimTranscript(interim);
      if (interim) {
        onTranscript?.(accumulatedTranscriptRef.current + interim, false);
      }

      // No automatic processing - user must explicitly stop recording
    };

    recognition.onspeechstart = () => {
      // Speech started
    };

    recognition.onspeechend = () => {
      // Speech ended - but don't auto-process, wait for explicit stop
    };

    return recognition;
  }, [
    language,
    continuous,
    interimResults,
    onTranscript,
    onError,
    updateState,
    processFinalTranscript,
  ]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Speech recognition not supported");
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore errors when stopping
      }
    }

    // Clear previous state
    setError(null);
    setInterimTranscript("");
    accumulatedTranscriptRef.current = "";
    isStoppingRef.current = false;

    // Initialize and start new recognition
    const recognition = initializeRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (e) {
        setError("Failed to start speech recognition");
        updateState("error");
      }
    }
  }, [isSupported, initializeRecognition, updateState]);

  // Stop listening - returns the final transcript
  const stopListening = useCallback((): string => {
    clearSilenceTimeout();
    isStoppingRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore errors
      }
    }

    // Get the current accumulated text before processing
    const currentText = accumulatedTranscriptRef.current.trim();
    
    // Process any remaining transcript
    processFinalTranscript();
    updateState("idle");
    
    // Return the transcript that was captured
    return currentText;
  }, [clearSilenceTimeout, processFinalTranscript, updateState]);

  // Get current transcript synchronously (doesn't wait for React state)
  const getCurrentTranscript = useCallback((): string => {
    return accumulatedTranscriptRef.current.trim();
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state === "listening") {
      stopListening();
    } else {
      startListening();
    }
  }, [state, startListening, stopListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    accumulatedTranscriptRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimeout();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, [clearSilenceTimeout]);

  return {
    state,
    isListening: state === "listening",
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    getCurrentTranscript,
  };
}

// Helper to get user-friendly error messages
function getErrorMessage(error: string): string {
  switch (error) {
    case "no-speech":
      return "No speech detected. Please try again.";
    case "audio-capture":
      return "No microphone found. Please check your device.";
    case "not-allowed":
      return "Microphone access denied. Please allow microphone access in your browser settings.";
    case "network":
      return "Voice recognition requires internet. Please check your connection and try again.";
    case "aborted":
      return "Speech recognition aborted.";
    case "language-not-supported":
      return "Language not supported.";
    case "service-not-allowed":
      return "Speech recognition service not allowed. Please use HTTPS.";
    default:
      return `Speech recognition error: ${error}`;
  }
}

export default useVoiceInput;

