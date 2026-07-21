// Mock AI API. Swap this with a real backend call (e.g. Ollama) later.
// Example real call:
//   const res = await fetch("http://localhost:11434/api/chat", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ model, messages, stream: false }),
//   });
//   const data = await res.json();
//   return data.message.content as string;

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
    price: "$0.048 / 1K",
    badge: "Flagship",
  },
  {
    id: "axis-noir-pro",
    name: "Axis Noir Pro",
    tier: "Reserve",
    tagline: "Editorial writing · long-form synthesis",
    context: "400K tokens",
    price: "$0.021 / 1K",
  },
  {
    id: "axis-atelier-code",
    name: "Atelier Code",
    tier: "Atelier",
    tagline: "Specialist: engineering & code review",
    context: "256K tokens",
    price: "$0.014 / 1K",
  },
  {
    id: "axis-onyx-vision",
    name: "Onyx Vision",
    tier: "Signature",
    tagline: "Multimodal · documents, images, diagrams",
    context: "512K tokens",
    price: "$0.036 / 1K",
    badge: "New",
  },
];

const MOCK_REPLIES = [
  "Certainly. Here is a distilled response:\n\n- **Principle one** — hold complexity where it belongs.\n- **Principle two** — colocate state with its consumer.\n- **Principle three** — derive, do not duplicate.\n\n```ts\nfunction greet(name: string) {\n  return `Hello, ${name}!`;\n}\n```\n\nWould you like a deeper cut on any of these?",
  "A concise comparison:\n\n| Approach | Strength | Trade-off |\n| --- | --- | --- |\n| Local state | Immediate, private | Doesn't scale across trees |\n| Context | Ergonomic sharing | Rerender surface |\n| Store | Powerful, testable | Setup overhead |\n\nIn practice: **start local, lift only when the pain is real.**",
  "Here is a starter, hand-tuned:\n\n```tsx\nimport { useState } from \"react\";\n\nexport function Counter() {\n  const [n, setN] = useState(0);\n  return (\n    <button onClick={() => setN(n + 1)}>\n      Clicked {n} times\n    </button>\n  );\n}\n```\n\nAnd a query to match:\n\n```sql\nSELECT id, name\nFROM users\nWHERE created_at > NOW() - INTERVAL '7 days'\nORDER BY created_at DESC;\n```\n\nHappy to refine further.",
];

export async function sendChatMessage(
  messages: ChatMessage[],
  modelId?: string,
): Promise<{ content: string; model: string; tokens: number; latencyMs: number }> {
  const started = performance.now();
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 900));
  const last = messages[messages.length - 1]?.content ?? "";
  const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
  const content = `You said: _"${last.slice(0, 80)}"_\n\n${reply}`;
  return {
    content,
    model: modelId ?? AI_MODELS[0].id,
    tokens: Math.round(content.length / 3.6),
    latencyMs: Math.round(performance.now() - started),
  };
}
