/**
 * MoveActionUtil
 *
 * Handles the "move" action type for moving shapes to absolute positions.
 */

import type { TLShapeId } from "tldraw";
import type { AgentHelpers } from "../agent-helpers";
import type { MoveAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

export class MoveActionUtil extends AgentActionUtil<MoveAction> {
  static override type = "move" as const;

  override getInfo(action: Streaming<MoveAction>): Partial<ChatHistoryInfo> {
    return {
      icon: "shapes",
      description: action.intent ?? "Move shape",
    };
  }

  override sanitizeAction(
    action: Streaming<MoveAction>,
    helpers: AgentHelpers
  ): Streaming<MoveAction> | null {
    if (!action.complete) return action;

    const shapeId = helpers.ensureShapeIdExists(action.shapeId);
    if (!shapeId) return null;

    action.shapeId = shapeId;
    return action;
  }

  override applyAction(
    action: Streaming<MoveAction>,
    helpers: AgentHelpers
  ): void {
    if (!action.complete) return;
    if (!this.agent) return;

    const { editor } = this.agent;
    const shapeId = `shape:${action.shapeId}` as TLShapeId;
    const shape = editor.getShape(shapeId);

    if (!shape) return;

    // Remove offset from position
    const position = helpers.removeOffsetFromVec({ x: action.x, y: action.y });

    editor.updateShape({
      id: shapeId,
      type: shape.type,
      x: position.x,
      y: position.y,
    });
  }
}

