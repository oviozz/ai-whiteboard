/**
 * AI Tutor Review Endpoint
 * 
 * Lightweight endpoint for proactive work review.
 * Focused on identifying errors and providing hints.
 * Returns: status, hint text, and optional position.
 */

import { streamText, type CoreMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { getGatewayModel } from "@/lib/gateway-client";

// Shape type for context
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
}

// Request body type
interface ReviewRequest {
  shapes: SimplifiedShape[];
  viewportBounds: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  screenshot?: string;
}

// Video suggestion type
interface VideoSuggestion {
  title: string;
  description: string;
  searchQuery: string;
  relevanceReason: string;
}

// Response type
interface ReviewResponse {
  status: "correct" | "on_track" | "needs_help" | "error" | "empty";
  hint?: string;
  hintType?: "quick" | "detailed";
  position?: { x: number; y: number };
  confidence: number;
  video?: VideoSuggestion;
}

// Build the review-focused system prompt
function buildReviewPrompt(request: ReviewRequest): string {
  const shapesDescription = request.shapes.length > 0
    ? `Canvas has ${request.shapes.length} shape(s):\n${request.shapes.map(s => {
        let desc = `- ${s._type} at (${Math.round(s.x)}, ${Math.round(s.y)})`;
        if (s.text) {
          const truncated = s.text.length > 80 ? s.text.slice(0, 80) + "..." : s.text;
          desc += `: "${truncated}"`;
        }
        return desc;
      }).join("\n")}`
    : "Canvas is empty.";

  return `You are an AI tutor reviewing a student's work on a whiteboard. Your job is to:
1. Quickly assess if the student is on track
2. Identify any errors or misconceptions
3. Provide helpful, encouraging hints when needed

**Guidelines:**
- Be encouraging, not critical
- Provide hints that guide without giving away the answer
- Only flag clear errors, not style preferences
- If work looks correct, confirm it
- If canvas is empty or just has random shapes, say it's on track

**Response Format:**
You MUST respond with valid JSON only:
{
  "status": "correct" | "on_track" | "needs_help" | "error" | "empty",
  "hint": "Brief helpful hint if status is needs_help or error",
  "hintType": "quick" | "detailed",
  "confidence": 0.0-1.0,
  "video": {
    "title": "Short video title",
    "description": "Why this video helps",
    "searchQuery": "YouTube search query to find helpful video",
    "relevanceReason": "How this relates to the problem"
  }
}

Note: Only include "video" if status is "needs_help" or "error" and a video would actually help. The searchQuery should be a real YouTube search term that would find educational content about the topic.

**Status meanings:**
- "correct": Work is mathematically/logically correct
- "on_track": Work is in progress and looks reasonable
- "needs_help": Student might benefit from a hint
- "error": Clear mistake that should be addressed
- "empty": No meaningful work to review

**Current Canvas:**
${shapesDescription}

Analyze the canvas content and provide your assessment. Be concise.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReviewRequest;

    // Quick check: if no shapes, return empty immediately
    if (!body.shapes || body.shapes.length === 0) {
      return NextResponse.json({
        status: "empty",
        confidence: 1.0,
      } satisfies ReviewResponse);
    }

    // Check if there's any meaningful content (text shapes with content)
    const hasContent = body.shapes.some(
      (s) => s.text && s.text.trim().length > 0
    );

    if (!hasContent) {
      // Just shapes without text content - probably just drawings
      return NextResponse.json({
        status: "on_track",
        confidence: 0.8,
      } satisfies ReviewResponse);
    }

    const systemPrompt = buildReviewPrompt(body);

    // Build user message with optional screenshot
    const userMessage: CoreMessage = {
      role: "user",
      content: body.screenshot
        ? [
            {
              type: "text" as const,
              text: "Review the student's work shown in the canvas. Provide your assessment.",
            },
            {
              type: "image" as const,
              image: body.screenshot,
            },
          ]
        : "Review the student's work shown in the canvas. Provide your assessment.",
    };

    // Use a fast model for reviews
    const { textStream } = streamText({
      model: getGatewayModel("google/gemini-2.0-flash"),
      system: systemPrompt,
      messages: [userMessage],
    });

    // Collect the full response
    let fullResponse = "";
    for await (const chunk of textStream) {
      fullResponse += chunk;
    }

    // Parse the JSON response
    try {
      // Clean up the response (remove markdown code blocks if present)
      const cleanResponse = fullResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const result = JSON.parse(cleanResponse) as ReviewResponse;

      // Validate and ensure required fields
      const response: ReviewResponse = {
        status: result.status || "on_track",
        confidence: result.confidence || 0.5,
        ...(result.hint && { hint: result.hint }),
        ...(result.hintType && { hintType: result.hintType }),
        ...(result.position && { position: result.position }),
        ...(result.video && { video: result.video }),
      };

      return NextResponse.json(response);
    } catch (parseError) {
      console.error("Failed to parse review response:", parseError);
      // Default to on_track if parsing fails
      return NextResponse.json({
        status: "on_track",
        confidence: 0.3,
      } satisfies ReviewResponse);
    }
  } catch (error) {
    console.error("Review API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
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

