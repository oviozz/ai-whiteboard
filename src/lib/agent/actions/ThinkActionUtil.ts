/**
 * ThinkActionUtil
 *
 * Handles the "think" action type for AI reasoning/thinking.
 */

import type { ThinkAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

export class ThinkActionUtil extends AgentActionUtil<ThinkAction> {
  static override type = "think" as const;

  override getInfo(action: Streaming<ThinkAction>): Partial<ChatHistoryInfo> {
    const time = Math.floor((action.time || 0) / 1000);
    let summary = `Thought for ${time} seconds`;
    if (time === 0) summary = "Thought for less than a second";
    if (time === 1) summary = "Thought for 1 second";

    return {
      icon: "brain",
      description: action.text ?? (action.complete ? "Thinking..." : null),
      summary,
    };
  }

  override savesToHistory(): boolean {
    return true;
  }
}

