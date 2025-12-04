/**
 * Agent module exports
 *
 * Provides everything needed for AI agent canvas manipulation
 */

// Action types and schemas
export * from "./agent-actions";

// Action executor for canvas manipulation
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
