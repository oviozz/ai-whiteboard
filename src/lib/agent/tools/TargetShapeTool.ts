/**
 * TargetShapeTool
 *
 * A custom tldraw tool that allows users to select shapes on the canvas
 * as context for the agent.
 */

import {
  StateNode,
  Box,
  type TLShape,
  type BoxModel,
  type VecModel,
  type Editor,
} from "tldraw";
import type { TldrawAgent } from "../tldraw-agent";
import type { SimpleShape, SimpleColor, SimpleFill } from "../agent-actions";

/**
 * Convert a tldraw shape to SimpleShape format
 */
function convertShapeToSimple(editor: Editor, shape: TLShape): SimpleShape | null {
  const bounds = editor.getShapePageBounds(shape);
  if (!bounds) return null;

  const props = shape.props as Record<string, unknown>;
  const meta = shape.meta as Record<string, unknown> | undefined;
  const shapeId = shape.id.replace("shape:", "");

  if (shape.type === "text") {
    return {
      _type: "text",
      shapeId,
      x: bounds.x,
      y: bounds.y,
      text: String(props.text ?? ""),
      color: (props.color as SimpleColor) ?? "black",
      size: props.size as "s" | "m" | "l" | "xl" | undefined,
      scale: typeof props.scale === "number" ? props.scale : 1,
      textAlign: props.textAlign as "start" | "middle" | "end" | undefined,
      note: String(meta?.note ?? ""),
    };
  }

  if (shape.type === "geo") {
    return {
      _type: String(props.geo ?? "rectangle") as SimpleShape["_type"],
      shapeId,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      color: (props.color as SimpleColor) ?? "black",
      fill: (props.fill as SimpleFill) ?? "none",
      text: props.text ? String(props.text) : undefined,
      note: String(meta?.note ?? ""),
    } as SimpleShape;
  }

  if (shape.type === "note") {
    return {
      _type: "note",
      shapeId,
      x: bounds.x,
      y: bounds.y,
      text: props.text ? String(props.text) : undefined,
      color: (props.color as SimpleColor) ?? "yellow",
      size: props.size as "s" | "m" | "l" | "xl" | undefined,
      note: String(meta?.note ?? ""),
    };
  }

  if (shape.type === "arrow") {
    const startPoint = props.start as { x: number; y: number } | undefined;
    const endPoint = props.end as { x: number; y: number } | undefined;
    
    return {
      _type: "arrow",
      shapeId,
      x1: bounds.x + (startPoint?.x ?? 0),
      y1: bounds.y + (startPoint?.y ?? 0),
      x2: bounds.x + (endPoint?.x ?? bounds.w),
      y2: bounds.y + (endPoint?.y ?? bounds.h),
      color: (props.color as SimpleColor) ?? "black",
      bend: typeof props.bend === "number" ? props.bend : 0,
      text: props.text ? String(props.text) : undefined,
      note: String(meta?.note ?? ""),
    };
  }

  if (shape.type === "line") {
    const points = props.points as Record<string, { x: number; y: number }> | undefined;
    const pointsArray = points ? Object.values(points).sort((a, b) => a.x - b.x) : [];
    const start = pointsArray[0] ?? { x: 0, y: 0 };
    const end = pointsArray[pointsArray.length - 1] ?? { x: bounds.w, y: bounds.h };
    
    return {
      _type: "line",
      shapeId,
      x1: bounds.x + start.x,
      y1: bounds.y + start.y,
      x2: bounds.x + end.x,
      y2: bounds.y + end.y,
      color: (props.color as SimpleColor) ?? "black",
      note: String(meta?.note ?? ""),
    };
  }

  // Fallback for unknown shapes
  return {
    _type: "rectangle" as SimpleShape["_type"],
    shapeId,
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    color: (props.color as SimpleColor) ?? "black",
    fill: "none" as const,
    note: String(meta?.note ?? ""),
  } as SimpleShape;
}

/**
 * Global reference to the active agent (set by the component)
 */
let activeAgent: TldrawAgent | null = null;

export function setActiveAgent(agent: TldrawAgent | null) {
  activeAgent = agent;
}

export function getActiveAgent(): TldrawAgent | null {
  return activeAgent;
}

/**
 * Main tool state
 */
export class TargetShapeTool extends StateNode {
  static override id = "target-shape";
  static override initial = "idle";
  static override children() {
    return [TargetShapeIdle, TargetShapePointing, TargetShapeDragging];
  }

  override isLockable = false;

  override onEnter() {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onExit() {
    this.editor.setCursor({ type: "default", rotation: 0 });
  }

  override onInterrupt() {
    this.complete();
  }

  override onCancel() {
    this.complete();
  }

  private complete() {
    this.parent.transition("select", {});
  }
}

/**
 * Idle state - highlights shapes on hover
 */
class TargetShapeIdle extends StateNode {
  static override id = "idle";

  override onPointerMove() {
    const { currentPagePoint } = this.editor.inputs;
    const shape = this.editor.getShapeAtPoint(currentPagePoint, {
      hitInside: true,
    });

    if (shape) {
      this.editor.setHintingShapes([shape]);
    } else {
      this.editor.setHintingShapes([]);
    }
  }

  override onPointerDown() {
    const shape = this.editor.getShapeAtPoint(
      this.editor.inputs.currentPagePoint,
      { hitInside: true }
    );
    this.parent.transition("pointing", { shape });
  }
}

/**
 * Pointing state - user clicked on a shape
 */
class TargetShapePointing extends StateNode {
  static override id = "pointing";

  private shape: TLShape | undefined = undefined;
  private initialScreenPoint: VecModel | undefined = undefined;
  private initialPagePoint: VecModel | undefined = undefined;

  override onEnter({ shape }: { shape: TLShape | undefined }) {
    this.initialScreenPoint = this.editor.inputs.currentScreenPoint.clone();
    this.initialPagePoint = this.editor.inputs.currentPagePoint.clone();
    this.shape = shape;
  }

  override onPointerMove() {
    if (!this.initialScreenPoint) return;
    if (this.editor.inputs.isDragging) {
      this.parent.transition("dragging", {
        initialPagePoint: this.initialPagePoint,
      });
    }
  }

  override onPointerUp() {
    this.editor.setHintingShapes([]);

    if (this.shape) {
      const agent = getActiveAgent();
      if (agent) {
        // Convert to SimpleShape format
        const simpleShape = convertShapeToSimple(this.editor, this.shape);
        if (simpleShape) {
          agent.addToContext({
            type: "shape",
            shape: simpleShape,
            source: "user",
          });
        }
      }
    }

    this.editor.setCurrentTool("select");
  }
}

/**
 * Dragging state - user is dragging to select multiple shapes
 */
class TargetShapeDragging extends StateNode {
  static override id = "dragging";

  private shapes: TLShape[] = [];
  private initialPagePoint: VecModel | undefined = undefined;
  private bounds: BoxModel | undefined = undefined;

  override onEnter(props: { initialPagePoint: VecModel }) {
    this.initialPagePoint = props.initialPagePoint;
    this.editor.setHintingShapes([]);
    this.updateBounds();
  }

  override onPointerMove() {
    this.updateBounds();
  }

  override onPointerUp() {
    this.editor.setHintingShapes([]);
    this.editor.updateInstanceState({
      brush: null,
    });

    if (!this.bounds || this.shapes.length === 0) {
      this.editor.setCurrentTool("select");
      return;
    }

    const agent = getActiveAgent();
    if (agent) {
      // Convert shapes to SimpleShape format
      const serialized = this.shapes
        .map((shape) => convertShapeToSimple(this.editor, shape))
        .filter((s): s is SimpleShape => s !== null);

      if (serialized.length <= 3) {
        // Add individually if 3 or fewer shapes
        for (const shape of serialized) {
          agent.addToContext({
            type: "shape",
            shape,
            source: "user",
          });
        }
      } else {
        // Add as a group if more than 3 shapes
        agent.addToContext({
          type: "shapes",
          shapes: serialized,
          source: "user",
        });
      }
    }

    this.editor.setCurrentTool("select");
  }

  private updateBounds() {
    if (!this.initialPagePoint) return;

    const currentPagePoint = this.editor.inputs.currentPagePoint;
    const x = Math.min(this.initialPagePoint.x, currentPagePoint.x);
    const y = Math.min(this.initialPagePoint.y, currentPagePoint.y);
    const w = Math.abs(currentPagePoint.x - this.initialPagePoint.x);
    const h = Math.abs(currentPagePoint.y - this.initialPagePoint.y);

    // Update brush indicator
    this.editor.updateInstanceState({
      brush: { x, y, w, h },
    });

    this.bounds = { x, y, w, h };

    // Find shapes within bounds
    const bounds = new Box(x, y, w, h);
    const shapesInBounds = this.editor
      .getCurrentPageShapesSorted()
      .filter((shape) => {
        const geometry = this.editor.getShapeGeometry(shape);
        const pageTransform = this.editor.getShapePageTransform(shape);
        const shapeTransform = pageTransform.clone().invert();
        const boundsInShapeSpace = shapeTransform.applyToPoints(bounds.corners);
        return geometry.overlapsPolygon(boundsInShapeSpace);
      });

    this.shapes = shapesInBounds;
    this.editor.setHintingShapes(shapesInBounds);
  }
}

/**
 * Tool definition for tldraw
 */
export const targetShapeToolDefinition = {
  id: "target-shape",
  label: "Pick Shape",
  kbd: "s",
  icon: "tool-frame",
  onSelect: (editor: { setCurrentTool: (tool: string) => void }) => {
    editor.setCurrentTool("target-shape");
  },
};

