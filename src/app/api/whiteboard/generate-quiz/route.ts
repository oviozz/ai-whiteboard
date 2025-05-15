
import { getGoogleAIClient } from "@/lib/gemini-client";
import {CoreMessage, streamObject} from "ai";
import { z } from "zod";

export const maxDuration = 45;

// Define the schema for the request body
const bodySchema = z.object({
    number: z.number().int().positive().describe("Number of questions to generate"),
    topic: z.string().min(1).describe("Topic for the questions"),
    problem_statement: z.string().optional().describe("Optional problem statement for context")
});

// Define the response schema
const questionsResponseSchema = z.array(
    z.object({
        question: z.string().describe("Generated question"),
        options: z.array(z.string()).length(4).describe("List of 4 mcq options"),
        answer: z.string().describe("The answer to the generated question")
    })
);

export async function POST(req: Request) {
    const jsonBody = await req.json();

    try {

        const validationResult = bodySchema.safeParse(jsonBody);

        if (!validationResult.success) {
            return Response.json(
                { success: false, error: "Invalid input.", details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const { number, topic, problem_statement } = validationResult.data;

        const currentGoogleClient = getGoogleAIClient();


        const systemPromptContent = `.
            IMPORTANT Each question should:
            1. Be clear and focused on the topic
            2. Have exactly 4 options
            3. Have exactly one correct answer
            4. The correct answer should be included as one of the options AND separately specified in the 'answer' field
            
            **FORMAT YOUR RESPONSES WITH:**
            1. **Markdown** for structure:
               * Lists for steps
               * Bold for key points
               * Code blocks for structured data
               * Blockquotes for important notes
            
            2. **LaTeX** for ALL math:
               * Inline: $E = mc^2$
               * Display: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$
           
            `;

        const messagesToAI: CoreMessage[] = [
            {
                role: 'system',
                content: systemPromptContent
            },
            {
                role: 'user',
                content: `Generate ${number} multiple choice questions about ${topic}${problem_statement ? `related to the following problem statement: ${problem_statement}` : ''}`
            }
        ];

        const result = streamObject({
            model: currentGoogleClient('gemini-2.0-flash-exp'),
            schema: z.object({
                questions: questionsResponseSchema
            }),
            messages: messagesToAI
        });

        return result.toTextStreamResponse();
    } catch (err) {
        console.error("Error generating questions:", err);
        return new Response(JSON.stringify({ error: "Failed to generate questions" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}