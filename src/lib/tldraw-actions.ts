import type { Editor, TLShapeId } from 'tldraw'
import { createShapeId } from 'tldraw'

type TextSize = 's' | 'm' | 'l' | 'xl'
type NoteColor = 'black' | 'grey' | 'light-violet' | 'violet' | 'light-blue' | 'blue' | 'light-green' | 'green' | 'light-yellow' | 'yellow' | 'orange' | 'red'

interface AddTextOptions {
  x?: number
  y?: number
  fontSize?: TextSize
  color?: string
}

interface AddNoteOptions {
  x?: number
  y?: number
  color?: NoteColor
  size?: TextSize
}

interface Position {
  x: number
  y: number
}

/**
 * Add a text shape to the whiteboard
 */
export function addTextToWhiteboard(
  editor: Editor,
  text: string,
  options?: AddTextOptions
): TLShapeId {
  const { x = 100, y = 100, fontSize = 'm', color = 'black' } = options || {}
  
  const shapeId = createShapeId()
  
  editor.createShape({
    id: shapeId,
    type: 'text',
    x,
    y,
    props: {
      text,
      font: 'draw',
      size: fontSize,
      color,
    },
  })
  
  // Select the new shape and zoom to it
  editor.select(shapeId)
  editor.zoomToSelection()
  
  return shapeId
}

/**
 * Add a problem card (sticky note) to the whiteboard
 */
export function addProblemCard(
  editor: Editor,
  problem: string,
  options?: AddNoteOptions
): TLShapeId {
  const { x = 100, y = 100, color = 'light-blue', size = 'l' } = options || {}
  
  const shapeId = createShapeId()
  
  editor.createShape({
    id: shapeId,
    type: 'note',
    x,
    y,
    props: {
      text: problem,
      color,
      size,
    },
  })
  
  // Select and zoom to the new shape
  editor.select(shapeId)
  editor.zoomToSelection()
  
  return shapeId
}

/**
 * Add a hint bubble (yellow sticky note) to the whiteboard
 */
export function addHintBubble(
  editor: Editor,
  hint: string,
  position?: Position
): TLShapeId {
  // Find a good position - near top-right of viewport if not specified
  const bounds = editor.getViewportPageBounds()
  const x = position?.x ?? bounds.x + bounds.w - 300
  const y = position?.y ?? bounds.y + 20
  
  const shapeId = createShapeId()
  
  editor.createShape({
    id: shapeId,
    type: 'note',
    x,
    y,
    props: {
      text: `💡 ${hint}`,
      color: 'yellow',
      size: 'm',
    },
  })
  
  return shapeId
}

/**
 * Add a solution/answer card (green sticky note)
 */
export function addSolutionCard(
  editor: Editor,
  solution: string,
  options?: AddNoteOptions
): TLShapeId {
  const { x = 100, y = 100, size = 'l' } = options || {}
  
  const shapeId = createShapeId()
  
  editor.createShape({
    id: shapeId,
    type: 'note',
    x,
    y,
    props: {
      text: solution,
      color: 'light-green',
      size,
    },
  })
  
  editor.select(shapeId)
  editor.zoomToSelection()
  
  return shapeId
}

/**
 * Find the best position to insert new content
 * Places content below existing shapes or at viewport center if empty
 */
export function findBestInsertPosition(editor: Editor): Position {
  const shapes = editor.getCurrentPageShapes()
  
  if (shapes.length === 0) {
    // Empty canvas - use viewport center
    const bounds = editor.getViewportPageBounds()
    return { 
      x: bounds.x + bounds.w / 2 - 150, 
      y: bounds.y + 50 
    }
  }
  
  // Find the bottom-most shape and place below it
  let maxY = -Infinity
  let xAtMaxY = 100
  
  for (const shape of shapes) {
    const shapeBounds = editor.getShapePageBounds(shape.id)
    if (shapeBounds && shapeBounds.maxY > maxY) {
      maxY = shapeBounds.maxY
      xAtMaxY = shapeBounds.x
    }
  }
  
  return { 
    x: xAtMaxY, 
    y: maxY + 50 
  }
}

/**
 * Clear all shapes from the current page
 */
export function clearWhiteboard(editor: Editor): void {
  const shapeIds = [...editor.getCurrentPageShapeIds()]
  if (shapeIds.length > 0) {
    editor.deleteShapes(shapeIds)
  }
}

/**
 * Get all shape IDs on the current page
 */
export function getCurrentPageShapeIds(editor: Editor): TLShapeId[] {
  return [...editor.getCurrentPageShapeIds()]
}

/**
 * Whiteboard action types that can be returned from AI
 */
export type WhiteboardActionType = 
  | 'addProblem'
  | 'addText'
  | 'addHint'
  | 'addSolution'

export interface WhiteboardAction {
  type: WhiteboardActionType
  content: string
  position?: Position
}

/**
 * Execute a whiteboard action from AI response
 */
export function executeWhiteboardAction(
  editor: Editor,
  action: WhiteboardAction
): TLShapeId | null {
  const position = action.position ?? findBestInsertPosition(editor)
  
  switch (action.type) {
    case 'addProblem':
      return addProblemCard(editor, action.content, position)
    case 'addText':
      return addTextToWhiteboard(editor, action.content, position)
    case 'addHint':
      return addHintBubble(editor, action.content, position)
    case 'addSolution':
      return addSolutionCard(editor, action.content, position)
    default:
      console.warn('Unknown whiteboard action type:', action.type)
      return null
  }
}

