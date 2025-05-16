
import {internalQuery, mutation, query} from "./_generated/server";
import {v} from "convex/values";
import {getCurrentUser} from "./users";

export const getWhiteboardID = query({
    args: {
        whiteboardID: v.id("whiteboards")
    },
    handler: async (ctx, args) => {

        const whiteboards = await ctx.db.get(args.whiteboardID);

        return whiteboards
    }
})

export const getWhiteboards = query({
    handler: async (ctx) => {
        const subject = await getCurrentUser(ctx);

        if (!subject){
            return []
        }

        const whiteboards = await ctx.db
            .query("whiteboards")
            .withIndex("byUserID",(q) => {
                return q.eq("userID", subject.clerkUserID);
            })
            .collect();

        return whiteboards || [];
    }
})

export const getWhiteboardByID = internalQuery({
    args: {
        whiteboardID: v.id("whiteboards")
    },
    handler: async (ctx, args) => {

        const whiteboards = await ctx.db.get(args.whiteboardID);

        return whiteboards
    }
})

export const createWhiteboard = mutation({
    args: {
        topic: v.string(),
        problem_statement: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const subject = await getCurrentUser(ctx);

        if (!subject){
            return { success: false, message: "Please try again. Something went wrong!"}
        }

        if (!args.topic) {
            return { success: false, message: 'Topic is not provided' }
        }

        const new_whiteboard = await ctx.db.insert("whiteboards", {
            userID: subject.clerkUserID,
            topic: args.topic,
            problem_statement: args.problem_statement,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        if (!new_whiteboard){
            return { success: false, message: "Couldn't create a new whiteboard" }
        }

        return { success: true, message: "Whiteboard created successfully", new_id: new_whiteboard };
        // schedule after using ai to autofill those data
        // title: args?.name,
        // description: args?.description,
        // topic: args?.topic,
    }
})

export const deleteWhiteboard = mutation({
    args: {
        whiteboardID: v.id("whiteboards")
    },
    handler: async (ctx, args) => {
        const { whiteboardID } = args;

        if (!whiteboardID){
            return { success: false, message: "Whiteboard ID not provided" }
        }

        const elements_items = await ctx.db
            .query("whiteboardElements")
            .withIndex("byWhiteboardID", q => q.eq("whiteboardID", args.whiteboardID))
            .collect();



        const chatbot = await ctx.db
            .query("whiteboardChatBot")
            .withIndex("byWhiteboardIDCreatedAt", q => q.eq("whiteboardID", args.whiteboardID))
            .collect()

        const itemsToDelete = [...elements_items, ...chatbot];

        await Promise.all([
            ...itemsToDelete.map(item => ctx.db.delete(item._id)),
        ]);

        await ctx.db.delete(whiteboardID);


        return { success: true, message: "Whiteboard deleted successfully" }

    }
})