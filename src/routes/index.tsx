import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

export const Route = createFileRoute("/")({
  component: IndexPage,
  head: () => ({
    meta: [
      { title: "Nexus X AI — Free Multi-Model Chat Workspace" },
      { name: "description", content: "Nexus X AI — a premium chat workspace with Pollinations Text as the primary free AI route plus Groq, Gemini, DeepSeek, Llama and Ollama fallbacks." },
      { property: "og:title", content: "Nexus X AI" },
      { property: "og:description", content: "Free AI chat workspace powered primarily by Pollinations Text with live code preview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function IndexPage() {
  const [Workspace, setWorkspace] = useState<ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;
    import("@/components/ChatWorkspace").then((mod) => {
      if (mounted) setWorkspace(() => mod.ChatWorkspace);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!Workspace) return <ChatBootScreen />;
  return <Workspace />;
}

function ChatBootScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#020205] px-4 text-neutral-100">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.9)]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[color:var(--color-iris-cyan)]" />
        <span className="text-xs uppercase tracking-[0.22em] text-neutral-400">Booting Nexus X AI</span>
      </div>
    </main>
  );
}
