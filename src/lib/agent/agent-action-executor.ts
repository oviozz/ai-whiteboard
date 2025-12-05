/**
 * Agent Action Executor
 *
 * Executes agent actions on the tldraw canvas using TLDraw's native APIs.
 * Matches the tldraw agent starter kit pattern with `_type` field.
 */

import type {
  Editor,
  TLShapeId,
  TLDrawShapeSegment,
  TLShape,
  VecLike,
  TLBindingCreate,
} from "tldraw";
import {
  createShapeId,
  toRichText,
  TEXT_PROPS,
  FONT_FAMILIES,
  FONT_SIZES,
  Vec,
} from "tldraw";
import type {
  AgentAction,
  CreateAction,
  PenAction,
  DeleteAction,
  UpdateAction,
  LabelAction,
  PlaceAction,
  ClearAction,
  MoveAction,
  ResizeAction,
  RotateAction,
  AlignAction,
  DistributeAction,
  StackAction,
  BringToFrontAction,
  SendToBackAction,
  SetMyViewAction,
  AddDetailAction,
  CanvasAction,
  SimpleGeoShape,
  SimpleTextShape,
  SimpleNoteShape,
  SimpleArrowShape,
  SimpleLineShape,
} from "./agent-actions";

// ============================================
// Types
// ============================================

export interface ExecutionResult {
  success: boolean;
  shapeIds?: TLShapeId[];
  error?: string;
  historyMarkId?: string;
}

export interface PreviewResult {
  success: boolean;
  previewShapeIds: TLShapeId[];
  error?: string;
}

// Map simple color to tldraw color
const colorMap: Record<string, string> = {
  black: "black",
  grey: "grey",
  "light-violet": "light-violet",
  violet: "violet",
  blue: "blue",
  "light-blue": "light-blue",
  yellow: "yellow",
  orange: "orange",
  green: "green",
  "light-green": "light-green",
  "light-red": "light-red",
  red: "red",
  white: "white",
};

// Map simple geo type to tldraw geo type (all types from starter kit)
const geoTypeMap: Record<string, string> = {
  // Basic shapes
  rectangle: "rectangle",
  ellipse: "ellipse",
  triangle: "triangle",
  diamond: "diamond",
  hexagon: "hexagon",
  star: "star",
  cloud: "cloud",
  heart: "heart",
  // Extended shapes from starter kit
  pill: "oval",
  "x-box": "x-box",
  "check-box": "check-box",
  pentagon: "pentagon",
  octagon: "octagon",
  "parallelogram-right": "rhombus",
  "parallelogram-left": "rhombus-2",
  trapezoid: "trapezoid",
  // Fat arrows
  "fat-arrow-right": "arrow-right",
  "fat-arrow-left": "arrow-left",
  "fat-arrow-up": "arrow-up",
  "fat-arrow-down": "arrow-down",
};

// All geo shape types for switch statement matching
const GEO_SHAPE_TYPES = new Set([
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "hexagon",
  "star",
  "cloud",
  "heart",
  "pill",
  "x-box",
  "check-box",
  "pentagon",
  "octagon",
  "parallelogram-right",
  "parallelogram-left",
  "trapezoid",
  "fat-arrow-right",
  "fat-arrow-left",
  "fat-arrow-up",
  "fat-arrow-down",
]);

// ============================================
// Validation Helpers (from AgentHelpers pattern)
// ============================================

/**
 * Ensure a value is a valid number, converting from string if needed
 */
function ensureValueIsNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * Ensure a value is a valid Vec (point with x and y)
 */
function ensureValueIsVec(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (!("x" in obj) || !("y" in obj)) return null;

  const x = ensureValueIsNumber(obj.x);
  const y = ensureValueIsNumber(obj.y);
  if (x === null || y === null) return null;

  return { x, y };
}

/**
 * Ensure a value is a valid boolean
 */
function ensureValueIsBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (typeof value === "string") {
    return value.toLowerCase() !== "false" && value !== "0";
  }
  return null;
}

/**
 * Ensure a value is a valid fill type
 */
function ensureValueIsFill(value: unknown): string | null {
  const validFills = ["none", "semi", "solid", "pattern"];
  if (typeof value === "string" && validFills.includes(value)) {
    return value;
  }
  return null;
}

// ============================================
// Arrow Binding Helper (from starter kit)
// ============================================

/**
 * Calculate the best normalized anchor point for arrow binding
 * @param editor - The tldraw editor instance
 * @param targetShape - The shape to bind to
 * @param targetPoint - The desired point in page space
 * @returns The normalized anchor point (0-1 range within shape bounds)
 */
function calculateArrowBindingAnchor(
  editor: Editor,
  targetShape: TLShape,
  targetPoint: VecLike
): VecLike {
  const targetShapePageBounds = editor.getShapePageBounds(targetShape);
  const targetShapeGeometry = editor.getShapeGeometry(targetShape);

  if (!targetShapePageBounds || !targetShapeGeometry) {
    return { x: 0.5, y: 0.5 }; // Fall back to center
  }

  // Transform the target shape's geometry to page space
  const pageTransform = editor.getShapePageTransform(targetShape);
  const targetShapeGeometryInPageSpace =
    targetShapeGeometry.transform(pageTransform);

  // Find the best anchor point on the shape
  const anchorPoint = targetShapeGeometryInPageSpace.hitTestPoint(
    targetPoint,
    0,
    true
  )
    ? targetPoint
    : targetShapeGeometryInPageSpace.nearestPoint(targetPoint);

  // Convert anchor point to normalized coordinates (0-1 range)
  const normalizedAnchor = {
    x: (anchorPoint.x - targetShapePageBounds.x) / targetShapePageBounds.w,
    y: (anchorPoint.y - targetShapePageBounds.y) / targetShapePageBounds.h,
  };

  // Clamp to valid range
  const clampedNormalizedAnchor = {
    x: Math.max(0.1, Math.min(0.9, normalizedAnchor.x)),
    y: Math.max(0.1, Math.min(0.9, normalizedAnchor.y)),
  };

  // Validate the clamped anchor point
  const clampedAnchorInPageSpace = {
    x:
      targetShapePageBounds.x +
      clampedNormalizedAnchor.x * targetShapePageBounds.w,
    y:
      targetShapePageBounds.y +
      clampedNormalizedAnchor.y * targetShapePageBounds.h,
  };

  return targetShapeGeometryInPageSpace.hitTestPoint(
    clampedAnchorInPageSpace,
    0,
    true
  )
    ? clampedNormalizedAnchor
    : { x: 0.5, y: 0.5 }; // Fall back to center
}

// ============================================
// Collision Detection Utilities
// ============================================

interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Check if two bounding boxes overlap
 */
function boxesOverlap(a: BoundingBox, b: BoundingBox, padding = 10): boolean {
  return !(
    a.x + a.w + padding < b.x ||
    b.x + b.w + padding < a.x ||
    a.y + a.h + padding < b.y ||
    b.y + b.h + padding < a.y
  );
}

// Track recently created shapes in the current session to handle batch creates
const recentlyCreatedBoxes: BoundingBox[] = [];
let lastCreationTime = 0;

/**
 * Clear recent creation tracking if enough time has passed
 */
function clearStaleRecentCreations() {
  const now = Date.now();
  // Clear if more than 2 seconds since last creation (new prompt likely)
  if (now - lastCreationTime > 2000) {
    recentlyCreatedBoxes.length = 0;
  }
  lastCreationTime = now;
}

/**
 * Sanitize a number to ensure it's finite. Returns fallback if not.
 */
function safeNumber(
  value: number | undefined | null,
  fallback: number
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

/**
 * Find a non-overlapping position for a shape
 */
function findNonOverlappingPosition(
  editor: Editor,
  desiredX: number,
  desiredY: number,
  width: number,
  height: number,
  spacing = 30
): { x: number; y: number } {
  clearStaleRecentCreations();

  // Get viewport center as ultimate fallback
  const viewportBounds = editor.getViewportPageBounds();
  const fallbackX = viewportBounds.x + viewportBounds.w / 2;
  const fallbackY = viewportBounds.y + viewportBounds.h / 2;

  // CRITICAL: Sanitize ALL inputs to ensure finite values
  const safeDesiredX = safeNumber(desiredX, fallbackX);
  const safeDesiredY = safeNumber(desiredY, fallbackY);
  const safeWidth = safeNumber(width, 100);
  const safeHeight = safeNumber(height, 50);

  const existingShapes = editor.getCurrentPageShapes();

  // Get bounding boxes of all existing shapes AND recently created shapes
  // Only include boxes with finite values
  const existingBoxes: BoundingBox[] = [];

  for (const box of recentlyCreatedBoxes) {
    if (
      Number.isFinite(box.x) &&
      Number.isFinite(box.y) &&
      Number.isFinite(box.w) &&
      Number.isFinite(box.h)
    ) {
      existingBoxes.push(box);
    }
  }

  for (const shape of existingShapes) {
    const bounds = editor.getShapePageBounds(shape);
    if (
      bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.w) &&
      Number.isFinite(bounds.h)
    ) {
      existingBoxes.push({
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
      });
    }
  }

  if (existingBoxes.length === 0) {
    // Track this position for future creations
    recentlyCreatedBoxes.push({
      x: safeDesiredX,
      y: safeDesiredY,
      w: safeWidth,
      h: safeHeight,
    });
    return { x: safeDesiredX, y: safeDesiredY };
  }

  // Check if desired position overlaps
  const newBox: BoundingBox = {
    x: safeDesiredX,
    y: safeDesiredY,
    w: safeWidth,
    h: safeHeight,
  };
  const hasOverlap = existingBoxes.some((box) =>
    boxesOverlap(newBox, box, spacing)
  );

  if (!hasOverlap) {
    // Track this position for future creations
    recentlyCreatedBoxes.push(newBox);
    return { x: safeDesiredX, y: safeDesiredY };
  }

  // Find safe Y position below all content
  let maxBottom = safeDesiredY; // Start with safe value, not -Infinity
  for (const box of existingBoxes) {
    const bottom = box.y + box.h;
    if (Number.isFinite(bottom) && bottom > maxBottom) {
      maxBottom = bottom;
    }
  }

  // Also check if there's space to the right at the same Y
  let rightmostAtY = safeDesiredX; // Start with safe value, not -Infinity
  for (const box of existingBoxes) {
    // Check if this box is at a similar Y position
    if (Math.abs(box.y - safeDesiredY) < safeHeight + spacing) {
      const right = box.x + box.w;
      if (Number.isFinite(right) && right > rightmostAtY) {
        rightmostAtY = right;
      }
    }
  }

  // Calculate safe positions
  const goDownY = maxBottom + spacing;
  const goRightX = rightmostAtY + spacing;

  // Find the leftmost X position to align with existing content
  let minX = safeDesiredX;
  for (const box of existingBoxes) {
    if (Number.isFinite(box.x) && box.x < minX) {
      minX = box.x;
    }
  }

  // Prefer going right if it keeps us close to the original Y
  // and within a reasonable horizontal distance
  const maxX = viewportBounds.x + viewportBounds.w - safeWidth - 50;

  if (goRightX < maxX) {
    // Check if going right would overlap with anything
    const rightBox: BoundingBox = {
      x: goRightX,
      y: safeDesiredY,
      w: safeWidth,
      h: safeHeight,
    };
    const rightOverlap = existingBoxes.some((box) =>
      boxesOverlap(rightBox, box, spacing)
    );
    if (!rightOverlap) {
      // Track this position for future creations
      recentlyCreatedBoxes.push(rightBox);
      return { x: goRightX, y: safeDesiredY };
    }
  }

  // Check the position below existing content
  const downBox: BoundingBox = {
    x: minX,
    y: goDownY,
    w: safeWidth,
    h: safeHeight,
  };
  const downOverlap = existingBoxes.some((box) =>
    boxesOverlap(downBox, box, spacing)
  );

  if (!downOverlap) {
    // Track this position for future creations
    recentlyCreatedBoxes.push(downBox);
    return { x: minX, y: goDownY };
  }

  // Fallback: try multiple positions
  const attempts = [
    { x: minX, y: goDownY },
    { x: safeDesiredX, y: goDownY },
    { x: safeDesiredX, y: goDownY + spacing },
    { x: minX, y: goDownY + spacing * 2 },
  ];

  for (const pos of attempts) {
    const testBox: BoundingBox = {
      x: pos.x,
      y: pos.y,
      w: safeWidth,
      h: safeHeight,
    };
    if (!existingBoxes.some((box) => boxesOverlap(testBox, box, spacing))) {
      // Track this position for future creations
      recentlyCreatedBoxes.push(testBox);
      return pos;
    }
  }

  // Ultimate fallback: go way down
  const finalPos = { x: minX, y: goDownY + spacing * 3 };
  recentlyCreatedBoxes.push({
    x: finalPos.x,
    y: finalPos.y,
    w: safeWidth,
    h: safeHeight,
  });
  return finalPos;
}

// ============================================
// Main Executor Class
// ============================================

export class AgentActionExecutor {
  private editor: Editor;
  private previewShapeIds: Map<string, TLShapeId[]> = new Map();
  private historyMarkId: string | null = null;
  // Map AI-provided shape IDs to actual tldraw shape IDs
  private shapeIdMap: Map<string, TLShapeId> = new Map();

  constructor(editor: Editor) {
    this.editor = editor;
  }

  /**
   * Ensure a shape ID from AI is unique and create a valid tldraw ID
   * Tracks the mapping for future reference
   */
  private ensureShapeIdIsUnique(aiShapeId: string): TLShapeId {
    // Handle null/undefined IDs
    if (!aiShapeId) {
      return createShapeId();
    }

    // Remove shape: prefix if present
    const baseId = aiShapeId.startsWith("shape:")
      ? aiShapeId.slice(6)
      : aiShapeId;

    // Check if we already have a mapping for this AI ID
    const existingMapping = this.shapeIdMap.get(baseId);
    if (existingMapping) {
      return existingMapping;
    }

    // Find a unique ID
    let newId = baseId;
    let existingShape = this.editor.getShape(`shape:${newId}` as TLShapeId);
    while (existingShape) {
      // Increment number at end or add -1
      const match = newId.match(/^(.+?)(\d+)$/);
      if (match) {
        newId = match[1] + String(parseInt(match[2]) + 1);
      } else {
        newId = `${newId}-1`;
      }
      existingShape = this.editor.getShape(`shape:${newId}` as TLShapeId);
    }

    const tldrawId = `shape:${newId}` as TLShapeId;

    // Store the mapping
    this.shapeIdMap.set(baseId, tldrawId);

    return tldrawId;
  }

  /**
   * Find an existing shape ID from AI reference
   */
  private ensureShapeIdExists(
    aiShapeId: string | null | undefined
  ): TLShapeId | null {
    // Handle null/undefined IDs
    if (!aiShapeId) {
      return null;
    }

    const baseId = aiShapeId.startsWith("shape:")
      ? aiShapeId.slice(6)
      : aiShapeId;

    // Check our mapping first
    const mappedId = this.shapeIdMap.get(baseId);
    if (mappedId && this.editor.getShape(mappedId)) {
      return mappedId;
    }

    // Try direct ID lookup
    const directId = `shape:${baseId}` as TLShapeId;
    if (this.editor.getShape(directId)) {
      return directId;
    }

    // Try as-is
    if (this.editor.getShape(aiShapeId as TLShapeId)) {
      return aiShapeId as TLShapeId;
    }

    return null;
  }

  /**
   * Reset the shape ID map (call when starting a new chat)
   */
  resetShapeIdMap(): void {
    this.shapeIdMap.clear();
  }

  /**
   * Create a history mark before executing agent actions.
   */
  markHistoryPoint(): string {
    this.historyMarkId = this.editor.markHistoryStoppingPoint("agent-action");
    return this.historyMarkId;
  }

  /**
   * Undo all agent actions back to the marked point
   */
  bailToMark(): boolean {
    if (!this.historyMarkId) return false;
    this.editor.bailToMark(this.historyMarkId);
    this.historyMarkId = null;
    return true;
  }

  /**
   * Ensure multiple shape IDs exist and return valid tldraw IDs
   */
  private ensureShapeIdsExist(aiShapeIds: string[]): TLShapeId[] {
    return aiShapeIds
      .map((id) => this.ensureShapeIdExists(id))
      .filter((id): id is TLShapeId => id !== null);
  }

  /**
   * Execute a single action on the canvas
   */
  executeAction(action: AgentAction): ExecutionResult {
    try {
      switch (action._type) {
        case "create":
          return this.executeCreate(action);
        case "pen":
          return this.executePen(action);
        case "delete":
          return this.executeDelete(action);
        case "update":
          return this.executeUpdate(action);
        case "label":
          return this.executeLabel(action);
        case "place":
          return this.executePlace(action);
        // New action types from Agent Starter Kit
        case "clear":
          return this.executeClear();
        case "move":
          return this.executeMove(action);
        case "resize":
          return this.executeResize(action);
        case "rotate":
          return this.executeRotate(action);
        case "align":
          return this.executeAlign(action);
        case "distribute":
          return this.executeDistribute(action);
        case "stack":
          return this.executeStack(action);
        case "bringToFront":
          return this.executeBringToFront(action);
        case "sendToBack":
          return this.executeSendToBack(action);
        case "setMyView":
          return this.executeSetMyView(action);
        case "add-detail":
          return this.executeAddDetail(action);
        case "think":
        case "message":
        case "review":
          // Communication actions don't modify canvas
          return { success: true };
        default:
          return { success: false, error: "Unknown action type" };
      }
    } catch (error) {
      console.error("[AgentExecutor] Error executing action:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute multiple actions atomically
   */
  executeActions(actions: AgentAction[]): ExecutionResult {
    const allShapeIds: TLShapeId[] = [];
    const markId = this.markHistoryPoint();

    try {
      this.editor.run(() => {
        for (const action of actions) {
          const result = this.executeAction(action);
          if (result.shapeIds) {
            allShapeIds.push(...result.shapeIds);
          }
          if (!result.success) {
            throw new Error(result.error || "Action failed");
          }
        }
      });

      return { success: true, shapeIds: allShapeIds, historyMarkId: markId };
    } catch (error) {
      this.bailToMark();
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Batch execution failed",
      };
    }
  }

  /**
   * Preview actions without affecting undo history
   */
  previewActions(actions: CanvasAction[], previewKey: string): PreviewResult {
    const previewShapeIds: TLShapeId[] = [];

    try {
      this.editor.run(
        () => {
          for (const action of actions) {
            const result = this.executeAction(action);
            if (result.shapeIds) {
              previewShapeIds.push(...result.shapeIds);
            }
          }

          // Style preview shapes as ghosted
          previewShapeIds.forEach((id) => {
            this.editor.updateShape({
              id,
              type: this.editor.getShape(id)?.type || "geo",
              opacity: 0.5,
              meta: { isPreview: true },
            });
          });
        },
        { history: "ignore" }
      );

      this.previewShapeIds.set(previewKey, previewShapeIds);
      return { success: true, previewShapeIds };
    } catch (error) {
      console.error("[AgentExecutor] Preview error:", error);
      return {
        success: false,
        previewShapeIds: [],
        error: error instanceof Error ? error.message : "Preview failed",
      };
    }
  }

  /**
   * Commit preview to make it permanent
   */
  commitPreview(previewKey: string): boolean {
    const shapeIds = this.previewShapeIds.get(previewKey);
    if (!shapeIds) return false;

    try {
      this.editor.run(() => {
        shapeIds.forEach((id) => {
          const shape = this.editor.getShape(id);
          if (shape) {
            this.editor.updateShape({
              id,
              type: shape.type,
              opacity: 1,
              meta: { ...shape.meta, isPreview: false },
            });
          }
        });
      });

      this.previewShapeIds.delete(previewKey);
      return true;
    } catch (error) {
      console.error("[AgentExecutor] Commit preview error:", error);
      return false;
    }
  }

  /**
   * Reject preview and remove temporary shapes
   */
  rejectPreview(previewKey: string): boolean {
    const shapeIds = this.previewShapeIds.get(previewKey);
    if (!shapeIds) return false;

    try {
      this.editor.run(
        () => {
          this.editor.deleteShapes(shapeIds);
        },
        { history: "ignore" }
      );

      this.previewShapeIds.delete(previewKey);
      return true;
    } catch (error) {
      console.error("[AgentExecutor] Reject preview error:", error);
      return false;
    }
  }

  // ============================================
  // Individual Action Executors
  // ============================================

  private executeCreate(action: CreateAction): ExecutionResult {
    const { shape } = action;

    // Use AI-provided shapeId if available, otherwise generate one
    const shapeId = shape.shapeId
      ? this.ensureShapeIdIsUnique(shape.shapeId)
      : createShapeId();

    // Handle geo shapes (use set to check all types)
    if (GEO_SHAPE_TYPES.has(shape._type)) {
      const geoShape = shape as SimpleGeoShape;

      // Sanitize input values - AI may send invalid coordinates
      const inputX = safeNumber(geoShape.x, 0);
      const inputY = safeNumber(geoShape.y, 0);
      const width = safeNumber(geoShape.w, 100);
      const height = safeNumber(geoShape.h, 100);

      // Find non-overlapping position
      const safePos = findNonOverlappingPosition(
        this.editor,
        inputX,
        inputY,
        width,
        height
      );

      this.editor.createShape({
        id: shapeId,
        type: "geo",
        x: safePos.x,
        y: safePos.y,
        props: {
          geo: geoTypeMap[geoShape._type] || "rectangle",
          w: width,
          h: height,
          color: colorMap[geoShape.color] || "black",
          fill: geoShape.fill || "none",
          richText: toRichText(geoShape.text || ""),
        },
        meta: {
          note: geoShape.note || "",
          intent: action.intent || "",
        },
      });
      return { success: true, shapeIds: [shapeId] };
    }

    switch (shape._type) {
      case "text": {
        const textShape = shape as SimpleTextShape;
        const text = textShape.text || "";
        const font = "draw";
        // Use provided size or default to "l" (large) for better visibility
        const textSize: keyof typeof FONT_SIZES =
          (textShape.size as keyof typeof FONT_SIZES) || "l";
        // Default scale of 1.5 for AI-generated text (more readable)
        const scale = textShape.scale ?? 1.5;
        // Map textAlign values - tldraw uses "start", "middle", "end" (not "center", "left", "right")
        const textAlignMap: Record<string, "start" | "middle" | "end"> = {
          start: "start",
          left: "start",
          middle: "middle",
          center: "middle",
          end: "end",
          right: "end",
        };
        const textAlign = textAlignMap[textShape.textAlign || "start"] || "start";
        const effectiveFontSize = FONT_SIZES[textSize] * scale;

        // Sanitize input coordinates
        const inputX = safeNumber(textShape.x, 0);
        const inputY = safeNumber(textShape.y, 0);

        // Set max width for text to wrap nicely (500px default, or use provided width)
        // This prevents long text from stretching across the entire canvas
        const MAX_TEXT_WIDTH = 500;
        const targetWidth = safeNumber(
          textShape.w ?? textShape.width,
          MAX_TEXT_WIDTH
        );

        // Measure text to get proper dimensions with max width for wrapping
        const measurement = this.editor.textMeasure.measureText(text, {
          ...TEXT_PROPS,
          fontFamily: FONT_FAMILIES[font as keyof typeof FONT_FAMILIES],
          fontSize: effectiveFontSize,
          maxWidth: targetWidth,
        });

        // Use the measured width, but cap it at the target width
        const finalWidth = Math.min(measurement.w, targetWidth);

        // Determine if we should use autoSize (only for short text that fits within a reasonable width)
        const isShortText = measurement.w < MAX_TEXT_WIDTH;
        const useAutoSize =
          textShape.w === undefined &&
          textShape.width === undefined &&
          isShortText;

        // Calculate position based on text alignment
        let correctedX = inputX;
        let correctedY = inputY - measurement.h / 2;

        switch (textAlign) {
          case "middle":
            correctedX = inputX - finalWidth / 2;
            break;
          case "end":
            correctedX = inputX - finalWidth;
            break;
          case "start":
          default:
            correctedX = inputX;
            break;
        }

        // Find non-overlapping position for text
        const safePos = findNonOverlappingPosition(
          this.editor,
          correctedX,
          correctedY,
          finalWidth,
          safeNumber(measurement.h, 50)
        );

        this.editor.createShape({
          id: shapeId,
          type: "text",
          x: safePos.x,
          y: safePos.y,
          props: {
            richText: toRichText(text),
            color: colorMap[textShape.color] || "black",
            size: textSize,
            font,
            autoSize: useAutoSize,
            scale,
            textAlign,
            w: useAutoSize ? measurement.w : finalWidth,
          },
          meta: {
            note: textShape.note || "",
            intent: action.intent || "",
          },
        });
        break;
      }

      case "note": {
        const noteShape = shape as SimpleNoteShape;
        // Default to "l" for better visibility
        const noteSize = noteShape.size || "l";
        // Estimate note size (notes have fixed dimensions based on size)
        const noteSizeMap: Record<string, number> = {
          s: 150,
          m: 200,
          l: 250,
          xl: 300,
        };
        const noteWidth = noteSizeMap[noteSize] || 200;
        const noteHeight = noteWidth; // Notes are roughly square

        // Sanitize input coordinates
        const inputX = safeNumber(noteShape.x, 0);
        const inputY = safeNumber(noteShape.y, 0);

        // Find non-overlapping position for note
        const safePos = findNonOverlappingPosition(
          this.editor,
          inputX,
          inputY,
          noteWidth,
          noteHeight
        );

        this.editor.createShape({
          id: shapeId,
          type: "note",
          x: safePos.x,
          y: safePos.y,
          props: {
            richText: toRichText(noteShape.text || ""),
            color: colorMap[noteShape.color] || "yellow",
            size: noteSize,
            font: "draw",
            align: "middle",
            verticalAlign: "middle",
            scale: 1.2, // Slightly larger for readability
          },
          meta: {
            note: noteShape.note || "",
            intent: action.intent || "",
          },
        });
        break;
      }

      case "arrow": {
        const arrowShape = shape as SimpleArrowShape;
        // Validate coordinates
        const x1 = ensureValueIsNumber(arrowShape.x1) ?? 0;
        const y1 = ensureValueIsNumber(arrowShape.y1) ?? 0;
        const x2 = ensureValueIsNumber(arrowShape.x2) ?? 0;
        const y2 = ensureValueIsNumber(arrowShape.y2) ?? 0;
        const bendValue = ensureValueIsNumber(arrowShape.bend) ?? 0;

        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);

        // Create the arrow shape
        this.editor.createShape({
          id: shapeId,
          type: "arrow",
          x: minX,
          y: minY,
          props: {
            start: { x: x1 - minX, y: y1 - minY },
            end: { x: x2 - minX, y: y2 - minY },
            color: colorMap[arrowShape.color] || "black",
            size: "m",
            arrowheadStart: "none",
            arrowheadEnd: "arrow",
            richText: toRichText(arrowShape.text || ""),
            bend: bendValue,
          },
          meta: {
            note: arrowShape.note || "",
            intent: action.intent || "",
          },
        });

        // Create bindings if fromId or toId are specified
        const bindings: TLBindingCreate[] = [];

        if (arrowShape.fromId) {
          const fromShapeId = this.ensureShapeIdExists(arrowShape.fromId);
          if (fromShapeId) {
            const startShape = this.editor.getShape(fromShapeId);
            if (startShape) {
              const targetPoint = { x: x1, y: y1 };
              const normalizedAnchor = calculateArrowBindingAnchor(
                this.editor,
                startShape,
                targetPoint
              );
              bindings.push({
                type: "arrow",
                fromId: shapeId,
                toId: fromShapeId,
                props: {
                  normalizedAnchor,
                  isExact: false,
                  isPrecise: true,
                  terminal: "start",
                },
                meta: {},
              });
            }
          }
        }

        if (arrowShape.toId) {
          const toShapeId = this.ensureShapeIdExists(arrowShape.toId);
          if (toShapeId) {
            const endShape = this.editor.getShape(toShapeId);
            if (endShape) {
              const targetPoint = { x: x2, y: y2 };
              const normalizedAnchor = calculateArrowBindingAnchor(
                this.editor,
                endShape,
                targetPoint
              );
              bindings.push({
                type: "arrow",
                fromId: shapeId,
                toId: toShapeId,
                props: {
                  normalizedAnchor,
                  isExact: false,
                  isPrecise: true,
                  terminal: "end",
                },
                meta: {},
              });
            }
          }
        }

        // Create bindings
        for (const binding of bindings) {
          this.editor.createBinding(binding);
        }

        break;
      }

      case "line": {
        const lineShape = shape as SimpleLineShape;
        // Validate coordinates
        const x1 = ensureValueIsNumber(lineShape.x1) ?? 0;
        const y1 = ensureValueIsNumber(lineShape.y1) ?? 0;
        const x2 = ensureValueIsNumber(lineShape.x2) ?? 100;
        const y2 = ensureValueIsNumber(lineShape.y2) ?? 0;

        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);

        this.editor.createShape({
          id: shapeId,
          type: "line",
          x: minX,
          y: minY,
          props: {
            points: {
              a1: {
                id: "a1",
                index: "a1" as const,
                x: x1 - minX,
                y: y1 - minY,
              },
              a2: {
                id: "a2",
                index: "a2" as const,
                x: x2 - minX,
                y: y2 - minY,
              },
            },
            color: colorMap[lineShape.color] || "black",
            size: "m",
            dash: "draw",
          },
          meta: {
            note: lineShape.note || "",
            intent: action.intent || "",
          },
        });
        break;
      }

      default:
        return { success: false, error: `Unknown shape type: ${shape._type}` };
    }

    return { success: true, shapeIds: [shapeId] };
  }

  private executePen(action: PenAction): ExecutionResult {
    const shapeId = createShapeId();
    const { points, color, style } = action;

    if (!points || points.length < 2) {
      return { success: false, error: "Pen action requires at least 2 points" };
    }

    // Validate and filter points using sanitization helpers
    const validPoints = points
      .map((p) => ensureValueIsVec(p))
      .filter((p): p is { x: number; y: number } => p !== null);

    if (validPoints.length < 2) {
      return {
        success: false,
        error: "Pen action requires at least 2 valid points",
      };
    }

    // Sanitize closed and fill values
    const isClosed = ensureValueIsBoolean(action.closed) ?? false;
    const fillValue = ensureValueIsFill(action.fill) ?? "none";

    // Calculate bounds with safety fallbacks
    const xValues = validPoints.map((p) => p.x).filter(Number.isFinite);
    const yValues = validPoints.map((p) => p.y).filter(Number.isFinite);
    const minX = xValues.length > 0 ? Math.min(...xValues) : 0;
    const minY = yValues.length > 0 ? Math.min(...yValues) : 0;

    // Interpolate points for smoother lines using Vec utilities
    const interpolatedPoints: { x: number; y: number }[] = [];
    const maxDistanceBetweenPoints = style === "smooth" ? 10 : 2;

    for (let i = 0; i < validPoints.length - 1; i++) {
      const point = validPoints[i];
      interpolatedPoints.push(point);

      const nextPoint = validPoints[i + 1];
      if (!nextPoint) continue;

      const distance = Vec.Dist(point, nextPoint);
      const numPointsToAdd = Math.floor(distance / maxDistanceBetweenPoints);

      // Interpolate between points
      for (let j = 1; j <= numPointsToAdd; j++) {
        const t = j / (numPointsToAdd + 1);
        const interpolated = Vec.Lrp(point, nextPoint, t);
        interpolatedPoints.push({ x: interpolated.x, y: interpolated.y });
      }
    }

    // Add last point
    interpolatedPoints.push(validPoints[validPoints.length - 1]);

    // Close the shape if needed
    if (isClosed) {
      interpolatedPoints.push(validPoints[0]);
    }

    const segments: TLDrawShapeSegment[] = [
      {
        type: "free",
        points: interpolatedPoints.map((p) => ({
          x: p.x - minX,
          y: p.y - minY,
          z: 0.75,
        })),
      },
    ];

    this.editor.createShape({
      id: shapeId,
      type: "draw",
      x: minX,
      y: minY,
      props: {
        segments,
        color: colorMap[color] || "black",
        size: "s",
        dash: "draw",
        fill: fillValue,
        isComplete: true,
        isClosed,
        isPen: true,
      },
    });

    return { success: true, shapeIds: [shapeId] };
  }

  private executeDelete(action: DeleteAction): ExecutionResult {
    const id = this.ensureShapeIdExists(action.shapeId);
    if (!id) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    this.editor.deleteShapes([id]);
    return { success: true };
  }

  private executeUpdate(action: UpdateAction): ExecutionResult {
    const id = this.ensureShapeIdExists(action.shapeId);
    if (!id) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    const shape = this.editor.getShape(id);
    if (!shape) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    const updates: Record<string, unknown> = {};
    const shapeUpdate = action.shape;

    // Map properties
    if ("color" in shapeUpdate && shapeUpdate.color) {
      updates.color =
        colorMap[shapeUpdate.color as string] || shapeUpdate.color;
    }
    if ("fill" in shapeUpdate) {
      updates.fill = shapeUpdate.fill;
    }
    if ("text" in shapeUpdate && typeof shapeUpdate.text === "string") {
      updates.richText = toRichText(shapeUpdate.text);
    }

    this.editor.updateShape({
      id,
      type: shape.type,
      props: updates,
    });

    return { success: true, shapeIds: [id] };
  }

  private executeLabel(action: LabelAction): ExecutionResult {
    const id = this.ensureShapeIdExists(action.shapeId);
    if (!id) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    const shape = this.editor.getShape(id);
    if (!shape) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    // Update shape with label text
    this.editor.updateShape({
      id,
      type: shape.type,
      props: {
        richText: toRichText(action.text),
      },
    });

    return { success: true, shapeIds: [id] };
  }

  /**
   * Place a shape relative to another shape (from starter kit PlaceActionUtil)
   */
  private executePlace(action: PlaceAction): ExecutionResult {
    const shapeId = this.ensureShapeIdExists(action.shapeId);
    if (!shapeId) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    const referenceShapeId = this.ensureShapeIdExists(action.referenceShapeId);
    if (!referenceShapeId) {
      return {
        success: false,
        error: `Reference shape not found: ${action.referenceShapeId}`,
      };
    }

    const shape = this.editor.getShape(shapeId);
    const referenceShape = this.editor.getShape(referenceShapeId);
    if (!shape || !referenceShape) {
      return { success: false, error: "Shape or reference shape not found" };
    }

    const { side, sideOffset = 0, align, alignOffset = 0 } = action;
    const bbA = this.editor.getShapePageBounds(shape)!;
    const bbR = this.editor.getShapePageBounds(referenceShape)!;

    let newX = shape.x;
    let newY = shape.y;

    // Calculate position based on side and alignment
    if (side === "top") {
      newY = bbR.minY - bbA.height - sideOffset;
      if (align === "start") {
        newX = bbR.minX + alignOffset;
      } else if (align === "center") {
        newX = bbR.midX - bbA.width / 2 + alignOffset;
      } else if (align === "end") {
        newX = bbR.maxX - bbA.width - alignOffset;
      }
    } else if (side === "bottom") {
      newY = bbR.maxY + sideOffset;
      if (align === "start") {
        newX = bbR.minX + alignOffset;
      } else if (align === "center") {
        newX = bbR.midX - bbA.width / 2 + alignOffset;
      } else if (align === "end") {
        newX = bbR.maxX - bbA.width - alignOffset;
      }
    } else if (side === "left") {
      newX = bbR.minX - bbA.width - sideOffset;
      if (align === "start") {
        newY = bbR.minY + alignOffset;
      } else if (align === "center") {
        newY = bbR.midY - bbA.height / 2 + alignOffset;
      } else if (align === "end") {
        newY = bbR.maxY - bbA.height - alignOffset;
      }
    } else if (side === "right") {
      newX = bbR.maxX + sideOffset;
      if (align === "start") {
        newY = bbR.minY + alignOffset;
      } else if (align === "center") {
        newY = bbR.midY - bbA.height / 2 + alignOffset;
      } else if (align === "end") {
        newY = bbR.maxY - bbA.height - alignOffset;
      }
    }

    this.editor.updateShape({
      id: shapeId,
      type: shape.type,
      x: newX,
      y: newY,
    });

    return { success: true, shapeIds: [shapeId] };
  }

  // ============================================
  // New Action Executors from Agent Starter Kit
  // ============================================

  /**
   * Clear all shapes from the canvas
   */
  private executeClear(): ExecutionResult {
    const allShapes = this.editor.getCurrentPageShapes();
    if (allShapes.length === 0) {
      return { success: true };
    }
    this.editor.deleteShapes(allShapes.map((s) => s.id));
    return { success: true };
  }

  /**
   * Move a shape to an absolute position
   */
  private executeMove(action: MoveAction): ExecutionResult {
    const shapeId = this.ensureShapeIdExists(action.shapeId);
    if (!shapeId) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    const shape = this.editor.getShape(shapeId);
    if (!shape) {
      return { success: false, error: `Shape not found: ${action.shapeId}` };
    }

    // Validate coordinates
    const x = ensureValueIsNumber(action.x);
    const y = ensureValueIsNumber(action.y);
    if (x === null || y === null) {
      return { success: false, error: "Invalid coordinates for move action" };
    }

    // Get current shape bounds to calculate delta
    const shapeBounds = this.editor.getShapePageBounds(shapeId);
    if (!shapeBounds) {
      return { success: false, error: "Could not get shape bounds" };
    }

    // Calculate position offset (shape origin vs bounds origin)
    const shapeOrigin = new Vec(shape.x, shape.y);
    const shapeBoundsOrigin = new Vec(shapeBounds.minX, shapeBounds.minY);
    const shapeOriginDelta = shapeOrigin.sub(shapeBoundsOrigin);
    const newTarget = new Vec(x, y).add(shapeOriginDelta);

    this.editor.updateShape({
      id: shapeId,
      type: shape.type,
      x: newTarget.x,
      y: newTarget.y,
    });

    return { success: true, shapeIds: [shapeId] };
  }

  /**
   * Resize shapes from an origin point
   */
  private executeResize(action: ResizeAction): ExecutionResult {
    const shapeIds = this.ensureShapeIdsExist(action.shapeIds || []);
    if (shapeIds.length === 0) {
      return { success: false, error: "No valid shapes to resize" };
    }

    const scaleX = ensureValueIsNumber(action.scaleX);
    const scaleY = ensureValueIsNumber(action.scaleY);
    const originX = ensureValueIsNumber(action.originX);
    const originY = ensureValueIsNumber(action.originY);

    if (
      scaleX === null ||
      scaleY === null ||
      originX === null ||
      originY === null
    ) {
      return { success: false, error: "Invalid resize parameters" };
    }

    const origin = { x: originX, y: originY };

    for (const shapeId of shapeIds) {
      this.editor.resizeShape(
        shapeId,
        { x: scaleX, y: scaleY },
        { scaleOrigin: origin }
      );
    }

    return { success: true, shapeIds };
  }

  /**
   * Rotate shapes around an origin point
   */
  private executeRotate(action: RotateAction): ExecutionResult {
    const shapeIds = this.ensureShapeIdsExist(action.shapeIds || []);
    if (shapeIds.length === 0) {
      return { success: false, error: "No valid shapes to rotate" };
    }

    const degrees = ensureValueIsNumber(action.degrees);
    const originX = ensureValueIsNumber(action.originX);
    const originY = ensureValueIsNumber(action.originY);

    if (degrees === null || originX === null || originY === null) {
      return { success: false, error: "Invalid rotate parameters" };
    }

    const radians = (degrees * Math.PI) / 180;
    const center = { x: originX, y: originY };

    this.editor.rotateShapesBy(shapeIds, radians, { center });

    return { success: true, shapeIds };
  }

  /**
   * Align shapes to each other
   */
  private executeAlign(action: AlignAction): ExecutionResult {
    const shapeIds = this.ensureShapeIdsExist(action.shapeIds || []);
    if (shapeIds.length === 0) {
      return { success: false, error: "No valid shapes to align" };
    }

    this.editor.alignShapes(shapeIds, action.alignment);

    return { success: true, shapeIds };
  }

  /**
   * Distribute shapes evenly
   */
  private executeDistribute(action: DistributeAction): ExecutionResult {
    const shapeIds = this.ensureShapeIdsExist(action.shapeIds || []);
    if (shapeIds.length < 3) {
      return { success: false, error: "Need at least 3 shapes to distribute" };
    }

    this.editor.distributeShapes(shapeIds, action.direction);

    return { success: true, shapeIds };
  }

  /**
   * Stack shapes with a gap
   */
  private executeStack(action: StackAction): ExecutionResult {
    const shapeIds = this.ensureShapeIdsExist(action.shapeIds || []);
    if (shapeIds.length === 0) {
      return { success: false, error: "No valid shapes to stack" };
    }

    const gap = ensureValueIsNumber(action.gap) ?? 0;
    this.editor.stackShapes(shapeIds, action.direction, Math.max(gap, 0));

    return { success: true, shapeIds };
  }

  /**
   * Bring shapes to front
   */
  private executeBringToFront(action: BringToFrontAction): ExecutionResult {
    const shapeIds = this.ensureShapeIdsExist(action.shapeIds || []);
    if (shapeIds.length === 0) {
      return { success: false, error: "No valid shapes to bring to front" };
    }

    this.editor.bringToFront(shapeIds);

    return { success: true, shapeIds };
  }

  /**
   * Send shapes to back
   */
  private executeSendToBack(action: SendToBackAction): ExecutionResult {
    const shapeIds = this.ensureShapeIdsExist(action.shapeIds || []);
    if (shapeIds.length === 0) {
      return { success: false, error: "No valid shapes to send to back" };
    }

    this.editor.sendToBack(shapeIds);

    return { success: true, shapeIds };
  }

  /**
   * Set AI viewport (for review purposes)
   * This action schedules a follow-up request with new bounds
   */
  private executeSetMyView(_action: SetMyViewAction): ExecutionResult {
    // This action doesn't directly modify the canvas,
    // it's used to schedule a follow-up request with new viewport bounds
    // The actual viewport change happens in the agent prompt handling
    return { success: true };
  }

  /**
   * Add detail action - schedules further work
   */
  private executeAddDetail(_action: AddDetailAction): ExecutionResult {
    // This action doesn't directly modify the canvas,
    // it signals to the agent system to schedule more work
    return { success: true };
  }
}

// ============================================
// Factory function
// ============================================

export function createAgentExecutor(editor: Editor): AgentActionExecutor {
  return new AgentActionExecutor(editor);
}
