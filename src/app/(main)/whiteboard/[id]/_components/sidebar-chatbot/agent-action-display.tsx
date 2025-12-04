"use client"

import { useState } from "react"
import type { Streaming, AgentAction } from "@/lib/agent/agent-actions"
import { getActionInfo } from "@/lib/agent/agent-actions"
import ReactMarkdown from "react-markdown"
import { 
  ChevronDown, 
  ChevronRight, 
  Sparkles,
  Shapes,
  Pencil,
  Trash2,
  Edit,
  Tag,
  Brain,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react"

interface AgentActionDisplayProps {
  action: Streaming<AgentAction>
}

export function AgentActionDisplay({ action }: AgentActionDisplayProps) {
  const info = getActionInfo(action)
  if (!info.description) return null

  switch (action._type) {
    case "think":
      return <ThinkingDisplay action={action} />
    case "message":
      return <MessageDisplay action={action} />
    case "review":
      return <ReviewDisplay action={action} />
    default:
      return <GenericActionDisplay action={action} />
  }
}

function ThinkingDisplay({ action }: { action: Streaming<AgentAction> & { _type: "think" } }) {
  const [expanded, setExpanded] = useState(false)
  const timeText = action.complete 
    ? `Thought for ${Math.ceil(action.time / 1000)}s`
    : "Thinking..."

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 p-2 text-left hover:bg-slate-100 transition-colors"
      >
        <Brain className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-xs text-slate-500 flex-1">
          {timeText}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-sm text-slate-600 border-t border-slate-200">
          <div className="pt-2 prose prose-sm max-w-none">
            <ReactMarkdown>{action.text}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageDisplay({ action }: { action: Streaming<AgentAction> & { _type: "message" } }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="prose prose-sm max-w-none text-slate-700">
          <ReactMarkdown>{action.text}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function ReviewDisplay({ action }: { action: Streaming<AgentAction> & { _type: "review" } }) {
  const statusConfig = {
    correct: {
      icon: CheckCircle,
      bg: "bg-green-50",
      border: "border-green-200",
      iconColor: "text-green-500",
      textColor: "text-green-800",
      label: "Correct!",
    },
    incorrect: {
      icon: XCircle,
      bg: "bg-red-50",
      border: "border-red-200",
      iconColor: "text-red-500",
      textColor: "text-red-800",
      label: "Needs correction",
    },
    needs_improvement: {
      icon: AlertCircle,
      bg: "bg-amber-50",
      border: "border-amber-200",
      iconColor: "text-amber-500",
      textColor: "text-amber-800",
      label: "Almost there!",
    },
  }

  const config = statusConfig[action.status]
  const Icon = config.icon

  return (
    <div className={`rounded-lg ${config.bg} ${config.border} border p-3`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${config.textColor}`}>{config.label}</p>
          <div className={`prose prose-sm max-w-none mt-1 ${config.textColor}`}>
            <ReactMarkdown>{action.text}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

function GenericActionDisplay({ action }: { action: Streaming<AgentAction> }) {
  const info = getActionInfo(action)
  const Icon = getActionIcon(action._type)
  
  const isCanvasAction = ["create", "pen", "delete", "update", "label", "place", "move", "resize", "rotate", "align", "distribute", "stack", "clear"].includes(action._type)
  
  if (!info.description) return null

  return (
    <div className={`flex items-start gap-2 text-sm rounded-lg p-2 ${
      isCanvasAction 
        ? "bg-slate-50 border border-slate-200 text-slate-600" 
        : "text-slate-500"
    }`}>
      {Icon && (
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
          isCanvasAction ? "text-slate-400" : "text-slate-400"
        }`} />
      )}
      <span className="flex-1 min-w-0">
        {"intent" in action && action.intent 
          ? action.intent 
          : info.description}
        {!action.complete && (
          <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        )}
      </span>
    </div>
  )
}

function getActionIcon(_type: string) {
  switch (_type) {
    case "create":
    case "place":
    case "move":
    case "resize":
    case "rotate":
    case "align":
    case "distribute":
    case "stack":
      return Shapes
    case "pen":
      return Pencil
    case "delete":
    case "clear":
      return Trash2
    case "update":
      return Edit
    case "label":
      return Tag
    case "think":
      return Brain
    case "message":
      return MessageSquare
    case "review":
      return CheckCircle
    default:
      return null
  }
}
