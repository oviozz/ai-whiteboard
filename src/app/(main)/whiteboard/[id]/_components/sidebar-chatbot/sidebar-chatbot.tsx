"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
} from "react";
import { Send, Bot, Loader, ChevronRight, Trash2 } from "lucide-react";
import { BsStars } from "react-icons/bs";
import ChatbotSuggestion from "@/app/(main)/whiteboard/[id]/_components/sidebar-chatbot/chatbot-suggestion";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { cn, timeAgo } from "@/lib/utils";
import MarkdownRenderer from "@/components/markdown-renderer";
import { toast } from "sonner";
import { useTldrawScreenshot } from "@/hooks/use-tldraw-screenshot";
import { useTldrawEditor } from "@/contexts/tldraw-editor-context";
import { executeWhiteboardAction } from "@/lib/tldraw-actions";
import type { WhiteboardAction } from "@/lib/tldraw-actions";

type ChatbotSheetProps = {
  whiteboardID: Id<"whiteboards">;
};

function SidebarChatbot({ whiteboardID }: ChatbotSheetProps) {
  const { editor } = useTldrawEditor();
  const { captureScreenshot, isReady: isScreenshotReady } =
    useTldrawScreenshot();
  const [isSendingUserMessage, startSendingUserMessage] = useTransition();

  const messages = useQuery(api.whiteboardChatBot.getAllMessages, {
    whiteboardID,
  });
  const userSendMessage = useMutation(api.whiteboardChatBot.sendMessage);
  const generateAIResponseAction = useAction(api.ai.generateResponse);

  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeBotMessageId, setActiveBotMessageId] =
    useState<Id<"whiteboardChatBot"> | null>(null);
  const [errorFromAI, setErrorFromAI] = useState<string | null>(null);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const generateUploadUrlMutation = useMutation(
    api.whiteboardActions.generateUploadUrl
  );

  const removeAllChatMessages = useMutation(
    api.whiteboardChatBot.deleteAllWhiteboardMessages
  );

  const isGeneratingResponse = useMemo(() => {
    if (!activeBotMessageId) return false;
    const activeBotMessage = messages?.find(
      (m) => m._id === activeBotMessageId
    );
    if (activeBotMessage) {
      if (activeBotMessage.text === "...") return true;
      if (errorFromAI && activeBotMessage.text === errorFromAI) return false;
      return false;
    }
    return true;
  }, [activeBotMessageId, messages, errorFromAI]);

  // Handle AI whiteboard actions from messages
  const handleWhiteboardAction = useCallback(
    (action: WhiteboardAction) => {
      if (!editor) {
        toast.error("Whiteboard not ready");
        return;
      }

      try {
        executeWhiteboardAction(editor, action);
        toast.success(
          `Added ${action.type === "addProblem" ? "problem" : "content"} to whiteboard`
        );
      } catch (error) {
        console.error("Failed to execute whiteboard action:", error);
        toast.error("Failed to add content to whiteboard");
      }
    },
    [editor]
  );

  // Parse AI response for whiteboard triggers
  const parseResponseForWhiteboardAction = useCallback(
    (text: string): WhiteboardAction | null => {
      const triggers = [
        "I'll add this problem to your whiteboard:",
        "I'll add this to your whiteboard:",
        "Adding to your whiteboard:",
        "Here's the problem for your whiteboard:",
      ];

      for (const trigger of triggers) {
        if (text.toLowerCase().includes(trigger.toLowerCase())) {
          const content = text.split(trigger)[1]?.trim();
          if (content) {
            return {
              type: "addProblem",
              content,
            };
          }
        }
      }

      return null;
    },
    []
  );

  // Watch for completed AI messages and check for whiteboard actions
  useEffect(() => {
    if (!activeBotMessageId || !messages) return;

    const activeBotMessage = messages.find((m) => m._id === activeBotMessageId);
    if (
      activeBotMessage &&
      activeBotMessage.text !== "..." &&
      activeBotMessage.isBot
    ) {
      // Check if the message contains a whiteboard action trigger
      const action = parseResponseForWhiteboardAction(activeBotMessage.text);
      if (action) {
        // Small delay to let the message render first
        setTimeout(() => {
          handleWhiteboardAction(action);
        }, 500);
      }
    }
  }, [
    messages,
    activeBotMessageId,
    parseResponseForWhiteboardAction,
    handleWhiteboardAction,
  ]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === "" || !whiteboardID) return;

    const currentUserMessage = inputValue;
    setInputValue("");
    setErrorFromAI(null);

    startSendingUserMessage(async () => {
      await userSendMessage({
        whiteboardID,
        text: currentUserMessage,
      });
    });

    setActiveBotMessageId(null);
    try {
      // Use tldraw's native screenshot capture
      const screenshot_blob = await captureScreenshot();

      let storageId: Id<"_storage"> | undefined;

      if (screenshot_blob) {
        const uploadUrl = await generateUploadUrlMutation();
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          body: screenshot_blob,
        });

        if (!uploadResult.ok)
          throw new Error(`Upload failed: ${uploadResult.statusText}`);
        const uploadData = await uploadResult.json();
        storageId = uploadData.storageId;
      }

      const result = await generateAIResponseAction({
        whiteboardID,
        userMessage: currentUserMessage,
        ...(storageId && { storageID: storageId }),
      });

      if (result && result.success && result.botMessageId) {
        setActiveBotMessageId(result.botMessageId as Id<"whiteboardChatBot">);
      } else {
        console.error("Error initiating AI response:", result?.error);
        setErrorFromAI(
          result?.error || "Failed to start AI response. Please try again."
        );
        setActiveBotMessageId(null);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "A network error occurred. Please try again.";
      console.error("Client-side error calling AI action:", error);
      setErrorFromAI(errorMessage);
      setActiveBotMessageId(null);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isGeneratingResponse && !isSendingUserMessage) {
      textAreaRef.current?.focus();
    }
  }, [isOpen, isGeneratingResponse, isSendingUserMessage]);

  useEffect(() => {
    if (errorFromAI && !activeBotMessageId && messages) {
      console.warn("AI Initiation Error:", errorFromAI);
    }
  }, [errorFromAI, activeBotMessageId, messages]);

  return (
    <>
      {/* Tab sticking to right wall */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-40",
          "flex items-center gap-1.5 pl-2.5 pr-3 py-3",
          "text-slate-600 hover:text-blue-600",
          "bg-white border border-r-0 border-slate-200",
          "rounded-l-lg transition-all duration-200",
          "hover:bg-slate-50",
          isOpen ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
        )}
      >
        <BsStars className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className="text-xs font-medium writing-mode-vertical whitespace-nowrap">
          Need Help?
        </span>
      </button>

      {/* Sidebar Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50",
          "flex flex-col bg-white border-l border-slate-200",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          "w-[380px] max-w-[90vw]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">
                AI Assistant
              </h2>
              {!isScreenshotReady && (
                <span className="text-xs text-slate-400">Loading...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={async () => {
                if (whiteboardID) {
                  const { success, message } = await removeAllChatMessages({
                    whiteboardID,
                  });
                  if (success) {
                    toast.success(message);
                    setActiveBotMessageId(null);
                  }
                }
              }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar bg-slate-50">
          {messages && messages.length === 0 && !isGeneratingResponse && (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <BsStars className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="font-medium text-slate-700 mb-1">
                How can I help?
              </h3>
              <p className="text-sm text-slate-500">
                Ask me anything about your whiteboard!
              </p>
            </div>
          )}
          {messages?.map((message) => (
            <div
              key={message._id}
              className={cn(
                "flex flex-col gap-1 w-full overflow-x-hidden",
                message.isBot ? "items-start" : "items-end"
              )}
            >
              <div
                className={cn(
                  "flex gap-2 items-end max-w-[85%]",
                  message.isBot ? "flex-row" : "flex-row-reverse"
                )}
              >
                {message.isBot && (
                  <div className="flex-shrink-0 h-6 w-6 bg-blue-500 text-white rounded-full flex items-center justify-center self-start">
                    <Bot size={12} />
                  </div>
                )}
                <div
                  className={cn(
                    "p-3 rounded-2xl text-sm break-words",
                    message.isBot
                      ? "bg-white text-slate-700 rounded-bl-md border border-slate-100"
                      : "bg-blue-500 text-white rounded-br-md"
                  )}
                >
                  <MarkdownRenderer
                    content={
                      message.text === "..." &&
                      isGeneratingResponse &&
                      message._id === activeBotMessageId
                        ? "Thinking..."
                        : message.text
                    }
                  />
                  {message.isBot &&
                    isGeneratingResponse &&
                    message._id === activeBotMessageId &&
                    message.text === "..." && (
                      <Loader className="h-4 w-4 animate-spin inline-block ml-1.5 text-blue-400 mt-1" />
                    )}
                </div>
              </div>
              <span
                className={cn(
                  "text-xs text-slate-400 px-1 mt-0.5",
                  message.isBot ? "ml-8" : "mr-1"
                )}
              >
                {timeAgo(message.createdAt)}
              </span>
            </div>
          ))}
          {errorFromAI && !activeBotMessageId && (
            <div className="text-center text-red-500 text-sm py-2 px-3 bg-red-50 rounded-lg">
              {errorFromAI}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="flex items-end gap-2 bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
            <textarea
              ref={textAreaRef}
              className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed max-h-24 hide-scrollbar py-1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isGeneratingResponse ? "AI is thinking..." : "Ask anything..."
              }
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (
                    inputValue.trim() !== "" &&
                    !isSendingUserMessage &&
                    !isGeneratingResponse
                  ) {
                    handleSendMessage();
                  }
                }
              }}
              disabled={isSendingUserMessage || isGeneratingResponse}
            />
            <button
              type="button"
              className={cn(
                "p-2 rounded-xl transition-colors",
                inputValue.trim() &&
                  !isSendingUserMessage &&
                  !isGeneratingResponse
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
              disabled={
                inputValue.trim() === "" ||
                isSendingUserMessage ||
                isGeneratingResponse
              }
              onClick={handleSendMessage}
              aria-label="Send message"
            >
              {isSendingUserMessage ||
              (isGeneratingResponse && activeBotMessageId) ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="mt-3">
            <ChatbotSuggestion
              onClickSuggestion={(val) => setInputValue(val)}
            />
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

export default React.memo(SidebarChatbot);
