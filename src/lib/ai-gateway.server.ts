import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

// Map friendly CodeAxis model ids -> real Lovable AI Gateway model ids.
const MODEL_MAP: Record<string, string> = {
  "axis-obsidian-1": "openai/gpt-5.6-sol",
  "axis-noir-pro": "openai/gpt-5.4",
  "axis-atelier-code": "openai/gpt-5.4-mini",
  "axis-onyx-vision": "google/gemini-3.1-pro-preview",
};

export function resolveGatewayModel(friendlyId: string | undefined) {
  if (!friendlyId) return "google/gemini-3.5-flash";
  return MODEL_MAP[friendlyId] ?? "google/gemini-3.5-flash";
}
