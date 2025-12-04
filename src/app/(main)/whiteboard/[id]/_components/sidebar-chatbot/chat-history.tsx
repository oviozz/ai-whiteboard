"use client"

import { useEffect, useRef } from "react"
import type { 
  ChatHistoryItem, 
  ChatHistoryActionItem,
} from "@/lib/agent/agent-actions"
import { ChatHistorySection, getAgentHistorySections } from "./chat-history-section"

interface ChatHistoryProps {
  items: ChatHistoryItem[]
  isGenerating: boolean
  onAccept?: (item: ChatHistoryActionItem) => void
  onReject?: (item: ChatHistoryActionItem) => void
}

export function ChatHistory({ items, isGenerating, onAccept, onReject }: ChatHistoryProps) {
  const historyRef = useRef<HTMLDivElement>(null)
  const previousScrollDistanceFromBottomRef = useRef(0)

  useEffect(() => {
    if (!historyRef.current) return

    // If a new prompt is submitted by the user, scroll to the bottom
    if (items.at(-1)?.type === "prompt") {
      if (previousScrollDistanceFromBottomRef.current <= 0) {
        historyRef.current.scrollTo(0, historyRef.current.scrollHeight)
        previousScrollDistanceFromBottomRef.current = 0
      }
      return
    }

    // If the user is scrolled to the bottom, keep them there while new actions appear
    if (previousScrollDistanceFromBottomRef.current <= 0) {
      const scrollDistanceFromBottom =
        historyRef.current.scrollHeight -
        historyRef.current.scrollTop -
        historyRef.current.clientHeight

      if (scrollDistanceFromBottom > 0) {
        historyRef.current.scrollTo(0, historyRef.current.scrollHeight)
      }
    }
  }, [items])

  // Keep track of the user's scroll position
  const handleScroll = () => {
    if (!historyRef.current) return
    const scrollDistanceFromBottom =
      historyRef.current.scrollHeight -
      historyRef.current.scrollTop -
      historyRef.current.clientHeight

    previousScrollDistanceFromBottomRef.current = scrollDistanceFromBottom
  }

  const sections = getAgentHistorySections(items)

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 p-4">
        <div className="text-center">
          <p className="text-sm">Start a conversation</p>
          <p className="text-xs mt-1">Ask me to help with your whiteboard!</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={historyRef} 
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200"
    >
      {sections.map((section, i) => (
        <ChatHistorySection
          key={`section-${i}`}
          section={section}
          loading={i === sections.length - 1 && isGenerating}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </div>
  )
}

