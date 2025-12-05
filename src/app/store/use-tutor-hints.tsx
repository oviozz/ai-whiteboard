"use client";

import { create } from "zustand";

export type HintType = "quick" | "detailed" | "none";

export type TutorHint = {
  type: HintType;
  content: string;
  position?: { x: number; y: number };
  timestamp: number;
};

export type AnalysisStatus = "correct" | "on_track" | "stuck" | "wrong" | "empty" | "idle";

export type GuidedStep = {
  stepNumber: number;
  instruction: string;
  hint?: string;
  isCompleted: boolean;
  showingHint: boolean;
};

export type VideoSuggestion = {
  title: string;
  description: string;
  searchQuery: string;
  relevanceReason: string;
};

export type WebResource = {
  title: string;
  type: "khan_academy" | "wikipedia" | "interactive_tool" | "article" | "other";
  url?: string;
  searchQuery: string;
  description: string;
};

type TutorHintsState = {
  // Current hint state
  activeHint: TutorHint | null;
  
  // Bubble UI state
  showBubble: boolean;
  bubbleExpanded: boolean;
  bubbleMinimized: boolean;
  activeTab: "hint" | "steps" | "resources";
  
  // Analysis state
  lastAnalysisTime: number | null;
  currentStatus: AnalysisStatus | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  
  // Smart check state (for interval-based checking)
  lastCheckHash: string | null;
  checkIntervalMs: number;
  isCheckingEnabled: boolean;
  lastCheckTime: number | null;
  shapeCount: number;
  
  // Guided steps
  guidedSteps: GuidedStep[];
  currentStepIndex: number;
  isLoadingSteps: boolean;
  
  // Resources
  videos: VideoSuggestion[];
  webResources: WebResource[];
  isLoadingResources: boolean;
  
  // History
  hintsShownCount: number;
  hintsDismissedCount: number;
  
  // Settings
  proactiveHintsEnabled: boolean;
  
  // Actions
  setActiveHint: (hint: TutorHint | null) => void;
  dismissHint: () => void;
  showQuickHint: (content: string, position?: { x: number; y: number }) => void;
  showDetailedHint: (content: string) => void;
  
  // Bubble actions
  toggleBubble: () => void;
  expandBubble: () => void;
  collapseBubble: () => void;
  minimizeBubble: () => void;
  setActiveTab: (tab: "hint" | "steps" | "resources") => void;
  
  // Analysis actions
  setAnalyzing: (isAnalyzing: boolean) => void;
  setAnalysisResult: (status: AnalysisStatus, hint?: TutorHint) => void;
  setAnalysisError: (error: string | null) => void;
  
  // Smart check actions
  setLastCheckHash: (hash: string | null) => void;
  setCheckIntervalMs: (ms: number) => void;
  setCheckingEnabled: (enabled: boolean) => void;
  updateCheckState: (hash: string, shapeCount: number) => void;
  shouldCheck: (currentHash: string, currentShapeCount: number) => boolean;
  
  // Guided steps actions
  setGuidedSteps: (steps: GuidedStep[]) => void;
  completeStep: (stepNumber: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  toggleStepHint: (stepNumber: number) => void;
  setLoadingSteps: (loading: boolean) => void;
  clearSteps: () => void;
  
  // Resources actions
  setVideos: (videos: VideoSuggestion[]) => void;
  setWebResources: (resources: WebResource[]) => void;
  setLoadingResources: (loading: boolean) => void;
  clearResources: () => void;
  
  // Settings actions
  setProactiveHintsEnabled: (enabled: boolean) => void;
  
  // Reset
  reset: () => void;
};

const DEFAULT_CHECK_INTERVAL_MS = 12000; // 12 seconds

const initialState = {
  activeHint: null,
  showBubble: false,
  bubbleExpanded: false,
  bubbleMinimized: false,
  activeTab: "hint" as const,
  lastAnalysisTime: null,
  currentStatus: null,
  isAnalyzing: false,
  analysisError: null,
  // Smart check state
  lastCheckHash: null,
  checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
  isCheckingEnabled: true,
  lastCheckTime: null,
  shapeCount: 0,
  // Guided steps
  guidedSteps: [] as GuidedStep[],
  currentStepIndex: 0,
  isLoadingSteps: false,
  videos: [] as VideoSuggestion[],
  webResources: [] as WebResource[],
  isLoadingResources: false,
  hintsShownCount: 0,
  hintsDismissedCount: 0,
  proactiveHintsEnabled: true,
};

const useTutorHints = create<TutorHintsState>((set, get) => ({
  ...initialState,

  setActiveHint: (hint) => {
    set({
      activeHint: hint,
      hintsShownCount: hint ? get().hintsShownCount + 1 : get().hintsShownCount,
    });
    
    // If it's a detailed hint, also show/expand the bubble
    if (hint?.type === "detailed") {
      set({
        showBubble: true,
        bubbleExpanded: true,
        bubbleMinimized: false,
      });
    }
  },

  dismissHint: () => {
    const { activeHint } = get();
    set({
      activeHint: null,
      hintsDismissedCount: activeHint ? get().hintsDismissedCount + 1 : get().hintsDismissedCount,
    });
  },

  showQuickHint: (content, position) => {
    set({
      activeHint: {
        type: "quick",
        content,
        position,
        timestamp: Date.now(),
      },
      hintsShownCount: get().hintsShownCount + 1,
    });
  },

  showDetailedHint: (content) => {
    set({
      activeHint: {
        type: "detailed",
        content,
        timestamp: Date.now(),
      },
      showBubble: true,
      bubbleExpanded: true,
      bubbleMinimized: false,
      hintsShownCount: get().hintsShownCount + 1,
    });
  },

  toggleBubble: () => {
    const { showBubble, bubbleMinimized } = get();
    if (bubbleMinimized) {
      set({ bubbleMinimized: false, showBubble: true });
    } else {
      set({ showBubble: !showBubble });
    }
  },

  expandBubble: () => {
    set({
      showBubble: true,
      bubbleExpanded: true,
      bubbleMinimized: false,
    });
  },

  collapseBubble: () => {
    set({ bubbleExpanded: false });
  },

  minimizeBubble: () => {
    set({
      bubbleMinimized: true,
      bubbleExpanded: false,
    });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  setAnalyzing: (isAnalyzing) => {
    set({ isAnalyzing, analysisError: null });
  },

  setAnalysisResult: (status, hint) => {
    set({
      currentStatus: status,
      lastAnalysisTime: Date.now(),
      isAnalyzing: false,
      analysisError: null,
      activeHint: hint || null,
    });

    // Show bubble for detailed hints
    if (hint?.type === "detailed") {
      set({
        showBubble: true,
        bubbleExpanded: true,
        bubbleMinimized: false,
      });
    }
  },

  setAnalysisError: (error) => {
    set({
      analysisError: error,
      isAnalyzing: false,
    });
  },

  // Smart check actions
  setLastCheckHash: (hash) => {
    set({ lastCheckHash: hash });
  },

  setCheckIntervalMs: (ms) => {
    set({ checkIntervalMs: ms });
  },

  setCheckingEnabled: (enabled) => {
    set({ isCheckingEnabled: enabled });
  },

  updateCheckState: (hash, shapeCount) => {
    set({
      lastCheckHash: hash,
      lastCheckTime: Date.now(),
      shapeCount,
    });
  },

  shouldCheck: (currentHash, currentShapeCount) => {
    const state = get();
    
    // Don't check if checking is disabled
    if (!state.isCheckingEnabled || !state.proactiveHintsEnabled) {
      return false;
    }
    
    // Don't check if already analyzing
    if (state.isAnalyzing) {
      return false;
    }
    
    // Don't check if canvas is empty
    if (currentShapeCount === 0) {
      return false;
    }
    
    // Don't check if nothing has changed since last check
    if (currentHash === state.lastCheckHash) {
      return false;
    }
    
    // Don't check too frequently
    if (state.lastCheckTime) {
      const timeSinceLastCheck = Date.now() - state.lastCheckTime;
      if (timeSinceLastCheck < state.checkIntervalMs) {
        return false;
      }
    }
    
    return true;
  },

  setProactiveHintsEnabled: (enabled) => {
    set({ proactiveHintsEnabled: enabled });
    if (!enabled) {
      set({ activeHint: null });
    }
  },

  // Guided steps actions
  setGuidedSteps: (steps) => {
    set({
      guidedSteps: steps.map(s => ({ ...s, showingHint: false })),
      currentStepIndex: 0,
      isLoadingSteps: false,
      activeTab: "steps",
      showBubble: true,
      bubbleExpanded: true,
    });
  },

  completeStep: (stepNumber) => {
    set((state) => ({
      guidedSteps: state.guidedSteps.map(s =>
        s.stepNumber === stepNumber ? { ...s, isCompleted: true } : s
      ),
    }));
  },

  nextStep: () => {
    const { currentStepIndex, guidedSteps } = get();
    if (currentStepIndex < guidedSteps.length - 1) {
      // Mark current step as completed
      const currentStep = guidedSteps[currentStepIndex];
      if (currentStep) {
        set((state) => ({
          guidedSteps: state.guidedSteps.map(s =>
            s.stepNumber === currentStep.stepNumber ? { ...s, isCompleted: true } : s
          ),
          currentStepIndex: state.currentStepIndex + 1,
        }));
      }
    }
  },

  previousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  toggleStepHint: (stepNumber) => {
    set((state) => ({
      guidedSteps: state.guidedSteps.map(s =>
        s.stepNumber === stepNumber ? { ...s, showingHint: !s.showingHint } : s
      ),
    }));
  },

  setLoadingSteps: (loading) => {
    set({ isLoadingSteps: loading });
  },

  clearSteps: () => {
    set({
      guidedSteps: [],
      currentStepIndex: 0,
    });
  },

  // Resources actions
  setVideos: (videos) => {
    set({ videos, isLoadingResources: false });
  },

  setWebResources: (resources) => {
    set({ webResources: resources, isLoadingResources: false });
  },

  setLoadingResources: (loading) => {
    set({ isLoadingResources: loading });
  },

  clearResources: () => {
    set({
      videos: [],
      webResources: [],
    });
  },

  reset: () => {
    set(initialState);
  },
}));

export default useTutorHints;

