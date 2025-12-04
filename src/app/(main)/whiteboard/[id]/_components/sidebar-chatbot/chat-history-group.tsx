"use client"

import { useMemo, useState } from "react"
import type { 
  ChatHistoryActionItem,
  AgentAction,
  Streaming,
} from "@/lib/agent/agent-actions"
import { getActionInfo } from "@/lib/agent/agent-actions"
import { AgentActionDisplay } from "./agent-action-display"
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  X,
  Shapes,
  Pencil,
  Trash2,
  Edit,
  Brain,
  MessageSquare,
  CheckCircle,
  Tag,
} from "lucide-react"
import ReactMarkdown from "react-markdown"

export interface ChatHistoryGroupData {
  items: ChatHistoryActionItem[]
  withCanvasChanges: boolean
}

interface ChatHistoryGroupProps {
  group: ChatHistoryGroupData
  onAccept?: (item: ChatHistoryActionItem) => void
  onReject?: (item: ChatHistoryActionItem) => void
}

export function ChatHistoryGroup({ group, onAccept, onReject }: ChatHistoryGroupProps) {
  if (group.withCanvasChanges) {
    return <ChatHistoryGroupWithChanges group={group} onAccept={onAccept} onReject={onReject} />
  }
  return <ChatHistoryGroupWithoutChanges group={group} />
}

function ChatHistoryGroupWithChanges({ group, onAccept, onReject }: ChatHistoryGroupProps) {
  const { items } = group
  
  // Get acceptance status of the group
  const acceptance = useMemo(() => {
    if (items.length === 0) return "pending"
    const firstAcceptance = items[0].acceptance
    for (const item of items) {
      if (item.acceptance !== firstAcceptance) return "pending"
    }
    return firstAcceptance
  }, [items])

  const handleAcceptAll = () => {
    items.forEach(item => onAccept?.(item))
  }

  const handleRejectAll = () => {
    items.forEach(item => onReject?.(item))
  }

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200">
      {/* Accept/Reject buttons */}
      {acceptance === "pending" && (
        <div className="flex justify-end gap-1 p-2 bg-slate-50 border-b border-slate-200">
          <button
            onClick={handleRejectAll}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
        </div>
      )}
      
      {/* Status badge */}
      {acceptance !== "pending" && (
        <div className={`px-2 py-1 text-xs font-medium ${
          acceptance === "accepted" 
            ? "bg-green-50 text-green-700" 
            : "bg-red-50 text-red-700"
        }`}>
          {acceptance === "accepted" ? "✓ Accepted" : "✕ Rejected"}
        </div>
      )}

      {/* Action list */}
      <div className="p-2 bg-white space-y-2">
        {items.map((item, i) => (
          <ActionItem key={i} action={item.action} />
        ))}
      </div>
    </div>
  )
}

function ChatHistoryGroupWithoutChanges({ group }: { group: ChatHistoryGroupData }) {
  const { items } = group
  const [collapsed, setCollapsed] = useState(true)

  // Filter out null descriptions
  const nonEmptyItems = useMemo(() => {
    return items.filter(item => {
      const info = getActionInfo(item.action)
      return info.description !== null
    })
  }, [items])

  const complete = useMemo(() => {
    return items.every(item => item.action.complete)
  }, [items])

  const summary = useMemo(() => {
    const time = Math.floor(items.reduce((acc, item) => acc + item.action.time, 0) / 1000)
    if (time === 0) return "Thought for less than a second"
    if (time === 1) return "Thought for 1 second"
    return `Thought for ${time} seconds`
  }, [items])

  if (nonEmptyItems.length === 0) return null

  // For single items or message-type actions, show directly
  if (nonEmptyItems.length === 1 || nonEmptyItems.some(i => i.action._type === "message" || i.action._type === "review")) {
    return (
      <div className="space-y-2">
        {nonEmptyItems.map((item, i) => (
          <AgentActionDisplay key={i} action={item.action} />
        ))}
      </div>
    )
  }

  // For multiple thinking actions, make them collapsible
  const showContent = !collapsed || !complete

  return (
    <div className="space-y-2">
      {complete && (
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          {showContent ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {summary}
        </button>
      )}
      {showContent && (
        <div className="space-y-2 pl-2 border-l-2 border-slate-100">
          {nonEmptyItems.map((item, i) => (
            <ActionItem key={i} action={item.action} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActionItem({ action }: { action: Streaming<AgentAction> }) {
  const info = getActionInfo(action)
  if (!info.description) return null

  const Icon = getActionIcon(action._type)

  return (
    <div className={`flex items-start gap-2 text-sm ${
      action._type === "message" || action._type === "review" 
        ? "text-slate-800" 
        : "text-slate-500"
    }`}>
      {Icon && (
        <span className="mt-0.5 flex-shrink-0">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <span className="min-w-0 break-words">
        {action._type === "message" || action._type === "review" ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{info.description}</ReactMarkdown>
          </div>
        ) : (
          info.description
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
    case "bringToFront":
    case "sendToBack":
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

// All action types that modify the canvas
const CANVAS_ACTION_TYPES = [
  "create", "pen", "delete", "update", "label", "place",
  "clear", "move", "resize", "rotate", "align", "distribute", 
  "stack", "bringToFront", "sendToBack"
]

export function getActionHistoryGroups(items: ChatHistoryActionItem[]): ChatHistoryGroupData[] {
  const groups: ChatHistoryGroupData[] = []

  for (const item of items) {
    const info = getActionInfo(item.action)
    if (info.description === null) continue

    // Check if action modifies canvas (using _type)
    const hasCanvasChanges = CANVAS_ACTION_TYPES.includes(item.action._type)

    const lastGroup = groups[groups.length - 1]
    
    // Group similar actions together
    if (lastGroup && canActionBeGrouped(item, lastGroup)) {
      lastGroup.items.push(item)
    } else {
      groups.push({
        items: [item],
        withCanvasChanges: hasCanvasChanges && item.action.complete,
      })
    }
  }

  return groups
}

function canActionBeGrouped(item: ChatHistoryActionItem, group: ChatHistoryGroupData): boolean {
  if (!item.action.complete) return false
  if (!group) return false

  const hasCanvasChanges = CANVAS_ACTION_TYPES.includes(item.action._type)
  if (hasCanvasChanges !== group.withCanvasChanges) return false

  const groupAcceptance = group.items[0]?.acceptance
  if (groupAcceptance !== item.acceptance) return false

  const prevAction = group.items.at(-1)?.action
  if (!prevAction) return false

  // Group thinking actions together
  if (item.action._type === "think" && prevAction._type === "think") return true

  return false
}
