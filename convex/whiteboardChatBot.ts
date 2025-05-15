
import {internalQuery, mutation, query} from "./_generated/server";
import {v} from "convex/values";

export const getAllMessages = query({
    args: {
        whiteboardID: v.optional(v.id("whiteboards")),
    },
    handler: async (ctx, args) => {
        const {whiteboardID} = args;

        if (!whiteboardID) {
            return [];
        }

        return await ctx.db
            .query("whiteboardChatBot")
            .withIndex("byWhiteboardIDCreatedAt",
                e => e.eq("whiteboardID", whiteboardID)
            )
            .order("asc")
            .collect()
    }
})

export const sendMessage = mutation({
    args: {
        whiteboardID: v.id("whiteboards"),
        text: v.string(),
    },
    handler: async (ctx, args) => {
        const {whiteboardID, text} = args;


        if (!whiteboardID) {
            return {success: false, message: "Something went wrong! Try Again"}
        }

        if (!text.trim()) {
            return { success: false, message: "Message text cannot be empty." };
        }

        await ctx.db.insert("whiteboardChatBot", {
            whiteboardID,
            text,
            isBot: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        return {success: true}
    }
})


export const getPreviousMessages = internalQuery({
    args: {
        whiteboardID: v.id("whiteboards"),
        limit: v.optional(v.number()),
        beforeTimestamp: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { whiteboardID, limit = 5, beforeTimestamp } = args;

        let query = ctx.db
            .query("whiteboardChatBot")
            .withIndex("byWhiteboardIDCreatedAt", (q) => q.eq("whiteboardID", whiteboardID));

        if (beforeTimestamp !== undefined) {
            query = query.filter((q) => q.lt(q.field("createdAt"), beforeTimestamp));
        }

        const messages = await query
            .order("desc")
            .take(limit);

        return messages.reverse();
    },
});

export const deleteAllWhiteboardMessages = mutation({
    args: {
        whiteboardID: v.id("whiteboards"),
    },
    handler: async (ctx, args) => {

        const chatbot = await ctx.db
            .query("whiteboardChatBot")
            .withIndex("byWhiteboardIDCreatedAt", q => q.eq("whiteboardID", args.whiteboardID))
            .collect()


        await Promise.all(
            chatbot.map(item => ctx.db.delete(item._id)),
        );

        return { success: true, message: "Chat cleared successfully "};
    }
})