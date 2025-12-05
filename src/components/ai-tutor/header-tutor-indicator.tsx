"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Lightbulb,
  Loader2,
  ListChecks,
  BookOpen,
  Play,
  ExternalLink,
  Check,
  HelpCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { BsStars } from "react-icons/bs";
import { cn } from "@/lib/utils";
import useTutorHints from "@/app/store/use-tutor-hints";
import MarkdownRenderer from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import TutorSettings from "./tutor-settings";

type HeaderTutorIndicatorProps = {
  className?: string;
};

export default function HeaderTutorIndicator({
  className,
}: HeaderTutorIndicatorProps) {
  const {
    activeHint,
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
    setActiveTab,
    nextStep,
    previousStep,
    toggleStepHint,
    completeStep,
  } = useTutorHints();

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReviewingBubble, setShowReviewingBubble] = useState(false);
  const previousHintRef = useRef<string | null>(null);

  const hasHint = activeHint && activeHint.type !== "none";
  const hasSteps = guidedSteps.length > 0;
  const hasResources = videos.length > 0 || webResources.length > 0;
  const currentStep = guidedSteps[currentStepIndex];

  // Show "Reviewing your work..." bubble when analyzing
  useEffect(() => {
    if (isAnalyzing) {
      // Small delay before showing the bubble for smoother UX
      const timer = setTimeout(() => {
        setShowReviewingBubble(true);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      // Keep showing for a moment after analysis completes
      const timer = setTimeout(() => {
        setShowReviewingBubble(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAnalyzing]);

  // Track previous status for change detection
  const previousStatusRef = useRef<string | null>(null);

  // Auto-open popover when a new hint is available
  useEffect(() => {
    if (activeHint && activeHint.content !== previousHintRef.current) {
      previousHintRef.current = activeHint.content;

      // Auto-open for detailed hints or when user seems stuck
      if (
        activeHint.type === "detailed" ||
        currentStatus === "stuck" ||
        currentStatus === "wrong"
      ) {
        setIsOpen(true);
      }
    }
  }, [activeHint, currentStatus]);

  // Auto-open when status changes to "wrong" or "stuck" (even for quick hints)
  useEffect(() => {
    if (currentStatus !== previousStatusRef.current) {
      previousStatusRef.current = currentStatus;

      // Auto-open when status indicates a problem
      if (currentStatus === "wrong" || currentStatus === "stuck") {
        setIsOpen(true);
        // Also switch to hints tab to show the relevant info
        setActiveTab("hint");
      }
    }
  }, [currentStatus, setActiveTab]);

  // Get status config
  const getStatusConfig = () => {
    if (isAnalyzing) {
      return { color: "bg-blue-500", pulse: true, text: "Analyzing..." };
    }

    const configs: Record<
      string,
      { color: string; pulse: boolean; text: string }
    > = {
      correct: { color: "bg-green-500", pulse: false, text: "Great work!" },
      on_track: { color: "bg-green-500", pulse: false, text: "On track" },
      stuck: { color: "bg-amber-500", pulse: true, text: "Need help?" },
      wrong: { color: "bg-red-500", pulse: true, text: "Check your work" },
      empty: { color: "bg-slate-400", pulse: false, text: "Ready" },
      idle: { color: "bg-slate-400", pulse: false, text: "Ready" },
    };

    return configs[currentStatus || "empty"] || configs.empty;
  };

  const statusConfig = getStatusConfig();

  if (!proactiveHintsEnabled) {
    return null;
  }

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
        const isError = currentStatus === "wrong";
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  "p-1 rounded border mt-0.5",
                  isError ? "border-red-300" : "border-amber-300"
                )}
              >
                {isError ? (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                ) : (
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-xs font-medium mb-1",
                    isError ? "text-red-700" : "text-amber-700"
                  )}
                >
                  {isError ? "Check This" : "Hint"}
                </p>
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
            <p className="text-xs text-slate-400 mt-1">
              Steps will appear when you need help solving a problem.
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
                style={{
                  width: `${((currentStepIndex + 1) / guidedSteps.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Current step */}
          {currentStep && (
            <div className="border-2 border-indigo-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                  {currentStep.stepNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {currentStep.instruction}
                  </p>

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
                        <p className="mt-1.5 text-xs text-amber-700 rounded px-2 py-1.5 border border-amber-200 bg-amber-50">
                          {currentStep.hint}
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
            <p className="text-xs text-slate-400 mt-1">
              Helpful videos and articles will appear when you need them.
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
                    className="block p-2 border border-slate-200 rounded-lg hover:border-red-300 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded border border-red-300">
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
                    href={
                      resource.url ||
                      `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded border border-blue-300">
                        <BookOpen className="w-3 h-3 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {resource.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {resource.description}
                        </p>
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

  return (
    <>
      <div className="relative flex items-center gap-2">
        {/* Reviewing Work Bubble - slides in from the right */}
        <div
          className={cn(
            "absolute right-full mr-3 whitespace-nowrap",
            "flex items-center gap-1.5 px-2.5 py-1",
            "transition-all duration-300 ease-out",
            showReviewingBubble
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-4 pointer-events-none"
          )}
        >
          <Loader2 className="w-3 h-3 text-pink-500 animate-spin" />
          <span className="text-xs font-medium bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
            Reviewing...
          </span>
        </div>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative inline-flex items-center justify-center">
              {/* Spinning border ring effect when active */}
              {(isAnalyzing || hasHint) && (
                <div
                  className="absolute rounded-full spin-border"
                  style={{
                    width: "40px",
                    height: "40px",
                    background:
                      "conic-gradient(from 0deg, #fb923c, #ec4899, #9333ea, #fb923c)",
                    borderRadius: "50%",
                    padding: "1.5px",
                  }}
                >
                  <div className="w-full h-full rounded-full bg-white" />
                </div>
              )}

              <button
                className={cn(
                  "relative flex items-center justify-center p-2.5 rounded-full cursor-pointer transition-all duration-500 z-10",
                  "bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600",
                  "hover:shadow-lg hover:shadow-pink-500/30",
                  className
                )}
              >
                <BsStars className="w-5 h-5 text-white" />

                {/* Notification dot for hints */}
                {hasHint && !isOpen && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-bounce" />
                )}
              </button>
            </div>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-80 p-0 border border-slate-200 bg-white shadow-lg animate-in slide-in-from-top-2 duration-200"
            sideOffset={8}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <BsStars className="w-4 h-4 text-pink-600" />
                <span className="text-sm font-semibold text-slate-800">
                  AI Tutor
                </span>
                {isAnalyzing && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing...
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab("hint")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === "hint"
                    ? "text-indigo-600 border-b-2 border-indigo-500"
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
                    ? "text-indigo-600 border-b-2 border-indigo-500"
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
                    ? "text-indigo-600 border-b-2 border-indigo-500"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Resources
                {hasResources && activeTab !== "resources" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            </div>

            {/* Content */}
            <ScrollArea className="max-h-80">
              <div className="p-4">{renderTabContent()}</div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Settings Modal */}
      <TutorSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
