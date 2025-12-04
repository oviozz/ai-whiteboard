/**
 * Agent Types
 *
 * Core types for the TldrawAgent system, matching the tldraw agent starter kit.
 */

import type { BoxModel, VecModel, RecordsDiff, TLRecord } from "tldraw";
import type { AgentAction, SimpleShape, Streaming } from "./agent-actions";

// ============================================
// Context Item Types
// ============================================

export interface ShapeContextItem {
  type: "shape";
  shape: SimpleShape;
  source: "agent" | "user";
}

export interface ShapesContextItem {
  type: "shapes";
  shapes: SimpleShape[];
  source: "agent" | "user";
}

export interface AreaContextItem {
  type: "area";
  bounds: BoxModel;
  source: "agent" | "user";
}

export interface PointContextItem {
  type: "point";
  point: VecModel;
  source: "agent" | "user";
}

export type ContextItem =
  | ShapeContextItem
  | ShapesContextItem
  | AreaContextItem
  | PointContextItem;

// ============================================
// Request Types
// ============================================

export type AgentRequestType = "user" | "schedule" | "todo";

export interface AgentRequest {
  type: AgentRequestType;
  messages: string[];
  data: Promise<unknown>[];
  selectedShapes: SimpleShape[];
  contextItems: ContextItem[];
  bounds: BoxModel;
  modelName: string;
}

export type AgentInput =
  | string
  | string[]
  | Partial<AgentRequest> & { message?: string; messages?: string | string[] };

// ============================================
// Chat History Types (Enhanced)
// ============================================

export interface ChatHistoryPromptItem {
  type: "prompt";
  message: string;
  /** Context items (shapes, areas, points) included in this prompt */
  contextItems?: ContextItem[];
  /** Selected shapes included in this prompt */
  selectedShapes?: SimpleShape[];
  /** Timestamp (legacy support) */
  timestamp?: number;
}

export interface ChatHistoryActionItem {
  type: "action";
  action: Streaming<AgentAction>;
  /** The diff of canvas changes from this action */
  diff?: RecordsDiff<TLRecord>;
  acceptance: "pending" | "accepted" | "rejected";
}

export interface ChatHistoryContinuationItem {
  type: "continuation";
  /** Data from continuations */
  data?: unknown[];
}

export type ChatHistoryItem =
  | ChatHistoryPromptItem
  | ChatHistoryActionItem
  | ChatHistoryContinuationItem;

// ============================================
// Todo Types
// ============================================

export interface TodoItem {
  id: number;
  status: "todo" | "in-progress" | "done";
  text: string;
}

// ============================================
// Agent Message Types (for prompt building)
// ============================================

export interface AgentMessageContent {
  type: "text" | "image";
  text?: string;
  image?: string;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: AgentMessageContent[];
  priority: number;
}

// ============================================
// Action Info Types
// ============================================

export type AgentIconType =
  | "pencil"
  | "shapes"
  | "trash"
  | "edit"
  | "highlight"
  | "brain"
  | "message"
  | "check"
  | "warning"
  | "tag"
  | "search"
  | "target";

export interface ChatHistoryInfo {
  icon: AgentIconType | null;
  description: string | null;
  summary?: string | null;
  canGroup?: (prevAction: AgentAction) => boolean;
}

// ============================================
// Prompt Part Types
// ============================================

export interface BasePromptPart<T extends string = string> {
  type: T;
}

// ============================================
// Helper to check context item equality
// ============================================

export function areContextItemsEqual(
  a: ContextItem,
  b: ContextItem
): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case "shape": {
      const _b = b as ShapeContextItem;
      return a.shape.shapeId === _b.shape.shapeId;
    }
    case "shapes": {
      const _b = b as ShapesContextItem;
      if (a.shapes.length !== _b.shapes.length) return false;
      return a.shapes.every((shape) =>
        _b.shapes.find((s) => s.shapeId === shape.shapeId)
      );
    }
    case "area": {
      const _b = b as AreaContextItem;
      return (
        a.bounds.x === _b.bounds.x &&
        a.bounds.y === _b.bounds.y &&
        a.bounds.w === _b.bounds.w &&
        a.bounds.h === _b.bounds.h
      );
    }
    case "point": {
      const _b = b as PointContextItem;
      return a.point.x === _b.point.x && a.point.y === _b.point.y;
    }
    default:
      return false;
  }
}

