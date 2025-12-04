"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Editor, TLShapeId } from "tldraw"

/**
 * Represents a simplified snapshot of canvas state for change detection
 */
interface CanvasSnapshot {
  shapeHash: string
  shapeCount: number
  timestamp: number
}

/**
 * Configuration for the change detector
 */
interface ChangeDetectorConfig {
  editor: Editor | null
  enabled?: boolean
  // Only track user changes, not changes from agent/remote
  trackUserChangesOnly?: boolean
}

/**
 * Return type for the change detector hook
 */
interface ChangeDetectorReturn {
  /** Whether canvas has changed since last analysis was marked */
  hasChangedSinceLastAnalysis: boolean
  /** IDs of shapes that changed since last analysis */
  changedShapeIds: TLShapeId[]
  /** Total number of changes since last analysis */
  changeCount: number
  /** Mark current state as analyzed (reset change tracking) */
  markAnalyzed: () => void
  /** Get current canvas snapshot */
  getSnapshot: () => CanvasSnapshot | null
  /** Force check for changes */
  checkForChanges: () => boolean
}

/**
 * Generate a hash of the current canvas shapes for comparison
 */
function generateShapeHash(editor: Editor): string {
  const shapes = editor.getCurrentPageShapes()
  
  // Create a simplified representation of shapes for hashing
  const shapeData = shapes.map(shape => ({
    id: shape.id,
    type: shape.type,
    x: Math.round(shape.x),
    y: Math.round(shape.y),
    rotation: Math.round(shape.rotation * 100) / 100,
    // Include key props that matter for content changes
    propsHash: JSON.stringify(shape.props).slice(0, 200), // Limit size
  }))
  
  // Sort by ID for consistent ordering
  shapeData.sort((a, b) => a.id.localeCompare(b.id))
  
  return JSON.stringify(shapeData)
}

/**
 * Hook that uses TLDraw's side effects API to detect when canvas content
 * actually changes, distinguishing between user and agent changes.
 * 
 * This enables smart analysis triggering - only analyze when the user
 * has made real changes, not on every pause.
 */
export function useCanvasChangeDetector(
  config: ChangeDetectorConfig
): ChangeDetectorReturn {
  const { editor, enabled = true, trackUserChangesOnly = true } = config

  // Track state
  const [hasChangedSinceLastAnalysis, setHasChangedSinceLastAnalysis] = useState(false)
  const [changedShapeIds, setChangedShapeIds] = useState<TLShapeId[]>([])
  const [changeCount, setChangeCount] = useState(0)

  // Refs for tracking
  const lastAnalyzedSnapshotRef = useRef<CanvasSnapshot | null>(null)
  const changedShapeIdsSetRef = useRef<Set<TLShapeId>>(new Set())

  /**
   * Mark a shape as changed
   */
  const markShapeChanged = useCallback((shapeId: TLShapeId) => {
    changedShapeIdsSetRef.current.add(shapeId)
    setChangedShapeIds(Array.from(changedShapeIdsSetRef.current))
    setChangeCount(prev => prev + 1)
    setHasChangedSinceLastAnalysis(true)
  }, [])

  /**
   * Get current canvas snapshot
   */
  const getSnapshot = useCallback((): CanvasSnapshot | null => {
    if (!editor) return null

    return {
      shapeHash: generateShapeHash(editor),
      shapeCount: editor.getCurrentPageShapeIds().size,
      timestamp: Date.now(),
    }
  }, [editor])

  /**
   * Mark current state as analyzed (reset tracking)
   */
  const markAnalyzed = useCallback(() => {
    if (!editor) return

    // Store current snapshot as the analyzed state
    lastAnalyzedSnapshotRef.current = getSnapshot()
    
    // Reset tracking
    changedShapeIdsSetRef.current.clear()
    setChangedShapeIds([])
    setChangeCount(0)
    setHasChangedSinceLastAnalysis(false)
  }, [editor, getSnapshot])

  /**
   * Force check for changes against last analyzed state
   */
  const checkForChanges = useCallback((): boolean => {
    if (!editor) return false

    const currentSnapshot = getSnapshot()
    const lastSnapshot = lastAnalyzedSnapshotRef.current

    if (!currentSnapshot) return false
    if (!lastSnapshot) return true // No previous analysis = has changed

    const hasChanged = currentSnapshot.shapeHash !== lastSnapshot.shapeHash
    setHasChangedSinceLastAnalysis(hasChanged)
    return hasChanged
  }, [editor, getSnapshot])

  /**
   * Subscribe to TLDraw side effects for precise change detection
   */
  useEffect(() => {
    if (!editor || !enabled) return

    const cleanups: (() => void)[] = []

    // Register shape creation handler
    const createCleanup = editor.sideEffects.registerAfterCreateHandler(
      'shape',
      (shape, source) => {
        // Only track user changes if configured
        if (trackUserChangesOnly && source !== 'user') return
        
        console.log('[ChangeDetector] Shape created:', shape.id, 'source:', source)
        markShapeChanged(shape.id as TLShapeId)
      }
    )
    cleanups.push(createCleanup)

    // Register shape change handler
    const changeCleanup = editor.sideEffects.registerAfterChangeHandler(
      'shape',
      (_prev, next, source) => {
        // Only track user changes if configured
        if (trackUserChangesOnly && source !== 'user') return
        
        console.log('[ChangeDetector] Shape changed:', next.id, 'source:', source)
        markShapeChanged(next.id as TLShapeId)
      }
    )
    cleanups.push(changeCleanup)

    // Register shape deletion handler
    const deleteCleanup = editor.sideEffects.registerAfterDeleteHandler(
      'shape',
      (shape, source) => {
        // Only track user changes if configured
        if (trackUserChangesOnly && source !== 'user') return
        
        console.log('[ChangeDetector] Shape deleted:', shape.id, 'source:', source)
        // For deletions, we still mark as changed even though shape is gone
        setChangeCount(prev => prev + 1)
        setHasChangedSinceLastAnalysis(true)
      }
    )
    cleanups.push(deleteCleanup)

    // Initialize with current state if no previous snapshot
    if (!lastAnalyzedSnapshotRef.current) {
      lastAnalyzedSnapshotRef.current = getSnapshot()
    }

    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }, [editor, enabled, trackUserChangesOnly, markShapeChanged, getSnapshot])

  return {
    hasChangedSinceLastAnalysis,
    changedShapeIds,
    changeCount,
    markAnalyzed,
    getSnapshot,
    checkForChanges,
  }
}

export default useCanvasChangeDetector

