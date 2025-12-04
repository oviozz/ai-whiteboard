/**
 * TargetAreaTool
 *
 * A custom tldraw tool that allows users to select an area on the canvas
 * as context for the agent.
 */

import { StateNode, type BoxModel, type VecModel } from "tldraw";
import type { TldrawAgent } from "../tldraw-agent";

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
export class TargetAreaTool extends StateNode {
  static override id = "target-area";
  static override initial = "idle";
  static override children() {
    return [TargetAreaIdle, TargetAreaPointing, TargetAreaDragging];
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
 * Idle state - waiting for user to start
 */
class TargetAreaIdle extends StateNode {
  static override id = "idle";

  override onPointerDown() {
    this.parent.transition("pointing");
  }
}

/**
 * Pointing state - user clicked, waiting to see if they drag
 */
class TargetAreaPointing extends StateNode {
  static override id = "pointing";

  private initialScreenPoint: VecModel | undefined = undefined;
  private initialPagePoint: VecModel | undefined = undefined;

  override onEnter() {
    this.initialScreenPoint = this.editor.inputs.currentScreenPoint.clone();
    this.initialPagePoint = this.editor.inputs.currentPagePoint.clone();
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
    // Single click - add a point context
    const agent = getActiveAgent();
    if (agent) {
      agent.addToContext({
        type: "point",
        point: this.editor.inputs.currentPagePoint.clone(),
        source: "user",
      });
    }
    this.editor.setCurrentTool("select");
  }
}

/**
 * Dragging state - user is dragging to select an area
 */
class TargetAreaDragging extends StateNode {
  static override id = "dragging";

  private initialPagePoint: VecModel | undefined = undefined;
  private bounds: BoxModel | undefined = undefined;

  override onEnter(props: { initialPagePoint: VecModel }) {
    this.initialPagePoint = props.initialPagePoint;
    this.updateBounds();
  }

  override onPointerMove() {
    this.updateBounds();
  }

  override onPointerUp() {
    this.editor.updateInstanceState({
      brush: null,
    });

    if (!this.bounds) return;

    // Add area context
    const agent = getActiveAgent();
    if (agent) {
      agent.addToContext({
        type: "area",
        bounds: this.bounds,
        source: "user",
      });
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
  }
}

/**
 * Tool definition for tldraw
 */
export const targetAreaToolDefinition = {
  id: "target-area",
  label: "Pick Area",
  kbd: "c",
  icon: "tool-frame",
  onSelect: (editor: { setCurrentTool: (tool: string) => void }) => {
    editor.setCurrentTool("target-area");
  },
};

