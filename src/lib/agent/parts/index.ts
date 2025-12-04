/**
 * Prompt Parts Index
 *
 * Exports all prompt part utilities.
 */

import type { TldrawAgent } from "../tldraw-agent";
import type { BasePromptPart } from "../types";
import { PromptPartUtil, type PromptPartUtilConstructor } from "./PromptPartUtil";

// Re-export base class
export { PromptPartUtil, type PromptPartUtilConstructor } from "./PromptPartUtil";

// Re-export individual parts
export { MessagesPartUtil, type MessagesPart } from "./MessagesPartUtil";
export {
  ViewportBoundsPartUtil,
  type ViewportBoundsPart,
} from "./ViewportBoundsPartUtil";
export {
  ContextItemsPartUtil,
  type ContextItemsPart,
} from "./ContextItemsPartUtil";
export {
  ChatHistoryPartUtil,
  type ChatHistoryPart,
} from "./ChatHistoryPartUtil";

// Import all part utilities
import { MessagesPartUtil } from "./MessagesPartUtil";
import { ViewportBoundsPartUtil } from "./ViewportBoundsPartUtil";
import { ContextItemsPartUtil } from "./ContextItemsPartUtil";
import { ChatHistoryPartUtil } from "./ChatHistoryPartUtil";

/**
 * All prompt part utilities
 */
export const PROMPT_PART_UTILS: PromptPartUtilConstructor[] = [
  MessagesPartUtil,
  ViewportBoundsPartUtil,
  ContextItemsPartUtil,
  ChatHistoryPartUtil,
];

/**
 * Get a record of all prompt part utilities
 */
export function getPromptPartUtilsRecord(
  agent?: TldrawAgent
): Record<string, PromptPartUtil<BasePromptPart>> {
  const record: Record<string, PromptPartUtil<BasePromptPart>> = {};

  for (const Util of PROMPT_PART_UTILS) {
    record[Util.type] = new Util(agent);
  }

  return record;
}

