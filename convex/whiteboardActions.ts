import {query, mutation, internalQuery, internalMutation, action} from "./_generated/server";
import {v} from "convex/values";
import {elementData as elementDataSchema} from "./schema";
import {internal} from "./_generated/api";
import {getGoogleAIClient} from "../src/lib/gemini-client";
import {CoreMessage, generateText, ImagePart, streamText, TextPart} from "ai";
import {containsWhiteboardTrigger} from "../src/lib/utils";


export const getWhiteboardContent = query({
    args: {whiteboardID: v.optional(v.id("whiteboards"))},
    handler: async (ctx, args) => {
        const {whiteboardID} = args;

        if (!whiteboardID) {
            return {whiteboard: null, elements: [], status: "id_missing" as const};
        }

        const whiteboard = await ctx.db.get(whiteboardID);
        if (!whiteboard) {
            console.warn(`Whiteboard not found in DB: ${whiteboardID}`);
            return {whiteboard: null, elements: [], status: "not_found" as const};
        }

        const elements = await ctx.db
            .query("whiteboardElements")
            .withIndex("byWhiteboardID_order", q => q.eq("whiteboardID", whiteboard._id))
            .collect();
        return {whiteboard, elements, status: "success" as const};
    },
});

export const addElement = mutation({
    args: {
        whiteboardID: v.id("whiteboards"),
        element: elementDataSchema,
        order: v.number(),
    },
    handler: async (ctx, args) => {
        const elementId = await ctx.db.insert("whiteboardElements", {
            whiteboardID: args.whiteboardID,
            element: args.element,
            order: args.order,
            createdAt: Date.now().toString(),
            updatedAt: Date.now().toString(),
        });
        const whiteboard = await ctx.db.get(args.whiteboardID);
        if (whiteboard) {
            await ctx.db.patch(args.whiteboardID, {updatedAt: Date.now().toString()});
        } else {
            console.warn(`Whiteboard ${args.whiteboardID} not found when trying to update timestamp after adding element.`);
        }
        return elementId;
    },
});

export const updateElement = mutation({
    args: {
        elementID: v.id("whiteboardElements"),
        updates: v.object({
            element: v.optional(elementDataSchema),
            order: v.optional(v.number()),
        }),
    },
    handler: async (ctx, args) => {
        const {elementID, updates} = args;
        const existingElement = await ctx.db.get(elementID);
        if (!existingElement) {
            console.error(`Element not found for update: ${elementID}`);
            throw new Error(`Element ${elementID} not found`);
        }

        await ctx.db.patch(elementID, {...updates, updatedAt: Date.now().toString()});
        const whiteboard = await ctx.db.get(existingElement.whiteboardID);
        if (whiteboard) {
            await ctx.db.patch(existingElement.whiteboardID, {updatedAt: Date.now().toString()});
        } else {
            console.warn(`Whiteboard ${existingElement.whiteboardID} not found when trying to update timestamp after updating element.`);
        }
        return existingElement._id;
    },
});

export const deleteElement = mutation({
    args: {elementID: v.id("whiteboardElements")},
    handler: async (ctx, args) => {
        const existingElement = await ctx.db.get(args.elementID);
        if (!existingElement) {
            return {success: false, message: "Element not found"}
        }
        await ctx.db.delete(args.elementID);
        const whiteboard = await ctx.db.get(existingElement.whiteboardID);
        if (whiteboard) {
            await ctx.db.patch(existingElement.whiteboardID, {updatedAt: Date.now().toString()});
        }
        return {success: true, id: existingElement._id};
    },
});

export const deleteAllElements = mutation({
    args: {
        whiteboardID: v.id("whiteboards")
    },
    handler: async (ctx, args) => {

        const elements_items = await ctx.db
            .query("whiteboardElements")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", args.whiteboardID))
            .collect();

        if (elements_items.length === 0) {
            return {success: false, message: "There is nothing to clear"}
        }


        await Promise.all([
            ...elements_items.map(item => ctx.db.delete(item._id)),
                ...elements_items.map(element => {
                    return element.element.type === "image"
                        ? ctx.storage.delete(element.element.storageId)
                        : Promise.resolve()
                })
            ]
        );

        return {success: true, message: 'Whiteboard has been cleared'}
    }
})

export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

export const getInternalImageUrl = internalQuery({
    args: {storageId: v.id("_storage")},
    handler: async (ctx, args) => {
        const url = await ctx.storage.getUrl(args.storageId);
        if (!url) {
            console.warn(`URL not found for storageId: ${args.storageId}`);
            // Client should handle cases where URL might be null (e.g., file deleted or permissions issue)
        }
        return url;
    },
});

export const getImageUrl = query({
    args: {storageId: v.id("_storage")},
    handler: async (ctx, args) => {
        const url = await ctx.storage.getUrl(args.storageId);
        if (!url) {
            console.warn(`URL not found for storageId: ${args.storageId}`);
            // Client should handle cases where URL might be null (e.g., file deleted or permissions issue)
        }
        return url;
    },
});

// This is an example if you wanted a specific mutation to create an ImageElement
// after the client has uploaded the file and obtained the storageId.
// The generic `addElement` can also be used if the client constructs the `elementData` correctly.
export const addImageElementAfterUpload = mutation({
    args: {
        whiteboardID: v.id("whiteboards"),
        order: v.number(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        storageId: v.id("_storage"),
        // altText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {

        const now = Date.now();

        const elementId = await ctx.db.insert("whiteboardElements", {
            whiteboardID: args.whiteboardID,
            element: {
                type: "image",
                x: args.x,
                y: args.y,
                width: args.width,
                height: args.height,
                storageId: args.storageId,
            },
            order: args.order,
            createdAt: now.toString(),
            updatedAt: now.toString(),
        });

        const whiteboard = await ctx.db.get(args.whiteboardID);
        if (whiteboard) {
            await ctx.db.patch(args.whiteboardID, {updatedAt: now.toString()});
        }
        return elementId;
    },
});

export const addRandomText = internalMutation({
    args: {
        whiteboardID: v.id("whiteboards"),
        text: v.string(),
        fontSize: v.optional(v.number()),
        fontColor: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const {whiteboardID, text, fontSize, fontColor} = args;

        try {

            if (!text) {
                return {success: false, message: 'Text is not given'}
            }

            const x = 400;
            const y = 50;

            const elementId = await ctx.db.insert("whiteboardElements", {
                whiteboardID: whiteboardID,
                element: {
                    type: "text",
                    x,
                    y,
                    text: text,
                    color: fontColor || "#000000",
                    fontFamily: "Arial",
                    fontSize: fontSize || 26,
                },
                order: 0,
                createdAt: Date.now().toString(),
                updatedAt: Date.now().toString(),
            });

            const whiteboard = await ctx.db.get(args.whiteboardID);

            if (whiteboard) {
                await ctx.db.patch(args.whiteboardID, {updatedAt: Date.now().toString()});
            }

            return {
                success: true,
                elementId: elementId,
            };

        } catch (error: any) {
            console.error("Failed to add random text:", error.message);
            return {
                success: false,
                error: error.message || "Failed to add random text element."
            };
        }
    },
});

export const checkWhiteboardElements = internalQuery({
    args: {
        whiteboardID: v.id("whiteboards")
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("whiteboardElements")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", args.whiteboardID))
            .take(1)
    }
})

export const solveItAll = action({
    args: {
        whiteboardID: v.id("whiteboards"),
        storageID: v.id("_storage"),
    },
    handler: async (ctx, args) => {

        const {whiteboardID, storageID} = args;

        const elements_items = await ctx.runQuery(internal.whiteboardActions.checkWhiteboardElements, {
            whiteboardID
        })

        if (elements_items.length === 0) {
            return {success: false, message: "There is nothing there to solve"}
        }



        try {
            const currentGoogleClient = getGoogleAIClient();

            const whiteboard = await ctx.runQuery(internal.whiteboards.getWhiteboardByID, {
                    whiteboardID
                })

            if (!whiteboard){
                return { success: false, message: "Whiteboard not found" }
            }

            const image_url = await ctx.runQuery(internal.whiteboardActions.getInternalImageUrl, {
                storageId: storageID
            });

            const { topic, problem_statement } = whiteboard;

            let systemPromptContent = `You are a highly visual, concise whiteboard tutor that gives best solutions for ${topic}${problem_statement ? ` focused on: "${problem_statement}"` : ''}. Your answers are extremely brief and direct - never verbose.

            **RESPONSE RULES (CRITICAL):**
                - Always solve the questions in the image with clear, step-by-step detailed solutions.
                - Keep each step concise and focused.
                - When the user submits a step, respond with a short, clear explanation:
                  * Confirm if the step is correct or incorrect
                  * Point out errors briefly if any
                  * Provide focused hints or corrections
                - Encourage when steps are correct

            **FORMAT YOUR RESPONSES WITH:**
            1. **Markdown** for structure:
               * Lists for steps
               * Bold for key points
               * Code blocks for structured data
               * Blockquotes for important notes
            
            2. **LaTeX** for ALL math:
               * Inline: $E = mc^2$
               * Display: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$
            
          
            Remember:
            - You are expert in ${topic}${problem_statement ? ` specifically for "${problem_statement}"` : ''}
            - Always favor clarity and brevity
            - You solve the problem and give the best and accurate solution
        `;


            const userContent = [
                { type: "text", text: "Solve this problem and give me the answers step by step" } as TextPart,
                {
                    type: "image",
                    image: image_url
                } as ImagePart
            ];

            const messagesToAI: CoreMessage[] = [
                {
                    role: 'system',
                    content: systemPromptContent
                },
                {
                    role: 'user',
                    content: userContent
                }
            ];

            const generateTextResult = await generateText({
                model: currentGoogleClient('gemini-2.0-flash-exp', ),
                messages: messagesToAI,
            });

            const { text } = generateTextResult;

            if (text){
                await ctx.runMutation(internal.whiteboardActions.addRandomText, {
                    whiteboardID,
                    text: text
                });
            }

            return { success: true, message: "Solved problem successfully" }

        } catch (error: any) {
            console.log(error);
            const errorMessage = error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID")
                ? "AI Service Error: Invalid API Key."
                : "Sorry, an unexpected error occurred while generating a response.";

            try {
                await ctx.runMutation(internal.whiteboardActions.addRandomText, {
                    whiteboardID,
                    text: "Something happened. Try again!",
                    fontSize: 20,
                    fontColor: "red"
                });

            } catch (dbError: any) {
                console.error("Failed to update bot message with error text:", dbError.message);
            }
        }
    }
})
