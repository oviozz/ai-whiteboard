/**
 * MessagesPartUtil
 *
 * Handles the user's messages in the prompt.
 */

import type { AgentRequest, BasePromptPart } from "../types";
import { PromptPartUtil } from "./PromptPartUtil";

export interface MessagesPart extends BasePromptPart<"messages"> {
  messages: string[];
}

export class MessagesPartUtil extends PromptPartUtil<MessagesPart> {
  static override type = "messages" as const;

  override getPriority() {
    return 10; // High priority - user message comes early
  }

  override getPart(request: AgentRequest): MessagesPart {
    return {
      type: "messages",
      messages: request.messages,
    };
  }

  override buildContent({ messages }: MessagesPart): string[] {
    if (messages.length === 0) return [];
    return [messages.join("\n")];
  }
}

