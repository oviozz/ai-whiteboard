"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronRight, Brain, Loader2 } from "lucide-react"
import MarkdownRenderer from "@/components/markdown-renderer"

interface ThinkingMessageProps {
  content: string
  durationMs?: number
  isThinking?: boolean
  defaultExpanded?: boolean
}

export function ThinkingMessage({
  content,
  durationMs,
  isThinking = false,
  defaultExpanded = false,
}: ThinkingMessageProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const durationText = isThinking
    ? "Thinking..."
    : durationMs
    ? `Thought for ${Math.ceil(durationMs / 1000)}s`
    : "Thought for a moment"

  return (
    <div className="rounded-lg bg-violet-50 border border-violet-100 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-violet-100/50 transition-colors"
        disabled={isThinking && !content}
      >
        {isThinking ? (
          <Loader2 className="w-4 h-4 text-violet-500 flex-shrink-0 animate-spin" />
        ) : (
          <Brain className="w-4 h-4 text-violet-500 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-violet-700 flex-1">
          {durationText}
        </span>
        {content && (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 text-violet-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-violet-400" />
          )
        )}
      </button>
      {isExpanded && content && (
        <div className="px-3 pb-3 text-sm text-violet-700 border-t border-violet-100">
          <div className="pt-2">
            <MarkdownRenderer content={content} />
          </div>
        </div>
      )}
    </div>
  )
}
