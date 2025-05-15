import {query, mutation, internalQuery, internalMutation} from "./_generated/server";
import {v} from "convex/values";
import {elementData as elementDataSchema} from "./schema";
import {internal} from "./_generated/api";


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
    },
    handler: async (ctx, args) => {
        const {whiteboardID, text} = args;

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
                    color: "#000000",
                    fontFamily: "Arial",
                    fontSize: 26,
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