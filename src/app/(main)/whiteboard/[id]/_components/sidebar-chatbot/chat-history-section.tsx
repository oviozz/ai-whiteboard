"use client"

import { useMemo } from "react"
import type { 
  ChatHistoryItem, 
  ChatHistoryPromptItem, 
  ChatHistoryActionItem,
  ChatHistoryContinuationItem,
} from "@/lib/agent/types"
import { ChatHistoryPrompt } from "./chat-history-prompt"
import { ChatHistoryGroup, getActionHistoryGroups } from "./chat-history-group"
import { Loader2 } from "lucide-react"

// Re-export type (used in chat-history.tsx)
export type { ChatHistoryItem }

export interface ChatHistorySectionData {
  prompt: ChatHistoryPromptItem
  items: (ChatHistoryActionItem | ChatHistoryContinuationItem)[]
}

interface ChatHistorySectionProps {
  section: ChatHistorySectionData
  loading: boolean
  onAccept?: (item: ChatHistoryActionItem) => void
  onReject?: (item: ChatHistoryActionItem) => void
}

export function ChatHistorySection({ section, loading, onAccept, onReject }: ChatHistorySectionProps) {
  const actions = section.items.filter((item): item is ChatHistoryActionItem => item.type === "action")
  const groups = useMemo(() => getActionHistoryGroups(actions), [actions])

  return (
    <div className="space-y-3">
      <ChatHistoryPrompt item={section.prompt} />
      {groups.map((group, i) => (
        <ChatHistoryGroup 
          key={`group-${i}`} 
          group={group}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm px-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Thinking...</span>
        </div>
      )}
    </div>
  )
}

export function getAgentHistorySections(items: ChatHistoryItem[]): ChatHistorySectionData[] {
  const sections: ChatHistorySectionData[] = []

  for (const item of items) {
    if (item.type === "prompt") {
      sections.push({ prompt: item, items: [] })
      continue
    }

    if (sections.length > 0) {
      sections[sections.length - 1].items.push(item)
    }
  }

  return sections
}

