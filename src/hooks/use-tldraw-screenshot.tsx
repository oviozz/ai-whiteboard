"use client"

import { useCallback } from 'react'
import { useTldrawEditor } from '@/contexts/tldraw-editor-context'

/**
 * Hook for capturing screenshots from the tldraw canvas
 * Uses tldraw's native export for clean captures
 */
export function useTldrawScreenshot() {
  const { editor } = useTldrawEditor()
  
  /**
   * Capture a screenshot of all shapes on the current page
   * Returns a Blob or null if editor not available
   */
  const captureScreenshot = useCallback(async (): Promise<Blob | null> => {
    if (!editor) {
      console.warn('[TldrawScreenshot] Editor not available')
      return null
    }
    
    try {
      const shapeIds = editor.getCurrentPageShapeIds()
      console.log('[TldrawScreenshot] Found shapes:', shapeIds.size)
      
      if (shapeIds.size === 0) {
        console.log('[TldrawScreenshot] No shapes found, creating placeholder')
        // Return a placeholder for truly empty canvas
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#999999'
          ctx.font = '20px Arial'
        ctx.textAlign = 'center'
          ctx.fillText('Empty whiteboard - no content yet', canvas.width / 2, canvas.height / 2)
      }
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      })
    }
    
      // Use tldraw's native export - note: returns { blob } object, not blob directly!
      console.log('[TldrawScreenshot] Capturing', shapeIds.size, 'shapes...')
      const result = await editor.toImage([...shapeIds], {
        format: 'png',
        background: true,
        padding: 32,
        scale: 1.5, // Higher scale for better AI recognition
      })
      
      // toImage returns { blob } object
      const blob = result?.blob || result
      
      if (blob && blob instanceof Blob) {
        console.log('[TldrawScreenshot] Capture successful, blob size:', blob.size)
      return blob
      } else {
        console.warn('[TldrawScreenshot] toImage returned unexpected result:', typeof result)
        // Try fallback
        return await captureScreenshotFallback()
      }
    } catch (error) {
      console.error('[TldrawScreenshot] Failed to capture:', error)
      // Try fallback: capture using getSvg and convert
      return await captureScreenshotFallback()
    }
  }, [editor])
  
  /**
   * Fallback capture method using SVG export
   */
  const captureScreenshotFallback = useCallback(async (): Promise<Blob | null> => {
    if (!editor) return null
    
    try {
      const shapeIds = editor.getCurrentPageShapeIds()
      if (shapeIds.size === 0) return null
      
      console.log('[TldrawScreenshot] Trying SVG fallback...')
      
      // Get SVG element
      const svg = await editor.getSvg([...shapeIds], {
        background: true,
        padding: 32,
      })
      
      if (!svg) {
        console.warn('[TldrawScreenshot] getSvg returned null')
        return null
      }
      
      // Convert SVG to PNG using canvas
      const svgString = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(svgBlob)
      
      return new Promise<Blob | null>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          // Ensure minimum size for AI readability
          canvas.width = Math.max(img.width, 400) * 1.5
          canvas.height = Math.max(img.height, 300) * 1.5
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          }
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url)
            if (blob) {
              console.log('[TldrawScreenshot] SVG fallback successful, size:', blob.size)
            }
            resolve(blob)
          }, 'image/png')
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          console.error('[TldrawScreenshot] SVG fallback failed - image load error')
          resolve(null)
        }
        img.src = url
      })
    } catch (error) {
      console.error('[TldrawScreenshot] Fallback capture failed:', error)
      return null
    }
  }, [editor])
  
  /**
   * Capture a screenshot of the current viewport (what the user sees)
   */
  const captureViewport = useCallback(async (): Promise<Blob | null> => {
    if (!editor) {
      console.warn('[TldrawScreenshot] Editor not available for viewport capture')
      return null
    }
    
    try {
      // Get shapes visible in the current viewport
      const viewportBounds = editor.getViewportPageBounds()
      const allShapes = editor.getCurrentPageShapes()
      
      console.log('[TldrawScreenshot] Viewport capture - total shapes:', allShapes.length)
      
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
      
      console.log('[TldrawScreenshot] Visible shapes in viewport:', visibleShapeIds.length)
      
      if (visibleShapeIds.length === 0) {
        return captureScreenshot() // Fall back to full screenshot
      }
      
      const result = await editor.toImage(visibleShapeIds, {
        format: 'png',
        background: true,
        padding: 16,
        scale: 1.5,
      })
      
      // Handle both { blob } object and direct blob return
      const blob = result?.blob || result
      return blob instanceof Blob ? blob : null
    } catch (error) {
      console.error('[TldrawScreenshot] Failed to capture viewport:', error)
      return captureScreenshot() // Fall back to full screenshot
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
  
  /**
   * Get info about the last changed shape for hint positioning
   */
  const getLastChangedShapePosition = useCallback(() => {
    if (!editor) return null
    
    const selectedIds = editor.getSelectedShapeIds()
    if (selectedIds.length > 0) {
      const lastId = selectedIds[selectedIds.length - 1]
      const bounds = editor.getShapePageBounds(lastId)
      if (bounds) {
        return {
          x: bounds.x + bounds.w / 2,
          y: bounds.y + bounds.h / 2,
          bounds,
        }
      }
    }
    
    // Fallback: get the most recently created shape
    const shapes = editor.getCurrentPageShapes()
    if (shapes.length > 0) {
      const lastShape = shapes[shapes.length - 1]
      const bounds = editor.getShapePageBounds(lastShape.id)
      if (bounds) {
        return {
          x: bounds.x + bounds.w / 2,
          y: bounds.y + bounds.h / 2,
          bounds,
        }
      }
    }
    
    return null
  }, [editor])
  
  return {
    captureScreenshot,
    captureViewport,
    captureAsDataUrl,
    captureScreenshotFallback,
    getLastChangedShapePosition,
    isReady: !!editor,
  }
}

export default useTldrawScreenshot
