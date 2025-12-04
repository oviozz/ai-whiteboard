"use client"

import type { ChatHistoryPromptItem } from "@/lib/agent/agent-actions"
import { User } from "lucide-react"

interface ChatHistoryPromptProps {
  item: ChatHistoryPromptItem
}

export function ChatHistoryPrompt({ item }: ChatHistoryPromptProps) {
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm -mx-4 px-4 py-2">
      <div className="flex gap-2.5 items-start">
        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
            {item.message}
          </p>
        </div>
      </div>
    </div>
  )
}
