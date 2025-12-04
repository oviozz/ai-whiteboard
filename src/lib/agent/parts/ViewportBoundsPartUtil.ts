/**
 * ViewportBoundsPartUtil
 *
 * Provides viewport bounds information to the model.
 */

import type { BoxModel } from "tldraw";
import type { AgentHelpers } from "../agent-helpers";
import type { AgentRequest, BasePromptPart } from "../types";
import { PromptPartUtil } from "./PromptPartUtil";

export interface ViewportBoundsPart extends BasePromptPart<"viewportBounds"> {
  userBounds: BoxModel | null;
  agentBounds: BoxModel | null;
}

export class ViewportBoundsPartUtil extends PromptPartUtil<ViewportBoundsPart> {
  static override type = "viewportBounds" as const;

  override getPriority() {
    return 75; // Lower priority
  }

  override getPart(
    request: AgentRequest,
    helpers: AgentHelpers
  ): ViewportBoundsPart {
    if (!this.agent) {
      return { type: "viewportBounds", userBounds: null, agentBounds: null };
    }

    const userBounds = this.agent.editor.getViewportPageBounds();
    const offsetUserBounds = helpers.applyOffsetToBox(userBounds);
    const offsetAgentBounds = helpers.applyOffsetToBox(request.bounds);

    return {
      type: "viewportBounds",
      userBounds: helpers.roundBox(offsetUserBounds),
      agentBounds: helpers.roundBox(offsetAgentBounds),
    };
  }

  override buildContent({
    userBounds,
    agentBounds,
  }: ViewportBoundsPart): string[] {
    if (!agentBounds || !userBounds) return [];

    const response = [
      `The bounds of the part of the canvas that you can currently see are:`,
      JSON.stringify(agentBounds),
      `The user's view bounds are:`,
      JSON.stringify(userBounds),
    ];

    return response;
  }
}

