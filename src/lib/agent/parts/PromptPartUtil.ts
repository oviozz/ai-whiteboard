/**
 * PromptPartUtil
 *
 * Base abstract class for prompt part utilities.
 * Each prompt part handles a specific aspect of the prompt sent to the model.
 */

import type { Editor } from "tldraw";
import type { TldrawAgent } from "../tldraw-agent";
import type { AgentHelpers } from "../agent-helpers";
import type { AgentRequest, AgentMessage, BasePromptPart } from "../types";

export abstract class PromptPartUtil<T extends BasePromptPart = BasePromptPart> {
  static type: string;

  protected agent?: TldrawAgent;
  protected editor?: Editor;

  constructor(agent?: TldrawAgent) {
    this.agent = agent;
    this.editor = agent?.editor;
  }

  /**
   * Get data to add to the prompt
   */
  abstract getPart(
    request: AgentRequest,
    helpers: AgentHelpers
  ): Promise<T> | T;

  /**
   * Get priority for this part (lower = higher priority, appears first)
   */
  getPriority(_part: T): number {
    return 0;
  }

  /**
   * Get the model name to use (if this part overrides it)
   */
  getModelName(_part: T): string | null {
    return null;
  }

  /**
   * Build array of text or image content
   */
  buildContent(_part: T): string[] {
    return [];
  }

  /**
   * Build array of messages to send to the model
   */
  buildMessages(part: T): AgentMessage[] {
    const content = this.buildContent(part);
    if (!content || content.length === 0) {
      return [];
    }

    const messageContent = content.map((item) => {
      if (typeof item === "string" && item.startsWith("data:image/")) {
        return { type: "image" as const, image: item };
      }
      return { type: "text" as const, text: item };
    });

    return [{ role: "user", content: messageContent, priority: this.getPriority(part) }];
  }

  /**
   * Build a system prompt contribution
   */
  buildSystemPrompt(_part: T): string | null {
    return null;
  }
}

export interface PromptPartUtilConstructor<
  T extends BasePromptPart = BasePromptPart
> {
  new (agent?: TldrawAgent): PromptPartUtil<T>;
  type: string;
}

