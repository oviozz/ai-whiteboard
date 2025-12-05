"use client"

import { useState } from "react"
import { Id } from "../../../../../../convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { api } from "../../../../../../convex/_generated/api"
import { Loader } from "lucide-react"

import WhiteboardHeader from "./whiteboard-header"
import WhiteboardSidebar from "./whiteboard-sidebar"
import TldrawCanvas from "./tldraw-canvas"
import SidebarChatbot from "./sidebar-chatbot/sidebar-chatbot"
import QuizDrawer from "./quiz-drawer"
import { TldrawEditorProvider } from "@/contexts/tldraw-editor-context"
import ProactiveTutorProvider from "@/components/ai-tutor/proactive-tutor-provider"
import SolveItAllProvider from "@/components/providers/solve-it-all-provider"

interface WhiteboardClientProps {
  whiteboardId?: Id<"whiteboards">
}

export default function WhiteboardClient({ whiteboardId }: WhiteboardClientProps) {
  // Sidebar state - controlled here so canvas can resize
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Fetch whiteboard metadata
  const whiteboardData = useQuery(
    api.whiteboards.getWhiteboardID,
    whiteboardId ? { whiteboardID: whiteboardId } : "skip"
  )

  // Handle missing whiteboard ID
  if (!whiteboardId) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 p-4 text-center">
        Whiteboard ID is required.
      </div>
    )
  }

  // Loading state
  if (whiteboardData === undefined) {
    return (
      <div className="flex flex-col gap-2 items-center justify-center h-screen">
        <Loader className="w-10 h-10 animate-spin text-blue-500" />
        Loading whiteboard...
      </div>
    )
  }

  // Not found state
  if (whiteboardData === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <h2 className="text-2xl font-semibold text-red-600 mb-3">Error</h2>
        <p className="text-slate-700 dark:text-slate-300">
          Whiteboard not found or access denied (ID: {whiteboardId}).
        </p>
      </div>
    )
  }

  const whiteboardTopic = whiteboardData.topic || "Whiteboard"

  return (
    <TldrawEditorProvider>
      <div className="flex flex-col w-full h-screen bg-slate-100 dark:bg-slate-900">
        {/* Header */}
        <WhiteboardHeader
          whiteboardID={whiteboardId}
          whiteboardName={whiteboardTopic}
        />

        {/* Main content area */}
        <div className="flex flex-1 w-full overflow-hidden">
          {/* Sidebar with tools */}
          <WhiteboardSidebar whiteboardID={whiteboardId} />

          {/* Canvas area - transitions smoothly when chat opens */}
          <div 
            className="flex flex-1 overflow-hidden transition-all duration-300"
            style={{ marginRight: isChatOpen ? 400 : 0 }}
          >
            <div
              className="flex-1 relative overflow-hidden"
              style={{ touchAction: "none", backgroundColor: "#ffffff" }}
            >
              <ProactiveTutorProvider whiteboardID={whiteboardId}>
                <SolveItAllProvider>
                  <TldrawCanvas whiteboardId={whiteboardId} />
                </SolveItAllProvider>
              </ProactiveTutorProvider>
            </div>
          </div>
        </div>

        {/* AI Chatbot sidebar - fixed position, full height */}
        <SidebarChatbot 
          whiteboardID={whiteboardId} 
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
        />

        {/* Quiz Drawer - renders as modal */}
        <QuizDrawer whiteboardID={whiteboardId} />
      </div>
    </TldrawEditorProvider>
  )
}
