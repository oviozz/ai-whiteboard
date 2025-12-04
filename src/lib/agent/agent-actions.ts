/**
 * Agent Action Types
 * 
 * Matches the tldraw agent starter kit pattern.
 * Uses `_type` field (with underscore) to match the starter kit convention.
 */

// ============================================
// Base Types (matching starter kit)
// ============================================

export type SimpleColor = 
  | "black" | "grey" | "light-violet" | "violet" | "blue" 
  | "light-blue" | "yellow" | "orange" | "green" | "light-green" 
  | "light-red" | "red" | "white"

export type SimpleFill = "none" | "semi" | "solid" | "pattern"

export type SimpleSize = "s" | "m" | "l" | "xl"

export type SimpleDash = "draw" | "solid" | "dashed" | "dotted"

export type SimpleFont = "draw" | "sans" | "serif" | "mono"

export type SimpleGeoType = 
  // Basic shapes
  | "rectangle" | "ellipse" | "triangle" | "diamond" 
  | "hexagon" | "star" | "cloud" | "heart"
  // Extended shapes from starter kit
  | "pill" | "x-box" | "check-box" | "pentagon" | "octagon"
  | "parallelogram-right" | "parallelogram-left" | "trapezoid"
  // Fat arrows
  | "fat-arrow-right" | "fat-arrow-left" | "fat-arrow-up" | "fat-arrow-down"

export type SimpleTextAlign = "start" | "middle" | "end"

// ============================================
// Simple Shape Types (matching starter kit)
// ============================================

export interface SimpleGeoShape {
  _type: SimpleGeoType
  shapeId: string
  x: number
  y: number
  w: number
  h: number
  color: SimpleColor
  fill: SimpleFill
  text?: string
  textAlign?: SimpleTextAlign
  note: string
}

export interface SimpleTextShape {
  _type: "text"
  shapeId: string
  x: number
  y: number
  text: string
  color: SimpleColor
  size?: SimpleSize  // "s", "m", "l", "xl" - for consistent sizing
  scale?: number     // Scale multiplier
  fontSize?: number  // Legacy support
  textAlign?: SimpleTextAlign
  w?: number         // Width for text wrapping (recommended: 400-500 for paragraphs)
  width?: number     // Legacy alias for w
  wrap?: boolean
  note: string
}

export interface SimpleNoteShape {
  _type: "note"
  shapeId: string
  x: number
  y: number
  text?: string
  color: SimpleColor
  size?: SimpleSize  // "s", "m", "l", "xl" - for consistent sizing
  note: string
}

export interface SimpleArrowShape {
  _type: "arrow"
  shapeId: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: SimpleColor
  fromId?: string | null
  toId?: string | null
  text?: string
  bend?: number
  note: string
}

export interface SimpleLineShape {
  _type: "line"
  shapeId: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: SimpleColor
  note: string
}

export interface SimpleDrawShape {
  _type: "draw"
  shapeId: string
  color: SimpleColor
  fill?: SimpleFill
  note: string
}

export type SimpleShape = 
  | SimpleGeoShape 
  | SimpleTextShape 
  | SimpleNoteShape 
  | SimpleArrowShape
  | SimpleLineShape
  | SimpleDrawShape

// ============================================
// Agent Actions (matching starter kit)
// ============================================

export interface CreateAction {
  _type: "create"
  intent: string
  shape: SimpleShape
}

export interface PenAction {
  _type: "pen"
  intent: string
  color: SimpleColor
  style: "smooth" | "straight"
  closed: boolean
  fill: SimpleFill
  points: { x: number; y: number }[]
}

export interface DeleteAction {
  _type: "delete"
  intent: string
  shapeId: string
}

export interface UpdateAction {
  _type: "update"
  intent: string
  shapeId: string
  shape: Partial<SimpleShape>
}

export interface LabelAction {
  _type: "label"
  intent: string
  shapeId: string
  text: string
}

export interface PlaceAction {
  _type: "place"
  intent: string
  shapeId: string
  referenceShapeId: string
  side: "top" | "bottom" | "left" | "right"
  sideOffset: number
  align: "start" | "center" | "end"
  alignOffset: number
}

export interface ThinkAction {
  _type: "think"
  text: string
}

export interface MessageAction {
  _type: "message"
  text: string
}

export interface ReviewAction {
  _type: "review"
  status: "correct" | "incorrect" | "needs_improvement"
  text: string
  x?: number
  y?: number
  w?: number
  h?: number
}

// ============================================
// New Actions from Agent Starter Kit
// ============================================

/**
 * ClearAction - Delete all shapes on the canvas
 */
export interface ClearAction {
  _type: "clear"
}

/**
 * MoveAction - Move a shape to an absolute position
 */
export interface MoveAction {
  _type: "move"
  intent: string
  shapeId: string
  x: number
  y: number
}

/**
 * ResizeAction - Resize shapes relative to an origin
 */
export interface ResizeAction {
  _type: "resize"
  intent: string
  shapeIds: string[]
  scaleX: number
  scaleY: number
  originX: number
  originY: number
}

/**
 * RotateAction - Rotate shapes around an origin
 */
export interface RotateAction {
  _type: "rotate"
  intent: string
  shapeIds: string[]
  degrees: number
  originX: number
  originY: number
}

/**
 * AlignAction - Align shapes to each other
 */
export interface AlignAction {
  _type: "align"
  intent: string
  shapeIds: string[]
  alignment: "top" | "bottom" | "left" | "right" | "center-horizontal" | "center-vertical"
  gap: number
}

/**
 * DistributeAction - Distribute shapes evenly
 */
export interface DistributeAction {
  _type: "distribute"
  intent: string
  shapeIds: string[]
  direction: "horizontal" | "vertical"
}

/**
 * StackAction - Stack shapes with a gap
 */
export interface StackAction {
  _type: "stack"
  intent: string
  shapeIds: string[]
  direction: "horizontal" | "vertical"
  gap: number
}

/**
 * BringToFrontAction - Bring shapes to front
 */
export interface BringToFrontAction {
  _type: "bringToFront"
  intent: string
  shapeIds: string[]
}

/**
 * SendToBackAction - Send shapes to back
 */
export interface SendToBackAction {
  _type: "sendToBack"
  intent: string
  shapeIds: string[]
}

/**
 * SetMyViewAction - AI changes its viewport
 */
export interface SetMyViewAction {
  _type: "setMyView"
  intent: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * AddDetailAction - AI schedules further work
 */
export interface AddDetailAction {
  _type: "add-detail"
  intent: string
}

// Union type for all actions
export type AgentAction = 
  | CreateAction 
  | PenAction 
  | DeleteAction 
  | UpdateAction 
  | LabelAction
  | PlaceAction
  | ThinkAction 
  | MessageAction
  | ReviewAction
  | ClearAction
  | MoveAction
  | ResizeAction
  | RotateAction
  | AlignAction
  | DistributeAction
  | StackAction
  | BringToFrontAction
  | SendToBackAction
  | SetMyViewAction
  | AddDetailAction

// Streaming wrapper (matches tldraw starter kit pattern)
export type Streaming<T> = T & {
  complete: boolean
  time: number
}

// Canvas actions (ones that modify the canvas)
export type CanvasAction = 
  | CreateAction 
  | PenAction 
  | DeleteAction 
  | UpdateAction 
  | LabelAction
  | PlaceAction
  | ClearAction
  | MoveAction
  | ResizeAction
  | RotateAction
  | AlignAction
  | DistributeAction
  | StackAction
  | BringToFrontAction
  | SendToBackAction

// Check if action is a canvas action
export function isCanvasAction(action: AgentAction): action is CanvasAction {
  return [
    "create", "pen", "delete", "update", "label", "place",
    "clear", "move", "resize", "rotate", "align", "distribute", 
    "stack", "bringToFront", "sendToBack"
  ].includes(action._type)
}

// ============================================
// Chat History Types
// ============================================

export interface ChatHistoryPromptItem {
  type: "prompt"
  message: string
  timestamp: number
}

export interface ChatHistoryActionItem {
  type: "action"
  action: Streaming<AgentAction>
  acceptance: "pending" | "accepted" | "rejected"
  /** The diff of canvas changes from this action (used for accept/reject) */
  diff?: unknown // RecordsDiff<TLRecord> from tldraw
}

export interface ChatHistoryContinuationItem {
  type: "continuation"
}

export type ChatHistoryItem = 
  | ChatHistoryPromptItem 
  | ChatHistoryActionItem 
  | ChatHistoryContinuationItem

// ============================================
// Action Info (for display in UI)
// ============================================

export type AgentIconType = 
  | "pencil" | "shapes" | "trash" | "edit" | "highlight" 
  | "brain" | "message" | "check" | "warning" | "tag"

export interface ActionInfo {
  icon: AgentIconType | null
  description: string | null
  summary?: string | null
  canGroup?: (prevAction: AgentAction) => boolean
}

export function getActionInfo(action: Streaming<AgentAction>): ActionInfo {
  switch (action._type) {
    case "create":
      return {
        icon: "shapes",
        description: action.intent || `Create ${action.shape._type} shape`,
      }
    case "pen":
      return {
        icon: "pencil",
        description: action.intent || "Draw freeform line",
      }
    case "delete":
      return {
        icon: "trash",
        description: action.intent || "Delete shape",
      }
    case "update":
      return {
        icon: "edit",
        description: action.intent || "Update shape",
      }
    case "label":
      return {
        icon: "tag",
        description: action.intent || `Label shape: "${action.text}"`,
      }
    case "place":
      return {
        icon: "shapes",
        description: action.intent || `Place shape ${action.side} of reference`,
      }
    case "think":
      return {
        icon: "brain",
        description: action.text,
        summary: `Thought for ${Math.ceil(action.time / 1000)} seconds`,
        canGroup: (prevAction) => prevAction._type === "think",
      }
    case "message":
      return {
        icon: "message",
        description: action.text,
      }
    case "review":
      return {
        icon: action.status === "correct" ? "check" : "warning",
        description: action.text,
      }
    // New action types from Agent Starter Kit
    case "clear":
      return {
        icon: "trash",
        description: "Cleared the canvas",
      }
    case "move":
      return {
        icon: "shapes",
        description: action.intent || "Move shape",
      }
    case "resize":
      return {
        icon: "shapes",
        description: action.intent || "Resize shapes",
      }
    case "rotate":
      return {
        icon: "shapes",
        description: action.intent || "Rotate shapes",
      }
    case "align":
      return {
        icon: "shapes",
        description: action.intent || `Align shapes: ${action.alignment}`,
      }
    case "distribute":
      return {
        icon: "shapes",
        description: action.intent || `Distribute shapes ${action.direction}`,
      }
    case "stack":
      return {
        icon: "shapes",
        description: action.intent || `Stack shapes ${action.direction}`,
      }
    case "bringToFront":
      return {
        icon: "shapes",
        description: action.intent || "Bring to front",
      }
    case "sendToBack":
      return {
        icon: "shapes",
        description: action.intent || "Send to back",
      }
    case "setMyView":
      return {
        icon: "shapes",
        description: action.intent || "Change viewport",
      }
    case "add-detail":
      return {
        icon: "pencil",
        description: action.intent || "Adding detail",
      }
    default:
      return {
        icon: null,
        description: null,
      }
  }
}
