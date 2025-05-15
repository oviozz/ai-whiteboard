import {defineSchema, defineTable} from "convex/server";
import {v} from "convex/values";

export const pathProperties = v.object({
    type: v.literal("path"),
    points: v.array(v.object({x: v.number(), y: v.number()})),
    color: v.string(),
    strokeWidth: v.number(),
    compositeOperation: v.optional(v.string()), // For eraser or special effects
});

export const imageProperties = v.object({
    type: v.literal("image"),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    imageUrl: v.optional(v.string()), // Or v.id("_storage") if using Convex file storage
    storageId: v.id("_storage"),
    // For Convex storage, you'd likely store storageId and resolve to URL on client or in query
});

export const textProperties = v.object({
    type: v.literal("text"),
    x: v.number(),
    y: v.number(),
    text: v.string(),
    color: v.string(),
    fontSize: v.number(),
    fontFamily: v.string(),
});

// Union of all possible element properties
export const elementData = v.union(
    pathProperties,
    imageProperties,
    textProperties,
);

export default defineSchema({
    users: defineTable({
        email: v.string(),
        firstName: v.string(),
        lastName: v.string(),
        clerkUserID: v.string(),
    }).index("byClerkUserID", ["clerkUserID"]),
    whiteboards: defineTable({
        userID: v.string(),
        topic: v.string(),
        problem_statement: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
    }).index("byUserID", ["userID"]),

    whiteboardElements: defineTable({
        whiteboardID: v.id("whiteboards"),
        element: elementData, // Stores the specific data for the element
        order: v.number(), // For z-index or rendering order
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("byWhiteboardID", ["whiteboardID"])
        .index("byWhiteboardID_order", ["whiteboardID", "order"]),

    whiteboardChatBot: defineTable({
        whiteboardID: v.id("whiteboards"),
        isBot: v.boolean(),
        text: v.string(),
        imageURL: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
    })
        .index("byWhiteboardIDCreatedAt", ["whiteboardID", "createdAt"]),
});

