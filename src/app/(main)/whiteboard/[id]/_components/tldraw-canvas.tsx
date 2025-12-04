"use client"

import { useCallback, useRef, useEffect, useState } from 'react'
import { 
  Tldraw, 
  getSnapshot, 
  loadSnapshot,
  TLStoreWithStatus,
  createTLStore,
  defaultShapeUtils,
  Editor,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../../convex/_generated/api'
import { Id } from '../../../../../../convex/_generated/dataModel'
import { useTldrawEditor } from '@/contexts/tldraw-editor-context'
import { Loader } from 'lucide-react'

interface TldrawCanvasProps {
  whiteboardId: Id<"whiteboards">
}

export default function TldrawCanvas({ whiteboardId }: TldrawCanvasProps) {
  const { setEditor } = useTldrawEditor()
  
  // Fetch whiteboard data including tldraw snapshot
  const whiteboardData = useQuery(api.whiteboardActions.getTldrawSnapshot, {
    whiteboardID: whiteboardId,
  })
  
  const saveSnapshot = useMutation(api.whiteboardActions.saveTldrawSnapshot)
  
  // Refs for debounced saving
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedSnapshotRef = useRef<string | null>(null)
  
  // Store with status for async loading
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: 'loading',
  })
  
  // Initialize store when data is loaded
  useEffect(() => {
    if (whiteboardData === undefined) {
      // Still loading
      setStoreWithStatus({ status: 'loading' })
      return
    }
    
    if (whiteboardData.status === 'not_found') {
      setStoreWithStatus({ 
        status: 'error', 
        error: 'Whiteboard not found' 
      })
      return
    }
    
    // Create store
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
  
  // Handle editor mount - setup auto-save
  const handleMount = useCallback((editor: Editor) => {
    // Store editor in context for other components to use
    setEditor(editor)
    
    // Listen for document changes and auto-save with debounce
    const unsubscribe = editor.store.listen(
      () => {
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        
        // Debounce save by 1 second
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const { document } = getSnapshot(editor.store)
            const snapshotString = JSON.stringify(document)
            
            // Only save if different from last saved
            if (snapshotString !== lastSavedSnapshotRef.current) {
              await saveSnapshot({
                whiteboardID: whiteboardId,
                snapshot: snapshotString,
              })
              lastSavedSnapshotRef.current = snapshotString
            }
          } catch (error) {
            console.error('Failed to save tldraw snapshot:', error)
          }
        }, 1000)
      },
      { scope: 'document', source: 'user' }
    )
    
    // Cleanup on unmount
    return () => {
      unsubscribe()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      setEditor(null)
    }
  }, [whiteboardId, saveSnapshot, setEditor])
  
  // Show loading state
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
  
  // Show error state
  if (storeWithStatus.status === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Whiteboard</h3>
          <p className="text-slate-600">{storeWithStatus.error}</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-full h-full tldraw-container">
      <Tldraw
        store={storeWithStatus}
        onMount={handleMount}
        autoFocus
        // Hide the default style panel since we have our own in the sidebar
        components={{
          StylePanel: null,
        }}
      />
    </div>
  )
}

