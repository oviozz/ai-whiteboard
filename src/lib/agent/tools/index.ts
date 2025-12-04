/**
 * Agent Tools Index
 *
 * Exports custom tldraw tools for agent context selection.
 */

export {
  TargetAreaTool,
  targetAreaToolDefinition,
  setActiveAgent as setTargetAreaAgent,
  getActiveAgent as getTargetAreaAgent,
} from "./TargetAreaTool";

export {
  TargetShapeTool,
  targetShapeToolDefinition,
  setActiveAgent as setTargetShapeAgent,
  getActiveAgent as getTargetShapeAgent,
} from "./TargetShapeTool";

// Combined set agent function
import { setActiveAgent as setAreaAgent } from "./TargetAreaTool";
import { setActiveAgent as setShapeAgent } from "./TargetShapeTool";
import type { TldrawAgent } from "../tldraw-agent";

export function setAgentForTools(agent: TldrawAgent | null) {
  setAreaAgent(agent);
  setShapeAgent(agent);
}

// Tool definitions for easy import
export const agentTools = [
  // Import the classes themselves
] as const;

export const agentToolOverrides = {
  "target-area": {
    id: "target-area",
    label: "Pick Area",
    kbd: "c",
    icon: "tool-frame",
  },
  "target-shape": {
    id: "target-shape",
    label: "Pick Shape",
    kbd: "s",
    icon: "tool-frame",
  },
};

