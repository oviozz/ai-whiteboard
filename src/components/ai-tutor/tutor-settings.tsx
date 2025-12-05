"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Settings,
  X,
  Loader2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import useTutorHints from "@/app/store/use-tutor-hints";

type TutorSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function TutorSettings({ isOpen, onClose }: TutorSettingsProps) {
  const preferences = useQuery(api.users.getTutorPreferences);
  const updatePreferences = useMutation(api.users.updateTutorPreferences);
  const { setProactiveHintsEnabled } = useTutorHints();

  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with server preferences
  useEffect(() => {
    if (preferences) {
      setProactiveEnabled(preferences.proactiveHintsEnabled);
    }
  }, [preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        preferences: {
          proactiveHintsEnabled: proactiveEnabled,
          hintFrequency: "medium", // Default
          preferredHintStyle: "auto", // Default
          showResourceSuggestions: true, // Always enabled
        },
      });
      // Update local store
      setProactiveHintsEnabled(proactiveEnabled);
      onClose();
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border-2 border-slate-200 w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            <h2 className="font-semibold text-slate-800">AI Tutor</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {preferences === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <Zap className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Proactive AI Tutor
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    AI reviews your work and provides guidance when you make
                    mistakes or need help. Includes hints, alerts, and helpful
                    video resources.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProactiveEnabled(!proactiveEnabled)}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
                  proactiveEnabled ? "bg-indigo-500" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                    proactiveEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
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
              "Save"
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
