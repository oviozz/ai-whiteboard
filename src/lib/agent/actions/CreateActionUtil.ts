/**
 * CreateActionUtil
 *
 * Handles the "create" action type for creating new shapes on the canvas.
 */

import type { TLShapeId, IndexKey } from "tldraw";
import { createShapeId, toRichText, TEXT_PROPS, FONT_FAMILIES, FONT_SIZES, Vec } from "tldraw";
import type { AgentHelpers } from "../agent-helpers";
import type { CreateAction, Streaming, SimpleShape } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

// Map simple geo type to tldraw geo type
const GEO_TYPE_MAP: Record<string, string> = {
  rectangle: "rectangle",
  ellipse: "ellipse",
  triangle: "triangle",
  diamond: "diamond",
  hexagon: "hexagon",
  star: "star",
  cloud: "cloud",
  heart: "heart",
  pill: "oval",
  "x-box": "x-box",
  "check-box": "check-box",
  pentagon: "pentagon",
  octagon: "octagon",
  "parallelogram-right": "rhombus",
  "parallelogram-left": "rhombus-2",
  trapezoid: "trapezoid",
  "fat-arrow-right": "arrow-right",
  "fat-arrow-left": "arrow-left",
  "fat-arrow-up": "arrow-up",
  "fat-arrow-down": "arrow-down",
};

const GEO_SHAPE_TYPES = new Set(Object.keys(GEO_TYPE_MAP));

export class CreateActionUtil extends AgentActionUtil<CreateAction> {
  static override type = "create" as const;

  override getInfo(action: Streaming<CreateAction>): Partial<ChatHistoryInfo> {
    return {
      icon: "pencil",
      description: action.intent ?? "",
    };
  }

  override sanitizeAction(
    action: Streaming<CreateAction>,
    helpers: AgentHelpers
  ): Streaming<CreateAction> | null {
    if (!action.complete) return action;

    const { shape } = action;

    // Ensure the created shape has a unique ID
    shape.shapeId = helpers.ensureShapeIdIsUnique(shape.shapeId);

    // Handle arrow bindings
    if (shape._type === "arrow") {
      if (shape.fromId) {
        shape.fromId = helpers.ensureShapeIdExists(shape.fromId);
      }
      if (shape.toId) {
        shape.toId = helpers.ensureShapeIdExists(shape.toId);
      }
      if ("x1" in shape) {
        shape.x1 = helpers.ensureValueIsNumber(shape.x1) ?? 0;
      }
      if ("y1" in shape) {
        shape.y1 = helpers.ensureValueIsNumber(shape.y1) ?? 0;
      }
      if ("x2" in shape) {
        shape.x2 = helpers.ensureValueIsNumber(shape.x2) ?? 0;
      }
      if ("y2" in shape) {
        shape.y2 = helpers.ensureValueIsNumber(shape.y2) ?? 0;
      }
      if ("bend" in shape) {
        shape.bend = helpers.ensureValueIsNumber(shape.bend) ?? 0;
      }
    }

    return action;
  }

  override applyAction(
    action: Streaming<CreateAction>,
    helpers: AgentHelpers
  ): void {
    if (!action.complete) return;
    if (!this.agent) return;

    const { editor } = this.agent;

    // Remove offset from shape
    const shape = helpers.removeOffsetFromShape(action.shape);

    // Convert and create the shape
    this.createShape(editor, shape);
  }

  private createShape(editor: Editor, shape: SimpleShape): void {
    const shapeId = createShapeId(shape.shapeId);

    if (GEO_SHAPE_TYPES.has(shape._type)) {
      this.createGeoShape(editor, shapeId, shape as { _type: string; shapeId: string; x: number; y: number; w: number; h: number; color: string; fill: string; text?: string; textAlign?: string; note: string });
    } else if (shape._type === "text") {
      this.createTextShape(editor, shapeId, shape);
    } else if (shape._type === "note") {
      this.createNoteShape(editor, shapeId, shape);
    } else if (shape._type === "arrow") {
      this.createArrowShape(editor, shapeId, shape);
    } else if (shape._type === "line") {
      this.createLineShape(editor, shapeId, shape);
    }
  }

  private createGeoShape(
    editor: Editor,
    shapeId: TLShapeId,
    shape: { _type: string; shapeId: string; x: number; y: number; w: number; h: number; color: string; fill: string; text?: string; textAlign?: string; note: string }
  ): void {
    const geoType = GEO_TYPE_MAP[shape._type] || "rectangle";

    editor.createShape({
      id: shapeId,
      type: "geo",
      x: shape.x,
      y: shape.y,
      props: {
        geo: geoType,
        w: shape.w,
        h: shape.h,
        color: shape.color || "black",
        fill: shape.fill || "none",
        richText: shape.text ? toRichText(shape.text) : toRichText(""),
        align: shape.textAlign || "middle",
        size: "s",
        dash: "draw",
      },
      meta: {
        note: shape.note || "",
      },
    });
  }

  private createTextShape(
    editor: Editor,
    shapeId: TLShapeId,
    shape: SimpleShape
  ): void {
    if (shape._type !== "text") return;

    const textSize = shape.size || "s";
    const scale = shape.scale || 1;
    const textAlign = shape.textAlign || "start";
    const font = "draw";

    // Measure text to get proper positioning
    const textFontSize = FONT_SIZES[textSize];
    const effectiveFontSize = textFontSize * scale;

    const measurement = editor.textMeasure.measureText(shape.text, {
      ...TEXT_PROPS,
      fontFamily: FONT_FAMILIES[font],
      fontSize: effectiveFontSize,
      maxWidth: shape.w ?? Infinity,
    });

    // Adjust position based on alignment
    let x = shape.x;
    const y = shape.y - measurement.h / 2;

    switch (textAlign) {
      case "middle":
        x = shape.x - measurement.w / 2;
        break;
      case "end":
        x = shape.x - measurement.w;
        break;
    }

    editor.createShape({
      id: shapeId,
      type: "text",
      x,
      y,
      props: {
        richText: toRichText(shape.text),
        color: shape.color || "black",
        size: textSize,
        scale,
        textAlign,
        font,
        autoSize: !shape.wrap,
        w: measurement.w,
      },
      meta: {
        note: shape.note || "",
      },
    });
  }

  private createNoteShape(
    editor: Editor,
    shapeId: TLShapeId,
    shape: SimpleShape
  ): void {
    if (shape._type !== "note") return;

    editor.createShape({
      id: shapeId,
      type: "note",
      x: shape.x,
      y: shape.y,
      props: {
        richText: shape.text ? toRichText(shape.text) : toRichText(""),
        color: shape.color || "yellow",
        size: shape.size || "s",
      },
      meta: {
        note: shape.note || "",
      },
    });
  }

  private createArrowShape(
    editor: Editor,
    shapeId: TLShapeId,
    shape: SimpleShape
  ): void {
    if (shape._type !== "arrow") return;

    const x1 = shape.x1;
    const y1 = shape.y1;
    const x2 = shape.x2;
    const y2 = shape.y2;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);

    editor.createShape({
      id: shapeId,
      type: "arrow",
      x: minX,
      y: minY,
      props: {
        start: { x: x1 - minX, y: y1 - minY },
        end: { x: x2 - minX, y: y2 - minY },
        color: shape.color || "black",
        bend: (shape.bend ?? 0) * -1,
        richText: shape.text ? toRichText(shape.text) : toRichText(""),
        arrowheadEnd: "arrow",
        arrowheadStart: "none",
        size: "s",
        dash: "draw",
      },
      meta: {
        note: shape.note || "",
      },
    });

    // Create bindings if fromId or toId are provided
    if (shape.fromId) {
      const fromShapeId = `shape:${shape.fromId}` as TLShapeId;
      const fromShape = editor.getShape(fromShapeId);
      if (fromShape) {
        editor.createBinding({
          type: "arrow",
          fromId: shapeId,
          toId: fromShapeId,
          props: {
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
            isPrecise: true,
            terminal: "start",
          },
          meta: {},
        });
      }
    }

    if (shape.toId) {
      const toShapeId = `shape:${shape.toId}` as TLShapeId;
      const toShape = editor.getShape(toShapeId);
      if (toShape) {
        editor.createBinding({
          type: "arrow",
          fromId: shapeId,
          toId: toShapeId,
          props: {
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
            isPrecise: true,
            terminal: "end",
          },
          meta: {},
        });
      }
    }
  }

  private createLineShape(
    editor: Editor,
    shapeId: TLShapeId,
    shape: SimpleShape
  ): void {
    if (shape._type !== "line") return;

    const x1 = shape.x1;
    const y1 = shape.y1;
    const x2 = shape.x2;
    const y2 = shape.y2;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);

    editor.createShape({
      id: shapeId,
      type: "line",
      x: minX,
      y: minY,
      props: {
        points: {
          a1: {
            id: "a1",
            index: "a1" as IndexKey,
            x: x1 - minX,
            y: y1 - minY,
          },
          a2: {
            id: "a2",
            index: "a2" as IndexKey,
            x: x2 - minX,
            y: y2 - minY,
          },
        },
        color: shape.color || "black",
        size: "s",
        dash: "draw",
        spline: "line",
      },
      meta: {
        note: shape.note || "",
      },
    });
  }
}

// Need to import Editor type
import type { Editor } from "tldraw";

