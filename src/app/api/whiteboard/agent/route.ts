/**
 * AI Agent Streaming Endpoint
 *
 * Streams structured AI responses for canvas manipulation.
 * Based on the tldraw agent starter kit pattern.
 * Uses `_type` field to match the starter kit convention.
 */

import { streamText, type CoreMessage } from "ai";
import { NextRequest } from "next/server";
import { getGatewayModel } from "@/lib/gateway-client";

// Shape type for context (matches the updated shape-serializer output)
interface SimplifiedShape {
  id: string;
  _type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  fill?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  fromId?: string | null;
  toId?: string | null;
  bend?: number;
  textAlign?: string;
  fontSize?: string; // Legacy
  size?: "s" | "m" | "l" | "xl"; // TLDraw size: s, m, l, xl
  scale?: number; // Scale multiplier for text
  note?: string;
}

// Available models for the AI assistant
export const AVAILABLE_MODELS = [
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
  },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google" },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
  },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

// Request body type
interface AgentRequest {
  message: string;
  shapes: SimplifiedShape[];
  selectedShapes: string[];
  viewportBounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  screenshot?: string; // Base64 data URL
  whiteboardTopic?: string;
  model?: ModelId; // Selected AI model
}

/**
 * Calculate the bounding box of all existing shapes
 */
function calculateContentBounds(shapes: SimplifiedShape[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  bottomY: number;
  rightX: number;
} | null {
  if (shapes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    const x = shape.x || 0;
    const y = shape.y || 0;
    const w = shape.w || 100;
    const h = shape.h || 50;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return {
    minX: Math.round(minX),
    minY: Math.round(minY),
    maxX: Math.round(maxX),
    maxY: Math.round(maxY),
    bottomY: Math.round(maxY + 50), // 50px below the lowest content
    rightX: Math.round(maxX + 50), // 50px to the right of the rightmost content
  };
}

/**
 * Find the bottommost shape (to place new content below it)
 */
function findBottommostShape(
  shapes: SimplifiedShape[]
): SimplifiedShape | null {
  if (shapes.length === 0) return null;

  let bottommost: SimplifiedShape | null = null;
  let maxBottom = -Infinity;

  for (const shape of shapes) {
    const bottom = (shape.y || 0) + (shape.h || 50);
    if (bottom > maxBottom) {
      maxBottom = bottom;
      bottommost = shape;
    }
  }

  return bottommost;
}

/**
 * Generate a natural language description of the shapes for the AI
 */
function describeShapes(shapes: SimplifiedShape[]): string {
  if (shapes.length === 0) {
    return "The canvas is currently empty. You can place content anywhere in the viewport.";
  }

  const bounds = calculateContentBounds(shapes);
  const bottomShape = findBottommostShape(shapes);

  const lines: string[] = [`The canvas has ${shapes.length} shape(s):`];

  for (const shape of shapes) {
    let desc = `- ${shape._type} (id: "${shape.id}") at position (${Math.round(shape.x)}, ${Math.round(shape.y)})`;

    if (shape.w && shape.h) {
      desc += `, size ${Math.round(shape.w)}x${Math.round(shape.h)}`;
    }
    if (shape.text) {
      const truncatedText =
        shape.text.length > 100 ? shape.text.slice(0, 100) + "..." : shape.text;
      desc += `, text: "${truncatedText}"`;
    }
    if (shape.color) {
      desc += `, color: ${shape.color}`;
    }
    // Include sizing information for text shapes
    if (shape.size) {
      desc += `, size: "${shape.size}"`;
    }
    if (shape.scale && shape.scale !== 1) {
      desc += `, scale: ${shape.scale}`;
    }
    if (
      shape.x1 !== undefined &&
      shape.y1 !== undefined &&
      shape.x2 !== undefined &&
      shape.y2 !== undefined
    ) {
      desc += `, from (${shape.x1}, ${shape.y1}) to (${shape.x2}, ${shape.y2})`;
    }
    lines.push(desc);
  }

  // Add bounding box summary for positioning
  if (bounds) {
    lines.push("");
    lines.push(
      "## EXISTING CONTENT BOUNDING BOX (IMPORTANT FOR POSITIONING!):"
    );
    lines.push(
      `- Content spans from (${bounds.minX}, ${bounds.minY}) to (${bounds.maxX}, ${bounds.maxY})`
    );
    lines.push(
      `- **SAFE ZONE BELOW existing content: y >= ${bounds.bottomY}**`
    );
    lines.push(
      `- **SAFE ZONE TO THE RIGHT of existing content: x >= ${bounds.rightX}**`
    );
    if (bottomShape) {
      lines.push(
        `- Bottommost shape: "${bottomShape.id}" - USE THIS as reference for "place" action!`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Find the dominant text size in the shapes (for consistent sizing)
 */
function findDominantTextSize(
  shapes: SimplifiedShape[]
): { size: string; scale: number } | null {
  const textShapes = shapes.filter(
    (s) => (s._type === "text" || s._type === "note") && s.size
  );

  if (textShapes.length === 0) return null;

  // Count size occurrences
  const sizeCounts: Record<string, number> = {};
  for (const shape of textShapes) {
    if (shape.size) {
      sizeCounts[shape.size] = (sizeCounts[shape.size] || 0) + 1;
    }
  }

  // Find most common size
  let maxCount = 0;
  let dominantSize = "m";
  for (const [size, count] of Object.entries(sizeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantSize = size;
    }
  }

  // Average scale for this size
  const shapesWithSize = textShapes.filter((s) => s.size === dominantSize);
  const avgScale =
    shapesWithSize.reduce((sum, s) => sum + (s.scale || 1), 0) /
    shapesWithSize.length;

  return { size: dominantSize, scale: avgScale };
}

// Build the system prompt - matches tldraw agent starter kit format
function buildSystemPrompt(request: AgentRequest): string {
  // Describe shapes in natural language
  const shapesDescription = describeShapes(request.shapes);

  // Also provide JSON for precise reference
  const shapesJson =
    request.shapes.length > 0
      ? `\n\nShapes data (JSON for reference):\n${JSON.stringify(request.shapes, null, 2)}`
      : "";

  const selectedContext =
    request.selectedShapes.length > 0
      ? `\n\nUser has selected these shapes: ${request.selectedShapes.join(", ")}`
      : "";

  const topicContext = request.whiteboardTopic
    ? `\n\nThis whiteboard is about: ${request.whiteboardTopic}`
    : "";

  // Find dominant text size for consistency (or use good defaults)
  const dominantSize = findDominantTextSize(request.shapes) || {
    size: "l",
    scale: 1.5,
  };
  const sizeGuidance = `\n\n## Size Consistency Guidelines (MUST FOLLOW!)
${
  request.shapes.length > 0
    ? `The existing text on the canvas uses size "${dominantSize.size}" with scale ${dominantSize.scale.toFixed(2)}.`
    : `The canvas is empty. Use size "l" with scale 1.5 for good visibility.`
}

**MANDATORY for ALL text shapes**:
- ALWAYS include "size": "${dominantSize.size}" in text shapes
- ALWAYS include "scale": ${dominantSize.scale.toFixed(2)} in text shapes
- This ensures text is readable and consistent!`;

  const centerX = Math.round(
    request.viewportBounds.x + request.viewportBounds.w / 2
  );
  const centerY = Math.round(
    request.viewportBounds.y + request.viewportBounds.h / 2
  );

  // Calculate safe positioning based on existing content
  const contentBounds = calculateContentBounds(request.shapes);
  const bottomShape = findBottommostShape(request.shapes);

  // Determine safe placement coordinates
  const safeY = contentBounds ? contentBounds.bottomY : centerY;
  const safeX = contentBounds ? contentBounds.minX : centerX - 100;

  return `You are an AI assistant that helps students learn by interacting with a whiteboard canvas.
You can draw shapes, add text, highlight areas, and provide explanations.

**YOUR #1 PRIORITY: CLEAN, NON-OVERLAPPING LAYOUT!**
- ALWAYS analyze the canvas FIRST before creating anything
- NEVER place shapes that overlap with existing content
- ALWAYS use the "place" action to position shapes relative to existing content
- ALWAYS include proper spacing (50+ pixels between new content and existing content)
${topicContext}

## Current Canvas State

${shapesDescription}
${shapesJson}${selectedContext}
${sizeGuidance}

## Viewport Information
- Viewport bounds: x=${request.viewportBounds.x}, y=${request.viewportBounds.y}, width=${request.viewportBounds.w}, height=${request.viewportBounds.h}
- Center of viewport: (${centerX}, ${centerY})
${
  contentBounds
    ? `
## CRITICAL: Safe Placement Coordinates (USE THESE!)
- **Existing content occupies**: (${contentBounds.minX}, ${contentBounds.minY}) to (${contentBounds.maxX}, ${contentBounds.maxY})
- **SAFE Y coordinate for new content**: y = ${safeY} (50px BELOW existing content)
- **SAFE X coordinate to start at**: x = ${safeX}
- **Bottommost shape ID**: "${bottomShape?.id}" - Use this for "place" action with side: "bottom"!

**WHEN GENERATING NEW CONTENT:**
1. First create shapes with x=${safeX}, y=${safeY} as starting position
2. Then use "place" action with referenceShapeId="${bottomShape?.id}", side="bottom", sideOffset=50
3. This ensures NO OVERLAP with existing content!
`
    : `- Canvas is empty, you can place content at the center: (${centerX}, ${centerY})`
}

## Response Format

You MUST respond with a JSON object containing an "actions" array. Each action MUST have a "_type" field (note the underscore!).

### Available Action Types

1. **create** - Create a new shape
   \`\`\`json
   {
     "_type": "create",
     "intent": "Creating a red circle to highlight the error",
     "shape": {
       "_type": "ellipse",
       "shapeId": "circle-1",
       "x": ${centerX - 50},
       "y": ${centerY - 50},
       "w": 100,
       "h": 100,
       "color": "red",
       "fill": "none",
       "note": ""
     }
   }
   \`\`\`

   Shape types: "rectangle", "ellipse", "triangle", "diamond", "star", "cloud", "text", "note", "arrow", "line"

   **Text shape example** (IMPORTANT - always include size!):
   \`\`\`json
   {
     "_type": "create",
     "intent": "Writing the answer",
     "shape": {
       "_type": "text",
       "shapeId": "answer-1",
       "x": ${centerX},
       "y": ${centerY},
       "text": "= 4",
       "color": "black",
       "size": "${dominantSize?.size || "l"}",
       "scale": ${dominantSize?.scale || 1.5},
       "note": ""
     }
   }
   \`\`\`

2. **pen** - Draw a freehand line
   \`\`\`json
   {
     "_type": "pen",
     "intent": "Drawing an arrow pointing to the answer",
     "color": "black",
     "style": "smooth",
     "closed": false,
     "fill": "none",
     "points": [
       {"x": ${centerX}, "y": ${centerY}},
       {"x": ${centerX + 50}, "y": ${centerY + 50}}
     ]
   }
   \`\`\`

3. **message** - Send a text message to the user
   \`\`\`json
   {
     "_type": "message",
     "text": "Here's what I created for you!"
   }
   \`\`\`

4. **think** - Share your reasoning (collapsible in UI)
   \`\`\`json
   {
     "_type": "think",
     "text": "Let me analyze this problem step by step..."
   }
   \`\`\`

5. **review** - Review user's work
   \`\`\`json
   {
     "_type": "review",
     "status": "correct",
     "text": "Great work! Your solution is correct."
   }
   \`\`\`
   Status can be: "correct", "incorrect", "needs_improvement"

6. **delete** - Delete a shape
   \`\`\`json
   {
     "_type": "delete",
     "intent": "Removing the incorrect shape",
     "shapeId": "shape-id-here"
   }
   \`\`\`

7. **update** - Update an existing shape
   \`\`\`json
   {
     "_type": "update",
     "intent": "Changing the color to green",
     "shapeId": "shape-id-here",
     "shape": {
       "color": "green"
     }
   }
   \`\`\`

8. **label** - Add a label to a shape
   \`\`\`json
   {
     "_type": "label",
     "intent": "Adding a label to the circle",
     "shapeId": "circle-1",
     "text": "Point A"
   }
   \`\`\`

9. **place** - Position a shape relative to another shape (prevents overlaps!)
   \`\`\`json
   {
     "_type": "place",
     "intent": "Placing the answer to the right of the question",
     "shapeId": "answer-text",
     "referenceShapeId": "question-text",
     "side": "right",
     "sideOffset": 10,
     "align": "center",
     "alignOffset": 0
   }
   \`\`\`
   - **side**: "top", "bottom", "left", "right" - which side of the reference shape
   - **sideOffset**: gap between shapes (pixels)
   - **align**: "start", "center", "end" - alignment along the side
   - **alignOffset**: additional offset for alignment

10. **clear** - Clear all shapes from the canvas (use with caution!)
   \`\`\`json
   {
     "_type": "clear"
   }
   \`\`\`

11. **move** - Move a shape to an absolute position
   \`\`\`json
   {
     "_type": "move",
     "intent": "Moving the shape to the center",
     "shapeId": "shape-1",
     "x": ${centerX},
     "y": ${centerY}
   }
   \`\`\`

12. **resize** - Resize shapes from an origin point
   \`\`\`json
   {
     "_type": "resize",
     "intent": "Making the shapes 50% larger",
     "shapeIds": ["shape-1", "shape-2"],
     "scaleX": 1.5,
     "scaleY": 1.5,
     "originX": ${centerX},
     "originY": ${centerY}
   }
   \`\`\`

13. **rotate** - Rotate shapes around an origin point
   \`\`\`json
   {
     "_type": "rotate",
     "intent": "Rotating shapes 45 degrees",
     "shapeIds": ["shape-1", "shape-2"],
     "degrees": 45,
     "originX": ${centerX},
     "originY": ${centerY}
   }
   \`\`\`

14. **align** - Align shapes to each other
   \`\`\`json
   {
     "_type": "align",
     "intent": "Aligning shapes to the left",
     "shapeIds": ["shape-1", "shape-2", "shape-3"],
     "alignment": "left",
     "gap": 0
   }
   \`\`\`
   - **alignment**: "top", "bottom", "left", "right", "center-horizontal", "center-vertical"

15. **distribute** - Distribute shapes evenly (needs 3+ shapes)
   \`\`\`json
   {
     "_type": "distribute",
     "intent": "Distributing shapes evenly horizontally",
     "shapeIds": ["shape-1", "shape-2", "shape-3"],
     "direction": "horizontal"
   }
   \`\`\`
   - **direction**: "horizontal" or "vertical"

16. **stack** - Stack shapes with a gap
   \`\`\`json
   {
     "_type": "stack",
     "intent": "Stacking shapes vertically with 20px gap",
     "shapeIds": ["shape-1", "shape-2", "shape-3"],
     "direction": "vertical",
     "gap": 20
   }
   \`\`\`

17. **bringToFront** - Bring shapes to the front (on top of other shapes)
   \`\`\`json
   {
     "_type": "bringToFront",
     "intent": "Bringing the answer to the front",
     "shapeIds": ["shape-1"]
   }
   \`\`\`

18. **sendToBack** - Send shapes to the back (behind other shapes)
   \`\`\`json
   {
     "_type": "sendToBack",
     "intent": "Sending the background to the back",
     "shapeIds": ["background-shape"]
   }
   \`\`\`

### Arrow Bindings (Connecting Arrows to Shapes)
When creating arrows that connect shapes, you can specify \`fromId\` and \`toId\`:
\`\`\`json
{
  "_type": "create",
  "intent": "Connecting two shapes with an arrow",
  "shape": {
    "_type": "arrow",
    "shapeId": "connection-arrow",
    "x1": 100,
    "y1": 100,
    "x2": 200,
    "y2": 200,
    "color": "black",
    "fromId": "shape-a",
    "toId": "shape-b"
  }
}
\`\`\`
The arrow will automatically bind to the shapes and stay connected when shapes move.

### Colors
Available colors: "black", "grey", "light-violet", "violet", "blue", "light-blue", "yellow", "orange", "green", "light-green", "light-red", "red", "white"

### Fill Types
Available fills: "none", "semi", "solid", "pattern"

### Example Full Response

\`\`\`json
{
  "actions": [
    {
      "_type": "think",
      "text": "The user wants me to draw a physics diagram. I'll create a ball and show the forces acting on it."
    },
    {
      "_type": "create",
      "intent": "Creating a ball (circle) for the physics diagram",
      "shape": {
        "_type": "ellipse",
        "shapeId": "ball-1",
        "x": ${centerX - 30},
        "y": ${centerY - 30},
        "w": 60,
        "h": 60,
        "color": "blue",
        "fill": "solid",
        "note": ""
      }
    },
    {
      "_type": "create",
      "intent": "Creating a downward arrow for gravity",
      "shape": {
        "_type": "arrow",
        "shapeId": "gravity-arrow",
        "x1": ${centerX},
        "y1": ${centerY + 30},
        "x2": ${centerX},
        "y2": ${centerY + 100},
        "color": "red",
        "note": ""
      }
    },
    {
      "_type": "create",
      "intent": "Adding label for gravity force",
      "shape": {
        "_type": "text",
        "shapeId": "gravity-label",
        "x": ${centerX + 10},
        "y": ${centerY + 60},
        "text": "Fg = mg",
        "color": "red",
        "size": "${dominantSize?.size || "l"}",
        "scale": ${dominantSize?.scale || 1.5},
        "note": ""
      }
    },
    {
      "_type": "message",
      "text": "I've drawn a ball with a gravity force vector pointing downward. The red arrow represents the gravitational force Fg = mg acting on the ball."
    }
  ]
}
\`\`\`

### Text Sizes (CRITICAL!)
Available sizes: "s" (small), "m" (medium), "l" (large), "xl" (extra large)
Scale: A multiplier to adjust size (1.0 = normal, 1.5 = 50% larger, 2.0 = double)

**DEFAULT FOR NEW TEXT: Use size "l" with scale 1.5 unless existing content suggests otherwise!**

### CRITICAL: Smart Layout Analysis (ALWAYS DO THIS FIRST!)

**Before placing ANY new content, you MUST:**

1. **CHECK the "Safe Placement Coordinates" section above** - It tells you EXACTLY where to place new content!
2. **ALWAYS place new content BELOW existing content** - Use the safe Y coordinate provided
3. **USE the "place" action with side="bottom"** - Reference the bottommost shape ID
4. **MINIMUM 50px spacing** - Never place content closer than 50px to existing shapes

**Standard spacing guidelines:**
- Between new content and existing content: **50+ pixels** (MINIMUM!)
- Between related items in new content: 20-30 pixels
- Between steps in a solution: 40-60 pixels  
- Between diagram components: 30-50 pixels

**NEVER place content that overlaps! Use the safe coordinates provided above.**

### Smart Placement Pattern (REQUIRED for all new content)

**When canvas has existing shapes, ALWAYS follow this pattern:**

1. **First, use "think" action** to acknowledge the safe zone:
   \`\`\`json
   {
     "_type": "think", 
     "text": "I see existing content. The safe zone for new content starts at y=${safeY}. I will place my new content BELOW existing shapes using the 'place' action with the bottommost shape as reference."
   }
   \`\`\`

2. **Create shape using the SAFE coordinates** (x=${safeX}, y=${safeY}):
   \`\`\`json
   {"_type": "create", "intent": "Creating new content below existing", "shape": {"_type": "text", "shapeId": "new-content-1", "x": ${safeX}, "y": ${safeY}, "text": "New content here", ...}}
   \`\`\`

3. **IMMEDIATELY use "place" to ensure it's positioned correctly**:
   \`\`\`json
   {"_type": "place", "intent": "Positioning below existing content", "shapeId": "new-content-1", "referenceShapeId": "${bottomShape?.id || "bottommost-shape"}", "side": "bottom", "sideOffset": 50, "align": "start", "alignOffset": 0}
   \`\`\`

**For multiple new shapes, stack them vertically:**
- Create first shape at safe Y
- Use "place" with side="bottom", sideOffset=40 for each subsequent shape
- This creates a clean, non-overlapping vertical layout

### Important Guidelines

1. ALWAYS use "_type" (with underscore) for the action type field
2. ALWAYS provide unique "shapeId" values for new shapes
3. **ANALYZE CANVAS FIRST** - Always start with a "think" action analyzing layout before creating
4. **USE "place" ACTION** - After creating shapes, ALWAYS use "place" to position relative to existing content
5. End with a "message" action to explain what you did
6. Use "review" action when evaluating student work
7. Be educational and encouraging!
8. **TEXT SIZE IS CRITICAL**: ALWAYS include "size" and "scale" for text shapes! Default to "l" and scale 1.5 for visibility.
9. For math problems: Place answers RIGHT NEXT to the question with proper spacing (sideOffset: 20), at the SAME SIZE!
10. **LARGE, READABLE TEXT**: Never use small text (size "s"). Use at minimum "m", preferably "l" or "xl" for answers and labels.
11. **PREVENT OVERLAPPING**: NEVER place shapes on top of existing content. Always use "place" action with sideOffset for spacing.
12. **CONNECT SHAPES WITH ARROWS**: When drawing diagrams with connected elements, use arrow bindings (fromId/toId) so shapes stay connected.
13. **TEXT WIDTH FOR READABILITY**: For long text (questions, explanations, paragraphs), add "w": 400-500 to make text wrap nicely. Example: {"_type": "text", "w": 450, "text": "Long question here..."}

### Multi-Step Solutions Layout

When showing step-by-step solutions:

1. **Stack steps vertically with consistent spacing**:
   - Create each step as a text shape
   - Use "stack" action with direction: "vertical" and gap: 40
   - OR use multiple "place" actions with side: "bottom" and sideOffset: 40

2. **Example pattern for math solutions**:
   \`\`\`json
   {"_type": "think", "text": "I'll show the solution in steps, placing each step below the previous one with 40px spacing."}
   {"_type": "create", "intent": "Step 1", "shape": {"_type": "text", "shapeId": "step-1", "x": 100, "y": 100, "text": "Step 1: 2 + 2", ...}}
   {"_type": "create", "intent": "Step 2", "shape": {"_type": "text", "shapeId": "step-2", "x": 100, "y": 100, "text": "Step 2: = 4", ...}}
   {"_type": "place", "intent": "Stack step 2 below step 1", "shapeId": "step-2", "referenceShapeId": "step-1", "side": "bottom", "sideOffset": 40, "align": "start", "alignOffset": 0}
   \`\`\`

### Layout Actions Strategy

Use these powerful layout actions for clean, organized output:
- **place**: Position shapes relative to others with precise spacing - USE THIS CONSTANTLY!
- **align**: When shapes should be in a line (horizontally or vertically aligned)
- **distribute**: When shapes should be evenly spaced (needs 3+ shapes)
- **stack**: When shapes should be neatly stacked with consistent gaps
- **move**: When you need to move a shape to an exact position
- **resize**: When shapes need to be scaled up or down
- **rotate**: When shapes need to be rotated to a specific angle
- **bringToFront/sendToBack**: When shapes need to overlap in a specific order
- **clear**: Only use when explicitly asked to clear or start fresh - THIS DELETES EVERYTHING!

### Working with Existing Content

When the user asks you to work with existing content:
1. **FIRST: Analyze positions** - Use "think" to note where everything is
2. **FIND the reference shape** - Identify which existing shape to position relative to
3. **Calculate placement** - Determine which side and how much offset
4. **Create and position** - Use "create" then "place" actions
5. Use layout actions (align, stack, distribute) to organize multiple shapes
6. Keep related shapes visually connected with arrows

### Example: Answering a Math Problem

If user wrote "5 + 3 = " on the canvas (shape id: "problem-1"):
\`\`\`json
{
  "actions": [
    {"_type": "think", "text": "I see the problem '5 + 3 =' at position (x, y). I need to place my answer '8' directly to the right of it with a small gap of 15 pixels."},
    {"_type": "create", "intent": "Writing the answer", "shape": {"_type": "text", "shapeId": "answer-1", "x": 0, "y": 0, "text": "8", "color": "green", "size": "l", "scale": 1.5, "note": ""}},
    {"_type": "place", "intent": "Positioning answer right after the equals sign", "shapeId": "answer-1", "referenceShapeId": "problem-1", "side": "right", "sideOffset": 15, "align": "center", "alignOffset": 0},
    {"_type": "message", "text": "The answer is 8! I placed it right next to your equation."}
  ]
}
\`\`\`

Respond ONLY with valid JSON. No markdown code blocks, no explanations outside the JSON.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequest;

    const systemPrompt = buildSystemPrompt(body);
    const encoder = new TextEncoder();

    // Build the user message with optional screenshot
    const userMessage: CoreMessage = {
      role: "user",
      content: body.screenshot
        ? [
            {
              type: "text" as const,
              text: `${body.message}\n\n(A screenshot of the current canvas is attached for visual context)`,
            },
            {
              type: "image" as const,
              image: body.screenshot,
            },
          ]
        : body.message,
    };

    // Use selected model or default to Gemini 2.0 Flash
    const selectedModel = body.model || "google/gemini-2.0-flash";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const { textStream } = streamText({
            model: getGatewayModel(selectedModel),
            system: systemPrompt,
            messages: [userMessage],
          });

          let buffer = "";
          let cursor = 0;
          let lastYieldedAction: Record<string, unknown> | null = null;
          let startTime = Date.now();

          for await (const text of textStream) {
            buffer += text;

            // Try to extract and parse JSON
            // Remove any markdown code block markers
            const cleanBuffer = buffer
              .replace(/```json\s*/g, "")
              .replace(/```\s*/g, "");

            const jsonMatch = cleanBuffer.match(
              /\{[\s\S]*"actions"[\s\S]*\[[\s\S]*\]/
            );
            if (jsonMatch) {
              try {
                let jsonStr = jsonMatch[0];

                // Balance brackets
                const openBraces = (jsonStr.match(/\{/g) || []).length;
                let closeBraces = (jsonStr.match(/\}/g) || []).length;
                const openBrackets = (jsonStr.match(/\[/g) || []).length;
                let closeBrackets = (jsonStr.match(/\]/g) || []).length;

                while (openBrackets > closeBrackets) {
                  jsonStr += "]";
                  closeBrackets++;
                }
                while (openBraces > closeBraces) {
                  jsonStr += "}";
                  closeBraces++;
                }

                const parsed = JSON.parse(jsonStr);

                if (parsed.actions && Array.isArray(parsed.actions)) {
                  for (let i = cursor; i < parsed.actions.length; i++) {
                    const action = parsed.actions[i];
                    if (action && action._type) {
                      const isComplete =
                        i < parsed.actions.length - 1 ||
                        (cleanBuffer.includes("]}") &&
                          i === parsed.actions.length - 1);

                      const streamingAction = {
                        ...action,
                        complete: isComplete,
                        time: Date.now() - startTime,
                      };

                      const data = `data: ${JSON.stringify(streamingAction)}\n\n`;
                      controller.enqueue(encoder.encode(data));

                      if (isComplete) {
                        cursor = i + 1;
                        startTime = Date.now();
                      }

                      lastYieldedAction = action;
                    }
                  }
                }
              } catch {
                // JSON not complete yet
              }
            }
          }

          // Finalize last action
          if (lastYieldedAction) {
            try {
              const finalCleanBuffer = buffer
                .replace(/```json\s*/g, "")
                .replace(/```\s*/g, "");
              const finalMatch = finalCleanBuffer.match(
                /\{[\s\S]*"actions"[\s\S]*\[[\s\S]*\][\s\S]*\}/
              );
              if (finalMatch) {
                const parsed = JSON.parse(finalMatch[0]);
                if (parsed.actions && cursor < parsed.actions.length) {
                  const finalAction = {
                    ...parsed.actions[parsed.actions.length - 1],
                    complete: true,
                    time: Date.now() - startTime,
                  };
                  const data = `data: ${JSON.stringify(finalAction)}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
              }
            } catch {
              // Ignore parse errors on finalization
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errorData = `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
