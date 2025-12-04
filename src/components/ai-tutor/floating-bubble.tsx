"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Loader2,
  Sparkles,
  Minus,
  ListChecks,
  BookOpen,
  Play,
  ExternalLink,
  Check,
  HelpCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import useTutorHints from "@/app/store/use-tutor-hints";
import MarkdownRenderer from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import TutorSettings from "./tutor-settings";

type FloatingBubbleProps = {
  className?: string;
};

export default function FloatingBubble({ className }: FloatingBubbleProps) {
  const {
    activeHint,
    showBubble,
    bubbleExpanded,
    bubbleMinimized,
    activeTab,
    isAnalyzing,
    currentStatus,
    proactiveHintsEnabled,
    guidedSteps,
    currentStepIndex,
    isLoadingSteps,
    videos,
    webResources,
    isLoadingResources,
    dismissHint,
    toggleBubble,
    expandBubble,
    collapseBubble,
    minimizeBubble,
    setActiveTab,
    nextStep,
    previousStep,
    toggleStepHint,
    completeStep,
  } = useTutorHints();

  const bubbleRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-expand when there's a detailed hint
  useEffect(() => {
    if (activeHint?.type === "detailed" && !bubbleExpanded && !bubbleMinimized) {
      expandBubble();
    }
  }, [activeHint, bubbleExpanded, bubbleMinimized, expandBubble]);

  const hasHint = activeHint && activeHint.type !== "none";
  const showPulse = hasHint && !bubbleExpanded && !bubbleMinimized;

  // Get status indicator
  const getStatusIndicator = () => {
    if (isAnalyzing) {
      return (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Analyzing...
        </span>
      );
    }

    if (!currentStatus) return null;

    const statusConfig: Record<string, { color: string; text: string }> = {
      correct: { color: "text-green-600", text: "Great work!" },
      on_track: { color: "text-blue-600", text: "On track" },
      stuck: { color: "text-amber-600", text: "Need help?" },
      wrong: { color: "text-red-600", text: "Check your work" },
      empty: { color: "text-slate-500", text: "Ready to help" },
      idle: { color: "text-slate-500", text: "Here when you need me" },
    };

    const config = statusConfig[currentStatus] || statusConfig.empty;
    return <span className={cn("text-xs font-medium", config.color)}>{config.text}</span>;
  };

  if (!proactiveHintsEnabled) {
    return null;
  }

  // Minimized state - just a small floating button
  if (bubbleMinimized) {
    return (
      <button
        onClick={toggleBubble}
        className={cn(
          "fixed bottom-4 left-4 z-50",
          "w-12 h-12 rounded-full",
          "bg-white border-2 border-slate-200",
          "flex items-center justify-center",
          "hover:border-indigo-400 transition-colors",
          showPulse && "animate-pulse",
          className
        )}
        aria-label="Open AI Tutor"
      >
        <Bot className="w-6 h-6 text-indigo-600" />
        {hasHint && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
            <Lightbulb className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </button>
    );
  }

  // Collapsed bubble - shows button with status
  if (!showBubble || !bubbleExpanded) {
    return (
      <div
        ref={bubbleRef}
        className={cn(
          "fixed bottom-4 left-4 z-50",
          "flex items-center gap-2",
          className
        )}
      >
        <button
          onClick={expandBubble}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-full",
            "bg-white border-2 border-slate-200",
            "hover:border-indigo-400 transition-all",
            showPulse && "border-indigo-400"
          )}
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-indigo-600" />
            {showPulse && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-sm font-medium text-slate-700">AI Tutor</span>
          {getStatusIndicator()}
          <ChevronUp className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

  const hasSteps = guidedSteps.length > 0;
  const hasResources = videos.length > 0 || webResources.length > 0;
  const currentStep = guidedSteps[currentStepIndex];

  // Render tab content
  const renderTabContent = () => {
    // Hint Tab
    if (activeTab === "hint") {
      if (isAnalyzing) {
        return (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-slate-600">Analyzing your work...</p>
          </div>
        );
      }
      
      if (hasHint) {
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="p-1 rounded bg-amber-100 mt-0.5">
                <Lightbulb className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-700 mb-1">Hint</p>
                <div className="text-sm text-slate-700">
                  <MarkdownRenderer content={activeHint!.content} />
                </div>
              </div>
            </div>
            <Button
              variant="neutral"
              size="sm"
              onClick={dismissHint}
              className="w-full"
            >
              Got it, thanks!
            </Button>
          </div>
        );
      }
      
      return (
        <div className="text-center py-4">
          <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {currentStatus === "correct" || currentStatus === "on_track"
              ? "You're doing great! Keep going."
              : "I'm here to help when you need it."}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            I'll give you hints if you get stuck.
          </p>
        </div>
      );
    }

    // Steps Tab
    if (activeTab === "steps") {
      if (isLoadingSteps) {
        return (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-slate-600">Creating your guide...</p>
          </div>
        );
      }

      if (!hasSteps) {
        return (
          <div className="text-center py-4">
            <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No guided steps yet</p>
            <p className="text-xs text-slate-400 mt-2">
              I'll create step-by-step guidance when you need help with a problem.
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-slate-500">
              Step {currentStepIndex + 1} of {guidedSteps.length}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${((currentStepIndex + 1) / guidedSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Current step */}
          {currentStep && (
            <div className="border-2 border-indigo-200 rounded-lg p-3 bg-indigo-50">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                  {currentStep.stepNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {currentStep.instruction}
                  </p>
                  
                  {/* Hint toggle */}
                  {currentStep.hint && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleStepHint(currentStep.stepNumber)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        <HelpCircle className="w-3 h-3" />
                        {currentStep.showingHint ? "Hide hint" : "Need a hint?"}
                      </button>
                      {currentStep.showingHint && (
                        <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 border border-amber-200">
                          💡 {currentStep.hint}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="neutral"
              size="sm"
              onClick={previousStep}
              disabled={currentStepIndex === 0}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                completeStep(currentStep?.stepNumber || 0);
                nextStep();
              }}
              disabled={currentStepIndex >= guidedSteps.length - 1}
              className="flex-1"
            >
              {currentStepIndex >= guidedSteps.length - 1 ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Done!
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    // Resources Tab
    if (activeTab === "resources") {
      if (isLoadingResources) {
        return (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-slate-600">Finding resources...</p>
          </div>
        );
      }

      if (!hasResources) {
        return (
          <div className="text-center py-4">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No resources yet</p>
            <p className="text-xs text-slate-400 mt-2">
              I'll suggest helpful videos and articles when you get stuck.
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-4">
          {/* Videos */}
          {videos.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Helpful Videos
              </h4>
              <div className="space-y-2">
                {videos.map((video, index) => (
                  <a
                    key={index}
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(video.searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 border-2 border-slate-200 rounded-lg hover:border-red-300 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded bg-red-100">
                        <Play className="w-3 h-3 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {video.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {video.description}
                        </p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0 mt-1" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Web Resources */}
          {webResources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Learning Resources
              </h4>
              <div className="space-y-2">
                {webResources.map((resource, index) => (
                  <a
                    key={index}
                    href={resource.url || `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 border-2 border-slate-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded bg-blue-100">
                        <BookOpen className="w-3 h-3 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {resource.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {resource.description}
                        </p>
                        <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 capitalize">
                          {resource.type.replace("_", " ")}
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0 mt-1" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // Expanded bubble
  return (
    <div
      ref={bubbleRef}
      className={cn(
        "fixed bottom-4 left-4 z-50",
        "w-80 max-w-[calc(100vw-2rem)]",
        "bg-white border-2 border-slate-200 rounded-xl",
        "flex flex-col overflow-hidden",
        "transition-all duration-200",
        className
      )}
      style={{ maxHeight: "70vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-100">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">AI Tutor</h3>
            {getStatusIndicator()}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded hover:bg-slate-200 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={minimizeBubble}
            className="p-1 rounded hover:bg-slate-200 transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={collapseBubble}
            className="p-1 rounded hover:bg-slate-200 transition-colors"
            aria-label="Collapse"
          >
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <TutorSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveTab("hint")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "hint"
              ? "text-indigo-600 border-b-2 border-indigo-500 bg-white"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Hints
          {hasHint && activeTab !== "hint" && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("steps")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "steps"
              ? "text-indigo-600 border-b-2 border-indigo-500 bg-white"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <ListChecks className="w-3.5 h-3.5" />
          Steps
          {hasSteps && activeTab !== "steps" && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-600">
              {guidedSteps.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("resources")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "resources"
              ? "text-indigo-600 border-b-2 border-indigo-500 bg-white"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Resources
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {renderTabContent()}
        </div>
      </ScrollArea>
    </div>
  );
}

