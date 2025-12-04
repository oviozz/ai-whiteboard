import { v } from "convex/values";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getGatewayModel } from "../src/lib/gateway-client";
import { CoreMessage, generateText, TextPart } from "ai";

// ============================================
// Types
// ============================================

export type VideoSuggestion = {
    title: string;
    description: string;
    searchQuery: string; // Query to search on YouTube
    relevanceReason: string;
};

export type WebResource = {
    title: string;
    type: "khan_academy" | "wikipedia" | "interactive_tool" | "article" | "other";
    url?: string;
    searchQuery: string;
    description: string;
};

export type GuidedStep = {
    stepNumber: number;
    instruction: string;
    hint?: string;
    isCompleted: boolean;
};

// ============================================
// Queries
// ============================================

export const getGuidedSteps = query({
    args: { whiteboardID: v.id("whiteboards") },
    handler: async (ctx, args) => {
        const state = await ctx.db
            .query("whiteboardTutorState")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", args.whiteboardID))
            .first();
        
        // For now, guided steps would be stored in the hint content as JSON
        // In a full implementation, you'd have a separate table
        return state?.pendingHint?.content || null;
    },
});

// ============================================
// Actions
// ============================================

export const generateGuidedSteps = action({
    args: {
        whiteboardID: v.id("whiteboards"),
        problemText: v.string(),
        currentProgress: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ success: boolean; steps?: GuidedStep[]; error?: string }> => {
        try {
            // Get whiteboard context
            const whiteboard = await ctx.runQuery(internal.whiteboards.getWhiteboardByID, {
                whiteboardID: args.whiteboardID,
            });

            if (!whiteboard) {
                return { success: false, error: "Whiteboard not found" };
            }

            const { topic } = whiteboard;

            const systemPrompt = `You are an expert tutor helping a student solve a problem step by step.
Your goal is to GUIDE them through the solution process, NOT give them the answer.

Topic: ${topic}
Problem: ${args.problemText}
${args.currentProgress ? `Student's current progress: ${args.currentProgress}` : ""}

Create a series of guided steps that will help the student work through this problem.
Each step should:
1. Be clear and actionable
2. Guide toward discovery, not give away the answer
3. Include a small hint they can reveal if stuck

Return JSON only:
{
  "steps": [
    {
      "stepNumber": 1,
      "instruction": "Clear instruction for this step",
      "hint": "Optional hint if they get stuck on this step"
    }
  ]
}

Guidelines:
- Start with understanding the problem (identify knowns/unknowns)
- Break complex operations into smaller chunks
- Use Socratic questioning when possible
- Keep steps focused and manageable
- 4-8 steps is usually ideal
- Last step should be checking/verifying the answer`;

            const messages: CoreMessage[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Please create guided steps for solving this problem: ${args.problemText}` },
            ];

            const { text } = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages,
            });

            // Parse response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { success: false, error: "Could not parse AI response" };
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const steps: GuidedStep[] = (parsed.steps || []).map((s: { stepNumber: number; instruction: string; hint?: string }) => ({
                stepNumber: s.stepNumber,
                instruction: s.instruction,
                hint: s.hint,
                isCompleted: false,
            }));

            return { success: true, steps };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Generate guided steps error:", errorMessage);
            return { success: false, error: errorMessage };
        }
    },
});

export const findRelevantVideos = action({
    args: {
        topic: v.string(),
        problem: v.optional(v.string()),
        stuckPoint: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ success: boolean; videos?: VideoSuggestion[]; error?: string }> => {
        try {
            const systemPrompt = `You are a helpful educational assistant. Based on the student's topic and where they're stuck, suggest 2-3 YouTube video searches that would help them.

Topic: ${args.topic}
${args.problem ? `Current problem: ${args.problem}` : ""}
${args.stuckPoint ? `Where they're stuck: ${args.stuckPoint}` : ""}

Return JSON only with video suggestions:
{
  "videos": [
    {
      "title": "Suggested video title/topic",
      "description": "Brief description of what this video would cover",
      "searchQuery": "Exact YouTube search query to find this type of video",
      "relevanceReason": "Why this video would help the student"
    }
  ]
}

Guidelines:
- Suggest videos from reputable educational channels (Khan Academy, 3Blue1Brown, etc.)
- Make search queries specific enough to find relevant content
- Focus on concepts the student is struggling with
- Prefer beginner-friendly explanations unless topic is advanced`;

            const messages: CoreMessage[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Please suggest relevant educational videos for this student." },
            ];

            const { text } = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages,
            });

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { success: false, error: "Could not parse AI response" };
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return { success: true, videos: parsed.videos || [] };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Find videos error:", errorMessage);
            return { success: false, error: errorMessage };
        }
    },
});

export const findWebResources = action({
    args: {
        topic: v.string(),
        problem: v.optional(v.string()),
        concept: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ success: boolean; resources?: WebResource[]; error?: string }> => {
        try {
            const systemPrompt = `You are an educational resource finder. Suggest helpful web resources for a student studying a topic.

Topic: ${args.topic}
${args.problem ? `Problem they're working on: ${args.problem}` : ""}
${args.concept ? `Concept they need help with: ${args.concept}` : ""}

Return JSON with resource suggestions:
{
  "resources": [
    {
      "title": "Resource title",
      "type": "khan_academy" | "wikipedia" | "interactive_tool" | "article" | "other",
      "url": "Direct URL if known (e.g., khan academy topic pages)",
      "searchQuery": "Search query to find this resource",
      "description": "Brief description of what this resource offers"
    }
  ]
}

Resource types to consider:
- Khan Academy courses/lessons for the topic
- Wikipedia articles for conceptual understanding
- Interactive tools (Desmos for math, PhET for physics, etc.)
- Other educational sites (MIT OpenCourseWare, etc.)

Provide 3-4 diverse resources that complement each other.`;

            const messages: CoreMessage[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Please suggest helpful learning resources for this student." },
            ];

            const { text } = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages,
            });

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { success: false, error: "Could not parse AI response" };
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return { success: true, resources: parsed.resources || [] };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Find resources error:", errorMessage);
            return { success: false, error: errorMessage };
        }
    },
});

// Combined action to get all suggestions at once
export const getLearningSuggestions = action({
    args: {
        whiteboardID: v.id("whiteboards"),
        stuckPoint: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        error?: string;
        videos?: VideoSuggestion[];
        resources?: WebResource[];
    }> => {
        try {
            const whiteboard = await ctx.runQuery(internal.whiteboards.getWhiteboardByID, {
                whiteboardID: args.whiteboardID,
            });

            if (!whiteboard) {
                return { success: false, error: "Whiteboard not found" };
            }

            const topic: string = whiteboard.topic;
            const problem_statement: string | undefined = whiteboard.problem_statement;

            // Run video and resource searches in parallel
            const [videosResult, resourcesResult] = await Promise.all([
                ctx.runAction(internal.resources.findRelevantVideos_internal, {
                    topic,
                    problem: problem_statement,
                    stuckPoint: args.stuckPoint,
                }),
                ctx.runAction(internal.resources.findWebResources_internal, {
                    topic,
                    problem: problem_statement,
                    concept: args.stuckPoint,
                }),
            ]) as [
                { success: boolean; videos?: VideoSuggestion[] },
                { success: boolean; resources?: WebResource[] }
            ];

            return {
                success: true,
                videos: videosResult.success ? videosResult.videos : [],
                resources: resourcesResult.success ? resourcesResult.resources : [],
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Get learning suggestions error:", errorMessage);
            return { success: false, error: errorMessage };
        }
    },
});

// Internal versions for parallel execution
import { internalAction } from "./_generated/server";

export const findRelevantVideos_internal = internalAction({
    args: {
        topic: v.string(),
        problem: v.optional(v.string()),
        stuckPoint: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Same implementation as findRelevantVideos
        try {
            const systemPrompt = `You are a helpful educational assistant. Suggest 2-3 YouTube video searches.

Topic: ${args.topic}
${args.problem ? `Problem: ${args.problem}` : ""}
${args.stuckPoint ? `Stuck on: ${args.stuckPoint}` : ""}

Return JSON only:
{
  "videos": [
    {
      "title": "Video title/topic",
      "description": "Brief description",
      "searchQuery": "YouTube search query",
      "relevanceReason": "Why helpful"
    }
  ]
}`;

            const { text } = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Suggest videos." },
                ],
            });

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return { success: false, videos: [] };

            const parsed = JSON.parse(jsonMatch[0]);
            return { success: true, videos: parsed.videos || [] };
        } catch {
            return { success: false, videos: [] };
        }
    },
});

export const findWebResources_internal = internalAction({
    args: {
        topic: v.string(),
        problem: v.optional(v.string()),
        concept: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        try {

            const systemPrompt = `Suggest 3-4 web resources for learning.

Topic: ${args.topic}
${args.problem ? `Problem: ${args.problem}` : ""}
${args.concept ? `Concept: ${args.concept}` : ""}

Return JSON:
{
  "resources": [
    {
      "title": "Resource title",
      "type": "khan_academy" | "wikipedia" | "interactive_tool" | "article" | "other",
      "searchQuery": "Search query",
      "description": "Brief description"
    }
  ]
}`;

            const { text } = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Suggest resources." },
                ],
            });

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return { success: false, resources: [] };

            const parsed = JSON.parse(jsonMatch[0]);
            return { success: true, resources: parsed.resources || [] };
        } catch {
            return { success: false, resources: [] };
        }
    },
});

