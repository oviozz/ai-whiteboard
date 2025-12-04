import { createGateway } from "@ai-sdk/gateway";
import { LanguageModel } from "ai";

let gatewayClient: ReturnType<typeof createGateway> | null = null;

export function getGatewayClient() {
    if (gatewayClient) {
        return gatewayClient;
    }
    
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    
    if (!apiKey) {
        console.error("ERROR: AI_GATEWAY_API_KEY environment variable is not set.");
        throw new Error("AI Service not configured: Missing AI Gateway API Key.");
    }
    
    gatewayClient = createGateway({ apiKey });
    return gatewayClient;
}

// Helper to get a model from the gateway
export function getGatewayModel(modelId: string = "google/gemini-2.0-flash"): LanguageModel {
    const gateway = getGatewayClient();
    return gateway(modelId);
}
