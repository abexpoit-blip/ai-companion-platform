import { useCallback, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Plus,
  MessageSquare,
  Settings,
  LogOut,
  Send,
  Paperclip,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Trash2,
  Pencil,
  Check,
  X,
  Copy,
  Menu,
  User,
} from "lucide-react";
import {
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
} from "@/lib/chat-api";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = "codeaxis.chat.v1";

type Persisted = { threads: ChatThread[]; activeId: string };

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed || !Array.isArray(parsed.threads)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ChatWorkspace() {
  const [hydrated, setHydrated] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted && persisted.threads.length > 0) {
      setThreads(persisted.threads);
      setActiveId(
        persisted.activeId && persisted.threads.some((t) => t.id === persisted.activeId)
          ? persisted.activeId
          : persisted.threads[0].id,
      );
    } else {
      const first: ChatThread = { id: uid(), title: "New chat", messages: [], updatedAt: Date.now() };
      setThreads([first]);
      setActiveId(first.id);
    }
    setHydrated(true);
  }, []);

  // Persist on any change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads, activeId }));
    } catch {
      /* quota or private mode */
    }
  }, [threads, activeId, hydrated]);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0],
    [threads, activeId],
  );

  // Auto-scroll to bottom on new messages / typing
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, isSending]);

  const newChat = () => {
    // If current active is already an empty "New chat", just focus it.
    if (active && active.messages.length === 0) {
      setInput("");
      return;
    }
    const t: ChatThread = { id: uid(), title: "New chat", messages: [], updatedAt: Date.now() };
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
    setInput("");
  };

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh: ChatThread = { id: uid(), title: "New chat", messages: [], updatedAt: Date.now() };
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const startRename = (t: ChatThread) => {
    setRenamingId(t.id);
    setRenameDraft(t.title);
  };
  const commitRename = () => {
    const id = renamingId;
    const title = renameDraft.trim();
    if (id && title) {
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    }
    setRenamingId(null);
    setRenameDraft("");
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const updateThread = useCallback((id: string, updater: (t: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !active) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, createdAt: Date.now() };
    const isFirst = active.messages.length === 0;
    updateThread(active.id, (t) => ({
      ...t,
      title: isFirst ? text.slice(0, 40) : t.title,
      messages: [...t.messages, userMsg],
      updatedAt: Date.now(),
    }));
    setInput("");
    setIsSending(true);
    try {
      const reply = await sendChatMessage([...(active.messages ?? []), userMsg]);
      const asstMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: reply,
        createdAt: Date.now(),
      };
      updateThread(active.id, (t) => ({
        ...t,
        messages: [...t.messages, asstMsg],
        updatedAt: Date.now(),
      }));
    } finally {
      setIsSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="dark relative flex h-screen w-full overflow-hidden bg-[#0b0d12] text-slate-100">
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-full w-72 shrink-0 flex-col border-r border-white/5 bg-[#0f1219] transition-transform duration-300",
          "fixed inset-y-0 left-0 z-40 md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:-translate-x-0 md:overflow-hidden md:border-0",
        )}
      >

        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="text-sm font-semibold tracking-tight">CodeAxis Studio AI</div>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Recent
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {threads.map((t) => {
            const isRenaming = renamingId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "group mb-0.5 flex items-center gap-1 rounded-md px-2 py-2 text-sm transition",
                  t.id === activeId
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5",
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-slate-400" />
                {isRenaming ? (
                  <>
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      className="flex-1 rounded bg-black/30 px-1.5 py-0.5 text-sm text-white outline-none ring-1 ring-indigo-500/50"
                    />
                    <button onClick={commitRename} aria-label="Save" className="p-1 text-emerald-400 hover:text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={cancelRename} aria-label="Cancel" className="p-1 text-slate-400 hover:text-white">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setActiveId(t.id);
                        if (isMobile) setSidebarOpen(false);
                      }}

                      onDoubleClick={() => startRename(t)}
                      className="flex-1 truncate text-left"
                      title="Click to open · Double-click to rename"
                    >
                      {t.title}
                    </button>
                    <button
                      onClick={() => startRename(t)}
                      className="opacity-0 transition group-hover:opacity-100"
                      aria-label="Rename chat"
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-indigo-300" />
                    </button>
                    <button
                      onClick={() => deleteThread(t.id)}
                      className="opacity-0 transition group-hover:opacity-100"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-400" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>


        {/* User */}
        <div className="mt-2 border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">Alex Morgan</div>
              <div className="truncate text-xs text-slate-500">alex@codeaxis.io</div>
            </div>
            <button
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex h-full flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Toggle sidebar"
          >
            {isMobile ? <Menu className="h-4 w-4" /> : sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <div className="truncate text-sm font-medium">{active?.title ?? "New chat"}</div>
          <div className="ml-auto text-xs text-slate-500">Mock model · Ollama-ready</div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {active && active.messages.length === 0 ? (
            <EmptyState onPick={(q) => setInput(q)} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
              {active?.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isSending && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 border-t border-white/5 bg-[#0b0d12]/80 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#141824] p-2 shadow-lg focus-within:border-indigo-500/50">
              <button
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Message CodeAxis Studio AI…"
                className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isSending}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow transition hover:opacity-90 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 text-center text-[11px] text-slate-500">
              CodeAxis Studio AI can make mistakes. Verify important info.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-slate-700"
            : "bg-gradient-to-br from-indigo-500 to-violet-600",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Sparkles className="h-4 w-4 text-white" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-indigo-600/20 text-slate-100 border border-indigo-500/20"
            : "bg-[#141824] text-slate-200 border border-white/5",
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-[#0b0d12] prose-pre:border prose-pre:border-white/10 prose-code:text-indigo-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="rounded-2xl border border-white/5 bg-[#141824] px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const suggestions = [
    "Explain React Server Components in simple terms",
    "Write a marketing tagline for a dev tool",
    "Debug: why is my useEffect running twice?",
    "Draft a SQL query to find top customers",
  ];
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">How can I help you today?</h1>
      <p className="mt-2 text-sm text-slate-400">
        Ask anything, or start with a suggestion.
      </p>
      <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-white/10 bg-white/5 p-3 text-left text-sm text-slate-200 transition hover:border-indigo-500/40 hover:bg-white/10"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
