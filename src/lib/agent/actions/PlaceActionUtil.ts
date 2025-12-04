/**
 * PlaceActionUtil
 *
 * Handles the "place" action type for placing shapes relative to other shapes.
 */

import type { TLShapeId } from "tldraw";
import type { AgentHelpers } from "../agent-helpers";
import type { PlaceAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

export class PlaceActionUtil extends AgentActionUtil<PlaceAction> {
  static override type = "place" as const;

  override getInfo(action: Streaming<PlaceAction>): Partial<ChatHistoryInfo> {
    return {
      icon: "target",
      description: action.intent ?? "",
    };
  }

  override sanitizeAction(
    action: Streaming<PlaceAction>,
    helpers: AgentHelpers
  ): Streaming<PlaceAction> | null {
    if (!action.complete) return action;

    const shapeId = helpers.ensureShapeIdExists(action.shapeId);
    if (!shapeId) return null;
    action.shapeId = shapeId;

    const referenceShapeId = helpers.ensureShapeIdExists(action.referenceShapeId);
    if (!referenceShapeId) return null;
    action.referenceShapeId = referenceShapeId;

    return action;
  }

  override applyAction(action: Streaming<PlaceAction>): void {
    if (!action.complete) return;
    if (!this.agent) return;

    const { editor } = this.agent;
    const { side, sideOffset = 0, align, alignOffset = 0 } = action;

    const referenceShapeId = `shape:${action.referenceShapeId}` as TLShapeId;
    const shapeId = `shape:${action.shapeId}` as TLShapeId;

    const shape = editor.getShape(shapeId);
    const referenceShape = editor.getShape(referenceShapeId);
    if (!shape || !referenceShape) return;

    const bbA = editor.getShapePageBounds(shape);
    const bbR = editor.getShapePageBounds(referenceShape);
    if (!bbA || !bbR) return;

    let newX = shape.x;
    let newY = shape.y;

    // Calculate position based on side and alignment
    if (side === "top" && align === "start") {
      newX = bbR.minX + alignOffset;
      newY = bbR.minY - bbA.height - sideOffset;
    } else if (side === "top" && align === "center") {
      newX = bbR.midX - bbA.width / 2 + alignOffset;
      newY = bbR.minY - bbA.height - sideOffset;
    } else if (side === "top" && align === "end") {
      newX = bbR.maxX - bbA.width - alignOffset;
      newY = bbR.minY - bbA.height - sideOffset;
    } else if (side === "bottom" && align === "start") {
      newX = bbR.minX + alignOffset;
      newY = bbR.maxY + sideOffset;
    } else if (side === "bottom" && align === "center") {
      newX = bbR.midX - bbA.width / 2 + alignOffset;
      newY = bbR.maxY + sideOffset;
    } else if (side === "bottom" && align === "end") {
      newX = bbR.maxX - bbA.width - alignOffset;
      newY = bbR.maxY + sideOffset;
    } else if (side === "left" && align === "start") {
      newX = bbR.minX - bbA.width - sideOffset;
      newY = bbR.minY + alignOffset;
    } else if (side === "left" && align === "center") {
      newX = bbR.minX - bbA.width - sideOffset;
      newY = bbR.midY - bbA.height / 2 + alignOffset;
    } else if (side === "left" && align === "end") {
      newX = bbR.minX - bbA.width - sideOffset;
      newY = bbR.maxY - bbA.height - alignOffset;
    } else if (side === "right" && align === "start") {
      newX = bbR.maxX + sideOffset;
      newY = bbR.minY + alignOffset;
    } else if (side === "right" && align === "center") {
      newX = bbR.maxX + sideOffset;
      newY = bbR.midY - bbA.height / 2 + alignOffset;
    } else if (side === "right" && align === "end") {
      newX = bbR.maxX + sideOffset;
      newY = bbR.maxY - bbA.height - alignOffset;
    }

    editor.updateShape({
      id: shapeId,
      type: shape.type,
      x: newX,
      y: newY,
    });
  }
}

