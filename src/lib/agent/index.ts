/**
 * Agent module exports
 *
 * Provides everything needed for AI agent canvas manipulation
 */

// Action types and schemas
export * from "./agent-actions";

// Core types (select exports to avoid conflicts)
export type {
  ContextItem,
  ShapeContextItem,
  ShapesContextItem,
  AreaContextItem,
  PointContextItem,
  AgentRequest,
  AgentInput,
  TodoItem,
  AgentMessage,
  AgentMessageContent,
  BasePromptPart,
  areContextItemsEqual,
} from "./types";

// TldrawAgent class
export {
  TldrawAgent,
  Atom,
  createTldrawAgent,
  type TldrawAgentOptions,
} from "./tldraw-agent";

// Action executor for canvas manipulation (legacy)
export {
  AgentActionExecutor,
  createAgentExecutor,
  type ExecutionResult,
  type PreviewResult,
} from "./agent-action-executor";

// Agent helpers for transformations and validation
export {
  AgentHelpers,
  createAgentHelpers,
  type AgentHelpersOptions,
} from "./agent-helpers";

// Modular action utilities (select exports to avoid conflicts)
export {
  AgentActionUtil,
  CreateActionUtil,
  MessageActionUtil,
  ThinkActionUtil,
  ReviewActionUtil,
  DeleteActionUtil,
  MoveActionUtil,
  PlaceActionUtil,
  ClearActionUtil,
  AGENT_ACTION_UTILS,
  getAgentActionUtilsRecord,
  // Note: getActionInfo is already exported from agent-actions.ts
} from "./actions";

// Utilities
export { closeAndParseJson, extractJsonObjects } from "./utils/close-and-parse-json";

// Prompt parts
export * from "./parts";

// Context selection tools
export * from "./tools";

// Canvas context utilities (use shape-serializer for enhanced serialization)
export {
  getCanvasContext,
  generateCanvasDescription,
  generateShapesJson,
  simplifyShape,
  serializeShapes,
  findShapesNearPosition,
  getTextShapes,
  type CanvasContext,
  type SimplifiedShape,
} from "./shape-serializer";

// Keep old canvas-context for compatibility
export { getChangedShapes } from "./canvas-context";
