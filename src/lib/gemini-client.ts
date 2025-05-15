
import {createGoogleGenerativeAI, GoogleGenerativeAIProvider} from "@ai-sdk/google";

let googleAIClient: GoogleGenerativeAIProvider | null = null;

export function getGoogleAIClient(): GoogleGenerativeAIProvider {
    if (googleAIClient) {
        return googleAIClient;
    }

    const apiKey = "AIzaSyDym6jnzL_yu_wsgNNfAGDmEkaoCO6kq5U";
    if (!apiKey) {
        console.error("ERROR: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set.");
        throw new Error("AI Service not configured: Missing Google API Key.");
    }
    googleAIClient = createGoogleGenerativeAI({apiKey});
    return googleAIClient;
}