// Mock AI API. Swap this with a real backend call (e.g. Ollama) later.
// Example real call:
//   const res = await fetch("http://localhost:11434/api/chat", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ model: "llama3", messages, stream: false }),
//   });
//   const data = await res.json();
//   return data.message.content as string;

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const MOCK_REPLIES = [
  "Sure — here's a quick take:\n\n- **Point one**: keep components small and focused.\n- **Point two**: colocate state where it's used.\n- **Point three**: derive values instead of duplicating them.\n\n```ts\nfunction greet(name: string) {\n  return `Hello, ${name}!`;\n}\n```\n\nWant me to expand on any of these?",
  "Great question. Here's a short comparison:\n\n| Approach | Pros | Cons |\n| --- | --- | --- |\n| Local state | Simple, fast | Doesn't scale |\n| Context | Shared, ergonomic | Re-renders |\n| Store (Zustand/Redux) | Powerful | More setup |\n\nIn most apps, **start local, lift only when needed**.",
  "Here's a starter snippet with syntax highlighting:\n\n```tsx\nimport { useState } from \"react\";\n\nexport function Counter() {\n  const [n, setN] = useState(0);\n  return (\n    <button onClick={() => setN(n + 1)}>\n      Clicked {n} times\n    </button>\n  );\n}\n```\n\nAnd a quick SQL example:\n\n```sql\nSELECT id, name\nFROM users\nWHERE created_at > NOW() - INTERVAL '7 days'\nORDER BY created_at DESC;\n```\n\nHappy to iterate on this.",
];


export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  // Simulate network + model latency
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 800));
  const last = messages[messages.length - 1]?.content ?? "";
  const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
  return `You said: _"${last.slice(0, 80)}"_\n\n${reply}`;
}
