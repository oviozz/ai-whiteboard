
import { internalMutation, mutation, query, QueryCtx } from "./_generated/server";
import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";

export const current = query({
    args: {},
    handler: async (ctx) => {
        return await getCurrentUser(ctx);
    },
});

export const upsertFromClerk = internalMutation({
    args: {
        data: v.any()
    }, // no runtime validation, trust Clerk
    async handler(ctx, { data }) {
        const clerkUserID = data.id; // This is a string from Clerk
        const userAttributes = {
            email: data?.email_addresses[0].email_address || "",
            firstName: data?.first_name || "",
            lastName: data?.last_name || "", // Handle null/undefined from Clerk
            clerkUserID: clerkUserID, // Store the string from Clerk
        };

        const user = await userByClerkId(ctx, clerkUserID);
        if (user === null) {
            await ctx.db.insert("users", userAttributes);
        } else {
            await ctx.db.patch(user._id, userAttributes);
        }
    },
});

export const deleteFromClerk = internalMutation({
    args: {
        clerkUserId: v.string() // Changed from v.id("users") to v.string()
    },
    async handler(ctx, { clerkUserId }) {
        const user = await userByClerkId(ctx, clerkUserId);
        if (user !== null) {
            await ctx.db.delete(user._id);
        } else {
            console.warn(
                `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
            );
        }
    },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
    const userRecord = await getCurrentUser(ctx);
    if (!userRecord) throw new Error("Can't get current user");
    return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
        return null;
    }
    return await userByClerkId(ctx, identity.subject);
}

async function userByClerkId(ctx: QueryCtx, clerkUserID: string) {
    return await ctx.db
        .query("users")
        .withIndex("byClerkUserID", (q) => q.eq("clerkUserID", clerkUserID))
        .unique();
}

// ============================================
// Tutor Preferences
// ============================================

export const getTutorPreferences = query({
    args: {},
    handler: async (ctx) => {
        const user = await getCurrentUser(ctx);
        if (!user) return null;
        
        return user.tutorPreferences || {
            proactiveHintsEnabled: true,
            hintFrequency: "medium",
            preferredHintStyle: "auto",
            showResourceSuggestions: true,
            idleThresholdMs: 30000,
        };
    },
});

export const updateTutorPreferences = mutation({
    args: {
        preferences: v.object({
            proactiveHintsEnabled: v.optional(v.boolean()),
            hintFrequency: v.optional(v.string()),
            preferredHintStyle: v.optional(v.string()),
            showResourceSuggestions: v.optional(v.boolean()),
            idleThresholdMs: v.optional(v.number()),
        }),
    },
    handler: async (ctx, args) => {
        const user = await getCurrentUser(ctx);
        if (!user) {
            return { success: false, message: "User not found" };
        }

        const currentPrefs = user.tutorPreferences || {
            proactiveHintsEnabled: true,
            hintFrequency: "medium",
            preferredHintStyle: "auto",
            showResourceSuggestions: true,
            idleThresholdMs: 30000,
        };

        const updatedPrefs = {
            ...currentPrefs,
            ...Object.fromEntries(
                Object.entries(args.preferences).filter(([_, v]) => v !== undefined)
            ),
        };

        await ctx.db.patch(user._id, {
            tutorPreferences: updatedPrefs,
        });

        return { success: true, preferences: updatedPrefs };
    },
});