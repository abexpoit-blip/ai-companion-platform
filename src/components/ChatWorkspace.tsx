import { useCallback, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Plus,
  Settings,
  LogOut,
  ArrowUp,
  Paperclip,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Pencil,
  Check,
  X,
  Copy,
  Menu,
  Search,
  ChevronDown,
  Command,
  Zap,
  Shield,
  Sparkle,
  Diamond,
  Mic,
  Image as ImageIcon,
  ChevronRight,
  Crown,
} from "lucide-react";
import {
  sendChatMessage,
  AI_MODELS,
  type ChatMessage,
  type ChatThread,
  type AIModel,
} from "@/lib/chat-api";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ThemePicker } from "@/components/ThemePicker";


const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = "codeaxis.chat.v2";

type Persisted = { threads: ChatThread[]; activeId: string; modelId: string };

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

const tierIcon = (tier: AIModel["tier"]) =>
  tier === "Signature" ? Crown : tier === "Reserve" ? Diamond : Sparkle;

export function ChatWorkspace() {
  const [hydrated, setHydrated] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [modelId, setModelId] = useState<string>(AI_MODELS[0].id);
  const [modelOpen, setModelOpen] = useState(false);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted && persisted.threads.length > 0) {
      setThreads(persisted.threads);
      setActiveId(
        persisted.activeId && persisted.threads.some((t) => t.id === persisted.activeId)
          ? persisted.activeId
          : persisted.threads[0].id,
      );
      if (persisted.modelId) setModelId(persisted.modelId);
    } else {
      const first: ChatThread = { id: uid(), title: "Untitled dossier", messages: [], updatedAt: Date.now() };
      setThreads([first]);
      setActiveId(first.id);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads, activeId, modelId }));
    } catch {
      /* ignore */
    }
  }, [threads, activeId, modelId, hydrated]);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0],
    [threads, activeId],
  );
  const model = useMemo(
    () => AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0],
    [modelId],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return threads;
    const q = query.toLowerCase();
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, isSending]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const newChat = () => {
    if (active && active.messages.length === 0) {
      setInput("");
      return;
    }
    const t: ChatThread = { id: uid(), title: "Untitled dossier", messages: [], updatedAt: Date.now() };
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
    setInput("");
  };

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh: ChatThread = { id: uid(), title: "Untitled dossier", messages: [], updatedAt: Date.now() };
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
      title: isFirst ? text.slice(0, 48) : t.title,
      messages: [...t.messages, userMsg],
      updatedAt: Date.now(),
    }));
    setInput("");
    setIsSending(true);
    try {
      const reply = await sendChatMessage([...(active.messages ?? []), userMsg], modelId);
      const asstMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: reply.content,
        model: reply.model,
        tokens: reply.tokens,
        latencyMs: reply.latencyMs,
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

  const totalTokens = active?.messages.reduce((s, m) => s + (m.tokens ?? Math.round(m.content.length / 3.6)), 0) ?? 0;

  return (
    <div className="dark relative flex h-screen w-full overflow-hidden text-neutral-100" style={{
      background: "#020205",
    }}>
      {/* Iridescent ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-[15%] left-[15%] h-[620px] w-[620px] rounded-full iris-drift" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-iris-deep) 45%, transparent), transparent 70%)", filter: "blur(120px)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-[10%] right-[5%] h-[520px] w-[520px] rounded-full iris-drift" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-iris-cyan) 35%, transparent), transparent 70%)", filter: "blur(120px)", animationDelay: "-6s" }} />
      <div aria-hidden className="pointer-events-none absolute top-[30%] right-[20%] h-[360px] w-[360px] rounded-full iris-drift" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-iris-warm) 30%, transparent), transparent 70%)", filter: "blur(120px)", animationDelay: "-10s" }} />
      <div className="pointer-events-none absolute inset-0 grain" aria-hidden />


      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-full w-[300px] shrink-0 flex-col border-r border-white/[0.06] transition-transform duration-300",
          "fixed inset-y-0 left-0 z-40 md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:-translate-x-0 md:overflow-hidden md:border-0",
        )}
        style={{
          background: "linear-gradient(180deg, rgba(10,10,18,0.72) 0%, rgba(6,6,12,0.85) 100%)",
          backdropFilter: "blur(18px)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl p-[1.5px]" style={{
            background: "var(--iris-gradient)",
          }}>
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#050510]">
              <span className="font-display text-lg font-bold leading-none gold-text">C</span>
            </div>
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--color-iris-cyan)] shadow-[0_0_12px_color-mix(in_oklab,var(--color-iris-cyan)_80%,transparent)]" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[17px] font-bold leading-tight tracking-tight text-white">
              CodeAxis <span className="gold-text">Studio</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Private Intelligence</div>
          </div>
        </div>

        {/* New chat */}
        <div className="px-4 pb-3">
          <button
            onClick={newChat}
            className="group relative flex w-full items-center justify-between overflow-hidden rounded-xl px-3.5 py-2.5 text-sm text-white transition hover:-translate-y-px active:translate-y-0"
            style={{
              background: "linear-gradient(135deg, color-mix(in oklab, var(--color-iris-deep) 40%, transparent), color-mix(in oklab, var(--color-iris-cyan) 30%, transparent))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 28px -14px color-mix(in oklab, var(--color-iris-deep) 80%, transparent)",
              border: "1px solid color-mix(in oklab, var(--color-iris) 40%, transparent)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4 text-[color:var(--color-iris-cyan)] transition group-hover:rotate-90" />
              <span className="font-semibold tracking-tight">New Workspace</span>
            </span>
            <kbd className="relative z-10 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-neutral-300">⌘N</kbd>
            {/* shimmer sweep on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 opacity-0 transition duration-500 group-hover:left-[120%] group-hover:opacity-100"
              style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, white 45%, transparent), transparent)" }}
            />
          </button>
        </div>


        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dossiers"
              className="flex-1 bg-transparent text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
            />
            <kbd className="rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[9px] font-mono text-neutral-500">⌘K</kbd>
          </div>
        </div>

        <div className="mx-5 my-1 h-px bg-gradient-to-r from-transparent via-[color:var(--color-gold)]/25 to-transparent" />

        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">Archive</span>
          <span className="text-[10px] text-neutral-600">{filtered.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.map((t) => {
            const isRenaming = renamingId === t.id;
            const isActive = t.id === activeId;
            return (
              <div
                key={t.id}
                className={cn(
                  "group relative mb-1 flex items-center gap-2 overflow-hidden rounded-lg px-2.5 py-2 text-[13px] transition",
                  isActive
                    ? "text-white"
                    : "border border-transparent text-neutral-300 hover:bg-white/[0.04] hover:text-white",
                )}
                style={isActive ? {
                  background: "linear-gradient(135deg, color-mix(in oklab, var(--color-iris-deep) 28%, transparent), color-mix(in oklab, var(--color-iris-cyan) 14%, transparent))",
                  border: "1px solid color-mix(in oklab, var(--color-iris) 35%, transparent)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 18px -10px color-mix(in oklab, var(--color-iris-deep) 70%, transparent)",
                } : undefined}
              >
                {isActive && (
                  <>
                    <span
                      className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r"
                      style={{
                        background: "var(--iris-gradient)",
                        boxShadow: "0 0 10px color-mix(in oklab, var(--color-iris) 80%, transparent)",
                      }}
                    />
                    <span aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{
                      background: "radial-gradient(120% 60% at 100% 0%, color-mix(in oklab, var(--color-iris) 25%, transparent), transparent 60%)",
                    }} />
                  </>
                )}

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
                      className="flex-1 rounded bg-black/40 px-1.5 py-0.5 text-[13px] text-white outline-none ring-1 ring-[color:var(--color-gold)]/40"
                    />
                    <button onClick={commitRename} className="p-1 text-[color:var(--color-gold)]"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={cancelRename} className="p-1 text-neutral-400"><X className="h-3.5 w-3.5" /></button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setActiveId(t.id);
                        if (isMobile) setSidebarOpen(false);
                      }}
                      onDoubleClick={() => startRename(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate">{t.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-neutral-500">
                        <span>{new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <span className="text-neutral-700">·</span>
                        <span>{t.messages.length} turns</span>
                      </div>
                    </button>
                    <div className="flex items-center opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => startRename(t)} className="p-1 text-neutral-400 hover:text-[color:var(--color-gold)]" aria-label="Rename">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteThread(t.id)} className="p-1 text-neutral-400 hover:text-red-400" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* User */}
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-black/30 p-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full p-[1.5px]" style={{
              background: "var(--iris-gradient)",
            }}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#050510]">
                <span className="font-display text-base gold-text">A</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black ring-1 ring-white/10">
                <Crown className="h-2 w-2 text-[color:var(--color-iris-cyan)]" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="truncate text-[13px] font-medium">Alex Morgan</div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="rounded-sm bg-[color:var(--color-gold)]/15 px-1 py-px font-medium text-[color:var(--color-gold)]">SIGNATURE</span>
                <span className="text-neutral-500">alex@codeaxis.io</span>
              </div>
            </div>
            <button className="rounded-md p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Settings">
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-md p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Log out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex h-full flex-1 flex-col">
        {/* Header */}
        <header className="relative z-10 flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6" style={{
          background: "linear-gradient(180deg, rgba(14,12,22,0.72) 0%, rgba(10,10,18,0.4) 100%)",
          backdropFilter: "blur(10px)",
        }}>

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
            aria-label="Toggle sidebar"
          >
            {isMobile ? <Menu className="h-4 w-4" /> : sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setModelOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/30 py-1.5 pl-2 pr-3 text-left transition hover:border-[color:var(--color-gold)]/40"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--color-gold)]/30 bg-black/40">
                {(() => { const I = tierIcon(model.tier); return <I className="h-3.5 w-3.5 text-[color:var(--color-gold)]" />; })()}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] text-neutral-400">
                  <span className="text-[color:var(--color-gold)]">{model.tier}</span> · Model
                </span>
                <span className="text-[13px] font-medium text-white">{model.name}</span>
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-neutral-400 transition", modelOpen && "rotate-180")} />
            </button>
            {modelOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[360px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0908] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" style={{
                  backgroundImage: "linear-gradient(180deg, rgba(30,22,10,0.4), rgba(10,10,12,0.6))",
                }}>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Select Intelligence</span>
                    <span className="text-[10px] text-neutral-600">4 available</span>
                  </div>
                  {AI_MODELS.map((m) => {
                    const I = tierIcon(m.tier);
                    const active = m.id === modelId;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setModelId(m.id); setModelOpen(false); }}
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition",
                          active ? "bg-[color:var(--color-gold)]/10" : "hover:bg-white/[0.04]",
                        )}
                      >
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--color-gold)]/25 bg-black/40">
                          <I className="h-4 w-4 text-[color:var(--color-gold)]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium text-white">{m.name}</span>
                            {m.badge && (
                              <span className="rounded-sm bg-[color:var(--color-gold)]/15 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-[color:var(--color-gold)]">{m.badge}</span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-neutral-400">{m.tagline}</span>
                          <span className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                            <span className="font-mono">{m.context}</span>
                            <span className="text-neutral-700">·</span>
                            <span className="font-mono">{m.price}</span>
                          </span>
                        </span>
                        {active && <Check className="mt-2 h-3.5 w-3.5 text-[color:var(--color-gold)]" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-neutral-300">
            <span className="hidden items-center gap-1 rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 sm:flex">
              <Shield className="h-3 w-3 text-emerald-400" />
              <span>End-to-end encrypted</span>
            </span>
            <span className="hidden items-center gap-1 rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 font-mono md:flex">
              <Zap className="h-3 w-3 text-[color:var(--color-iris-cyan)]" />
              <span>{totalTokens.toLocaleString()} tok</span>
            </span>
            <ThemePicker />
          </div>

        </header>

        {/* Messages */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <EmptyState onPick={(q) => setInput(q)} model={model} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
              {active?.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isSending && <TypingIndicator model={model} />}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="relative border-t border-white/[0.06]" style={{
          background: "linear-gradient(0deg, rgba(10,10,18,0.9) 60%, rgba(10,10,18,0.4) 100%)",
          backdropFilter: "blur(10px)",
        }}>

          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
            <div className="group relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-[3px] rounded-[20px] opacity-40 blur-lg transition duration-500 group-focus-within:opacity-100 group-hover:opacity-80"
                style={{ background: "var(--iris-gradient)" }}
              />
              <div
                className="relative rounded-2xl border border-white/[0.09] p-2 transition focus-within:border-[color:var(--color-iris)]/60 iris-animated-border"
                style={{
                  background: "linear-gradient(180deg, rgba(14,14,22,0.88), rgba(8,8,14,0.88))",
                  boxShadow: "0 20px 60px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(200,220,255,0.06)",
                }}
              >
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Compose a query for Axis Intelligence…"
                  className="max-h-52 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[14px] leading-relaxed text-neutral-50 placeholder:text-neutral-500 focus:outline-none"
                />
                <div className="flex items-center justify-between px-1.5 pb-1 pt-1.5">
                  <div className="flex items-center gap-0.5">
                    <ComposerBtn label="Attach"><Paperclip className="h-4 w-4" /></ComposerBtn>
                    <ComposerBtn label="Image"><ImageIcon className="h-4 w-4" /></ComposerBtn>
                    <ComposerBtn label="Voice"><Mic className="h-4 w-4" /></ComposerBtn>
                    <ComposerBtn label="Commands"><Command className="h-4 w-4" /></ComposerBtn>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-neutral-500 sm:inline">
                      <kbd className="rounded border border-white/10 bg-black/40 px-1 py-0.5 font-mono">⏎</kbd> send
                      <span className="mx-1 text-neutral-700">·</span>
                      <kbd className="rounded border border-white/10 bg-black/40 px-1 py-0.5 font-mono">⇧⏎</kbd> newline
                    </span>
                    <SendButton
                      onClick={() => void handleSend()}
                      disabled={!input.trim() || isSending}
                      loading={isSending}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-2 text-[10.5px] text-neutral-500">
              <span>Powered by <span className="text-[color:var(--color-gold)]">{model.name}</span></span>
              <span className="text-neutral-700">·</span>
              <span>Verify critical outputs. CodeAxis is an assistant, not an oracle.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ComposerBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      className="group relative rounded-lg p-2 text-neutral-400 transition hover:text-white"
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-lg opacity-0 transition group-hover:opacity-100"
        style={{
          background: "radial-gradient(circle at center, color-mix(in oklab, var(--color-iris) 35%, transparent), transparent 70%)",
        }}
      />
      <span className="relative">{children}</span>
    </button>
  );
}

function SendButton({ onClick, disabled, loading }: { onClick: () => void; disabled: boolean; loading: boolean }) {
  const idle = !disabled;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Send"
      className={cn(
        "group relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl text-white transition-transform duration-200",
        "hover:scale-[1.06] active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50",
        idle && "iris-pulse-glow",
      )}
      style={{
        background: "var(--iris-gradient)",
        backgroundSize: "200% 100%",
        boxShadow:
          "0 10px 28px -8px color-mix(in oklab, var(--color-iris-deep) 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.4)",
      }}
    >
      {/* animated gradient sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
        style={{
          background: "linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.35) 50%, transparent 80%)",
          transform: "translateX(-100%)",
          animation: idle ? "iris-sheen 1.6s ease-in-out infinite" : undefined,
        }}
      />
      <ArrowUp className={cn("relative h-4 w-4 transition", loading && "animate-pulse")} strokeWidth={2.75} />
    </button>
  );
}


const markdownComponents: Components = {
  code(props) {
    const { className, children, ...rest } = props as ComponentPropsWithoutRef<"code"> & {
      node?: unknown;
      inline?: boolean;
    };
    const match = /language-(\w+)/.exec(className || "");
    const raw = String(children ?? "").replace(/\n$/, "");
    const isBlock = raw.includes("\n") || Boolean(match);
    if (!isBlock) {
      return (
        <code
          {...rest}
          className="rounded bg-[color:var(--color-gold)]/10 px-1.5 py-0.5 font-mono text-[0.85em] text-[color:var(--color-gold)]"
        >
          {children}
        </code>
      );
    }
    return <CodeBlock language={match?.[1] ?? "text"} value={raw} />;
  },
  pre({ children }) { return <>{children}</>; },
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border-b border-white/[0.08] bg-[color:var(--color-gold)]/[0.06] px-3 py-2 text-left font-medium uppercase tracking-wider text-[11px] text-[color:var(--color-gold-soft)]">{children}</th>;
  },
  td({ children }) {
    return <td className="border-b border-white/[0.05] px-3 py-2 align-top">{children}</td>;
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-[color:var(--color-gold)] underline decoration-[color:var(--color-gold)]/30 underline-offset-4 hover:decoration-[color:var(--color-gold)]">
        {children}
      </a>
    );
  },
};

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {/* ignore */}
  };
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-white/[0.08]" style={{
      background: "linear-gradient(180deg, #0a0908 0%, #0d0b09 100%)",
      boxShadow: "inset 0 1px 0 rgba(255,220,150,0.04)",
    }}>
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/40 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-white/10" />
            <span className="h-2 w-2 rounded-full bg-white/10" />
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-gold)]/40" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">{language}</span>
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] text-neutral-400 hover:bg-white/5 hover:text-[color:var(--color-gold)]"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-[color:var(--color-gold)]" /> : <Copy className="h-3 w-3" />}
          <span className="uppercase tracking-wider">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "14px 16px",
          fontSize: "12.5px",
          lineHeight: "1.6",
        }}
        codeTagProps={{ style: { fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace" } }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("flex gap-3 sm:gap-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          isUser
            ? "border-white/10 bg-white/[0.05]"
            : "border-transparent p-[1.5px]",
        )}
        style={!isUser ? { background: "var(--iris-gradient)" } : undefined}
      >
        {isUser ? (
          <span className="text-xs font-medium text-neutral-100">A</span>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0a0a14]">
            <span className="font-display text-sm leading-none gold-text">C</span>
          </div>
        )}
      </div>
      <div className={cn("min-w-0 max-w-[92%] sm:max-w-[85%]", isUser ? "text-right" : "text-left")}>
        <div className={cn("mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500", isUser && "justify-end")}>
          <span>{isUser ? "You" : "Axis"}</span>
          {!isUser && message.model && (
            <>
              <span className="text-neutral-700">·</span>
              <span className="normal-case tracking-normal font-mono text-[color:var(--color-iris-cyan)]/90">
                {AI_MODELS.find((m) => m.id === message.model)?.name ?? message.model}
              </span>
            </>
          )}
          <span className="text-neutral-700">·</span>
          <span className="normal-case font-mono">{time}</span>
        </div>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
            isUser
              ? "inline-block text-neutral-50"
              : "border border-white/[0.07] text-neutral-100",
          )}
          style={isUser ? {
            background: "linear-gradient(135deg, color-mix(in oklab, var(--color-iris-deep) 55%, transparent), color-mix(in oklab, var(--color-iris) 35%, transparent))",
            border: "1px solid color-mix(in oklab, var(--color-iris) 40%, transparent)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px -12px color-mix(in oklab, var(--color-iris-deep) 60%, transparent)",
          } : {
            background: "linear-gradient(180deg, rgba(18,16,28,0.72), rgba(10,10,18,0.72))",
            boxShadow: "inset 0 1px 0 rgba(200,220,255,0.06)",
          }}
        >

          {isUser ? (
            <div className="whitespace-pre-wrap break-words text-left">{message.content}</div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none break-words prose-p:my-2 prose-headings:font-display prose-headings:tracking-tight prose-headings:mt-3 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-[color:var(--color-gold-soft)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (message.tokens || message.latencyMs) && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-neutral-600">
            {message.latencyMs && <span>{(message.latencyMs / 1000).toFixed(2)}s</span>}
            {message.tokens && <><span className="text-neutral-800">·</span><span>{message.tokens} tokens</span></>}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({ model }: { model: AIModel }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-[1.5px]" style={{
        background: "var(--iris-gradient)",
      }}>
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0a0a14]">
          <span className="font-display text-sm gold-text">C</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          Axis · <span className="normal-case tracking-normal font-mono text-[color:var(--color-iris-cyan)]/90">{model.name}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.07] px-4 py-3" style={{
          background: "linear-gradient(180deg, rgba(18,16,28,0.7), rgba(10,10,18,0.7))",
        }}>
          <div className="relative h-4 w-16 overflow-hidden rounded-full bg-white/[0.04]">
            <div className="absolute inset-0 shimmer-gold" />
          </div>
          <span className="text-[11px] text-neutral-300">reasoning…</span>

        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick, model }: { onPick: (q: string) => void; model: AIModel }) {
  const TierI = tierIcon(model.tier);
  const bento = [
    {
      key: "hero",
      cls: "sm:col-span-2 sm:row-span-2",
      accent: "oklch(0.62 0.19 275)",
      icon: Zap,
      eyebrow: "Signature capability",
      title: "Architect entire systems",
      body: "Design end-to-end product architectures with contextual awareness — from schema to shipping code.",
      prompt: "Draft a scalable multi-tenant SaaS architecture with auth, billing and analytics.",
      large: true,
    },
    {
      key: "ui",
      cls: "sm:col-span-1",
      accent: "oklch(0.84 0.11 210)",
      icon: Sparkle,
      eyebrow: "Design",
      title: "UI systems",
      body: "Generate accessible, vapor-styled components.",
      prompt: "Design a premium pricing page with 3 tiers, iridescent glass cards and a comparison table.",
    },
    {
      key: "data",
      cls: "sm:col-span-1",
      accent: "oklch(0.7 0.17 320)",
      icon: Diamond,
      eyebrow: "Analysis",
      title: "Data flow",
      body: "Map intricate state and query patterns.",
      prompt: "Trace the state flow of a real-time collaborative editor and identify bottlenecks.",
    },
    {
      key: "cloud",
      cls: "sm:col-span-2",
      accent: "oklch(0.78 0.13 285)",
      icon: Shield,
      eyebrow: "Infrastructure",
      title: "Cloud architecture",
      body: "Deploy instantly to global infrastructure with a hardened, observable topology.",
      prompt: "Propose a globally-distributed edge deployment with failover and cost projections.",
      cta: true,
    },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-iris-soft)] backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-iris-cyan)] shadow-[0_0_8px_rgba(120,200,240,0.9)]" />
        <TierI className="h-3 w-3" />
        <span>{model.tier} · {model.name}</span>
      </div>
      <h1 className="text-center font-display text-[44px] font-extrabold leading-[1.02] tracking-tight text-white sm:text-[60px]">
        What's next,{" "}
        <span className="gold-text italic">Creative?</span>
      </h1>
      <p className="mt-4 max-w-xl text-center text-[14px] leading-relaxed text-neutral-400">
        Architect your vision with CodeAxis Studio — the private intelligence workspace engineered for enterprise depth and taste.
      </p>

      <div className="mt-10 grid w-full grid-cols-1 grid-rows-none gap-3 sm:grid-cols-3 sm:grid-rows-2 sm:gap-4" style={{ minHeight: "clamp(280px, 40vh, 380px)" }}>
        {bento.map((b) => {
          const I = b.icon;
          return (
            <button
              key={b.key}
              onClick={() => onPick(b.prompt)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] p-5 text-left transition hover:border-white/20 sm:p-6",
                b.cls,
              )}
              style={{
                background: "linear-gradient(180deg, rgba(20,20,32,0.55), rgba(10,10,18,0.55))",
                boxShadow: "inset 0 1px 0 rgba(200,220,255,0.05)",
              }}
            >
              {/* accent glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl transition-all duration-700 group-hover:opacity-90 group-hover:scale-110"
                style={{ background: `radial-gradient(circle, ${b.accent}, transparent 70%)` }}
              />
              {/* iridescent hairline on hover */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px opacity-0 transition group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)` }} />

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10" style={{ background: `linear-gradient(135deg, ${b.accent} / 0.25, transparent)`, backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <I className="h-5 w-5" style={{ color: b.accent, filter: `drop-shadow(0 0 6px ${b.accent})` }} />
                </div>
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{b.eyebrow}</span>
              </div>

              <div className={cn("relative", b.large ? "mt-auto pt-8" : "mt-4")}>
                <h3 className={cn("font-display font-bold text-white", b.large ? "text-2xl sm:text-3xl" : "text-lg")}>
                  {b.title}
                </h3>
                <p className={cn("mt-2 leading-relaxed text-neutral-400", b.large ? "text-[13.5px] max-w-sm" : "text-[12px]")}>
                  {b.body}
                </p>
                {(b.large || b.cta) && (
                  <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 transition group-hover:text-white">
                    Compose
                    <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10.5px] text-neutral-500">
        <span className="flex items-center gap-1.5"><Shield className="h-3 w-3 text-emerald-400" />E2E encrypted</span>
        <span className="text-neutral-800">·</span>
        <span className="flex items-center gap-1.5"><Crown className="h-3 w-3 text-[color:var(--color-iris)]" />SOC 2 · ISO 27001</span>
        <span className="text-neutral-800">·</span>
        <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-[color:var(--color-iris-cyan)]" />Sub-second routing</span>
      </div>
    </div>
  );
}
