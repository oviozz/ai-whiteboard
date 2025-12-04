/**
 * Agent Helpers
 * 
 * Provides utility functions for transformations, validation, and 
 * shape ID management during agent request processing.
 * Based on tldraw Agent Starter Kit's AgentHelpers pattern.
 */

import type { Editor, TLShapeId, BoxModel, VecModel } from "tldraw";
import type { SimpleShape, SimpleFill } from "./agent-actions";

// ============================================
// Types
// ============================================

export interface AgentHelpersOptions {
  editor: Editor;
  chatOrigin?: VecModel;
}

// ============================================
// AgentHelpers Class
// ============================================

/**
 * This class handles transformations throughout an agent request.
 * It contains helpers that can be used to:
 * - Transform positions relative to chat origin
 * - Validate incoming data from the model
 * - Manage shape ID uniqueness and mapping
 * - Round numbers for cleaner model output
 */
export class AgentHelpers {
  /** The tldraw editor instance */
  editor: Editor;
  
  /** The offset to apply for relative coordinates */
  offset: VecModel = { x: 0, y: 0 };
  
  /** Map of AI-provided IDs to actual tldraw IDs */
  shapeIdMap = new Map<string, string>();
  
  /** Map of rounding diffs for restoring original values */
  roundingDiffMap = new Map<string, number>();

  constructor(options: AgentHelpersOptions) {
    this.editor = options.editor;
    
    // Set offset based on chat origin
    if (options.chatOrigin) {
      this.offset = {
        x: -options.chatOrigin.x,
        y: -options.chatOrigin.y,
      };
    }
  }

  // ============================================
  // Coordinate Transformations
  // ============================================

  /**
   * Apply offset to a position (for sending to model)
   */
  applyOffsetToVec(position: VecModel): VecModel {
    return {
      x: position.x + this.offset.x,
      y: position.y + this.offset.y,
    };
  }

  /**
   * Remove offset from a position (for applying model output)
   */
  removeOffsetFromVec(position: VecModel): VecModel {
    return {
      x: position.x - this.offset.x,
      y: position.y - this.offset.y,
    };
  }

  /**
   * Apply offset to a box (for sending to model)
   */
  applyOffsetToBox(box: BoxModel): BoxModel {
    return {
      x: box.x + this.offset.x,
      y: box.y + this.offset.y,
      w: box.w,
      h: box.h,
    };
  }

  /**
   * Remove offset from a box (for applying model output)
   */
  removeOffsetFromBox(box: BoxModel): BoxModel {
    return {
      x: box.x - this.offset.x,
      y: box.y - this.offset.y,
      w: box.w,
      h: box.h,
    };
  }

  /**
   * Apply offset to a shape (for sending to model)
   */
  applyOffsetToShape(shape: SimpleShape): SimpleShape {
    if ("x1" in shape) {
      // Arrow or line shape
      return {
        ...shape,
        x1: shape.x1 + this.offset.x,
        y1: shape.y1 + this.offset.y,
        x2: shape.x2 + this.offset.x,
        y2: shape.y2 + this.offset.y,
      };
    }
    if ("x" in shape) {
      return {
        ...shape,
        x: shape.x + this.offset.x,
        y: shape.y + this.offset.y,
      };
    }
    return shape;
  }

  /**
   * Remove offset from a shape (for applying model output)
   */
  removeOffsetFromShape(shape: SimpleShape): SimpleShape {
    if ("x1" in shape) {
      return {
        ...shape,
        x1: shape.x1 - this.offset.x,
        y1: shape.y1 - this.offset.y,
        x2: shape.x2 - this.offset.x,
        y2: shape.y2 - this.offset.y,
      };
    }
    if ("x" in shape) {
      return {
        ...shape,
        x: shape.x - this.offset.x,
        y: shape.y - this.offset.y,
      };
    }
    return shape;
  }

  // ============================================
  // Value Validation
  // ============================================

  /**
   * Ensure a value is a valid number
   */
  ensureValueIsNumber(value: unknown): number | null {
    if (typeof value === "number" && !isNaN(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  /**
   * Ensure a value is a valid vector (point with x and y)
   */
  ensureValueIsVec(value: unknown): VecModel | null {
    if (!value || typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    if (!("x" in obj) || !("y" in obj)) return null;

    const x = this.ensureValueIsNumber(obj.x);
    const y = this.ensureValueIsNumber(obj.y);
    if (x === null || y === null) return null;

    return { x, y };
  }

  /**
   * Ensure a value is a valid boolean
   */
  ensureValueIsBoolean(value: unknown): boolean | null {
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
  ensureValueIsSimpleFill(value: unknown): SimpleFill | null {
    const validFills: SimpleFill[] = ["none", "semi", "solid", "pattern"];
    if (typeof value === "string" && validFills.includes(value as SimpleFill)) {
      return value as SimpleFill;
    }
    return null;
  }

  // ============================================
  // Shape ID Management
  // ============================================

  /**
   * Ensure a shape ID is unique, incrementing if necessary.
   * Tracks the mapping so future references work correctly.
   */
  ensureShapeIdIsUnique(id: string): string {
    const { editor } = this;
    const idWithoutPrefix = id.startsWith("shape:") ? id.slice(6) : id;

    // Find unique ID by incrementing number at end
    let newId = idWithoutPrefix;
    let existingShape = editor.getShape(`shape:${newId}` as TLShapeId);
    
    while (existingShape) {
      const match = /^(.+?)(\d+)$/.exec(newId);
      if (match) {
        newId = match[1] + String(parseInt(match[2]) + 1);
      } else {
        newId = `${newId}-1`;
      }
      existingShape = editor.getShape(`shape:${newId}` as TLShapeId);
    }

    // Track transformation if ID changed
    if (idWithoutPrefix !== newId) {
      this.shapeIdMap.set(idWithoutPrefix, newId);
    }

    // Return with or without prefix based on input
    return id.startsWith("shape:") ? `shape:${newId}` : newId;
  }

  /**
   * Ensure a shape ID refers to a real shape.
   * Returns the mapped ID if available.
   */
  ensureShapeIdExists(id: string): string | null {
    const { editor } = this;
    const idWithoutPrefix = id.startsWith("shape:") ? id.slice(6) : id;

    // Check if we have a mapping
    const mappedId = this.shapeIdMap.get(idWithoutPrefix);
    if (mappedId) {
      return mappedId;
    }

    // Check if shape exists
    const existingShape = editor.getShape(`shape:${idWithoutPrefix}` as TLShapeId);
    if (existingShape) {
      return id;
    }

    return null;
  }

  /**
   * Ensure multiple shape IDs exist, filtering out non-existent ones
   */
  ensureShapeIdsExist(ids: string[]): string[] {
    return ids
      .map((id) => this.ensureShapeIdExists(id))
      .filter((id): id is string => id !== null);
  }

  // ============================================
  // Rounding Helpers
  // ============================================

  /**
   * Round shape coordinates for cleaner model output
   */
  roundShape(shape: SimpleShape): SimpleShape {
    const result = { ...shape };
    
    if ("x1" in result) {
      result.x1 = this.roundAndSaveNumber(result.x1, `${shape.shapeId}_x1`);
      result.y1 = this.roundAndSaveNumber(result.y1, `${shape.shapeId}_y1`);
      result.x2 = this.roundAndSaveNumber(result.x2, `${shape.shapeId}_x2`);
      result.y2 = this.roundAndSaveNumber(result.y2, `${shape.shapeId}_y2`);
    } else if ("x" in result) {
      result.x = this.roundAndSaveNumber(result.x, `${shape.shapeId}_x`);
      result.y = this.roundAndSaveNumber(result.y, `${shape.shapeId}_y`);
    }

    if ("w" in result && "h" in result) {
      const geoShape = result as { w: number; h: number; shapeId: string };
      geoShape.w = this.roundAndSaveNumber(geoShape.w, `${shape.shapeId}_w`);
      geoShape.h = this.roundAndSaveNumber(geoShape.h, `${shape.shapeId}_h`);
    }

    return result;
  }

  /**
   * Restore original (unrounded) values for a shape
   */
  unroundShape(shape: SimpleShape): SimpleShape {
    const result = { ...shape };
    
    if ("x1" in result) {
      result.x1 = this.unroundAndRestoreNumber(result.x1, `${shape.shapeId}_x1`);
      result.y1 = this.unroundAndRestoreNumber(result.y1, `${shape.shapeId}_y1`);
      result.x2 = this.unroundAndRestoreNumber(result.x2, `${shape.shapeId}_x2`);
      result.y2 = this.unroundAndRestoreNumber(result.y2, `${shape.shapeId}_y2`);
    } else if ("x" in result) {
      result.x = this.unroundAndRestoreNumber(result.x, `${shape.shapeId}_x`);
      result.y = this.unroundAndRestoreNumber(result.y, `${shape.shapeId}_y`);
    }

    if ("w" in result && "h" in result) {
      const geoShape = result as { w: number; h: number; shapeId: string };
      geoShape.w = this.unroundAndRestoreNumber(geoShape.w, `${shape.shapeId}_w`);
      geoShape.h = this.unroundAndRestoreNumber(geoShape.h, `${shape.shapeId}_h`);
    }

    return result;
  }

  /**
   * Round a box's coordinates
   */
  roundBox(box: BoxModel): BoxModel {
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      w: Math.round(box.w),
      h: Math.round(box.h),
    };
  }

  /**
   * Round a vector's coordinates
   */
  roundVec(vec: VecModel): VecModel {
    return {
      x: Math.round(vec.x),
      y: Math.round(vec.y),
    };
  }

  /**
   * Round a number and save the diff for later restoration
   */
  private roundAndSaveNumber(num: number, key: string): number {
    const rounded = Math.round(num);
    const diff = rounded - num;
    this.roundingDiffMap.set(key, diff);
    return rounded;
  }

  /**
   * Restore the original value from a rounded number
   */
  private unroundAndRestoreNumber(num: number, key: string): number {
    const diff = this.roundingDiffMap.get(key);
    if (diff === undefined) return num;
    return num - diff;
  }

  // ============================================
  // Reset
  // ============================================

  /**
   * Clear all mappings and diffs
   */
  reset(): void {
    this.shapeIdMap.clear();
    this.roundingDiffMap.clear();
  }
}

// ============================================
// Factory Function
// ============================================

export function createAgentHelpers(options: AgentHelpersOptions): AgentHelpers {
  return new AgentHelpers(options);
}

