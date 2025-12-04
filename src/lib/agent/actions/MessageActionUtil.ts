/**
 * MessageActionUtil
 *
 * Handles the "message" action type for AI sending messages to the user.
 */

import type { MessageAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

export class MessageActionUtil extends AgentActionUtil<MessageAction> {
  static override type = "message" as const;

  override getInfo(action: Streaming<MessageAction>): Partial<ChatHistoryInfo> {
    return {
      icon: "message",
      description: action.text ?? "",
      canGroup: () => false,
    };
  }

  override savesToHistory(): boolean {
    return true;
  }
}

