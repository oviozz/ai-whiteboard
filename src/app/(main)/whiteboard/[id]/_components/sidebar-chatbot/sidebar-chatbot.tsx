"use client";
import React, {useState, useRef, useEffect, useTransition, useMemo} from 'react';
import {Send, Bot, X, Loader, ChevronUp} from 'lucide-react';
import ChatbotSuggestion from "@/app/(main)/whiteboard/[id]/_components/sidebar-chatbot/chatbot-suggestion"; // Assuming this exists
import {useMutation, useQuery, useAction} from "convex/react";
import {api} from "../../../../../../../convex/_generated/api"; // Adjust path as needed
import {Id} from "../../../../../../../convex/_generated/dataModel";
import {cn, timeAgo} from "@/lib/utils";
import MarkdownRenderer from "@/components/markdown-renderer";
import {toast} from "sonner";
import useScreenshot from "@/hooks/use-screenshot"; // Assuming this exists

type ChatbotSheetProps = {
    whiteboardID: Id<"whiteboards">;
}

function SidebarChatbot({whiteboardID}: ChatbotSheetProps) {

    const { screenshotBlog } = useScreenshot();
    const [isSendingUserMessage, startSendingUserMessage] = useTransition();

    const messages = useQuery(api.whiteboardChatBot.getAllMessages, {whiteboardID});
    const userSendMessage = useMutation(api.whiteboardChatBot.sendMessage);
    const generateAIResponseAction = useAction(api.ai.generateResponse);

    const [inputValue, setInputValue] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [activeBotMessageId, setActiveBotMessageId] = useState<Id<"whiteboardChatBot"> | null>(null);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const generateUploadUrlMutation = useMutation(api.whiteboardActions.generateUploadUrl);

    const removeAllChatMessages = useMutation(api.whiteboardChatBot.deleteAllWhiteboardMessages);

    const isGeneratingResponse = useMemo(() => {
        if (!activeBotMessageId) return false;
        const activeBotMessage = messages?.find(m => m._id === activeBotMessageId);
        if (activeBotMessage) {
            // If text is placeholder OR if it's an error message we set and want to show as "generating done"
            if (activeBotMessage.text === "...") return true;
            if (errorFromAI && activeBotMessage.text === errorFromAI) return false; // Error shown, generation "stopped"
            // Heuristic: if updatedAt is very recent, assume it might still be streaming
            // This is tricky without a definitive "status" field.
            // For now, "..." is the main indicator.
            return false; // if not "..." it's either done or has content
        }
        // If message not found yet, but we have an ID, assume it's coming/generating.
        return true;
    }, [activeBotMessageId, messages, errorFromAI]);


    const handleSendMessage = async () => {
        if (inputValue.trim() === '' || !whiteboardID) return;

        const currentUserMessage = inputValue;
        setInputValue('');
        setErrorFromAI(null); // Clear previous AI error

        startSendingUserMessage(async () => {
            await userSendMessage({
                whiteboardID,
                text: currentUserMessage,
            });
        });

        setActiveBotMessageId(null); // Reset before new AI call
        try {

            const screenshot_blob = await screenshotBlog();
            const uploadUrl = await generateUploadUrlMutation();
            const uploadResult = await fetch(uploadUrl, { method: "POST", body: screenshot_blob });

            if (!uploadResult.ok) throw new Error(`Upload failed: ${uploadResult.statusText}`);
            const { storageId } = await uploadResult.json();

            const result = await generateAIResponseAction({
                whiteboardID,
                userMessage: currentUserMessage,
                ...(storageId) && { storageID: storageId }
            });

            if (result && result.success && result.botMessageId) {
                setActiveBotMessageId(result.botMessageId as Id<"whiteboardChatBot">);
            } else {
                console.error("Error initiating AI response:", result?.error);
                setErrorFromAI(result?.error || "Failed to start AI response. Please try again.");
                setActiveBotMessageId(null); // Ensure no lingering active ID on failure
            }
        } catch (error: any) {
            console.error("Client-side error calling AI action:", error);
            setErrorFromAI(error.message || "A network error occurred. Please try again.");
            setActiveBotMessageId(null);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages]);

    // Auto-focus textarea when expanded and not generating
    useEffect(() => {
        if (!isCollapsed && !isGeneratingResponse && !isSendingUserMessage) {
            textAreaRef.current?.focus();
        }
    }, [isCollapsed, isGeneratingResponse, isSendingUserMessage]);

    // If an error occurred during AI initiation, display it as a temporary message
    useEffect(() => {
        if (errorFromAI && !activeBotMessageId && messages) { // Show if no bot message was even created
            // This part is tricky; ideally the error is part of a message.
            // For now, console log it, user sees it in the input disabled state.
            // Or add a temporary error display area.
            console.warn("AI Initiation Error:", errorFromAI)
        }
    }, [errorFromAI, activeBotMessageId, messages]);

    return (
        <div
            className={`fixed bottom-0 right-4 flex flex-col bg-white border border-b-0 border-gray-300 rounded-t-lg transition-all duration-300 ease-in-out ${isCollapsed ? 'h-[52px]' : 'h-9/10'} min-h-[52px]`}
            style={{width: 'clamp(320px, 90vw, 520px)'}}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 cursor-pointer"
                 onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center">
                    <Bot className="h-6 w-6 text-blue-600 mr-2"/>
                    <h2 className="font-semibold text-gray-700">Whiteboard AI</h2>
                </div>

                <div className={"flex items-center gap-2"}>

                    <button
                        type={"button"}
                        onClick={async (e) => {
                            e.stopPropagation();
                            if (whiteboardID) {
                                const {success, message} = await removeAllChatMessages({whiteboardID});
                                if (success) {
                                    toast.success(message);
                                    setActiveBotMessageId(null);
                                    return;
                                }
                            }
                        }}
                        className={"bg-red-500 text-white rounded-xl px-2 py-1 text-sm hover:cursor-pointer hover:bg-red-600"}
                    >
                        Clear Chat
                    </button>

                    <button
                        type={"button"}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCollapsed(!isCollapsed);
                        }}
                        className="p-1.5 text-gray-500 hover:text-gray-700 bg-gray-100 rounded-md"
                        aria-label={isCollapsed ? "Expand chat" : "Collapse chat"}
                    >
                        { isCollapsed ? (
                            <ChevronUp className={"w-5 h-5"} />
                        ) : (
                            <X className="h-5 w-5"/>
                        )}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar bg-gray-50">
                        {messages && messages.length === 0 && !isGeneratingResponse && (
                            <div className="text-center text-gray-500 text-sm py-6">
                                Ask the AI anything about your whiteboard!
                            </div>
                        )}
                        {messages?.map((message, index) => (
                            <div
                                key={message._id}
                                className={cn(
                                    "flex flex-col gap-1 w-full overflow-x-hidden",
                                    message.isBot ? 'items-start' : 'items-end'
                                )}
                            >
                                <div
                                    className={cn("flex gap-2 items-end", message.isBot ? "flex-row" : "flex-row-reverse")}>
                                    {message.isBot && (
                                        <div
                                            className="flex-shrink-0 h-7 w-7 bg-blue-500 text-white rounded-full flex items-center justify-center self-start">
                                            <Bot size={16}/>
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            " p-3 rounded-xl text-sm shadow-md break-words",
                                            message.isBot
                                                ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-bl-none border border-neutral-200 dark:border-neutral-600'
                                                : 'bg-blue-500 text-white rounded-br-none'
                                        )}
                                    >
                                        <MarkdownRenderer
                                            content={message.text === "..." && isGeneratingResponse && message._id === activeBotMessageId ? "Thinking..." : message.text}
                                        />
                                        {message.isBot && isGeneratingResponse && message._id === activeBotMessageId && message.text === "..." && (
                                            <Loader
                                                className="h-4 w-4 animate-spin inline-block ml-1.5 text-blue-400 dark:text-blue-500 mt-1"/>
                                        )}
                                    </div>
                                </div>
                                <span className={cn(
                                    'text-xs text-neutral-400 dark:text-neutral-500 px-1 mt-0.5',
                                    message.isBot ? "ml-9" : "mr-1" // Align with bubble edge
                                )}>
                                    {timeAgo(message.createdAt)}
                                </span>
                            </div>
                        ))}
                        {/* Display general AI error if it occurred before a message was created */}
                        {errorFromAI && !activeBotMessageId && (
                            <div className="text-center text-red-500 text-sm py-2 p-2 bg-red-50 rounded-md">
                                {errorFromAI}
                            </div>
                        )}
                        <div ref={messagesEndRef}/>
                    </div>

                    <div className="flex flex-col gap-3 p-3 border-t border-gray-200 bg-white">
                        <div className="flex items-center bg-gray-100 border border-gray-300 rounded-lg px-3 py-1">
                            <textarea
                                ref={textAreaRef}
                                className="flex-1 bg-transparent outline-none resize-none text-sm leading-tight max-h-28 hide-scrollbar"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={isGeneratingResponse ? "AI is responding..." : "Type your message..."}
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (inputValue.trim() !== '' && !isSendingUserMessage && !isGeneratingResponse) {
                                            handleSendMessage();
                                        }
                                    }
                                }}
                                disabled={isSendingUserMessage || isGeneratingResponse}
                            />
                            <button
                                type="button"
                                className="ml-2 text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                                disabled={inputValue.trim() === '' || isSendingUserMessage || isGeneratingResponse}
                                onClick={handleSendMessage}
                                aria-label="Send message"
                            >
                                {(isSendingUserMessage || (isGeneratingResponse && activeBotMessageId)) ? ( // Show loader if processing or active bot message is generating
                                    <Loader className={"w-5 h-5 animate-spin"}/>
                                ) : (
                                    <Send className="w-5 h-5"/>
                                )}
                            </button>
                        </div>
                        <ChatbotSuggestion onClickSuggestion={(val) => setInputValue(val)}/>
                    </div>
                </>
            )}
        </div>
    );
}

export default React.memo(SidebarChatbot);
