/**
 * DeleteActionUtil
 *
 * Handles the "delete" action type for deleting shapes from the canvas.
 */

import type { TLShapeId } from "tldraw";
import type { AgentHelpers } from "../agent-helpers";
import type { DeleteAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

export class DeleteActionUtil extends AgentActionUtil<DeleteAction> {
  static override type = "delete" as const;

  override getInfo(action: Streaming<DeleteAction>): Partial<ChatHistoryInfo> {
    return {
      icon: "trash",
      description: action.intent ?? "Delete shape",
    };
  }

  override sanitizeAction(
    action: Streaming<DeleteAction>,
    helpers: AgentHelpers
  ): Streaming<DeleteAction> | null {
    if (!action.complete) return action;

    const shapeId = helpers.ensureShapeIdExists(action.shapeId);
    if (!shapeId) return null;

    action.shapeId = shapeId;
    return action;
  }

  override applyAction(action: Streaming<DeleteAction>): void {
    if (!action.complete) return;
    if (!this.agent) return;

    const { editor } = this.agent;
    const shapeId = `shape:${action.shapeId}` as TLShapeId;

    if (editor.getShape(shapeId)) {
      editor.deleteShapes([shapeId]);
    }
  }
}

