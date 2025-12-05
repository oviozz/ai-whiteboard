"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Send,
  Plus,
  X,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  MousePointer2,
  Crosshair,
  Mic,
  MicOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTldrawScreenshot } from "@/hooks/use-tldraw-screenshot";
import { useTldrawEditor } from "@/contexts/tldraw-editor-context";
import {
  createAgentExecutor,
  getCanvasContext,
  isCanvasAction,
  type AgentAction,
  type Streaming,
} from "@/lib/agent";
import type {
  ChatHistoryItem,
  ChatHistoryActionItem,
  ChatHistoryPromptItem,
} from "@/lib/agent/types";
import { ChatHistory } from "./chat-history";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import type { RecordsDiff, TLRecord, TLShapeId } from "tldraw";
import { reverseRecordsDiff } from "tldraw";
import { useVoiceInput } from "@/hooks/use-voice-input";
import useVoiceState from "@/app/store/use-voice-state";
import { VoiceOverlay } from "@/components/voice";
import { useQuery } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import useSolveAll from "@/app/store/use-solve-all";
import { AVAILABLE_MODELS, type ModelId } from "@/lib/models";

type ChatbotSheetProps = {
  whiteboardID: Id<"whiteboards">;
  isOpen: boolean;
  onToggle: () => void;
};

function SidebarChatbot({ whiteboardID, isOpen, onToggle }: ChatbotSheetProps) {
  const { editor } = useTldrawEditor();
  const { captureScreenshot } = useTldrawScreenshot();

  // Fetch documents for this whiteboard to provide context to AI
  const documents = useQuery(api.documents.getDocumentsByWhiteboard, {
    whiteboardID,
  });

  // Chat state
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<ModelId>(
    "google/gemini-2.0-flash"
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Selection context
  const [useSelection, setUseSelection] = useState(false);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);

  // Agent executor
  const agentExecutorRef = useRef<ReturnType<
    typeof createAgentExecutor
  > | null>(null);

  // Refs
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  // Voice state from global store
  const {
    isVoiceEnabled,
    voiceState,
    setVoiceEnabled,
    setVoiceState,
    setTranscript: setGlobalTranscript,
    setInterimTranscript: setGlobalInterimTranscript,
    setError: setGlobalError,
    clearTranscript: clearGlobalTranscript,
  } = useVoiceState();

  // Track if voice message is being processed
  const voiceMessagePendingRef = useRef(false);

  // Get selected model details
  const currentModel = useMemo(
    () =>
      AVAILABLE_MODELS.find((m) => m.id === selectedModel) ||
      AVAILABLE_MODELS[0],
    [selectedModel]
  );

  // Initialize agent executor when editor is available
  useEffect(() => {
    if (editor) {
      agentExecutorRef.current = createAgentExecutor(editor);
    }
  }, [editor]);

  // Voice input hook
  const {
    isSupported: isVoiceSupported,
    isListening,
    transcript: voiceTranscript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript: clearVoiceTranscript,
    getCurrentTranscript,
  } = useVoiceInput({
    continuous: true,
    interimResults: true,
    onStateChange: setVoiceState,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setGlobalTranscript(text);
      } else {
        setGlobalInterimTranscript(text);
      }
    },
    // No onFinalTranscript - we only process when user explicitly stops
    onError: (err) => {
      setGlobalError(err);
      toast.error(err);
      // Disable voice mode on error to prevent retry loops
      setVoiceEnabled(false);
    },
  });

  // Auto-send voice message ref - will be set after handleSendMessage is defined
  const sendVoiceMessageRef = useRef<(() => void) | null>(null);

  // Sync voice enabled state with listening
  useEffect(() => {
    // Don't try to start listening if there was an error
    if (voiceState === "error") {
      return;
    }

    if (
      isVoiceEnabled &&
      !isListening &&
      voiceState === "idle" &&
      !isGenerating
    ) {
      startListening();
    } else if (!isVoiceEnabled && isListening) {
      stopListening();
    }
  }, [
    isVoiceEnabled,
    isListening,
    voiceState,
    isGenerating,
    startListening,
    stopListening,
  ]);

  // Toggle voice mode
  const handleToggleVoice = useCallback(() => {
    if (!isVoiceSupported) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    if (isVoiceEnabled) {
      stopListening();
      setVoiceEnabled(false);
      clearVoiceTranscript();
      clearGlobalTranscript();
    } else {
      setVoiceEnabled(true);
    }
  }, [
    isVoiceSupported,
    isVoiceEnabled,
    stopListening,
    setVoiceEnabled,
    clearVoiceTranscript,
    clearGlobalTranscript,
  ]);

  // Track selection changes from canvas
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const selected = editor.getSelectedShapeIds();
      setSelectedShapeIds(selected.map((id) => id.toString()));
    };

    // Initial update
    updateSelection();

    // Listen for selection changes
    const unsubscribe = editor.store.listen(updateSelection, {
      source: "user",
      scope: "session",
    });

    return () => unsubscribe();
  }, [editor]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cancel any ongoing request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Handle accepting an action (re-apply if previously rejected)
  const handleAcceptAction = useCallback(
    (item: ChatHistoryActionItem) => {
      if (!editor) return;

      const action = item.action;
      if (!isCanvasAction(action)) return;

      if (item.acceptance === "rejected" && item.diff) {
        editor.store.applyDiff(item.diff as RecordsDiff<TLRecord>);
      }

      setChatHistory((prev) =>
        prev.map((i) =>
          i === item ? { ...i, acceptance: "accepted" as const } : i
        )
      );
    },
    [editor]
  );

  // Handle rejecting an action (undo using diff)
  const handleRejectAction = useCallback(
    (item: ChatHistoryActionItem) => {
      if (!editor) return;

      if (item.acceptance !== "rejected" && item.diff) {
        const reverseDiff = reverseRecordsDiff(
          item.diff as RecordsDiff<TLRecord>
        );
        editor.store.applyDiff(reverseDiff);
      }

      setChatHistory((prev) =>
        prev.map((i) =>
          i === item ? { ...i, acceptance: "rejected" as const } : i
        )
      );
    },
    [editor]
  );

  // Stream agent response from API
  const streamAgentResponse = useCallback(
    async (message: string) => {
      if (!editor) return;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsGenerating(true);

      const executedActions = new Set<string>();
      const createdShapeIds: string[] = []; // Track shapes created during this session

      // Build message with selection context if enabled
      let finalMessage = message;
      if (useSelection && selectedShapeIds.length > 0) {
        finalMessage = `[Context: User has selected ${selectedShapeIds.length} shape(s): ${selectedShapeIds.join(", ")}]\n\n${message}`;
      }

      const promptItem: ChatHistoryPromptItem = {
        type: "prompt",
        message: finalMessage,
        timestamp: Date.now(),
      };
      setChatHistory((prev) => [...prev, promptItem]);

      try {
        const context = getCanvasContext(editor);
        const viewport = editor.getViewportPageBounds();

        let screenshotBase64: string | undefined;
        try {
          const blob = await captureScreenshot();
          if (blob) {
            const reader = new FileReader();
            screenshotBase64 = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        } catch (e) {
          console.warn("Screenshot capture failed:", e);
        }

        // Build document context from uploaded PDFs/study materials
        const documentContext = documents?.map((doc) => ({
          filename: doc.filename,
          extractedContent: doc.extractedContent || undefined,
          problems: doc.extractedProblems?.map((p) => ({
            id: p.id,
            text: p.text,
            pageNumber: p.pageNumber,
            difficulty: p.difficulty,
          })),
        }));

        const response = await fetch("/api/whiteboard/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: finalMessage,
            shapes: context.shapes,
            selectedShapes: useSelection
              ? selectedShapeIds
              : context.selectedShapeIds,
            viewportBounds: {
              x: viewport.x,
              y: viewport.y,
              w: viewport.w,
              h: viewport.h,
            },
            screenshot: screenshotBase64,
            whiteboardTopic: "Physics/Math Problems",
            model: selectedModel,
            documentContext:
              documentContext && documentContext.length > 0
                ? documentContext
                : undefined,
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const match = line.match(/^data: (.+)$/m);
            if (match) {
              const data = match[1];
              if (data === "[DONE]") continue;

              try {
                const action: Streaming<AgentAction> = JSON.parse(data);

                if ("error" in action) {
                  throw new Error((action as { error: string }).error);
                }

                const actionItem: ChatHistoryActionItem = {
                  type: "action",
                  action,
                  acceptance: "accepted",
                };

                setChatHistory((prev) => {
                  const lastItem = prev.at(-1);
                  if (
                    lastItem?.type === "action" &&
                    !lastItem.action.complete &&
                    lastItem.action._type === action._type
                  ) {
                    return [...prev.slice(0, -1), actionItem];
                  }
                  return [...prev, actionItem];
                });

                if (
                  isCanvasAction(action) &&
                  action.complete &&
                  agentExecutorRef.current
                ) {
                  let actionKey = `${action._type}-${Date.now()}`;
                  if (action._type === "create") {
                    actionKey = `${action._type}-${action.shape?.shapeId || "intent" in action ? (action as { intent?: string }).intent : Date.now()}`;
                    // Track created shape IDs for zooming later
                    if (action.shape?.shapeId) {
                      createdShapeIds.push(`shape:${action.shape.shapeId}`);
                    }
                  } else if ("intent" in action) {
                    actionKey = `${action._type}-${(action as { intent: string }).intent}`;
                  }

                  if (!executedActions.has(actionKey)) {
                    executedActions.add(actionKey);

                    let diff: RecordsDiff<TLRecord> | undefined;
                    const executor = agentExecutorRef.current;

                    diff = editor.store.extractingChanges(() => {
                      const result = executor.executeAction(action);
                      if (!result.success) {
                        console.warn("Action execution failed:", result.error);
                      }
                    });

                    if (diff) {
                      setChatHistory((prev) => {
                        const lastItem = prev.at(-1);
                        if (
                          lastItem?.type === "action" &&
                          lastItem.action._type === action._type
                        ) {
                          return [
                            ...prev.slice(0, -1),
                            { ...lastItem, diff } as ChatHistoryActionItem,
                          ];
                        }
                        return prev;
                      });
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to parse action:", e);
              }
            }
          }
        }
        // After streaming completes, zoom to the created shapes
        if (createdShapeIds.length > 0) {
          // Small delay to ensure all shapes are rendered
          setTimeout(() => {
            try {
              // Get bounds of all created shapes
              const shapes = createdShapeIds
                .map((id) => editor.getShape(id as TLShapeId))
                .filter((s): s is NonNullable<typeof s> => s !== undefined);

              if (shapes.length > 0) {
                // Calculate combined bounds
                let minX = Infinity,
                  minY = Infinity,
                  maxX = -Infinity,
                  maxY = -Infinity;

                for (const shape of shapes) {
                  const bounds = editor.getShapePageBounds(shape.id);
                  if (bounds) {
                    minX = Math.min(minX, bounds.x);
                    minY = Math.min(minY, bounds.y);
                    maxX = Math.max(maxX, bounds.x + bounds.w);
                    maxY = Math.max(maxY, bounds.y + bounds.h);
                  }
                }

                // Add some padding around the content
                const padding = 100;
                const zoomBounds = {
                  x: minX - padding,
                  y: minY - padding,
                  w: maxX - minX + padding * 2,
                  h: maxY - minY + padding * 2,
                };

                // Zoom to the bounds with animation
                editor.zoomToBounds(zoomBounds, {
                  inset: 50,
                  animation: { duration: 400 },
                });
              }
            } catch (e) {
              console.warn("Failed to zoom to created shapes:", e);
            }
          }, 200);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          console.log("Request cancelled");
          return;
        }
        console.error("Stream error:", error);
        toast.error("Failed to get AI response");
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
        setUseSelection(false); // Reset selection after sending
      }
    },
    [
      editor,
      captureScreenshot,
      selectedModel,
      useSelection,
      selectedShapeIds,
      documents,
    ]
  );

  const handleSendMessage = useCallback(async () => {
    const message = inputValue.trim();
    if (!message) {
      if (isGenerating) {
        abortControllerRef.current?.abort();
        setIsGenerating(false);
      }
      return;
    }

    setInputValue("");
    clearVoiceTranscript();
    clearGlobalTranscript();
    await streamAgentResponse(message);
  }, [
    inputValue,
    isGenerating,
    streamAgentResponse,
    clearVoiceTranscript,
    clearGlobalTranscript,
  ]);

  // Update ref for voice auto-send
  useEffect(() => {
    sendVoiceMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Auto-send when voice transcript is set in input
  useEffect(() => {
    if (voiceMessagePendingRef.current && inputValue.trim() && !isGenerating) {
      voiceMessagePendingRef.current = false;
      // Trigger send after a brief delay
      const timer = setTimeout(() => {
        sendVoiceMessageRef.current?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [inputValue, isGenerating]);

  const handleNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setChatHistory([]);
    setIsGenerating(false);
  }, []);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isGenerating) {
      textAreaRef.current?.focus();
    }
  }, [isOpen, isGenerating]);

  // Toggle selection context
  const handleToggleSelection = useCallback(() => {
    if (selectedShapeIds.length === 0) {
      toast.info("Select shapes on the canvas first");
      return;
    }
    setUseSelection((prev) => !prev);
  }, [selectedShapeIds.length]);

  // Handle voice message from overlay
  const handleVoiceOverlaySend = useCallback(
    async (text: string) => {
      if (text.trim()) {
        setInputValue(text.trim());
        // Small delay to let the input update, then send
        setTimeout(async () => {
          await streamAgentResponse(text.trim());
          setInputValue("");
        }, 50);
      }
      setVoiceEnabled(false);
    },
    [streamAgentResponse, setVoiceEnabled]
  );

  // Handle voice overlay close
  const handleVoiceOverlayClose = useCallback(() => {
    stopListening();
    setVoiceEnabled(false);
    clearVoiceTranscript();
    clearGlobalTranscript();
  }, [
    stopListening,
    setVoiceEnabled,
    clearVoiceTranscript,
    clearGlobalTranscript,
  ]);

  // Keyboard shortcut for voice (Ctrl+Shift+A or Cmd+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Shift+A or Cmd+Shift+A
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();

        if (isVoiceEnabled) {
          // If already listening, get transcript synchronously and send
          const text =
            getCurrentTranscript() || voiceTranscript || interimTranscript;
          if (text?.trim()) {
            handleVoiceOverlaySend(text.trim());
          } else {
            handleVoiceOverlayClose();
          }
        } else {
          // Start voice input
          if (!isVoiceSupported) {
            toast.error("Speech recognition is not supported in this browser");
            return;
          }
          setVoiceEnabled(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isVoiceEnabled,
    getCurrentTranscript,
    isVoiceSupported,
    voiceTranscript,
    interimTranscript,
    setVoiceEnabled,
    handleVoiceOverlaySend,
    handleVoiceOverlayClose,
  ]);

  // Solve it all store
  const { setIsLoading: setSolveLoading } = useSolveAll();

  // Listen for "Solve it All" event from sidebar
  useEffect(() => {
    const handleSolveItAll = async () => {
      if (!editor || isGenerating) return;

      // Check if canvas has content
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) {
        setSolveLoading(false);
        toast.info("Nothing to solve! Add some content to the canvas first.");
        return;
      }

      // Send the solve prompt to the AI
      const solvePrompt = `Please solve everything on the canvas completely. Provide detailed step-by-step solutions for all problems shown. Remove any incorrect work and replace it with the correct, complete solution. Show all steps clearly.`;

      await streamAgentResponse(solvePrompt);

      // Turn off loading when done (the streamAgentResponse handles its own state)
      setSolveLoading(false);
    };

    window.addEventListener("solve-it-all", handleSolveItAll);
    return () => window.removeEventListener("solve-it-all", handleSolveItAll);
  }, [editor, isGenerating, streamAgentResponse, setSolveLoading]);

  return (
    <>
      {/* Voice Overlay - Full screen when voice is active */}
      {isVoiceEnabled && (
        <VoiceOverlay
          onSend={handleVoiceOverlaySend}
          onClose={handleVoiceOverlayClose}
        />
      )}

      {/* Toggle Tab with Voice Button */}
      <div
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50",
          "flex flex-col gap-2",
          "transition-all duration-300",
          isOpen ? "right-[400px]" : "right-0"
        )}
      >
        {/* Voice Button */}
        <button
          onClick={() => {
            if (isVoiceEnabled) {
              // If already listening, get transcript synchronously and send
              // Use getCurrentTranscript() to get the latest value immediately
              const text =
                getCurrentTranscript() || voiceTranscript || interimTranscript;
              if (text?.trim()) {
                handleVoiceOverlaySend(text.trim());
              } else {
                handleVoiceOverlayClose();
              }
            } else {
              if (!isVoiceSupported) {
                toast.error(
                  "Speech recognition is not supported in this browser"
                );
                return;
              }
              setVoiceEnabled(true);
            }
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5",
            "border border-slate-200 border-r-0",
            "rounded-l-lg transition-all duration-200",
            "shadow-sm",
            isVoiceEnabled
              ? "bg-red-500 text-white hover:bg-red-600 border-red-500"
              : "bg-white hover:bg-slate-50"
          )}
          title={
            isVoiceEnabled
              ? "Stop voice input"
              : "Start voice input (Ctrl+Shift+A)"
          }
        >
          {voiceState === "processing" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mic
              className={cn(
                "w-4 h-4",
                isVoiceEnabled ? "text-white" : "text-slate-500"
              )}
            />
          )}
          {!isOpen && (
            <span
              className={cn(
                "text-[10px] font-medium whitespace-nowrap opacity-60",
                isVoiceEnabled ? "text-white" : "text-slate-500"
              )}
            >
              ⌘⇧A
            </span>
          )}
        </button>

        {/* Chat Button */}
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5",
            "border border-r-0 rounded-l-lg transition-all duration-200",
            "bg-white border-slate-200 hover:bg-slate-50",
            "shadow-sm"
          )}
          title={
            isOpen
              ? "Close Assistant"
              : isGenerating
                ? "AI is thinking..."
                : "Open Assistant"
          }
        >
          {isOpen ? (
            <ChevronLeft className="w-4 h-4 text-slate-500 rotate-180" />
          ) : isGenerating ? (
            <div className="flex items-center gap-2">
              {/* Clean spinner */}
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
                <div className="absolute inset-0 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              </div>
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Thinking...
              </span>
            </div>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                AI
              </span>
            </>
          )}
        </button>
      </div>

      {/* Sidebar Panel - Fixed position, full height */}
      <div
        className={cn(
          "fixed top-0 right-0 h-screen bg-white border-l border-slate-200 z-40",
          "flex flex-col transition-transform duration-300 ease-out",
          "w-[400px]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-slate-800 text-sm">
              AI Assistant
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewChat}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat History */}
        <ChatHistory
          items={chatHistory}
          isGenerating={isGenerating}
          onAccept={handleAcceptAction}
          onReject={handleRejectAction}
        />

        {/* Input Area */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          {/* Context buttons */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleToggleSelection}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border",
                useSelection && selectedShapeIds.length > 0
                  ? "bg-orange-50 text-orange-600 border-orange-200"
                  : selectedShapeIds.length > 0
                    ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              )}
              disabled={selectedShapeIds.length === 0}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              Selection
              {selectedShapeIds.length > 0 && (
                <span className="bg-slate-200 text-slate-600 px-1.5 rounded-full text-[10px]">
                  {selectedShapeIds.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
              onClick={() => toast.info("Context picker coming soon!")}
            >
              <Crosshair className="w-3.5 h-3.5" />
              Add Context
            </button>
          </div>

          {/* Voice indicator when listening */}
          {isVoiceEnabled &&
            (voiceState === "listening" || interimTranscript) && (
              <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Mic className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    <span className="text-xs font-medium text-red-600">
                      {voiceState === "listening"
                        ? "Listening..."
                        : "Processing..."}
                    </span>
                  </div>
                  {/* Sound wave animation */}
                  {voiceState === "listening" && (
                    <div className="flex items-center gap-0.5 h-3">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="w-0.5 bg-red-400 rounded-full animate-pulse"
                          style={{
                            height: `${4 + Math.random() * 8}px`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {(interimTranscript || voiceTranscript) && (
                  <p className="mt-1 text-sm text-slate-600 italic">
                    "{interimTranscript || voiceTranscript}"
                  </p>
                )}
              </div>
            )}

          {/* Input box */}
          <div className="bg-white rounded-xl border border-slate-200 focus-within:border-slate-300 transition-colors">
            <textarea
              ref={textAreaRef}
              className="w-full bg-transparent outline-none resize-none text-sm leading-relaxed p-3 text-slate-700 placeholder:text-slate-400 min-h-[100px]"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isGenerating
                  ? "Generating..."
                  : isVoiceEnabled
                    ? "Speak or type your message..."
                    : "Ask, learn, brainstorm, draw"
              }
              rows={4}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>

          {/* Bottom bar with model selector and send button */}
          <div className="flex items-center justify-between mt-3">
            {/* Model selector dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="max-w-[140px] truncate">
                  {currentModel.name}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    isModelDropdownOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Dropdown menu - opens upward */}
              {isModelDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-[100]">
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors",
                        selectedModel === model.id
                          ? "text-orange-600 bg-orange-50"
                          : "text-slate-700"
                      )}
                    >
                      <span>{model.name}</span>
                      <span className="text-xs text-slate-400">
                        {model.provider}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Voice button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                disabled={!isVoiceSupported}
                className={cn(
                  "relative p-2.5 rounded-xl transition-all duration-200",
                  !isVoiceSupported && "opacity-50 cursor-not-allowed",
                  isVoiceEnabled
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                )}
                title={
                  !isVoiceSupported
                    ? "Speech recognition not supported"
                    : isVoiceEnabled
                      ? "Stop voice input"
                      : "Start voice input"
                }
              >
                {voiceState === "processing" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isVoiceEnabled ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
                {/* Listening animation */}
                {voiceState === "listening" && (
                  <span className="absolute inset-0 rounded-xl bg-red-500/30 animate-ping" />
                )}
              </button>

              {/* Send button */}
              <button
                type="button"
                className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  inputValue.trim() || isGenerating
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-slate-200 text-slate-400"
                )}
                disabled={!inputValue.trim() && !isGenerating}
                onClick={handleSendMessage}
                aria-label={isGenerating ? "Cancel" : "Send message"}
              >
                {isGenerating ? (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <span className="text-xs font-bold">■</span>
                  </div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default React.memo(SidebarChatbot);
