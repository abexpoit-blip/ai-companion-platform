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
  "Sure — here's a quick take:\n\n- **Point one**: keep components small and focused.\n- **Point two**: colocate state where it's used.\n\n```ts\nfunction greet(name: string) {\n  return `Hello, ${name}!`;\n}\n```\n\nWant me to expand on any of these?",
  "Great question. In short, you'll want to:\n\n1. Identify the source of truth\n2. Lift state only when needed\n3. Prefer derived values over duplicated state\n\nLet me know if you'd like a code example.",
  "Here's a starter snippet:\n\n```tsx\nexport function Button({ children }: { children: React.ReactNode }) {\n  return <button className=\"px-4 py-2 rounded-md\">{children}</button>;\n}\n```\n\nHappy to iterate on this.",
];

export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  // Simulate network + model latency
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 800));
  const last = messages[messages.length - 1]?.content ?? "";
  const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
  return `You said: _"${last.slice(0, 80)}"_\n\n${reply}`;
}
