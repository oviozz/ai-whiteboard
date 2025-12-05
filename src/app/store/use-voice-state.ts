"use client";

import { create } from "zustand";

export type VoiceState = "idle" | "listening" | "processing" | "error";

type VoiceStateStore = {
  // Voice enabled state
  isVoiceEnabled: boolean;
  
  // Current voice state
  voiceState: VoiceState;
  
  // Is actively listening
  isListening: boolean;
  
  // Is processing speech
  isProcessing: boolean;
  
  // Current transcript
  transcript: string;
  
  // Interim transcript (while speaking)
  interimTranscript: string;
  
  // Error message
  error: string | null;
  
  // Actions
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceState: (state: VoiceState) => void;
  setTranscript: (transcript: string) => void;
  setInterimTranscript: (transcript: string) => void;
  setError: (error: string | null) => void;
  clearTranscript: () => void;
  reset: () => void;
};

const initialState = {
  isVoiceEnabled: false,
  voiceState: "idle" as VoiceState,
  isListening: false,
  isProcessing: false,
  transcript: "",
  interimTranscript: "",
  error: null,
};

const useVoiceState = create<VoiceStateStore>((set) => ({
  ...initialState,

  setVoiceEnabled: (enabled) =>
    set({
      isVoiceEnabled: enabled,
      // Reset state when disabling
      ...(enabled
        ? {}
        : {
            voiceState: "idle",
            isListening: false,
            isProcessing: false,
            transcript: "",
            interimTranscript: "",
            error: null,
          }),
    }),

  setVoiceState: (state) =>
    set({
      voiceState: state,
      isListening: state === "listening",
      isProcessing: state === "processing",
    }),

  setTranscript: (transcript) => set({ transcript }),

  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),

  setError: (error) =>
    set({
      error,
      voiceState: error ? "error" : "idle",
      isListening: false,
      isProcessing: false,
    }),

  clearTranscript: () =>
    set({
      transcript: "",
      interimTranscript: "",
    }),

  reset: () => set(initialState),
}));

export default useVoiceState;

