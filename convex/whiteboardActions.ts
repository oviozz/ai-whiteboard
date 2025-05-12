
// convex/whiteboardActions.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { elementData as elementDataSchema } from "./schema";

export const getWhiteboardContent = query({
    args: { whiteboardID: v.optional(v.id("whiteboards")) },
    handler: async (ctx, args) => {
        const { whiteboardID } = args;

        if (!whiteboardID) {
            return { whiteboard: null, elements: [], status: "id_missing" as const };
        }

        const whiteboard = await ctx.db.get(whiteboardID);
        if (!whiteboard) {
            console.warn(`Whiteboard not found in DB: ${whiteboardID}`);
            return { whiteboard: null, elements: [], status: "not_found" as const };
        }

        const elements = await ctx.db
            .query("whiteboardElements")
            .withIndex("byWhiteboardID_order", q => q.eq("whiteboardID", whiteboard._id))
            .collect();
        return { whiteboard, elements, status: "success" as const };
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
            await ctx.db.patch(args.whiteboardID, { updatedAt: Date.now().toString() });
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
        const { elementID, updates } = args;
        const existingElement = await ctx.db.get(elementID);
        if (!existingElement) {
            console.error(`Element not found for update: ${elementID}`);
            throw new Error(`Element ${elementID} not found`);
        }

        await ctx.db.patch(elementID, { ...updates, updatedAt: Date.now().toString() });
        const whiteboard = await ctx.db.get(existingElement.whiteboardID);
        if (whiteboard) {
            await ctx.db.patch(existingElement.whiteboardID, { updatedAt: Date.now().toString() });
        } else {
            console.warn(`Whiteboard ${existingElement.whiteboardID} not found when trying to update timestamp after updating element.`);
        }
        return existingElement._id;
    },
});

export const deleteElement = mutation({
    args: { elementID: v.id("whiteboardElements") },
    handler: async (ctx, args) => {
        const existingElement = await ctx.db.get(args.elementID);
        if (!existingElement) {
            console.error(`Element not found for deletion: ${args.elementID}`);
            throw new Error(`Element ${args.elementID} not found for deletion`);
        }
        await ctx.db.delete(args.elementID);
        const whiteboard = await ctx.db.get(existingElement.whiteboardID);
        if(whiteboard){
            await ctx.db.patch(existingElement.whiteboardID, { updatedAt: Date.now().toString() });
        }
        return existingElement._id;
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

        if (elements_items.length === 0){
            return { success: false, message: "There is nothing to clear" }
        }

        await Promise.all(
            elements_items.map(item => ctx.db.delete(item._id))
        );

        return { success: true, message: 'Whiteboard has been cleared'}
    }
})