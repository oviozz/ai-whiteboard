/**
 * Action Utilities Index
 *
 * Exports all action utilities and provides helper functions.
 */

import type { TldrawAgent } from "../tldraw-agent";
import type { AgentAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil, type AgentActionUtilConstructor } from "./AgentActionUtil";

// Import all action utilities
import { CreateActionUtil } from "./CreateActionUtil";
import { MessageActionUtil } from "./MessageActionUtil";
import { ThinkActionUtil } from "./ThinkActionUtil";
import { ReviewActionUtil } from "./ReviewActionUtil";
import { DeleteActionUtil } from "./DeleteActionUtil";
import { MoveActionUtil } from "./MoveActionUtil";
import { PlaceActionUtil } from "./PlaceActionUtil";
import { ClearActionUtil } from "./ClearActionUtil";

// Re-export base class
export { AgentActionUtil, type AgentActionUtilConstructor } from "./AgentActionUtil";

// Re-export individual utilities
export { CreateActionUtil } from "./CreateActionUtil";
export { MessageActionUtil } from "./MessageActionUtil";
export { ThinkActionUtil } from "./ThinkActionUtil";
export { ReviewActionUtil } from "./ReviewActionUtil";
export { DeleteActionUtil } from "./DeleteActionUtil";
export { MoveActionUtil } from "./MoveActionUtil";
export { PlaceActionUtil } from "./PlaceActionUtil";
export { ClearActionUtil } from "./ClearActionUtil";

/**
 * All action utilities
 */
export const AGENT_ACTION_UTILS: AgentActionUtilConstructor[] = [
  // Communication
  MessageActionUtil,

  // Planning
  ThinkActionUtil,
  ReviewActionUtil,

  // Shape operations
  CreateActionUtil,
  DeleteActionUtil,
  MoveActionUtil,
  PlaceActionUtil,
  ClearActionUtil,
];

/**
 * Unknown action utility (fallback)
 */
class UnknownActionUtil extends AgentActionUtil {
  static override type = "unknown" as const;

  override getInfo(): Partial<ChatHistoryInfo> | null {
    return null;
  }

  override savesToHistory(): boolean {
    return false;
  }
}

/**
 * Get a record of all action utilities
 */
export function getAgentActionUtilsRecord(
  agent?: TldrawAgent
): Record<string, AgentActionUtil> {
  const record: Record<string, AgentActionUtil> = {};

  for (const Util of AGENT_ACTION_UTILS) {
    record[Util.type] = new Util(agent);
  }

  // Add unknown as fallback
  record["unknown"] = new UnknownActionUtil(agent);

  return record;
}

/**
 * Get action info for an action
 */
export function getActionInfo(
  action: Streaming<AgentAction>,
  agent?: TldrawAgent
): ChatHistoryInfo {
  const utils = getAgentActionUtilsRecord(agent);
  const util = utils[action._type] || utils["unknown"];
  const info = util.getInfo(action);

  return {
    icon: info?.icon ?? null,
    description: info?.description ?? null,
    summary: info?.summary ?? null,
    canGroup: info?.canGroup,
  };
}

