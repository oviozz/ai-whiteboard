/**
 * ReviewActionUtil
 *
 * Handles the "review" action type for AI self-review and scheduling follow-up work.
 */

import { Box } from "tldraw";
import type { AgentHelpers } from "../agent-helpers";
import type { ReviewAction, Streaming } from "../agent-actions";
import type { ChatHistoryInfo, AreaContextItem } from "../types";
import { AgentActionUtil } from "./AgentActionUtil";

export class ReviewActionUtil extends AgentActionUtil<ReviewAction> {
  static override type = "review" as const;

  override getInfo(action: Streaming<ReviewAction>): Partial<ChatHistoryInfo> {
    const label = action.complete ? "Review" : "Reviewing";
    const text = action.text?.startsWith("#")
      ? `\n\n${action.text}`
      : action.text;
    const description = `**${label}:** ${text ?? ""}`;

    return {
      icon: "search",
      description,
    };
  }

  override applyAction(
    action: Streaming<ReviewAction>,
    helpers: AgentHelpers
  ): void {
    if (!action.complete) return;
    if (!this.agent) return;

    // If bounds are provided, schedule a review
    if (
      action.x !== undefined &&
      action.y !== undefined &&
      action.w !== undefined &&
      action.h !== undefined
    ) {
      const reviewBounds = helpers.removeOffsetFromBox({
        x: action.x,
        y: action.y,
        w: action.w,
        h: action.h,
      });

      const contextArea: AreaContextItem = {
        type: "area",
        bounds: reviewBounds,
        source: "agent",
      };

      // Expand scheduled bounds if needed
      const scheduledRequest = this.agent.$scheduledRequest.get();
      const bounds = scheduledRequest
        ? Box.From(scheduledRequest.bounds).union(reviewBounds)
        : reviewBounds;

      // Schedule the review
      this.agent.schedule({
        bounds,
        message: this.getReviewMessage(action.text || "Review"),
        contextItems: [contextArea],
      });
    }
  }

  private getReviewMessage(intent: string): string {
    return `Examine the actions that you (the agent) took since the most recent user message, with the intent: "${intent}". What's next?

- Are you awaiting a response from the user? If so, there's no need to do or say anything.
- Is there still more work to do? If so, continue it.
- Is the task supposed to be complete? If so, it's time to review the results of that. Did you do what the user asked for? Did the plan work? Think through your findings and pay close attention to the image, because that's what you can see right now. If you make any corrections, let the user know what you did and why. If no corrections are needed, there's no need to say anything.
- Make sure to reference your last actions (denoted by [ACTION]) in order to see if you completed the task. Assume each action you see in the chat history completed successfully.`;
  }

  override savesToHistory(): boolean {
    return true;
  }
}

