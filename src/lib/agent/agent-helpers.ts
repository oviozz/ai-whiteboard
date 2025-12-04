/**
 * AgentHelpers
 *
 * This class handles transformations that happen throughout a request.
 * It contains helpers for transforming prompt parts before sending to the model,
 * as well as transforming incoming actions from the model.
 *
 * Matches the tldraw agent starter kit pattern.
 */

import type { BoxModel, Editor, TLShapeId, VecModel } from "tldraw";
import type { TldrawAgent } from "./tldraw-agent";
import type { SimpleShape, SimpleFill } from "./agent-actions";
import type { ContextItem } from "./types";

// Valid fill values
const VALID_FILLS: SimpleFill[] = ["none", "semi", "solid", "pattern"];

export interface AgentHelpersOptions {
  agent: TldrawAgent;
}

/**
 * AgentHelpers class for handling transformations during agent requests
 */
export class AgentHelpers {
  /** The agent this instance is for */
  agent: TldrawAgent;

  /** The editor this instance is for */
  editor: Editor;

  /** The offset from the chat origin */
  offset: VecModel = { x: 0, y: 0 };

  /** Map of shape IDs that have been transformed */
  shapeIdMap = new Map<string, string>();

  /** Map of rounding diffs for restoring original values */
  roundingDiffMap = new Map<string, number>();

  constructor(agent: TldrawAgent) {
    this.agent = agent;
    this.editor = agent.editor;
    const origin = agent.$chatOrigin.get();
    this.offset = {
      x: -origin.x,
      y: -origin.y,
    };
  }

  // ============================================
  // Vector/Position Transformations
  // ============================================

  /**
   * Apply offset to a position
   */
  applyOffsetToVec(position: VecModel): VecModel {
    return {
      x: position.x + this.offset.x,
      y: position.y + this.offset.y,
    };
  }

  /**
   * Remove offset from a position
   */
  removeOffsetFromVec(position: VecModel): VecModel {
    return {
      x: position.x - this.offset.x,
      y: position.y - this.offset.y,
    };
  }

  // ============================================
  // Box/Bounds Transformations
  // ============================================

  /**
   * Apply offset to a box
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
   * Remove offset from a box
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
   * Round the values of a box
   */
  roundBox(boxModel: BoxModel): BoxModel {
    return {
      x: Math.round(boxModel.x),
      y: Math.round(boxModel.y),
      w: Math.round(boxModel.w),
      h: Math.round(boxModel.h),
    };
  }

  // ============================================
  // Shape Transformations
  // ============================================

  /**
   * Apply offset to a shape
   */
  applyOffsetToShape(shape: SimpleShape): SimpleShape {
    if ("x1" in shape) {
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
   * Apply offset to a partial shape
   */
  applyOffsetToShapePartial(shape: Partial<SimpleShape>): Partial<SimpleShape> {
    const result = { ...shape };
    if ("x" in shape && shape.x !== undefined) {
      (result as { x: number }).x = shape.x + this.offset.x;
    }
    if ("y" in shape && shape.y !== undefined) {
      (result as { y: number }).y = shape.y + this.offset.y;
    }
    if ("x1" in shape && shape.x1 !== undefined) {
      (result as { x1: number }).x1 = shape.x1 + this.offset.x;
    }
    if ("y1" in shape && shape.y1 !== undefined) {
      (result as { y1: number }).y1 = shape.y1 + this.offset.y;
    }
    if ("x2" in shape && shape.x2 !== undefined) {
      (result as { x2: number }).x2 = shape.x2 + this.offset.x;
    }
    if ("y2" in shape && shape.y2 !== undefined) {
      (result as { y2: number }).y2 = shape.y2 + this.offset.y;
    }
    return result;
  }

  /**
   * Remove offset from a shape
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

  /**
   * Round shape coordinates
   */
  roundShape(shape: SimpleShape): SimpleShape {
    if ("x1" in shape) {
      let rounded = { ...shape };
      rounded = this.roundPropertyGeneric(rounded, "x1") as typeof rounded;
      rounded = this.roundPropertyGeneric(rounded, "y1") as typeof rounded;
      rounded = this.roundPropertyGeneric(rounded, "x2") as typeof rounded;
      rounded = this.roundPropertyGeneric(rounded, "y2") as typeof rounded;
      return rounded;
    } else if ("x" in shape) {
      let rounded = { ...shape };
      rounded = this.roundPropertyGeneric(rounded, "x") as typeof rounded;
      rounded = this.roundPropertyGeneric(rounded, "y") as typeof rounded;
      if ("w" in rounded) {
        rounded = this.roundPropertyGeneric(rounded, "w") as typeof rounded;
        rounded = this.roundPropertyGeneric(rounded, "h") as typeof rounded;
      }
      return rounded;
    }
    return shape;
  }

  /**
   * Round a partial shape
   */
  roundShapePartial(shape: Partial<SimpleShape>): Partial<SimpleShape> {
    let result = { ...shape };
    for (const prop of ["x1", "y1", "x2", "y2", "x", "y", "w", "h"] as const) {
      if (prop in result) {
        result = this.roundProperty(result, prop as keyof typeof result);
      }
    }
    return result;
  }

  /**
   * Reverse rounding on a shape
   */
  unroundShape(shape: SimpleShape): SimpleShape {
    if ("x1" in shape) {
      let unrounded = { ...shape };
      unrounded = this.unroundPropertyGeneric(unrounded, "x1") as typeof unrounded;
      unrounded = this.unroundPropertyGeneric(unrounded, "y1") as typeof unrounded;
      unrounded = this.unroundPropertyGeneric(unrounded, "x2") as typeof unrounded;
      unrounded = this.unroundPropertyGeneric(unrounded, "y2") as typeof unrounded;
      return unrounded;
    } else if ("x" in shape) {
      let unrounded = { ...shape };
      unrounded = this.unroundPropertyGeneric(unrounded, "x") as typeof unrounded;
      unrounded = this.unroundPropertyGeneric(unrounded, "y") as typeof unrounded;
      if ("w" in unrounded) {
        unrounded = this.unroundPropertyGeneric(unrounded, "w") as typeof unrounded;
        unrounded = this.unroundPropertyGeneric(unrounded, "h") as typeof unrounded;
      }
      return unrounded;
    }
    return shape;
  }

  // ============================================
  // Context Item Transformations
  // ============================================

  /**
   * Apply offset to a context item
   */
  applyOffsetToContextItem(contextItem: ContextItem): ContextItem {
    switch (contextItem.type) {
      case "shape": {
        return {
          ...contextItem,
          shape: this.applyOffsetToShape(contextItem.shape),
        };
      }
      case "shapes": {
        return {
          ...contextItem,
          shapes: contextItem.shapes.map((shape) =>
            this.applyOffsetToShape(shape)
          ),
        };
      }
      case "area": {
        return {
          ...contextItem,
          bounds: this.applyOffsetToBox(contextItem.bounds),
        };
      }
      case "point": {
        return {
          ...contextItem,
          point: this.applyOffsetToVec(contextItem.point),
        };
      }
    }
  }

  /**
   * Round context item values
   */
  roundContextItem(contextItem: ContextItem): ContextItem {
    switch (contextItem.type) {
      case "shape": {
        return {
          ...contextItem,
          shape: this.roundShape(contextItem.shape),
        };
      }
      case "shapes": {
        return {
          ...contextItem,
          shapes: contextItem.shapes.map((shape) => this.roundShape(shape)),
        };
      }
      case "area": {
        return {
          ...contextItem,
          bounds: this.roundBox(contextItem.bounds),
        };
      }
      case "point": {
        return {
          ...contextItem,
          point: this.roundVec(contextItem.point),
        };
      }
    }
  }

  // ============================================
  // Shape ID Validation
  // ============================================

  /**
   * Ensure a shape ID is unique
   */
  ensureShapeIdIsUnique(id: string): string {
    const { editor } = this.agent;
    const idWithoutPrefix = id.startsWith("shape:") ? id.slice(6) : id;

    let newId = idWithoutPrefix;
    let existingShape = editor.getShape(`shape:${newId}` as TLShapeId);

    while (existingShape) {
      const match = /^.*(\d+)$/.exec(newId);
      if (match) {
        newId = newId.replace(/(\d+)(?=\D?)$/, (m) => (+m + 1).toString());
      } else {
        newId = `${newId}-1`;
      }
      existingShape = editor.getShape(`shape:${newId}` as TLShapeId);
    }

    if (idWithoutPrefix !== newId) {
      this.shapeIdMap.set(idWithoutPrefix, newId);
    }

    return idWithoutPrefix === id ? newId : `shape:${newId}`;
  }

  /**
   * Ensure a shape ID refers to a real shape
   */
  ensureShapeIdExists(id: string): string | null {
    const { editor } = this.agent;
    const idWithoutPrefix = id.startsWith("shape:") ? id.slice(6) : id;

    // Check if we have a transformed ID
    const existingId = this.shapeIdMap.get(idWithoutPrefix);
    if (existingId) {
      return existingId;
    }

    // Check if the shape exists
    const existingShape = editor.getShape(
      `shape:${idWithoutPrefix}` as TLShapeId
    );
    if (existingShape) {
      return id;
    }

    return null;
  }

  /**
   * Ensure all shape IDs refer to real shapes
   */
  ensureShapeIdsExist(ids: string[]): string[] {
    return ids
      .map((id) => this.ensureShapeIdExists(id))
      .filter((v): v is string => v !== null);
  }

  // ============================================
  // Value Validation
  // ============================================

  /**
   * Ensure a value is a number
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
   * Ensure a value is a vector
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
   * Ensure a value is a boolean
   */
  ensureValueIsBoolean(value: unknown): boolean | null {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value !== "false";
    return null;
  }

  /**
   * Ensure a value is a valid fill
   */
  ensureValueIsSimpleFill(value: unknown): SimpleFill | null {
    if (typeof value === "string" && VALID_FILLS.includes(value as SimpleFill)) {
      return value as SimpleFill;
    }
    return null;
  }

  // ============================================
  // Rounding Utilities
  // ============================================

  /**
   * Round a vector
   */
  roundVec(vecModel: VecModel): VecModel {
    return {
      x: Math.round(vecModel.x),
      y: Math.round(vecModel.y),
    };
  }

  /**
   * Round a number and save the diff
   */
  roundAndSaveNumber(number: number, key: string): number {
    const roundedNumber = Math.round(number);
    const diff = roundedNumber - number;
    this.roundingDiffMap.set(key, diff);
    return roundedNumber;
  }

  /**
   * Unround a number using saved diff
   */
  unroundAndRestoreNumber(number: number, key: string): number {
    const diff = this.roundingDiffMap.get(key);
    if (diff === undefined) return number;
    return number + diff;
  }

  /**
   * Round a property of a shape
   */
  roundProperty<T extends Partial<SimpleShape>>(
    shape: T,
    property: keyof T
  ): T {
    const value = shape[property];
    if (typeof value !== "number") return shape;

    const key = `${(shape as { shapeId?: string }).shapeId ?? "shape"}_${
      property as string
    }`;
    const roundedValue = this.roundAndSaveNumber(value, key);

    return { ...shape, [property]: roundedValue };
  }

  /**
   * Round a property of a shape (generic version)
   */
  roundPropertyGeneric<T extends Record<string, unknown>>(
    shape: T,
    property: string
  ): T {
    const value = shape[property];
    if (typeof value !== "number") return shape;

    const key = `${(shape as { shapeId?: string }).shapeId ?? "shape"}_${property}`;
    const roundedValue = this.roundAndSaveNumber(value, key);

    return { ...shape, [property]: roundedValue };
  }

  /**
   * Unround a property of a shape
   */
  unroundProperty<T extends SimpleShape>(shape: T, property: keyof T): T {
    const value = shape[property];
    if (typeof value !== "number") return shape;

    const key = `${shape.shapeId}_${property as string}`;
    const diff = this.roundingDiffMap.get(key);
    if (diff === undefined) return shape;

    return { ...shape, [property]: value + diff };
  }

  /**
   * Unround a property of a shape (generic version)
   */
  unroundPropertyGeneric<T extends Record<string, unknown>>(
    shape: T,
    property: string
  ): T {
    const value = shape[property];
    if (typeof value !== "number") return shape;

    const key = `${(shape as { shapeId?: string }).shapeId ?? "shape"}_${property}`;
    const diff = this.roundingDiffMap.get(key);
    if (diff === undefined) return shape;

    return { ...shape, [property]: value + diff };
  }
}

/**
 * Create an AgentHelpers instance
 */
export function createAgentHelpers(agent: TldrawAgent): AgentHelpers {
  return new AgentHelpers(agent);
}
