/**
 * ClearActionUtil
 *
 * Handles the "clear" action type for clearing all shapes from the canvas.
 */

import type { ClearAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

export class ClearActionUtil extends AgentActionUtil<ClearAction> {
  static override type = "clear" as const;

  override getInfo(_action: Streaming<ClearAction>): Partial<ChatHistoryInfo> {
    return {
      icon: "trash",
      description: "Cleared the canvas",
    };
  }

  override applyAction(action: Streaming<ClearAction>): void {
    if (!action.complete) return;
    if (!this.agent) return;

    const { editor } = this.agent;
    const shapes = editor.getCurrentPageShapes();
    const shapeIds = shapes.map((shape) => shape.id);

    if (shapeIds.length > 0) {
      editor.deleteShapes(shapeIds);
    }
  }
}

