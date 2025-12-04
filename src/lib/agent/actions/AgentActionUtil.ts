/**
 * AgentActionUtil
 *
 * Base abstract class for agent action utilities.
 * Each action type has its own utility that handles:
 * - Schema validation
 * - Chat history info
 * - Action sanitization
 * - Action execution
 * - System prompt contributions
 */

import type { Editor } from "tldraw";
import type { TldrawAgent } from "../tldraw-agent";
import type { AgentHelpers } from "../agent-helpers";
import type { AgentAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo } from "../types";

/**
 * Base action type that all actions must have
 */
export interface BaseAgentAction {
  _type: string;
}

/**
 * Abstract base class for action utilities
 */
export abstract class AgentActionUtil<T extends BaseAgentAction = BaseAgentAction> {
  static type: string;

  protected agent?: TldrawAgent;
  protected editor?: Editor;

  constructor(agent?: TldrawAgent) {
    this.agent = agent;
    this.editor = agent?.editor;
  }

  /**
   * Get information about the action for display in chat history.
   * Return null to not show anything.
   */
  getInfo(_action: Streaming<T>): Partial<ChatHistoryInfo> | null {
    return {};
  }

  /**
   * Transform the action before saving it to chat history.
   * Useful for sanitizing or correcting actions.
   * Return null to reject the action.
   */
  sanitizeAction(
    action: Streaming<T>,
    _helpers: AgentHelpers
  ): Streaming<T> | null {
    return action;
  }

  /**
   * Apply the action to the editor.
   * Any changes that happen during this function will be captured as a diff.
   */
  applyAction(
    _action: Streaming<T>,
    _helpers: AgentHelpers
  ): Promise<void> | void {
    // Do nothing by default
  }

  /**
   * Whether the action gets saved to chat history.
   */
  savesToHistory(): boolean {
    return true;
  }

  /**
   * Build a system message that gets concatenated with other system messages.
   * Return null to not add anything.
   */
  buildSystemPrompt(): string | null {
    return null;
  }
}

/**
 * Constructor type for action utilities
 */
export interface AgentActionUtilConstructor<
  T extends BaseAgentAction = BaseAgentAction
> {
  new (agent?: TldrawAgent): AgentActionUtil<T>;
  type: string;
}

