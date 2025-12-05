import {internal} from "./_generated/api";
import {action, internalAction, internalMutation, mutation, query} from "./_generated/server";
import {v} from "convex/values";
import {Id} from "./_generated/dataModel";
import {CoreMessage, ImagePart, streamText, TextPart, generateText} from "ai";
import {containsWhiteboardTrigger} from "../src/lib/utils";
import {getGatewayModel, getGatewayClient} from "../src/lib/gateway-client";

export const generateResponse = action({
    args: {
        whiteboardID: v.id("whiteboards"),
        userMessage: v.string(),
        storageID: v.optional(v.id("_storage"))
    },
    handler: async (ctx, args) => {
        const {whiteboardID, userMessage, storageID} = args;

        try {
            getGatewayClient();
        } catch (error: any) {
            console.error("Failed to initialize AI client:", error.message);
            return {success: false, error: error.message || "AI service is not configured."};
        }

        let botMessageId: Id<"whiteboardChatBot">;
        try {
            botMessageId = await ctx.runMutation(internal.ai._createBotMessageEntry, {
                whiteboardID,
                initialText: "...",
            });
        } catch (e: any) {
            console.error("Failed to run _createBotMessageEntry mutation:", e.message);
            return {success: false, error: "Failed to initiate bot response (database error)."};
        }

        try {

            if (storageID){

                const image_url = await ctx.runQuery(internal.whiteboardActions.getInternalImageUrl, {
                    storageId: storageID
                });


                await ctx.scheduler.runAfter(0, internal.ai._streamAndSaveResponse, {
                    botMessageId,
                    userMessage,
                    whiteboardID,
                    imageURL: image_url || undefined
                });

            } else {
                await ctx.scheduler.runAfter(0, internal.ai._streamAndSaveResponse, {
                    botMessageId,
                    userMessage,
                    whiteboardID,
                });
            }
        } catch (e: any) {
            console.error("Failed to schedule _streamAndSaveResponse action:", e.message);
            try {
                await ctx.runMutation(internal.ai._updateBotMessageChunk, {
                    messageId: botMessageId,
                    newText: "Error: AI processing could not be scheduled.",
                });
            } catch (updateError: any) {
                console.error("Failed to update bot message with scheduling error:", updateError.message);
            }
            return {success: false, error: "Failed to schedule AI processing."};
        }


        return {success: true, botMessageId};
    },
});

export const _createBotMessageEntry = internalMutation({
    args: {
        whiteboardID: v.id("whiteboards"),
        initialText: v.string(),
    },
    handler: async (ctx, args): Promise<Id<"whiteboardChatBot">> => {
        return await ctx.db.insert("whiteboardChatBot", {
            whiteboardID: args.whiteboardID,
            text: args.initialText,
            isBot: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const _streamAndSaveResponse = internalAction({
    args: {
        botMessageId: v.id("whiteboardChatBot"),
        userMessage: v.string(),
        whiteboardID: v.id("whiteboards"),
        imageURL: v.optional(v.string()),
    },
    handler: async (ctx, args) => {

        const {botMessageId, userMessage, whiteboardID, imageURL} = args;
        try {

            const [whiteboard, history] = await Promise.all([
                ctx.runQuery(internal.whiteboards.getWhiteboardByID, {
                    whiteboardID
                }),
                ctx.runQuery(internal.whiteboardChatBot.getPreviousMessages, {
                    whiteboardID: whiteboardID,
                    limit: 5,
                    beforeTimestamp: Date.now() - 1000,
                })
            ]);

            if (!whiteboard){
                throw new Error("Whiteboard information cannot be found");
            }

            const { topic, problem_statement } = whiteboard;


            const historyMessages: CoreMessage[] = history.map((msg: { isBot: boolean; text: string }) => ({
                role: msg.isBot ? 'assistant' : 'user' as const,
                content: msg.text,
            }));

            const fuzzyTriggers = [
                "add it to the whiteboard",
                "add it to whiteboard",
                "add this to the whiteboard",
                "save it to whiteboard",
                "insert in whiteboard",
                "display it in whiteboard",
                "put it on the whiteboard",
                "add this to the board",
                "show it on whiteboard",
                "show it in the whiteboard",
                "insert it into the whiteboard",
                "put this on the whiteboard",
                "send it to the whiteboard",
                "place this in whiteboard",
                "give it in the whiteboard",
                "generate a problem and add it",
                "create a problem for the whiteboard"
            ];

            const isProblemRequest = containsWhiteboardTrigger(userMessage, fuzzyTriggers);

            let systemPromptContent = `You are a highly visual, concise whiteboard tutor for ${topic}${problem_statement ? ` focused on: "${problem_statement}"` : ''}. Your answers are extremely brief and direct - never verbose.

            **RESPONSE RULES (CRITICAL):**
            - Keep ALL responses under 5 sentences
            - Give ONLY what was specifically asked for
            - Never provide lengthy explanations unless explicitly requested
            - Prioritize visual representations over text whenever possible
            - Use visuals + minimal text instead of paragraphs of explanation
            - NEVER provide solutions to problems until explicitly asked to do so
            - For practice problems, give ONLY the problem statement first, wait for the user to attempt it
            
            **FORMAT YOUR RESPONSES WITH:**
            1. **Markdown** for structure:
               * Lists for steps
               * Bold for key points
               * Code blocks for structured data
               * Blockquotes for important notes
            
            2. **LaTeX** for ALL math:
               * Inline: $E = mc^2$
               * Display: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$
            
            **RESPONSE TYPES:**
            - **Questions:** Give the direct answer only, not explanation
            - **Problems:** Present the problem clearly WITHOUT solution steps. Only provide solution when user explicitly asks "show solution" or similar
            - **Concepts:** Use visual diagram + 2-3 sentence explanation maximum
            
            Remember:
            - You are expert in ${topic}${problem_statement ? ` specifically for "${problem_statement}"` : ''}
            - Always favor visual clarity over detailed text
            - Stay strictly focused on what was asked - nothing more
            - Wait for user to request solutions - don't solve problems automatically
            
            `;

            if (isProblemRequest) {
                systemPromptContent += `
                **IMPORTANT FOR PROBLEMS:**
                - When you generate a problem, ALWAYS say "I'll add this problem to your whiteboard:" followed by the problem
                - Always format your response as: "I'll add this problem to your whiteboard: [PROBLEM TEXT]"
                - Make sure to include the exact phrase "add this problem to your whiteboard" or "save this to your whiteboard"
                `
            }


            let userContent: string | Array<TextPart | ImagePart> = userMessage;

            if (imageURL) {
                // Pass URL directly - Convex storage URLs are publicly accessible
                userContent = [
                    { type: "text", text: userMessage } as TextPart,
                    {
                        type: "image",
                        image: new URL(imageURL)
                    } as ImagePart
                ];
            }


            const messagesToAI: CoreMessage[] = [
                {
                    role: 'system',
                    content: systemPromptContent
                },
                ...historyMessages,
                {
                    role: 'user',
                    content: userContent
                }
            ];

            const {textStream} = await streamText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages: messagesToAI,
            });

            let accumulatedText = "";
            let lastUpdateTime = 0;
            const updateDebounceMs = 300;

            for await (const textPart of textStream) {
                accumulatedText += textPart;
                const now = Date.now();
                if (now - lastUpdateTime > updateDebounceMs) {
                    await ctx.runMutation(internal.ai._updateBotMessageChunk, {
                        messageId: botMessageId,
                        newText: accumulatedText,
                    });
                    lastUpdateTime = now;
                }
            }

            await ctx.runMutation(internal.ai._updateBotMessageChunk, {
                messageId: botMessageId,
                newText: accumulatedText.trim() === "" ? "Sorry, I couldn't generate a response for that." : accumulatedText,
            });

            if (isProblemRequest){
                const parse_question = accumulatedText.replace(
                    `I'll add this problem to your whiteboard:`,
                    ""
                );

                await ctx.runMutation(internal.whiteboardActions.addRandomText, {
                    whiteboardID,
                    text: parse_question || accumulatedText,
                });
            }

        } catch (error: any) {
            console.error(`Error streaming AI response for botMessageId ${botMessageId}:`, error.message);
            const errorMessage = error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID")
                ? "AI Service Error: Invalid API Key."
                : "Sorry, an unexpected error occurred while generating a response.";

            try {
                await ctx.runMutation(internal.ai._updateBotMessageChunk, {
                    messageId: botMessageId,
                    newText: errorMessage,
                });
            } catch (dbError: any) {
                console.error("Failed to update bot message with error text:", dbError.message);
            }
        }
    },
});

export const _updateBotMessageChunk = internalMutation({
    args: {
        messageId: v.id("whiteboardChatBot"),
        newText: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.messageId, {
            text: args.newText,
            updatedAt: Date.now(),
        });
    },
});

// ============================================
// Proactive Tutor Analysis
// ============================================

export type GuidedStep = {
    stepNumber: number;
    instruction: string;
    hint?: string;
};

export type VideoSuggestion = {
    title: string;
    description: string;
    searchQuery: string;
    relevanceReason: string;
};

export type WebResource = {
    title: string;
    type: "khan_academy" | "wikipedia" | "interactive_tool" | "article" | "other";
    url?: string;
    searchQuery: string;
    description: string;
};

export type AnalysisResult = {
    status: "correct" | "on_track" | "stuck" | "wrong" | "empty";
    confidence: number; // 0-1
    briefHint?: string; // Short hint for canvas overlay (< 15 words)
    detailedGuidance?: string; // Longer guidance for floating bubble
    hintType: "quick" | "detailed" | "none";
    suggestedAction?: "encourage" | "hint" | "guide" | "wait";
    // New: rich content for helping students
    guidedSteps?: GuidedStep[];
    videoSuggestions?: VideoSuggestion[];
    webResources?: WebResource[];
};

export const analyzeWhiteboardProgress = action({
    args: {
        whiteboardID: v.id("whiteboards"),
        screenshotStorageId: v.id("_storage"),
        activityState: v.string(), // 'active' | 'idle' | 'stuck'
        idleTimeMs: v.number(),
    },
    handler: async (ctx, args): Promise<{ success: boolean; analysis?: AnalysisResult; error?: string }> => {
        const { whiteboardID, screenshotStorageId, activityState, idleTimeMs } = args;

        try {
            // Get whiteboard info and any uploaded documents for context
            const [whiteboard, documents] = await Promise.all([
                ctx.runQuery(internal.whiteboards.getWhiteboardByID, { whiteboardID }),
                ctx.runQuery(internal.documents.getDocumentsByWhiteboardInternal, { whiteboardID }),
            ]);

            if (!whiteboard) {
                return { success: false, error: "Whiteboard not found" };
            }

            // Get screenshot URL
            const screenshotUrl = await ctx.runQuery(internal.whiteboardActions.getInternalImageUrl, {
                storageId: screenshotStorageId,
            });

            if (!screenshotUrl) {
                return { success: false, error: "Could not get screenshot URL" };
            }

            const { topic, problem_statement } = whiteboard;

            // Build context from uploaded documents
            let documentContext = "";
            if (documents && documents.length > 0) {
                type DocType = { extractedProblems?: Array<{ text: string; addedToBoard: boolean }> };
                type ProblemType = { text: string; addedToBoard: boolean };
                const problemsFromDocs = (documents as DocType[])
                    .filter((d: DocType) => d.extractedProblems && d.extractedProblems.length > 0)
                    .flatMap((d: DocType) => d.extractedProblems || [])
                    .filter((p: ProblemType) => p.addedToBoard)
                    .map((p: ProblemType) => p.text)
                    .join("\n\n");
                
                if (problemsFromDocs) {
                    documentContext = `\n\nProblems the student is working on:\n${problemsFromDocs}`;
                }
            }

            const systemPrompt = `You are an expert educational tutor analyzing a student's work on a whiteboard. Your job is to:
1. Carefully check ALL mathematical calculations, equations, and logical steps for errors
2. Identify if they're stuck or making mistakes
3. Provide helpful, encouraging guidance with hints when needed

**Context:**
- Topic: ${topic}
${problem_statement ? `- Problem/Focus: ${problem_statement}` : ""}
- Student activity: ${activityState} (idle for ${Math.round(idleTimeMs / 1000)}s)
${documentContext}

**CRITICAL - Error Detection:**
- CAREFULLY verify ALL arithmetic: additions, subtractions, multiplications, divisions
- Check if equations are mathematically correct (e.g., "2+2=5" is WRONG)
- Look for sign errors, calculation mistakes, wrong formulas
- If ANY error is found, status MUST be "wrong" and you MUST provide a hint

**Analysis Guidelines:**
- "empty": Whiteboard is blank or has minimal/irrelevant content
- "correct": Work is mathematically/logically correct and complete
- "on_track": Work is partially done but correct so far
- "wrong": ANY mathematical error, wrong answer, or incorrect step - ALWAYS provide briefHint
- "stuck": Student seems stuck (idle + incomplete work)

**Response Format (JSON only):**
{
  "status": "correct" | "on_track" | "stuck" | "wrong" | "empty",
  "confidence": 0.0-1.0,
  "briefHint": "REQUIRED if status is wrong/stuck. Short hint under 15 words pointing to the issue",
  "detailedGuidance": "More detailed help, 2-3 sentences max",
  "hintType": "quick" | "detailed" | "none",
  "suggestedAction": "encourage" | "hint" | "guide" | "wait",
  "guidedSteps": [
    { "stepNumber": 1, "instruction": "Step instruction", "hint": "Optional hint" }
  ],
  "videoSuggestions": [
    { "title": "Video title", "description": "Why helpful", "searchQuery": "YouTube search", "relevanceReason": "Reason" }
  ],
  "webResources": [
    { "title": "Resource name", "type": "khan_academy|wikipedia|interactive_tool|article|other", "searchQuery": "Search query", "description": "What they learn" }
  ]
}

**MANDATORY RULES:**
1. If status is "wrong", hintType MUST be "quick" or "detailed", and briefHint MUST be provided
2. If status is "stuck", hintType MUST be "quick" or "detailed", and briefHint MUST be provided
3. For wrong answers, hint should point to WHERE the error is without giving the answer
4. Example: For "2+2=5", briefHint could be "Check your addition - what is 2+2?"

**Hint Guidelines:**
- "none": ONLY when status is "correct", "on_track", or "empty"
- "quick": For small errors - use for most "wrong" cases
- "detailed": For bigger conceptual issues

**Important:**
- Be encouraging but ALWAYS catch errors
- Don't give away answers - guide toward discovery
- Return ONLY valid JSON, no other text`;

            // Pass URL directly - Convex storage URLs are publicly accessible
            // The AI SDK and Gemini can fetch URLs directly
            const userContent: Array<TextPart | ImagePart> = [
                { type: "text", text: "Analyze this student's whiteboard work and provide guidance:" },
                { type: "image", image: new URL(screenshotUrl) },
            ];

            const messages: CoreMessage[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
            ];

            const { text } = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages,
            });

            // Parse the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("Could not parse AI analysis response:", text);
                return { success: false, error: "Invalid AI response format" };
            }

            const analysis: AnalysisResult = JSON.parse(jsonMatch[0]);

            // Update tutor state in database
            await ctx.runMutation(internal.ai._updateTutorState, {
                whiteboardID,
                status: analysis.status,
                hint: analysis.hintType !== "none" ? {
                    type: analysis.hintType,
                    content: analysis.briefHint || analysis.detailedGuidance || "",
                } : undefined,
            });

            return { success: true, analysis };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Whiteboard analysis error:", errorMessage);
            return { success: false, error: errorMessage };
        }
    },
});

export const _updateTutorState = internalMutation({
    args: {
        whiteboardID: v.id("whiteboards"),
        status: v.string(),
        hint: v.optional(v.object({
            type: v.string(),
            content: v.string(),
        })),
    },
    handler: async (ctx, args) => {
        const { whiteboardID, status, hint } = args;
        
        // Check if tutor state exists
        const existing = await ctx.db
            .query("whiteboardTutorState")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", whiteboardID))
            .first();

        const now = Date.now();

        if (existing) {
            await ctx.db.patch(existing._id, {
                lastAnalysis: now,
                analysisCount: existing.analysisCount + 1,
                currentStatus: status,
                pendingHint: hint ? {
                    type: hint.type,
                    content: hint.content,
                } : undefined,
                lastActivity: now,
            });
        } else {
            await ctx.db.insert("whiteboardTutorState", {
                whiteboardID,
                lastAnalysis: now,
                analysisCount: 1,
                currentStatus: status,
                pendingHint: hint ? {
                    type: hint.type,
                    content: hint.content,
                } : undefined,
                hintsShown: 0,
                lastActivity: now,
            });
        }
    },
});

export const getTutorState = query({
    args: { whiteboardID: v.id("whiteboards") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("whiteboardTutorState")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", args.whiteboardID))
            .first();
    },
});

export const dismissHint = mutation({
    args: { whiteboardID: v.id("whiteboards") },
    handler: async (ctx, args) => {
        const state = await ctx.db
            .query("whiteboardTutorState")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", args.whiteboardID))
            .first();

        if (state && state.pendingHint) {
            await ctx.db.patch(state._id, {
                pendingHint: {
                    ...state.pendingHint,
                    dismissedAt: Date.now(),
                },
                hintsShown: state.hintsShown + 1,
            });
        }

        return { success: true };
    },
});

export const clearPendingHint = mutation({
    args: { whiteboardID: v.id("whiteboards") },
    handler: async (ctx, args) => {
        const state = await ctx.db
            .query("whiteboardTutorState")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", args.whiteboardID))
            .first();

        if (state) {
            await ctx.db.patch(state._id, {
                pendingHint: undefined,
            });
        }

        return { success: true };
    },
});

// ============================================
// Agent Response - Structured Actions
// ============================================

export type AgentActionType = 
  | { type: 'createShape'; shapeType: 'geo' | 'text' | 'note' | 'arrow'; props: Record<string, unknown> }
  | { type: 'draw'; props: { points: Array<{ x: number; y: number }>; color?: string; size?: string } }
  | { type: 'deleteShape'; shapeId: string }
  | { type: 'updateShape'; shapeId: string; props: Record<string, unknown> }
  | { type: 'highlight'; shapeId: string; style: 'error' | 'success' | 'warning' | 'info' }
  | { type: 'think'; content: string }
  | { type: 'message'; content: string };

export type AgentResponseType = {
  thinking?: string;
  thinkingDurationMs?: number;
  actions: AgentActionType[];
  message: string;
  requiresApproval?: boolean;
};

export const generateAgentResponse = action({
  args: {
    whiteboardID: v.id("whiteboards"),
    userMessage: v.string(),
    canvasContext: v.optional(v.string()),
    storageID: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response?: AgentResponseType; botMessageId?: Id<"whiteboardChatBot">; error?: string }> => {
    const { whiteboardID, userMessage, canvasContext, storageID } = args;

    try {
      getGatewayClient();
    } catch (error: any) {
      return { success: false, error: error.message || "AI service not configured." };
    }

    // Create a bot message entry for the text response
    let botMessageId: Id<"whiteboardChatBot">;
    try {
      botMessageId = await ctx.runMutation(internal.ai._createBotMessageEntry, {
        whiteboardID,
        initialText: "...",
      });
    } catch (e: any) {
      return { success: false, error: "Failed to create message entry." };
    }

    try {
      const [whiteboard, history] = await Promise.all([
        ctx.runQuery(internal.whiteboards.getWhiteboardByID, { whiteboardID }),
        ctx.runQuery(internal.whiteboardChatBot.getPreviousMessages, {
          whiteboardID,
          limit: 5,
          beforeTimestamp: Date.now() - 1000,
        })
      ]);

      if (!whiteboard) {
        throw new Error("Whiteboard not found");
      }

      const { topic, problem_statement } = whiteboard;

      // Build history messages
      const historyMessages: CoreMessage[] = history.map((msg: { isBot: boolean; text: string }) => ({
        role: msg.isBot ? 'assistant' : 'user' as const,
        content: msg.text,
      }));

      // Agent system prompt with action capabilities
      const systemPrompt = `You are an AI assistant that can see and manipulate a whiteboard canvas. You can:
1. Create shapes (rectangles, circles, text, notes, arrows)
2. Draw freehand
3. Highlight shapes to point out errors or successes
4. Provide educational guidance

**Context:**
- Topic: ${topic}
${problem_statement ? `- Problem: ${problem_statement}` : ""}
${canvasContext ? `\n**Current Canvas State:**\n${canvasContext}` : ""}

**RESPONSE FORMAT (JSON only):**
{
  "thinking": "Your reasoning process - what you're analyzing and why (2-3 sentences)",
  "actions": [
    // For drawing shapes:
    { "type": "createShape", "shapeType": "geo", "props": { "geo": "ellipse", "x": 100, "y": 100, "w": 50, "h": 50, "color": "red", "fill": "none" } },
    // For text:
    { "type": "createShape", "shapeType": "text", "props": { "x": 100, "y": 200, "text": "Hello!", "color": "black" } },
    // For notes:
    { "type": "createShape", "shapeType": "note", "props": { "x": 100, "y": 300, "text": "Remember this!", "color": "yellow" } },
    // For arrows:
    { "type": "createShape", "shapeType": "arrow", "props": { "startX": 100, "startY": 100, "endX": 200, "endY": 200, "color": "black" } },
    // For highlighting existing shapes:
    { "type": "highlight", "shapeId": "shape:abc123", "style": "error" }
  ],
  "message": "Your response to the user explaining what you did",
  "requiresApproval": true
}

**ACTION GUIDELINES:**
- For "draw a circle": use createShape with geo: "ellipse"
- For "draw a rectangle": use createShape with geo: "rectangle"
- For "highlight the error": use highlight with style: "error"
- For "point to": use createShape with shapeType: "arrow"
- Colors: "black", "red", "blue", "green", "orange", "yellow", "violet"
- Set requiresApproval: true for canvas changes (lets user accept/reject)
- Set requiresApproval: false for just explanations

**IMPORTANT:**
- Return ONLY valid JSON, no other text
- Keep thinking brief (2-3 sentences)
- Keep message concise and helpful
- Position shapes relative to existing content when possible`;

      // Prepare user content with optional image
      let userContent: string | Array<TextPart | ImagePart> = userMessage;

      if (storageID) {
        const imageUrl = await ctx.runQuery(internal.whiteboardActions.getInternalImageUrl, {
          storageId: storageID,
        });

        if (imageUrl) {
          // Pass URL directly - Convex storage URLs are publicly accessible
          userContent = [
            { type: "text", text: userMessage } as TextPart,
            { type: "image", image: new URL(imageUrl) } as ImagePart,
          ];
        }
      }

      const messages: CoreMessage[] = [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: userContent },
      ];

      const startTime = Date.now();
      const { text } = await generateText({
        model: getGatewayModel("google/gemini-2.0-flash"),
        messages,
      });
      const thinkingDurationMs = Date.now() - startTime;

      // Parse the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Fall back to regular text response
        await ctx.runMutation(internal.ai._updateBotMessageChunk, {
          messageId: botMessageId,
          newText: text,
        });
        return {
          success: true,
          response: {
            actions: [],
            message: text,
            requiresApproval: false,
          },
          botMessageId,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as AgentResponseType;
      parsed.thinkingDurationMs = thinkingDurationMs;

      // Update bot message with the text response
      await ctx.runMutation(internal.ai._updateBotMessageChunk, {
        messageId: botMessageId,
        newText: parsed.message || "I've prepared some changes for your canvas.",
      });

      return {
        success: true,
        response: parsed,
        botMessageId,
      };

    } catch (error: any) {
      console.error("Agent response error:", error.message);
      
      try {
        await ctx.runMutation(internal.ai._updateBotMessageChunk, {
          messageId: botMessageId,
          newText: "Sorry, I encountered an error processing your request.",
        });
      } catch {}

      return { success: false, error: error.message };
    }
    },
});

// ============================================
// Simple Test Action - to verify LLM is working
// ============================================
export const testLLM = action({
    args: {},
    handler: async (): Promise<{ success: boolean; response?: string; error?: string }> => {
        try {
            console.log("Testing LLM with AI Gateway...");
            
            const result = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages: [
                    { role: "user", content: "Say 'Hello! The LLM is working correctly.' and nothing else." }
                ],
            });

            console.log("LLM Response text:", result.text);

            return { 
                success: true, 
                response: result.text || "(empty response)"
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("LLM Test Error:", errorMessage);
            return { success: false, error: errorMessage };
        }
    },
});
