"use client"

import type { ChatHistoryPromptItem } from "@/lib/agent/types"
import { User, MapPin, Box, Target } from "lucide-react"

interface ChatHistoryPromptProps {
  item: ChatHistoryPromptItem
}

export function ChatHistoryPrompt({ item }: ChatHistoryPromptProps) {
  // Count context items
  const contextItems = item.contextItems || []
  const areaCount = contextItems.filter(i => i.type === "area").length
  const pointCount = contextItems.filter(i => i.type === "point").length
  const shapeCount = contextItems.filter(i => i.type === "shape").length
  const shapesCount = contextItems.filter(i => i.type === "shapes").reduce(
    (acc, i) => acc + (i.type === "shapes" ? i.shapes.length : 0), 0
  )
  const totalShapes = shapeCount + shapesCount
  const selectedShapes = item.selectedShapes?.length || 0
  
  const hasContext = areaCount > 0 || pointCount > 0 || totalShapes > 0 || selectedShapes > 0

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
          {hasContext && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {areaCount > 0 && (
                <ContextTag icon={<Box className="w-3 h-3" />} label={`${areaCount} area${areaCount > 1 ? 's' : ''}`} />
              )}
              {pointCount > 0 && (
                <ContextTag icon={<MapPin className="w-3 h-3" />} label={`${pointCount} point${pointCount > 1 ? 's' : ''}`} />
              )}
              {totalShapes > 0 && (
                <ContextTag icon={<Target className="w-3 h-3" />} label={`${totalShapes} shape${totalShapes > 1 ? 's' : ''}`} />
              )}
              {selectedShapes > 0 && (
                <ContextTag icon={<Target className="w-3 h-3" />} label={`${selectedShapes} selected`} color="blue" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ContextTag({ icon, label, color = "slate" }: { icon: React.ReactNode; label: string; color?: "slate" | "blue" }) {
  const colorClasses = color === "blue" 
    ? "bg-blue-50 text-blue-600 border-blue-100"
    : "bg-slate-50 text-slate-500 border-slate-100"
  
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${colorClasses}`}>
      {icon}
      {label}
    </span>
  )
}
