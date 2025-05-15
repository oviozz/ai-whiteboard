import {createGoogleGenerativeAI, GoogleGenerativeAIProvider} from "@ai-sdk/google";
import {internal} from "./_generated/api";
import {action, internalAction, internalMutation} from "./_generated/server";
import {v} from "convex/values";
import {Id} from "./_generated/dataModel";
import {CoreMessage, ImagePart, streamText, TextPart} from "ai";
import {containsWhiteboardTrigger} from "../src/lib/utils";

let googleAIClient: GoogleGenerativeAIProvider | null = null;

function getGoogleAIClient(): GoogleGenerativeAIProvider {
    if (googleAIClient) {
        return googleAIClient;
    }

    const apiKey = "AIzaSyDym6jnzL_yu_wsgNNfAGDmEkaoCO6kq5U";
    if (!apiKey) {
        console.error("ERROR: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set.");
        throw new Error("AI Service not configured: Missing Google API Key.");
    }
    googleAIClient = createGoogleGenerativeAI({apiKey});
    return googleAIClient;
}


export const generateResponse = action({
    args: {
        whiteboardID: v.id("whiteboards"),
        userMessage: v.string(),
        storageID: v.optional(v.id("_storage"))
    },
    handler: async (ctx, args) => {
        const {whiteboardID, userMessage, storageID} = args;

        try {
            getGoogleAIClient();
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
        const currentGoogleClient = getGoogleAIClient();

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


            const historyMessages: CoreMessage[] = history.map(msg => ({
                role: msg.isBot ? 'assistant' : 'user',
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
                userContent = [
                    { type: "text", text: userMessage } as TextPart,
                    {
                        type: "image",
                        image: imageURL
                    } as ImagePart
                ];
            } else {
                userContent = userMessage;
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
                model: currentGoogleClient('gemini-2.0-flash-exp', {
                    useSearchGrounding: true,
                }), // Or your preferred model
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
