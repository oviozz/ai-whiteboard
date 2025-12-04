"use client"

import React from "react"
import { 
  Check, 
  X, 
  Shapes, 
  Pencil, 
  Trash2, 
  Edit, 
  Tag,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentAction } from "@/lib/agent/agent-actions"

export type ActionStatus = "pending" | "previewing" | "accepted" | "rejected"

interface AgentActionMessageProps {
  action: AgentAction
  status: ActionStatus
  onAccept?: () => void
  onReject?: () => void
}

export function AgentActionMessage({
  action,
  status,
  onAccept,
  onReject,
}: AgentActionMessageProps) {
  const Icon = getActionIcon(action._type)
  const description = getActionDescription(action)
  const showButtons = status === "pending" || status === "previewing"

  const statusStyles = {
    pending: "bg-blue-50 border-blue-200 text-blue-800",
    previewing: "bg-blue-50 border-blue-200 text-blue-800",
    accepted: "bg-green-50 border-green-200 text-green-800",
    rejected: "bg-red-50 border-red-200 text-red-800",
  }

  const statusIcons = {
    pending: null,
    previewing: <Loader2 className="w-3 h-3 animate-spin" />,
    accepted: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  }

  const statusLabels = {
    pending: "Pending",
    previewing: "Previewing on canvas",
    accepted: "Applied",
    rejected: "Rejected",
  }

  return (
    <div className={cn(
      "rounded-lg border p-3 transition-colors",
      statusStyles[status]
    )}>
      <div className="flex items-start gap-2">
        {Icon && (
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
            status === "accepted" && "bg-green-200",
            status === "rejected" && "bg-red-200",
            (status === "pending" || status === "previewing") && "bg-blue-200"
          )}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium opacity-70">
              {statusLabels[status]}
            </span>
            {statusIcons[status]}
          </div>
          <p className="text-sm mt-0.5">{description}</p>
          
          {showButtons && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={onAccept}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                <Check className="w-3 h-3" />
                Accept
              </button>
              <button
                onClick={onReject}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
              >
                <X className="w-3 h-3" />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getActionIcon(_type: string) {
  switch (_type) {
    case "create":
      return Shapes
    case "pen":
      return Pencil
    case "delete":
      return Trash2
    case "update":
      return Edit
    case "label":
      return Tag
    default:
      return Shapes
  }
}

function getActionDescription(action: AgentAction): string {
  if ("intent" in action && action.intent) {
    return action.intent
  }

  switch (action._type) {
    case "create":
      return `Create ${action.shape._type} shape`
    case "pen":
      return "Draw freeform line"
    case "delete":
      return "Delete shape"
    case "update":
      return "Update shape"
    case "label":
      return `Add label: "${action.text}"`
    default:
      return "Canvas action"
  }
}
