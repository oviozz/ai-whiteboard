"use client";

/**
 * AgentViewportBoundsHighlight
 *
 * Shows a highlight around the area the agent is currently viewing/working on.
 */

import { Box, useValue } from "tldraw";
import type { TldrawAgent } from "@/lib/agent/tldraw-agent";
import { AreaHighlight } from "./AreaHighlight";

interface AgentViewportBoundsHighlightProps {
  agent: TldrawAgent;
}

export function AgentViewportBoundsHighlight({
  agent,
}: AgentViewportBoundsHighlightProps) {
  const currentRequest = useValue(
    "currentRequest",
    () => agent.$activeRequest.get(),
    [agent]
  );

  const agentViewportBounds = currentRequest?.bounds;

  // Check if agent's viewport is equivalent to a pending context area
  const isEquivalentToPendingContextArea = useValue(
    "isEquivalentToPendingContextArea",
    () => {
      if (!agentViewportBounds) return false;
      if (!currentRequest) return false;

      const contextItems = currentRequest.contextItems;
      return contextItems.some(
        (item) =>
          item.type === "area" &&
          item.source === "agent" &&
          Box.Equals(item.bounds, agentViewportBounds)
      );
    },
    [agentViewportBounds, currentRequest]
  );

  if (!agentViewportBounds) return null;
  if (isEquivalentToPendingContextArea) return null;

  return (
    <AreaHighlight
      key="agent-viewport-bounds-highlight"
      pageBounds={agentViewportBounds}
      color="var(--color-muted, #6b7280)"
      generating={true}
      label="Agent view"
    />
  );
}

