// Real AI backend via Lovable AI Gateway. Server route: /api/chat
// (see src/routes/api/chat.ts). LOVABLE_API_KEY stays server-side.

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
    id: "axis-obsidian-1",
    name: "Axis Obsidian",
    tier: "Signature",
    tagline: "Flagship reasoning · multi-step planning",
    context: "1M tokens",
    price: "Included",
    badge: "Flagship",
  },
  {
    id: "axis-noir-pro",
    name: "Axis Noir Pro",
    tier: "Reserve",
    tagline: "Editorial writing · long-form synthesis",
    context: "400K tokens",
    price: "Included",
  },
  {
    id: "axis-atelier-code",
    name: "Atelier Code",
    tier: "Atelier",
    tagline: "Specialist: engineering & code review",
    context: "256K tokens",
    price: "Included",
  },
  {
    id: "axis-onyx-vision",
    name: "Onyx Vision",
    tier: "Signature",
    tagline: "Multimodal · documents, images, diagrams",
    context: "512K tokens",
    price: "Included",
    badge: "New",
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
      throw new Error("AI credits exhausted for this workspace. Add credits to continue.");
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

