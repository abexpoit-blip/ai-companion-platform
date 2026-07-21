import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/ChatWorkspace";

export const Route = createFileRoute("/")({
  component: ChatWorkspace,
  head: () => ({
    meta: [
      { title: "Nexus X AI — Free Multi-Model Chat Workspace" },
      { name: "description", content: "Nexus X AI — a premium chat workspace wired to free AI models (Groq, Gemini, DeepSeek, Llama, Ollama)." },
      { property: "og:title", content: "Nexus X AI" },
      { property: "og:description", content: "Free multi-model AI workspace with live code preview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
