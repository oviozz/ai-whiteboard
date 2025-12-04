import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getGatewayModel } from "../src/lib/gateway-client";
import { CoreMessage, generateText, ImagePart, TextPart } from "ai";

// ============================================
// Queries
// ============================================

export const getDocumentsByWhiteboard = query({
    args: { whiteboardID: v.id("whiteboards") },
    handler: async (ctx, args) => {
        const docs = await ctx.db
            .query("whiteboardDocuments")
            .withIndex("byWhiteboardID", (q) => q.eq("whiteboardID", args.whiteboardID))
            .collect();
        
        // Include URLs for each document
        return await Promise.all(
            docs.map(async (doc) => ({
                ...doc,
                url: await ctx.storage.getUrl(doc.storageId),
            }))
        );
    },
});

export const getDocumentUrl = query({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

export const getExtractedProblems = query({
    args: { whiteboardID: v.id("whiteboards") },
    handler: async (ctx, args) => {
        const documents = await ctx.db
            .query("whiteboardDocuments")
            .withIndex("byWhiteboardID", (q) => q.eq("whiteboardID", args.whiteboardID))
            .collect();

        const allProblems: Array<{
            documentId: Id<"whiteboardDocuments">;
            filename: string;
            problem: {
                id: string;
                text: string;
                pageNumber?: number;
                difficulty?: string;
                addedToBoard: boolean;
            };
        }> = [];

        for (const doc of documents) {
            if (doc.extractedProblems) {
                for (const problem of doc.extractedProblems) {
                    allProblems.push({
                        documentId: doc._id,
                        filename: doc.filename,
                        problem,
                    });
                }
            }
        }

        return allProblems;
    },
});

// ============================================
// Internal Queries
// ============================================

export const getDocumentById = internalQuery({
    args: { documentId: v.id("whiteboardDocuments") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.documentId);
    },
});

export const getDocumentUrl_internal = internalQuery({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

export const getDocumentsByWhiteboardInternal = internalQuery({
    args: { whiteboardID: v.id("whiteboards") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("whiteboardDocuments")
            .withIndex("byWhiteboardID", (q) => q.eq("whiteboardID", args.whiteboardID))
            .collect();
    },
});

// ============================================
// Mutations
// ============================================

export const createDocumentRecord = mutation({
    args: {
        whiteboardID: v.id("whiteboards"),
        storageId: v.id("_storage"),
        filename: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
    },
    handler: async (ctx, args) => {
        const documentId = await ctx.db.insert("whiteboardDocuments", {
            whiteboardID: args.whiteboardID,
            storageId: args.storageId,
            filename: args.filename,
            fileType: args.fileType,
            fileSize: args.fileSize,
            processingStatus: "pending",
            uploadedAt: Date.now(),
        });

        return documentId;
    },
});

export const deleteDocument = mutation({
    args: { documentId: v.id("whiteboardDocuments") },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.documentId);
        if (!doc) {
            return { success: false, message: "Document not found" };
        }

        // Delete from storage
        try {
            await ctx.storage.delete(doc.storageId);
        } catch (e) {
            console.warn("Failed to delete file from storage:", e);
        }

        // Delete record
        await ctx.db.delete(args.documentId);

        return { success: true, message: "Document deleted" };
    },
});

export const markProblemAddedToBoard = mutation({
    args: {
        documentId: v.id("whiteboardDocuments"),
        problemId: v.string(),
    },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.documentId);
        if (!doc || !doc.extractedProblems) {
            return { success: false };
        }

        const updatedProblems = doc.extractedProblems.map((p) =>
            p.id === args.problemId ? { ...p, addedToBoard: true } : p
        );

        await ctx.db.patch(args.documentId, {
            extractedProblems: updatedProblems,
        });

        return { success: true };
    },
});

// ============================================
// Internal Mutations
// ============================================

export const updateDocumentProcessing = internalMutation({
    args: {
        documentId: v.id("whiteboardDocuments"),
        status: v.string(),
        extractedContent: v.optional(v.string()),
        extractedProblems: v.optional(v.array(v.object({
            id: v.string(),
            text: v.string(),
            pageNumber: v.optional(v.number()),
            difficulty: v.optional(v.string()),
            addedToBoard: v.boolean(),
        }))),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const updates: Record<string, unknown> = {
            processingStatus: args.status,
        };

        if (args.extractedContent !== undefined) {
            updates.extractedContent = args.extractedContent;
        }
        if (args.extractedProblems !== undefined) {
            updates.extractedProblems = args.extractedProblems;
        }
        if (args.error !== undefined) {
            updates.processingError = args.error;
        }

        await ctx.db.patch(args.documentId, updates);
    },
});

// ============================================
// Actions
// ============================================

export const processDocument = action({
    args: { documentId: v.id("whiteboardDocuments") },
    handler: async (ctx, args) => {
        const { documentId } = args;

        // Get document info
        const doc = await ctx.runQuery(internal.documents.getDocumentById, { documentId });
        if (!doc) {
            return { success: false, error: "Document not found" };
        }

        // Update status to processing
        await ctx.runMutation(internal.documents.updateDocumentProcessing, {
            documentId,
            status: "processing",
        });

        try {
            // Get file URL
            const fileUrl = await ctx.runQuery(internal.documents.getDocumentUrl_internal, {
                storageId: doc.storageId,
            });

            if (!fileUrl) {
                throw new Error("Could not get file URL");
            }

            // Process based on file type
            const isImage = doc.fileType.startsWith("image/");
            const isPdf = doc.fileType === "application/pdf";

            let extractedContent = "";
            let extractedProblems: Array<{
                id: string;
                text: string;
                pageNumber?: number;
                difficulty?: string;
                addedToBoard: boolean;
            }> = [];

            if (isImage || isPdf) {
                // Use Gemini Vision to extract content
                const result = await extractContentWithVision(fileUrl, doc.fileType, doc.filename);
                extractedContent = result.content;
                extractedProblems = result.problems;
            } else {
                // For other document types, use Gemini to describe what we need
                // In a real implementation, you'd parse DOCX/PPTX first
                const result = await extractContentWithVision(fileUrl, doc.fileType, doc.filename);
                extractedContent = result.content;
                extractedProblems = result.problems;
            }

            // Update document with results
            await ctx.runMutation(internal.documents.updateDocumentProcessing, {
                documentId,
                status: "complete",
                extractedContent,
                extractedProblems,
            });

            return { success: true, problemCount: extractedProblems.length };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Document processing error:", errorMessage);

            await ctx.runMutation(internal.documents.updateDocumentProcessing, {
                documentId,
                status: "error",
                error: errorMessage,
            });

            return { success: false, error: errorMessage };
        }
    },
});

export const extractProblemsFromContent = action({
    args: {
        documentId: v.id("whiteboardDocuments"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            const systemPrompt = `You are an expert at analyzing educational content and extracting practice problems, exercises, and questions.

Given the following content from a study document, extract ALL problems, exercises, questions, and practice items.

For each problem found, provide:
1. The complete problem text (preserve formatting, equations, etc.)
2. An estimated difficulty level (easy, medium, hard)
3. The page/section number if identifiable

Return your response as a JSON array with this exact structure:
{
  "problems": [
    {
      "text": "The complete problem text here",
      "difficulty": "easy|medium|hard",
      "pageNumber": 1
    }
  ]
}

If no problems are found, return: { "problems": [] }

Important:
- Include ALL types of problems: math equations, word problems, conceptual questions, fill-in-the-blanks, multiple choice, etc.
- Preserve mathematical notation and formatting
- Be thorough - don't miss any practice items`;

            const messages: CoreMessage[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: args.content },
            ];

            const { text } = await generateText({
                model: getGatewayModel("google/gemini-2.0-flash"),
                messages,
            });

            // Parse the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("Could not parse AI response");
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const problems = (parsed.problems || []).map((p: { text: string; difficulty?: string; pageNumber?: number }, index: number) => ({
                id: `problem_${Date.now()}_${index}`,
                text: p.text,
                difficulty: p.difficulty || "medium",
                pageNumber: p.pageNumber,
                addedToBoard: false,
            }));

            // Update document
            await ctx.runMutation(internal.documents.updateDocumentProcessing, {
                documentId: args.documentId,
                status: "complete",
                extractedProblems: problems,
            });

            return { success: true, problems };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Problem extraction error:", errorMessage);
            return { success: false, error: errorMessage };
        }
    },
});

// ============================================
// Helper Functions
// ============================================

async function extractContentWithVision(
    fileUrl: string,
    fileType: string,
    filename: string
): Promise<{ content: string; problems: Array<{ id: string; text: string; pageNumber?: number; difficulty?: string; addedToBoard: boolean }> }> {

    const systemPrompt = `You are an expert educational content analyzer. Analyze this document/image and:

1. Extract ALL text content, preserving structure and formatting
2. Identify and extract ALL problems, exercises, questions, and practice items
3. For each problem, estimate its difficulty (easy/medium/hard)

Return your response as JSON with this exact structure:
{
  "summary": "Brief summary of the document content",
  "fullContent": "The complete extracted text content",
  "problems": [
    {
      "text": "Complete problem text with all details",
      "difficulty": "easy|medium|hard",
      "pageNumber": 1
    }
  ]
}

Important guidelines:
- Be thorough - extract EVERY practice problem, question, or exercise
- Preserve mathematical equations and special notation
- Include context needed to understand each problem
- If this is an image of notes, extract all readable text
- For PDFs with multiple pages, try to identify page numbers`;

    // Pass the Convex storage URL directly - it's publicly accessible
    const userContent: Array<TextPart | ImagePart> = [
        { type: "text", text: `Please analyze this ${fileType} file named "${filename}" and extract all educational content and problems.` },
        { type: "image", image: fileUrl },
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
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // If no JSON found, treat the whole response as content
            return {
                content: text,
                problems: [],
            };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        const problems = (parsed.problems || []).map((p: { text: string; difficulty?: string; pageNumber?: number }, index: number) => ({
            id: `problem_${Date.now()}_${index}`,
            text: p.text,
            difficulty: p.difficulty || "medium",
            pageNumber: p.pageNumber,
            addedToBoard: false,
        }));

        return {
            content: parsed.fullContent || parsed.summary || text,
            problems,
        };
    } catch (parseError) {
        console.warn("Failed to parse JSON response, using raw text");
        return {
            content: text,
            problems: [],
        };
    }
}

