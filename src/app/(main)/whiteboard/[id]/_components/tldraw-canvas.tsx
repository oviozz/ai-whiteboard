"use client"

import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { 
  Tldraw, 
  getSnapshot, 
  loadSnapshot,
  TLStoreWithStatus,
  createTLStore,
  defaultShapeUtils,
  Editor,
  TLComponents,
} from 'tldraw'
// CSS is imported in globals.css or layout
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { Id } from '../../../../../../convex/_generated/dataModel'
import { useTldrawEditor } from '@/contexts/tldraw-editor-context'
import { Loader } from 'lucide-react'
import { TldrawAgent } from '@/lib/agent/tldraw-agent'
import { setAgentForTools, TargetAreaTool, TargetShapeTool } from '@/lib/agent/tools'
import { ContextHighlights, AgentViewportBoundsHighlight } from '@/components/highlights'

interface TldrawCanvasProps {
  whiteboardId: Id<"whiteboards">
}

// Custom tools for agent context selection
const customTools = [TargetAreaTool, TargetShapeTool]

// Memoized overlay component to prevent re-renders
const CanvasOverlay = React.memo(function CanvasOverlay({ agent }: { agent: TldrawAgent | null }) {
  if (!agent) return null
  return (
    <>
      <AgentViewportBoundsHighlight agent={agent} />
      <ContextHighlights agent={agent} />
    </>
  )
})

// Separate component for the actual Tldraw editor to avoid hooks ordering issues
const TldrawEditor = React.memo(function TldrawEditor({ 
  store, 
  onMount,
  agent,
}: { 
  store: TLStoreWithStatus & { status: 'synced-remote' }
  onMount: (editor: Editor) => (() => void) | void
  agent: TldrawAgent | null
}) {
  // Custom components for agent highlights - memoized to prevent flicker
  const components: TLComponents = useMemo(() => ({
    StylePanel: null,
    InFrontOfTheCanvas: () => <CanvasOverlay agent={agent} />,
  }), [agent])

  return (
    <div className="w-full h-full tldraw-container">
      <Tldraw
        store={store}
        onMount={onMount}
        autoFocus
        tools={customTools}
        components={components}
      />
    </div>
  )
})

export default function TldrawCanvas({ whiteboardId }: TldrawCanvasProps) {
  const { setEditor, setAgent } = useTldrawEditor()
  
  // Agent state
  const [agent, setLocalAgent] = useState<TldrawAgent | null>(null)
  
  // Fetch whiteboard data including tldraw snapshot
  const whiteboardData = useQuery(api.whiteboardActions.getTldrawSnapshot, {
    whiteboardID: whiteboardId,
  })
  
  const saveSnapshot = useMutation(api.whiteboardActions.saveTldrawSnapshot)
  
  // Refs for stable state tracking - KEY for preventing zoom bug
  const hasInitializedRef = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const isSavingRef = useRef(false)
  const agentRef = useRef<TldrawAgent | null>(null)
  
  // Refs for debounced saving
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedSnapshotRef = useRef<string | null>(null)
  
  // Store ref for stable mutation access
  const saveSnapshotRef = useRef(saveSnapshot)
  useEffect(() => {
    saveSnapshotRef.current = saveSnapshot
  }, [saveSnapshot])
  
  // Whiteboard ID ref for stable access in callbacks
  const whiteboardIdRef = useRef(whiteboardId)
  useEffect(() => {
    whiteboardIdRef.current = whiteboardId
  }, [whiteboardId])
  
  // Store with status for async loading
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: 'loading',
  })
  
  // Initialize store ONCE when data is first loaded
  // This is the KEY fix - we only create the store once
  useEffect(() => {
    // Skip if already initialized - prevents zoom bug on saves
    if (hasInitializedRef.current) return
    
    if (whiteboardData === undefined) {
      // Still loading from Convex
      setStoreWithStatus({ status: 'loading' })
      return
    }
    
    if (whiteboardData.status === 'not_found') {
      setStoreWithStatus({ 
        status: 'error', 
        error: new Error('Whiteboard not found')
      })
      return
    }
    
    // Mark as initialized BEFORE creating store
    // This ensures we never run this effect again
    hasInitializedRef.current = true
    
    // Create store only once
    const newStore = createTLStore({
      shapeUtils: defaultShapeUtils,
    })
    
    // Load existing snapshot if available
    if (whiteboardData.snapshot) {
      try {
        const parsedSnapshot = JSON.parse(whiteboardData.snapshot)
        loadSnapshot(newStore, { document: parsedSnapshot })
        lastSavedSnapshotRef.current = whiteboardData.snapshot
      } catch (error) {
        console.error('Failed to load tldraw snapshot:', error)
        // Continue with empty store
      }
    }
    
    setStoreWithStatus({
      status: 'synced-remote',
      connectionStatus: 'online',
      store: newStore,
    })
  }, [whiteboardData])
  
  // Handle editor mount - setup auto-save and agent with stable refs
  const handleMount = useCallback((editor: Editor) => {
    // Store editor in ref for stable access
    editorRef.current = editor
    
    // Store editor in context for other components to use
    setEditor(editor)
    
    // Create TldrawAgent for this editor
    const newAgent = new TldrawAgent({
      editor,
      id: `whiteboard-${whiteboardIdRef.current}`,
      apiEndpoint: '/api/whiteboard/agent',
      defaultModel: 'google/gemini-2.0-flash',
      onError: (e) => console.error('TldrawAgent error:', e),
    })
    
    agentRef.current = newAgent
    setLocalAgent(newAgent)
    setAgent(newAgent)
    setAgentForTools(newAgent)
    
    // Make agent available for debugging
    if (typeof window !== 'undefined') {
      (window as unknown as { agent: TldrawAgent }).agent = newAgent
    }
    
    // Listen for document changes and auto-save with debounce
    // Use a longer debounce to prevent lag during batch operations like Ctrl+A + Delete
    let lastChangeTime = 0
    const MIN_SAVE_INTERVAL = 3000 // Minimum 3 seconds between saves
    
    const unsubscribe = editor.store.listen(
      () => {
        const now = Date.now()
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        
        // Calculate delay - use longer delay if we just saved
        const timeSinceLastChange = now - lastChangeTime
        const delay = timeSinceLastChange < 500 ? 3000 : 2000 // Longer delay for rapid changes
        lastChangeTime = now
        
        // Debounce save
        saveTimeoutRef.current = setTimeout(async () => {
          // Prevent concurrent saves
          if (isSavingRef.current) return
          isSavingRef.current = true
          
          try {
            const { document } = getSnapshot(editor.store)
            const snapshotString = JSON.stringify(document)
            
            // Only save if different from last saved
            if (snapshotString !== lastSavedSnapshotRef.current) {
              await saveSnapshotRef.current({
                whiteboardID: whiteboardIdRef.current,
                snapshot: snapshotString,
              })
              lastSavedSnapshotRef.current = snapshotString
            }
          } catch (error) {
            console.error('Failed to save tldraw snapshot:', error)
          } finally {
            isSavingRef.current = false
          }
        }, delay)
      },
      { scope: 'document', source: 'user' }
    )
    
    // Cleanup on unmount
    return () => {
      unsubscribe()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (agentRef.current) {
        agentRef.current.dispose()
        setAgentForTools(null)
        agentRef.current = null
      }
      editorRef.current = null
      setEditor(null)
      setAgent(null)
      setLocalAgent(null)
    }
  // Using refs means we don't need dependencies that would cause re-renders
  }, [setEditor, setAgent])
  
  // Render based on store status
  if (storeWithStatus.status === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-sm text-slate-600">Loading whiteboard...</span>
        </div>
      </div>
    )
  }
  
  if (storeWithStatus.status === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Whiteboard</h3>
          <p className="text-slate-600">{storeWithStatus.error?.message || 'Unknown error'}</p>
        </div>
      </div>
    )
  }
  
  // Only render TldrawEditor when we have a synced store
  // Using a separate component prevents hooks ordering issues
  return (
    <TldrawEditor 
      store={storeWithStatus as TLStoreWithStatus & { status: 'synced-remote' }} 
      onMount={handleMount} 
      agent={agent}
    />
  )
}
