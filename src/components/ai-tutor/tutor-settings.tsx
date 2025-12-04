"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Settings,
  X,
  Loader2,
  Zap,
  Clock,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import useTutorHints from "@/app/store/use-tutor-hints";

type TutorSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
};

const HINT_FREQUENCY_OPTIONS = [
  { value: "low", label: "Less frequent", description: "Hints after 60s idle" },
  { value: "medium", label: "Balanced", description: "Hints after 30s idle" },
  { value: "high", label: "More frequent", description: "Hints after 15s idle" },
];

const HINT_STYLE_OPTIONS = [
  { value: "quick", label: "Quick hints", description: "Brief, near your work" },
  { value: "detailed", label: "Detailed", description: "More thorough guidance" },
  { value: "auto", label: "Automatic", description: "AI chooses based on context" },
];

export default function TutorSettings({ isOpen, onClose }: TutorSettingsProps) {
  const preferences = useQuery(api.users.getTutorPreferences);
  const updatePreferences = useMutation(api.users.updateTutorPreferences);
  const { setProactiveHintsEnabled } = useTutorHints();

  const [localPrefs, setLocalPrefs] = useState({
    proactiveHintsEnabled: true,
    hintFrequency: "medium",
    preferredHintStyle: "auto",
    showResourceSuggestions: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Sync with server preferences
  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        proactiveHintsEnabled: preferences.proactiveHintsEnabled,
        hintFrequency: preferences.hintFrequency,
        preferredHintStyle: preferences.preferredHintStyle,
        showResourceSuggestions: preferences.showResourceSuggestions,
      });
    }
  }, [preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({ preferences: localPrefs });
      // Update local store
      setProactiveHintsEnabled(localPrefs.proactiveHintsEnabled);
      onClose();
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof typeof localPrefs) => {
    setLocalPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelect = (key: keyof typeof localPrefs, value: string) => {
    setLocalPrefs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border-2 border-slate-200 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            <h2 className="font-semibold text-slate-800">AI Tutor Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {preferences === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Proactive Hints Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Zap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Proactive Hints
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      AI automatically offers help when you're stuck
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle("proactiveHintsEnabled")}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    localPrefs.proactiveHintsEnabled
                      ? "bg-indigo-500"
                      : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                      localPrefs.proactiveHintsEnabled
                        ? "translate-x-6"
                        : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              {/* Hint Frequency */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <Label className="text-sm font-medium text-slate-700">
                    Hint Frequency
                  </Label>
                </div>
                <div className="grid gap-2">
                  {HINT_FREQUENCY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSelect("hintFrequency", option.value)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border-2 transition-colors text-left",
                        localPrefs.hintFrequency === option.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {option.label}
                        </p>
                        <p className="text-xs text-slate-500">{option.description}</p>
                      </div>
                      {localPrefs.hintFrequency === option.value && (
                        <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hint Style */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <Label className="text-sm font-medium text-slate-700">
                    Hint Style
                  </Label>
                </div>
                <div className="grid gap-2">
                  {HINT_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSelect("preferredHintStyle", option.value)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border-2 transition-colors text-left",
                        localPrefs.preferredHintStyle === option.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {option.label}
                        </p>
                        <p className="text-xs text-slate-500">{option.description}</p>
                      </div>
                      {localPrefs.preferredHintStyle === option.value && (
                        <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resource Suggestions Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Resource Suggestions
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Show video and article recommendations
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle("showResourceSuggestions")}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    localPrefs.showResourceSuggestions
                      ? "bg-indigo-500"
                      : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                      localPrefs.showResourceSuggestions
                        ? "translate-x-6"
                        : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
          <Button variant="neutral" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || preferences === undefined}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Settings button component to trigger the modal
export function TutorSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        title="AI Tutor Settings"
      >
        <Settings className="w-5 h-5 text-slate-500" />
      </button>
      <TutorSettings isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

