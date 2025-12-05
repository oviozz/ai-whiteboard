import { getGatewayModel } from "@/lib/gateway-client";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 45;

// Define the schema for the request body
const bodySchema = z.object({
  topic: z.string().min(1).describe("Topic for the questions"),
  quizType: z.enum(["multiple_choice", "matching", "fill_blank"]).describe("Type of quiz"),
  questionCount: z.number().int().positive().default(5).describe("Number of questions"),
  problem_statement: z.string().optional().describe("Optional problem statement for context"),
});

// Multiple choice question schema
const multipleChoiceSchema = z.object({
  id: z.string(),
  type: z.literal("multiple_choice"),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.string(),
  hint: z.string(),
  videoSearch: z.string(),
  explanation: z.string(),
});

// Fill in the blank schema
const fillBlankSchema = z.object({
  id: z.string(),
  type: z.literal("fill_blank"),
  question: z.string(),
  correctAnswer: z.string(),
  hint: z.string(),
  videoSearch: z.string(),
  explanation: z.string(),
});

// Matching schema
const matchingPairSchema = z.object({
  left: z.string(),
  right: z.string(),
});

const matchingSchema = z.object({
  id: z.string(),
  type: z.literal("matching"),
  question: z.string(),
  pairs: z.array(matchingPairSchema).min(3).max(6),
  correctAnswer: z.array(z.string()),
  hint: z.string(),
  videoSearch: z.string(),
  explanation: z.string(),
});

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

    const { topic, quizType, questionCount, problem_statement } = validationResult.data;

    // Build schema based on quiz type
    let questionsSchema;
    let typeInstructions: string;

    if (quizType === "multiple_choice") {
      questionsSchema = z.array(multipleChoiceSchema);
      typeInstructions = `Generate multiple choice questions with:
- A clear question
- Exactly 4 options (A, B, C, D)
- One correct answer (the text of the correct option)
- A helpful hint that doesn't give away the answer
- A YouTube search query to find educational videos about this concept
- A brief explanation of why the answer is correct`;
    } else if (quizType === "fill_blank") {
      questionsSchema = z.array(fillBlankSchema);
      typeInstructions = `Generate fill-in-the-blank questions with:
- A question with a blank indicated by _____
- The correct answer to fill in the blank
- A helpful hint that doesn't give away the answer
- A YouTube search query to find educational videos about this concept
- A brief explanation of the answer`;
    } else {
      questionsSchema = z.array(matchingSchema);
      typeInstructions = `Generate matching questions with:
- An instruction (e.g., "Match the terms to their definitions")
- 3-6 pairs of items to match (left and right columns)
- correctAnswer as an array of the right-side items in order matching the left side
- A helpful hint about the matching strategy
- A YouTube search query to find educational videos about these concepts
- A brief explanation of the correct matches`;
    }

    const systemPrompt = `You are an educational quiz generator. Generate ${questionCount} ${quizType.replace("_", " ")} questions about "${topic}".

${problem_statement ? `Context: ${problem_statement}\n` : ""}

${typeInstructions}

Requirements:
1. Questions should be clear and educational
2. Difficulty should be appropriate for learning
3. Hints should guide without giving away the answer
4. Video search queries should find helpful educational content
5. Each question needs a unique id (use format: q1, q2, q3, etc.)
6. For math content, use simple notation (avoid LaTeX)

Generate exactly ${questionCount} questions.`;

    const result = await generateObject({
      model: getGatewayModel("google/gemini-2.0-flash"),
      schema: z.object({
        questions: questionsSchema,
      }),
      prompt: systemPrompt,
    });

    return Response.json(result.object);
  } catch (err) {
    console.error("Error generating questions:", err);
    return Response.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
