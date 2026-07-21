// Real AI backend. Server route: /api/chat keeps provider calls server-side.

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  model?: string;
  tokens?: number;
  latencyMs?: number;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  model?: string;
}

export interface AIModel {
  id: string;
  name: string;
  tier: "Signature" | "Reserve" | "Atelier";
  tagline: string;
  context: string;
  price: string;
  badge?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "nx-pollinations",
    name: "Nexus Unlimited",
    tier: "Signature",
    tagline: "Pollinations Text · no key · primary unlimited route",
    context: "OpenAI-compatible",
    price: "Free",
    badge: "Primary",
  },
  {
    id: "nx-flash",
    name: "Nexus Flash 70B",
    tier: "Signature",
    tagline: "Groq · Llama 3.3 70B · ultra-fast reasoning",
    context: "128K tokens",
    price: "Free",
    badge: "Flagship",
  },
  {
    id: "nx-reasoner",
    name: "Nexus Reasoner R1",
    tier: "Signature",
    tagline: "Groq · DeepSeek R1 distill · step-by-step thinking",
    context: "128K tokens",
    price: "Free",
    badge: "Thinks",
  },
  {
    id: "nx-gemini",
    name: "Nexus Gemini 2.0",
    tier: "Reserve",
    tagline: "Google · multimodal · docs, images, diagrams",
    context: "1M tokens",
    price: "Free",
  },
  {
    id: "nx-gemini-pro",
    name: "Nexus Gemini 2.5",
    tier: "Reserve",
    tagline: "Google · deeper reasoning · long context",
    context: "1M tokens",
    price: "Free",
  },
  {
    id: "nx-deepseek",
    name: "Nexus DeepSeek V3",
    tier: "Atelier",
    tagline: "OpenRouter · specialist code & math",
    context: "128K tokens",
    price: "Free",
  },
  {
    id: "nx-llama-or",
    name: "Nexus Llama 3.3",
    tier: "Atelier",
    tagline: "OpenRouter · open-source Llama 3.3 70B",
    context: "128K tokens",
    price: "Free",
  },
  {
    id: "nx-lite",
    name: "Nexus Lite 8B",
    tier: "Atelier",
    tagline: "Groq · Llama 3.1 8B · instant replies",
    context: "128K tokens",
    price: "Free",
  },
  {
    id: "nx-local",
    name: "Nexus Local",
    tier: "Atelier",
    tagline: "Ollama · your own machine · fully private",
    context: "Depends",
    price: "Self-hosted",
  },
];


export async function sendChatMessage(
  messages: ChatMessage[],
  modelId?: string,
): Promise<{ content: string; model: string; tokens: number; latencyMs: number }> {
  const payload = {
    modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = `AI request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) detail = data.error;
    } catch {
      try {
        detail = (await res.text()) || detail;
      } catch {
        // ignore
      }
    }
    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 402)
      throw new Error("The active AI provider rejected this request for billing/quota reasons. Switch model or try again later.");
    throw new Error(detail);
  }

  const data = (await res.json()) as {
    content: string;
    model: string;
    tokens: number;
    latencyMs: number;
  };
  return data;
}

