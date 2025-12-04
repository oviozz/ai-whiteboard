"use client"

import React from "react"
import { Id } from "../../../convex/_generated/dataModel"

type ProactiveTutorProviderProps = {
  whiteboardID: Id<"whiteboards">
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  panOffset: { x: number; y: number }
  zoomLevel: number
  children: React.ReactNode
}

// AI Tutor is currently disabled
export default function ProactiveTutorProvider({
  children,
}: ProactiveTutorProviderProps) {
  // AI Tutor disabled - just render children
  return <>{children}</>
}
