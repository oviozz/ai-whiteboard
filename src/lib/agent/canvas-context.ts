/**
 * Canvas Context Utilities
 * 
 * Provides functions to extract and serialize canvas state for AI context.
 */

import type { Editor } from "tldraw"

// Simple shape representation for AI
export interface SimpleShape {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  text?: string
  color?: string
  geo?: string
}

export interface CanvasContext {
  shapes: SimpleShape[]
  selectedShapeIds: string[]
  viewportBounds: {
    x: number
    y: number
    w: number
    h: number
  }
  isEmpty: boolean
}

/**
 * Extract canvas context from the editor for AI consumption
 */
export function getCanvasContext(editor: Editor): CanvasContext {
  const shapes = editor.getCurrentPageShapes()
  const selectedIds = editor.getSelectedShapeIds()
  const viewport = editor.getViewportPageBounds()

  const simpleShapes: SimpleShape[] = []
  
  for (const shape of shapes) {
    const bounds = editor.getShapePageBounds(shape.id)
    if (!bounds) continue

    const simple: SimpleShape = {
      id: shape.id,
      type: shape.type,
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      w: Math.round(bounds.w),
      h: Math.round(bounds.h),
    }

    // Extract text content
    if ("text" in shape.props) {
      simple.text = shape.props.text as string
    } else if ("richText" in shape.props) {
      // Extract plain text from rich text
      const richText = shape.props.richText
      if (richText && typeof richText === "object" && "content" in richText) {
        const content = richText.content as Array<{ children?: Array<{ text?: string }> }>
        simple.text = content
          ?.map((block) => block.children?.map((c) => c.text).join(""))
          .join("\n") || ""
      }
    }

    // Extract color
    if ("color" in shape.props) {
      simple.color = shape.props.color as string
    }

    // Extract geo type
    if (shape.type === "geo" && "geo" in shape.props) {
      simple.geo = shape.props.geo as string
    }

    simpleShapes.push(simple)
  }

  return {
    shapes: simpleShapes,
    selectedShapeIds: selectedIds.map(id => id as string),
    viewportBounds: {
      x: Math.round(viewport.x),
      y: Math.round(viewport.y),
      w: Math.round(viewport.w),
      h: Math.round(viewport.h),
    },
    isEmpty: simpleShapes.length === 0,
  }
}

/**
 * Generate a human-readable description of the canvas for AI context
 */
export function generateCanvasDescription(context: CanvasContext): string {
  const lines: string[] = []

  lines.push(`Canvas viewport: x=${context.viewportBounds.x}, y=${context.viewportBounds.y}, width=${context.viewportBounds.w}, height=${context.viewportBounds.h}`)
  lines.push(`Center point: (${Math.round(context.viewportBounds.x + context.viewportBounds.w / 2)}, ${Math.round(context.viewportBounds.y + context.viewportBounds.h / 2)})`)

  if (context.isEmpty) {
    lines.push("\nThe canvas is currently empty.")
  } else {
    lines.push(`\nShapes on canvas (${context.shapes.length} total):`)
    
    for (const shape of context.shapes) {
      let desc = `- ${shape.type}`
      if (shape.geo) desc += ` (${shape.geo})`
      desc += ` at (${shape.x}, ${shape.y}), size ${shape.w}x${shape.h}`
      if (shape.text) desc += `: "${shape.text.substring(0, 50)}${shape.text.length > 50 ? '...' : ''}"`
      if (shape.color) desc += ` [${shape.color}]`
      desc += ` | id: ${shape.id}`
      lines.push(desc)
    }
  }

  if (context.selectedShapeIds.length > 0) {
    lines.push(`\nSelected shapes: ${context.selectedShapeIds.join(", ")}`)
  }

  return lines.join("\n")
}

/**
 * Get shapes that were recently changed (for delta updates)
 */
export function getChangedShapes(
  editor: Editor,
  previousShapeIds: Set<string>
): SimpleShape[] {
  const currentShapes = editor.getCurrentPageShapes()
  const changedShapes: SimpleShape[] = []

  for (const shape of currentShapes) {
    if (!previousShapeIds.has(shape.id)) {
      const bounds = editor.getShapePageBounds(shape.id)
      if (!bounds) continue

      changedShapes.push({
        id: shape.id,
        type: shape.type,
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        w: Math.round(bounds.w),
        h: Math.round(bounds.h),
      })
    }
  }

  return changedShapes
}

