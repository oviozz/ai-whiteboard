"use client"

import { useCallback } from 'react'
import { useTldrawEditor } from '@/contexts/tldraw-editor-context'

/**
 * Hook for capturing screenshots from the tldraw canvas
 * Replaces the old html2canvas approach with tldraw's native export
 */
export function useTldrawScreenshot() {
  const { editor } = useTldrawEditor()
  
  /**
   * Capture a screenshot of all shapes on the current page
   * Returns a Blob or null if canvas is empty or editor not available
   */
  const captureScreenshot = useCallback(async (): Promise<Blob | null> => {
    if (!editor) {
      console.warn('useTldrawScreenshot: Editor not available')
      return null
    }
    
    const shapeIds = [...editor.getCurrentPageShapeIds()]
    
    if (shapeIds.length === 0) {
      // Empty canvas - return a white placeholder image
      // This matches the previous behavior where an empty canvas would still send something
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#cccccc'
        ctx.font = '16px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Empty whiteboard', canvas.width / 2, canvas.height / 2)
      }
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      })
    }
    
    try {
      // Use tldraw's native export which is much cleaner
      const blob = await editor.toImage(shapeIds, {
        format: 'png',
        background: true,
        padding: 32,
        scale: 1,
      })
      return blob
    } catch (error) {
      console.error('Failed to capture tldraw screenshot:', error)
      return null
    }
  }, [editor])
  
  /**
   * Capture a screenshot of the current viewport (what the user sees)
   */
  const captureViewport = useCallback(async (): Promise<Blob | null> => {
    if (!editor) {
      console.warn('useTldrawScreenshot: Editor not available')
      return null
    }
    
    try {
      // Get shapes visible in the current viewport
      const viewportBounds = editor.getViewportPageBounds()
      const allShapes = editor.getCurrentPageShapes()
      
      // Filter to shapes that intersect with viewport
      const visibleShapeIds = allShapes
        .filter(shape => {
          const shapeBounds = editor.getShapePageBounds(shape.id)
          if (!shapeBounds) return false
          // Check if shape intersects with viewport
          return !(
            shapeBounds.maxX < viewportBounds.x ||
            shapeBounds.x > viewportBounds.maxX ||
            shapeBounds.maxY < viewportBounds.y ||
            shapeBounds.y > viewportBounds.maxY
          )
        })
        .map(shape => shape.id)
      
      if (visibleShapeIds.length === 0) {
        return captureScreenshot() // Fall back to full screenshot
      }
      
      const blob = await editor.toImage(visibleShapeIds, {
        format: 'png',
        background: true,
        padding: 16,
        scale: 1,
      })
      return blob
    } catch (error) {
      console.error('Failed to capture viewport screenshot:', error)
      return null
    }
  }, [editor, captureScreenshot])
  
  /**
   * Capture and return as base64 data URL (useful for some APIs)
   */
  const captureAsDataUrl = useCallback(async (): Promise<string | null> => {
    const blob = await captureScreenshot()
    if (!blob) return null
    
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  }, [captureScreenshot])
  
  return {
    captureScreenshot,
    captureViewport,
    captureAsDataUrl,
    isReady: !!editor,
  }
}

export default useTldrawScreenshot

