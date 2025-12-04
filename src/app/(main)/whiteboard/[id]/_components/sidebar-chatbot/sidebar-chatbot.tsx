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
  type ChatHistoryItem,
  type ChatHistoryActionItem,
  type ChatHistoryPromptItem,
} from "@/lib/agent";
import { ChatHistory } from "./chat-history";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import type { RecordsDiff, TLRecord, TLShapeId } from "tldraw";
import { reverseRecordsDiff } from "tldraw";

// Model options - matching the API route
const AVAILABLE_MODELS = [
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
  },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google" },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
  },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
] as const;

type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

type ChatbotSheetProps = {
  whiteboardID: Id<"whiteboards">;
  isOpen: boolean;
  onToggle: () => void;
};

function SidebarChatbot({
  whiteboardID: _whiteboardID,
  isOpen,
  onToggle,
}: ChatbotSheetProps) {
  const { editor } = useTldrawEditor();
  const { captureScreenshot } = useTldrawScreenshot();

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
          }),
          signal: abortControllerRef.current.signal,
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
    [editor, captureScreenshot, selectedModel, useSelection, selectedShapeIds]
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
    await streamAgentResponse(message);
  }, [inputValue, isGenerating, streamAgentResponse]);

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

  return (
    <>
      {/* Toggle Tab */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50",
          "flex items-center gap-2 px-3 py-4",
          "bg-white border border-slate-200",
          "rounded-l-xl transition-all duration-300",
          "hover:bg-slate-50",
          isOpen ? "right-[400px] border-r-0" : "right-0 border-r-0"
        )}
        title={isOpen ? "Close Assistant" : "Open Assistant"}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4 text-slate-500 rotate-180" />
        ) : (
          <>
            <Sparkles className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
              AI
            </span>
          </>
        )}
      </button>

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

          {/* Input box */}
          <div className="bg-white rounded-xl border border-slate-200 focus-within:border-slate-300 transition-colors">
            <textarea
              ref={textAreaRef}
              className="w-full bg-transparent outline-none resize-none text-sm leading-relaxed p-3 text-slate-700 placeholder:text-slate-400 min-h-[100px]"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isGenerating ? "Generating..." : "Ask, learn, brainstorm, draw"
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
    </>
  );
}

export default React.memo(SidebarChatbot);
