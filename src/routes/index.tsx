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
    <main className="grid min-h-dvh place-items-center px-4 text-slate-800" style={{ background: "linear-gradient(135deg, #eef1ff 0%, #f6f0ff 30%, #eaf6f4 65%, #eef4ff 100%)" }}>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 shadow-[0_30px_80px_-40px_rgba(80,90,160,0.35)] backdrop-blur">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[color:var(--color-iris-cyan)]" />
        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Booting Nexus X AI</span>
      </div>
    </main>
  );
}
