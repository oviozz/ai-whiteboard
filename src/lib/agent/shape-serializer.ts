/**
 * Shape Serializer
 *
 * Converts tldraw shapes to a simplified format suitable for AI context.
 * Based on the tldraw agent starter kit's convertTldrawShapeToSimpleShape pattern.
 */

import type {
  Editor,
  TLShape,
  TLShapeId,
  TLTextShape,
  TLGeoShape,
  TLNoteShape,
  TLArrowShape,
  TLLineShape,
  TLDrawShape,
  TLArrowBinding,
} from "tldraw";

// ============================================
// Types
// ============================================

export interface SimplifiedShape {
  id: string;
  _type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  fill?: string;
  // For lines/arrows
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // Arrow specific
  fromId?: string | null;
  toId?: string | null;
  bend?: number;
  // Text specific
  textAlign?: string;
  fontSize?: string; // Legacy - keep for compatibility
  size?: "s" | "m" | "l" | "xl"; // TLDraw size: s, m, l, xl
  scale?: number; // Scale multiplier for text
  // Note for AI
  note?: string;
}

export interface CanvasContext {
  /** Screenshot blob (if available) */
  screenshot?: Blob;
  /** Simplified shape data */
  shapes: SimplifiedShape[];
  /** Currently selected shape IDs */
  selectedShapeIds: string[];
  /** Viewport bounds (what user can see) */
  viewportBounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** Shape IDs that changed since last analysis */
  changedShapeIds?: string[];
  /** Total shape count */
  shapeCount: number;
  /** Whether canvas is empty */
  isEmpty: boolean;
}

// ============================================
// ID Conversion
// ============================================

/**
 * Convert tldraw shape ID to simple ID (remove shape: prefix)
 */
function convertTldrawIdToSimpleId(id: TLShapeId): string {
  return id.startsWith("shape:") ? id.slice("shape:".length) : id;
}

// ============================================
// Shape Conversion Functions
// ============================================

/**
 * Extract text content from a shape using the shape util's getText method
 */
function extractText(editor: Editor, shape: TLShape): string | undefined {
  try {
    const util = editor.getShapeUtil(shape);
    if ("getText" in util && typeof util.getText === "function") {
      const text = util.getText(shape);
      return text?.trim() || undefined;
    }
  } catch {
    // Fallback to props.text if util method fails
  }

  // Fallback: try to extract from props directly
  const props = shape.props as Record<string, unknown>;
  if (typeof props.text === "string" && props.text.trim()) {
    return props.text.trim();
  }

  return undefined;
}

/**
 * Convert text shape to simple format
 */
function convertTextShape(editor: Editor, shape: TLTextShape): SimplifiedShape {
  const bounds = editor.getShapePageBounds(shape.id);
  const text = extractText(editor, shape) || "";
  const textAlign = shape.props.textAlign || "start";
  const textWidth = shape.props.w || bounds?.w || 0;

  // Calculate anchor point based on alignment
  let anchorX = bounds?.x || shape.x;
  switch (textAlign) {
    case "middle":
      anchorX = (bounds?.x || shape.x) + textWidth / 2;
      break;
    case "end":
      anchorX = (bounds?.x || shape.x) + textWidth;
      break;
    case "start":
    default:
      anchorX = bounds?.x || shape.x;
      break;
  }

  return {
    id: convertTldrawIdToSimpleId(shape.id),
    _type: "text",
    x: Math.round(anchorX),
    y: Math.round(bounds?.y || shape.y),
    w: Math.round(bounds?.w || 0),
    h: Math.round(bounds?.h || 0),
    text,
    color: shape.props.color,
    textAlign,
    fontSize: shape.props.size, // Legacy
    size: shape.props.size as "s" | "m" | "l" | "xl", // Tldraw size
    scale: shape.props.scale || 1, // Scale multiplier
  };
}

/**
 * Convert geo shape to simple format
 */
function convertGeoShape(editor: Editor, shape: TLGeoShape): SimplifiedShape {
  const bounds = editor.getShapePageBounds(shape.id);
  const text = extractText(editor, shape);

  return {
    id: convertTldrawIdToSimpleId(shape.id),
    _type: shape.props.geo, // rectangle, ellipse, etc.
    x: Math.round(bounds?.x || shape.x),
    y: Math.round(bounds?.y || shape.y),
    w: Math.round(shape.props.w),
    h: Math.round(shape.props.h),
    text,
    color: shape.props.color,
    fill: shape.props.fill,
    textAlign: shape.props.align,
  };
}

/**
 * Convert note shape to simple format
 */
function convertNoteShape(editor: Editor, shape: TLNoteShape): SimplifiedShape {
  const bounds = editor.getShapePageBounds(shape.id);
  const text = extractText(editor, shape);

  return {
    id: convertTldrawIdToSimpleId(shape.id),
    _type: "note",
    x: Math.round(bounds?.x || shape.x),
    y: Math.round(bounds?.y || shape.y),
    w: Math.round(bounds?.w || 200),
    h: Math.round(bounds?.h || 200),
    text,
    color: shape.props.color,
    size: shape.props.size as "s" | "m" | "l" | "xl", // Note size
    scale: shape.props.scale || 1, // Scale multiplier
  };
}

/**
 * Convert arrow shape to simple format
 */
function convertArrowShape(
  editor: Editor,
  shape: TLArrowShape
): SimplifiedShape {
  const bounds = editor.getShapePageBounds(shape.id);

  // Get arrow bindings to find connected shapes
  const bindings = editor.store.query.records("binding").get();
  const arrowBindings = bindings.filter(
    (b) => b.type === "arrow" && b.fromId === shape.id
  ) as TLArrowBinding[];
  const startBinding = arrowBindings.find((b) => b.props.terminal === "start");
  const endBinding = arrowBindings.find((b) => b.props.terminal === "end");

  const baseX = bounds?.x || shape.x;
  const baseY = bounds?.y || shape.y;

  return {
    id: convertTldrawIdToSimpleId(shape.id),
    _type: "arrow",
    x: Math.round(baseX),
    y: Math.round(baseY),
    x1: Math.round(shape.props.start.x + baseX),
    y1: Math.round(shape.props.start.y + baseY),
    x2: Math.round(shape.props.end.x + baseX),
    y2: Math.round(shape.props.end.y + baseY),
    color: shape.props.color,
    fromId: startBinding?.toId
      ? convertTldrawIdToSimpleId(startBinding.toId as TLShapeId)
      : null,
    toId: endBinding?.toId
      ? convertTldrawIdToSimpleId(endBinding.toId as TLShapeId)
      : null,
    bend: shape.props.bend * -1, // Invert for consistency
    text: extractText(editor, shape),
  };
}

/**
 * Convert line shape to simple format
 */
function convertLineShape(editor: Editor, shape: TLLineShape): SimplifiedShape {
  const bounds = editor.getShapePageBounds(shape.id);
  const points = Object.values(shape.props.points).sort((a, b) =>
    a.index.localeCompare(b.index)
  );

  const baseX = bounds?.x || shape.x;
  const baseY = bounds?.y || shape.y;

  return {
    id: convertTldrawIdToSimpleId(shape.id),
    _type: "line",
    x: Math.round(baseX),
    y: Math.round(baseY),
    x1: Math.round(points[0]?.x + baseX || baseX),
    y1: Math.round(points[0]?.y + baseY || baseY),
    x2: Math.round(points[1]?.x + baseX || baseX),
    y2: Math.round(points[1]?.y + baseY || baseY),
    color: shape.props.color,
  };
}

/**
 * Convert draw shape to simple format
 */
function convertDrawShape(editor: Editor, shape: TLDrawShape): SimplifiedShape {
  const bounds = editor.getShapePageBounds(shape.id);

  return {
    id: convertTldrawIdToSimpleId(shape.id),
    _type: "draw",
    x: Math.round(bounds?.x || shape.x),
    y: Math.round(bounds?.y || shape.y),
    w: Math.round(bounds?.w || 0),
    h: Math.round(bounds?.h || 0),
    color: shape.props.color,
    fill: shape.props.fill,
  };
}

/**
 * Convert unknown shape type to simple format
 */
function convertUnknownShape(editor: Editor, shape: TLShape): SimplifiedShape {
  const bounds = editor.getShapePageBounds(shape.id);

  return {
    id: convertTldrawIdToSimpleId(shape.id),
    _type: shape.type,
    x: Math.round(bounds?.x || shape.x),
    y: Math.round(bounds?.y || shape.y),
    w: Math.round(bounds?.w || 0),
    h: Math.round(bounds?.h || 0),
    color: (shape.props as Record<string, unknown>).color as string | undefined,
  };
}

// ============================================
// Main Conversion Function
// ============================================

/**
 * Convert a tldraw shape to a simplified format for AI
 */
export function simplifyShape(
  editor: Editor,
  shape: TLShape
): SimplifiedShape | null {
  try {
    switch (shape.type) {
      case "text":
        return convertTextShape(editor, shape as TLTextShape);
      case "geo":
        return convertGeoShape(editor, shape as TLGeoShape);
      case "note":
        return convertNoteShape(editor, shape as TLNoteShape);
      case "arrow":
        return convertArrowShape(editor, shape as TLArrowShape);
      case "line":
        return convertLineShape(editor, shape as TLLineShape);
      case "draw":
        return convertDrawShape(editor, shape as TLDrawShape);
      default:
        return convertUnknownShape(editor, shape);
    }
  } catch (error) {
    console.error(
      `[ShapeSerializer] Error converting shape ${shape.id}:`,
      error
    );
    return null;
  }
}

/**
 * Serialize all shapes on the current page
 */
export function serializeShapes(editor: Editor): SimplifiedShape[] {
  const shapes = editor.getCurrentPageShapes();
  const simplified: SimplifiedShape[] = [];

  for (const shape of shapes) {
    const simple = simplifyShape(editor, shape);
    if (simple) {
      simplified.push(simple);
    }
  }

  // Sort by position (top-left to bottom-right) for consistent ordering
  simplified.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 20) return yDiff; // Different rows
    return a.x - b.x; // Same row, sort by x
  });

  return simplified;
}

/**
 * Get full canvas context for AI
 */
export function getCanvasContext(
  editor: Editor,
  options?: {
    screenshot?: Blob;
    changedShapeIds?: TLShapeId[];
  }
): CanvasContext {
  const shapes = serializeShapes(editor);
  const viewportBounds = editor.getViewportPageBounds();
  const selectedIds = editor.getSelectedShapeIds();

  return {
    screenshot: options?.screenshot,
    shapes,
    selectedShapeIds: selectedIds.map((id) => convertTldrawIdToSimpleId(id)),
    viewportBounds: {
      x: Math.round(viewportBounds.x),
      y: Math.round(viewportBounds.y),
      w: Math.round(viewportBounds.w),
      h: Math.round(viewportBounds.h),
    },
    changedShapeIds: options?.changedShapeIds?.map((id) =>
      convertTldrawIdToSimpleId(id)
    ),
    shapeCount: shapes.length,
    isEmpty: shapes.length === 0,
  };
}

/**
 * Generate a natural language description of the canvas for AI
 */
export function generateCanvasDescription(context: CanvasContext): string {
  if (context.isEmpty) {
    return "The canvas is empty.";
  }

  const lines: string[] = [];
  lines.push(`Canvas has ${context.shapeCount} shape(s).`);
  lines.push("");

  // List each shape with its details
  for (const shape of context.shapes) {
    let desc = `- ${shape._type} (id: ${shape.id}) at position (${shape.x}, ${shape.y})`;
    if (shape.w && shape.h) {
      desc += `, size ${shape.w}x${shape.h}`;
    }
    if (shape.text) {
      const truncatedText =
        shape.text.length > 50 ? shape.text.slice(0, 50) + "..." : shape.text;
      desc += `, text: "${truncatedText}"`;
    }
    if (shape.color) {
      desc += `, color: ${shape.color}`;
    }
    // Include text sizing info for AI consistency
    if (shape.size) {
      desc += `, textSize: "${shape.size}"`;
    }
    if (shape.scale && shape.scale !== 1) {
      desc += `, scale: ${shape.scale}`;
    }
    lines.push(desc);
  }

  // Note selected shapes
  if (context.selectedShapeIds.length > 0) {
    lines.push("");
    lines.push(`Selected shapes: ${context.selectedShapeIds.join(", ")}`);
  }

  // Note viewport bounds
  lines.push("");
  lines.push(
    `Visible area: x=${context.viewportBounds.x}, y=${context.viewportBounds.y}, ` +
      `width=${context.viewportBounds.w}, height=${context.viewportBounds.h}`
  );

  return lines.join("\n");
}

/**
 * Generate JSON representation of shapes for AI context
 */
export function generateShapesJson(context: CanvasContext): string {
  return JSON.stringify(context.shapes, null, 2);
}

/**
 * Find shapes near a given position
 */
export function findShapesNearPosition(
  editor: Editor,
  x: number,
  y: number,
  radius: number = 100
): SimplifiedShape[] {
  const shapes = editor.getCurrentPageShapes();
  const nearby: SimplifiedShape[] = [];

  for (const shape of shapes) {
    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds) continue;

    // Check if center is within radius
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    const distance = Math.sqrt(
      Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2)
    );

    if (distance <= radius) {
      const simple = simplifyShape(editor, shape);
      if (simple) {
        nearby.push(simple);
      }
    }
  }

  return nearby;
}

/**
 * Get shapes that contain text (for OCR context)
 */
export function getTextShapes(editor: Editor): SimplifiedShape[] {
  return serializeShapes(editor).filter((s) => s.text);
}
