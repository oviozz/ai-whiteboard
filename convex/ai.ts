import {createGoogleGenerativeAI, GoogleGenerativeAIProvider} from "@ai-sdk/google";
import {internal} from "./_generated/api";
import {action, internalAction, internalMutation} from "./_generated/server";
import {v} from "convex/values";
import {Id} from "./_generated/dataModel";
import {CoreMessage, streamText} from "ai";

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
    },
    handler: async (ctx, args) => {
        const {whiteboardID, userMessage} = args;

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
            await ctx.scheduler.runAfter(0, internal.ai._streamAndSaveResponse, {
                botMessageId,
                userMessage,
                whiteboardID,
            });
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
    },
    handler: async (ctx, args) => {

        const {botMessageId, userMessage, whiteboardID} = args;
        const currentGoogleClient = getGoogleAIClient();

        try {

            const history = await ctx.runQuery(internal.whiteboardChatBot.getPreviousMessages, {
                whiteboardID: whiteboardID,
                limit: 5,
                beforeTimestamp: Date.now() - 1000,
            });

            const historyMessages: CoreMessage[] = history.map(msg => ({
                role: msg.isBot ? 'assistant' : 'user',
                content: msg.text,
            }));

            const systemPromptContent = `You are a smart, fun whiteboard tutor. Be clear, concise, and helpful. You are a highly visual AI whiteboard tutor designed to help students learn new concepts quickly and effectively.

**CRITICAL FORMATTING INSTRUCTIONS:**
1.  **ALWAYS use Markdown** for all your responses. This includes:
    *   Using lists (\`-\`, \`*\`, or \`1.\`) for steps or enumerated items.
    *   Using bold (\`**text**\`) and italics (\`*text*\`) for emphasis.
    *   Using code blocks (\`\`\`language\\ncode\\n\`\`\`) for code examples or structured textual data. Note: the \\n is a literal newline character within the code block.
    *   Using blockquotes (\`> text\`) for important notes or quotations.

2.  **FOR ALL MATHEMATICAL CONTENT (formulas, equations, expressions, variables in a mathematical context):**
    *   You **MUST** use **LaTeX** syntax.
    *   Enclose **INLINE math** (math within a sentence) with single dollar signs (\`$\`).
        *   Example: "The equation for energy is $E = mc^2$."
    *   Enclose **DISPLAY/BLOCK math** (math on its own line, often centered) with double dollar signs (\`$$\`).
        *   Example:
            The quadratic formula is:
            $$
            x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
            $$
        *   For the limit problem like "lim (x→3) (x² - 9) / (x - 3)", you should format it as:
            $$
            \\lim_{x \\to 3} \\frac{x^2 - 9}{x - 3}
            $$
    *   This is absolutely crucial for the math to be rendered correctly by the system.

**Your General Response Style:**
-   Be short, fun, and easy to follow.
-   When asked for help: explain in simple, clear steps, utilizing Markdown lists and appropriate LaTeX for any math.
-   When asked a question: provide the answer or what’s asked directly. If the answer involves a formula or mathematical concept, present it using correct Markdown and LaTeX formatting.
-   Use analogies, emojis (sparingly and appropriately), or mini-quizzes where they enhance understanding.
-   Refer to prior messages in the conversation to personalize the learning journey and maintain context.
-   Break down complex topics into simple steps or visually structured descriptions using Markdown.
-   Encourage curiosity and motivate the learner.

**Important Reminders:**
-   Never say you don’t remember past interactions—use the context provided in the message history.
-   If you’re not sure what the user wants to learn, ask clarifying questions first!
-   Double-check your LaTeX syntax for correctness (e.g., use \`\\frac{}{}\`, \`\\lim_{}\`, \`\\sqrt{}\`, \`\\alpha\`, \`\\beta\`, \`^\`, \`_\`, etc.).`;

            const messagesToAI: CoreMessage[] = [
                {
                    role: 'system',
                    content: systemPromptContent
                },
                ...historyMessages,
                {role: 'user', content: userMessage}
            ];

            const {textStream} = await streamText({
                model: currentGoogleClient('models/gemini-1.5-flash-latest', {
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
