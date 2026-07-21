import { useCallback, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
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
import nexusLogo from "@/assets/nexus-x-logo.png";
import { ThemePicker } from "@/components/ThemePicker";
import { Link } from "@tanstack/react-router";
import { PreviewProvider, usePreview, isPreviewable } from "@/components/preview-context";
import { PreviewPanel } from "@/components/PreviewPanel";
import { PlayCircle } from "lucide-react";


const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = "codeaxis.chat.v2";

type Persisted = { threads: ChatThread[]; activeId: string; modelId: string };

const createFreshThread = (): ChatThread => ({
  id: uid(),
  title: "Untitled dossier",
  messages: [],
  updatedAt: Date.now(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const role = value.role === "user" || value.role === "assistant" ? value.role : null;
  const content = typeof value.content === "string" ? value.content : null;
  if (!role || content === null) return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : uid(),
    role,
    content,
    createdAt: finiteNumber(value.createdAt, Date.now()),
    model: typeof value.model === "string" ? value.model : undefined,
    tokens: typeof value.tokens === "number" && Number.isFinite(value.tokens) ? value.tokens : undefined,
    latencyMs: typeof value.latencyMs === "number" && Number.isFinite(value.latencyMs) ? value.latencyMs : undefined,
  };
}

function normalizeThread(value: unknown): ChatThread | null {
  if (!isRecord(value)) return null;
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter((m): m is ChatMessage => Boolean(m))
    : [];
  const fallbackTitle = messages.find((m) => m.role === "user")?.content.slice(0, 48) || "Untitled dossier";
  const latestMessageAt = messages.reduce((latest, m) => Math.max(latest, m.createdAt), 0);
  return {
    id: typeof value.id === "string" && value.id ? value.id : uid(),
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : fallbackTitle,
    messages,
    updatedAt: finiteNumber(value.updatedAt, latestMessageAt || Date.now()),
    model: typeof value.model === "string" ? value.model : undefined,
  };
}

function normalizePersisted(value: unknown): Persisted | null {
  if (!isRecord(value)) return null;
  const threads = Array.isArray(value.threads)
    ? value.threads.map(normalizeThread).filter((t): t is ChatThread => Boolean(t))
    : [];
  const safeThreads = threads.length > 0 ? threads : [createFreshThread()];
  const activeId =
    typeof value.activeId === "string" && safeThreads.some((t) => t.id === value.activeId)
      ? value.activeId
      : safeThreads[0].id;
  const modelId =
    typeof value.modelId === "string" && AI_MODELS.some((m) => m.id === value.modelId)
      ? value.modelId
      : AI_MODELS[0].id;
  return { threads: safeThreads, activeId, modelId };
}

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizePersisted(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const tierIcon = (tier: AIModel["tier"]) =>
  tier === "Signature" ? Crown : tier === "Reserve" ? Diamond : Sparkle;

export function ChatWorkspace() {
  return (
    <PreviewProvider>
      <ChatWorkspaceInner />
    </PreviewProvider>
  );
}

function ChatWorkspaceInner() {
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
      setActiveId(persisted.activeId);
      setModelId(persisted.modelId);
    } else {
      const first = createFreshThread();
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
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The AI provider did not return a response.";
      const asstMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: `**Connection issue**\n\n${detail}\n\nPlease try again in a moment or switch to another Nexus model.`,
        model: modelId,
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
    <div className="relative flex h-screen w-full overflow-hidden text-slate-900" style={{
      background: "linear-gradient(135deg, #eef1ff 0%, #f6f0ff 30%, #eaf6f4 65%, #eef4ff 100%)",
    }}>
      {/* Iridescent ambient blobs (softened for light theme) */}
      <div aria-hidden className="pointer-events-none absolute -top-[15%] left-[15%] h-[620px] w-[620px] rounded-full iris-drift" style={{ background: "radial-gradient(circle, rgba(124,92,255,0.22), transparent 70%)", filter: "blur(120px)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-[10%] right-[5%] h-[520px] w-[520px] rounded-full iris-drift" style={{ background: "radial-gradient(circle, rgba(80,180,220,0.22), transparent 70%)", filter: "blur(120px)", animationDelay: "-6s" }} />
      <div aria-hidden className="pointer-events-none absolute top-[30%] right-[20%] h-[360px] w-[360px] rounded-full iris-drift" style={{ background: "radial-gradient(circle, rgba(120,220,190,0.18), transparent 70%)", filter: "blur(120px)", animationDelay: "-10s" }} />
      <div className="pointer-events-none absolute inset-0 grain" aria-hidden />


      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm md:hidden"
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-full w-[300px] shrink-0 flex-col border-r border-slate-200 transition-transform duration-300",
          "fixed inset-y-0 left-0 z-40 md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:-translate-x-0 md:overflow-hidden md:border-0",
        )}
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(248,246,255,0.72) 100%)",
          backdropFilter: "blur(18px)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="relative flex h-11 w-11 items-center justify-center rgb-halo">
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl blur-xl opacity-80"
              style={{
                background: "conic-gradient(from 0deg, #ff2d95, #ffd400, #2dff88, #00c8ff, #7a5cff, #ff2d95)",
                animation: "rgb-hue 6s linear infinite",
              }}
            />
            <img
              src={nexusLogo}
              alt="Nexus X AI logo"
              width={44}
              height={44}
              className="relative h-11 w-11 object-contain drop-shadow-[0_4px_18px_color-mix(in_oklab,var(--color-iris)_60%,transparent)]"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[color:var(--color-iris-cyan)] shadow-[0_0_12px_color-mix(in_oklab,var(--color-iris-cyan)_80%,transparent)]" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[17px] font-bold leading-tight tracking-tight text-slate-900">
              Nexus <span className="gold-text">X AI</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Free Intelligence Network</div>
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
            <kbd className="relative z-10 rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">⌘N</kbd>
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
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dossiers"
              className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none"
            />
            <kbd className="rounded border border-slate-200 bg-white/70 px-1 py-0.5 text-[9px] font-mono text-slate-500">⌘K</kbd>
          </div>
        </div>

        <div className="mx-5 my-1 h-px bg-gradient-to-r from-transparent via-[color:var(--color-gold)]/25 to-transparent" />

        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Archive</span>
          <span className="text-[10px] text-slate-500">{filtered.length}</span>
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
                    ? "text-slate-900"
                    : "border border-transparent text-slate-700 hover:bg-slate-900/5 hover:text-slate-900",
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
                      className="flex-1 rounded bg-white/70 px-1.5 py-0.5 text-[13px] text-slate-900 outline-none ring-1 ring-[color:var(--color-gold)]/40"
                    />
                    <button onClick={commitRename} className="p-1 text-[color:var(--color-gold)]"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={cancelRename} className="p-1 text-slate-500"><X className="h-3.5 w-3.5" /></button>
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
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span>{new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <span className="text-slate-300">·</span>
                        <span>{t.messages.length} turns</span>
                      </div>
                    </button>
                    <div className="flex items-center opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => startRename(t)} className="p-1 text-slate-500 hover:text-[color:var(--color-gold)]" aria-label="Rename">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteThread(t.id)} className="p-1 text-slate-500 hover:text-red-400" aria-label="Delete">
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
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/60 p-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full p-[1.5px]" style={{
              background: "var(--iris-gradient)",
            }}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                <span className="font-display text-base gold-text">A</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-1 ring-white" style={{ background: "var(--iris-gradient)" }}>
                <Crown className="h-2 w-2 text-white" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="truncate text-[13px] font-medium">Alex Morgan</div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="rounded-sm bg-[color:var(--color-gold)]/15 px-1 py-px font-medium text-[color:var(--color-gold)]">SIGNATURE</span>
                <span className="text-slate-500">alex@codeaxis.io</span>
              </div>
            </div>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-900/5 hover:text-slate-900" aria-label="Settings">
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-900/5 hover:text-slate-900" aria-label="Log out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Developer credit */}
        <div className="border-t border-slate-200 px-4 py-3">
          <div
            className="relative overflow-hidden rounded-xl px-3 py-2.5 text-center"
            style={{
              background: "linear-gradient(90deg, rgba(255,45,149,0.10), rgba(0,200,255,0.10), rgba(122,92,255,0.10))",
              border: "1px solid rgba(122,92,255,0.18)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{
                background: "linear-gradient(90deg, #ff2d95, #ffd400, #2dff88, #00c8ff, #7a5cff, #ff2d95)",
                backgroundSize: "300% 100%",
                animation: "rgb-flow 6s linear infinite",
                filter: "blur(22px)",
              }}
            />
            <div className="relative text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Crafted with care
            </div>
            <div className="relative mt-0.5 text-[13px] font-semibold">
              Developed by <span className="rgb-text">Sam</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex h-full flex-1 flex-col">
        {/* Header */}
        <header className="relative z-10 flex items-center gap-2 border-b border-slate-200 px-3 py-3 sm:gap-3 sm:px-6" style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.35) 100%)",
          backdropFilter: "blur(10px)",
        }}>

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
            aria-label="Toggle sidebar"
          >
            {isMobile ? <Menu className="h-4 w-4" /> : sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>

          {/* Model selector */}
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <button
              onClick={() => setModelOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-white/60 py-1.5 pl-1.5 pr-2 text-left transition hover:border-[color:var(--color-gold)]/40 sm:w-auto sm:gap-2.5 sm:pl-2 sm:pr-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-gold)]/30 bg-white/70">
                {(() => { const I = tierIcon(model.tier); return <I className="h-3.5 w-3.5 text-[color:var(--color-gold)]" />; })()}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="hidden text-[11px] text-slate-500 sm:block">
                  <span className="text-[color:var(--color-gold)]">{model.tier}</span> · Model
                </span>
                <span className="truncate text-[13px] font-medium text-slate-900">{model.name}</span>
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-slate-500 transition", modelOpen && "rotate-180")} />
            </button>
            {modelOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_30px_80px_-20px_rgba(80,90,160,0.35)]" style={{
                  backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,246,255,0.95))",
                }}>

                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Select Intelligence</span>
                    <span className="text-[10px] text-slate-500">4 available</span>
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
                          active ? "bg-[color:var(--color-gold)]/10" : "hover:bg-slate-900/5",
                        )}
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-gold)]/25 bg-white/70">
                          <I className="h-4 w-4 text-[color:var(--color-gold)]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-slate-900">{m.name}</span>
                            {m.badge && (
                              <span className="shrink-0 rounded-sm bg-[color:var(--color-gold)]/15 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-[color:var(--color-gold)]">{m.badge}</span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">{m.tagline}</span>
                          <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-mono">{m.context}</span>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono">{m.price}</span>
                          </span>
                        </span>
                        {active && <Check className="mt-2 h-3.5 w-3.5 shrink-0 text-[color:var(--color-gold)]" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-slate-700 sm:gap-2">
            <span className="hidden items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-1 lg:flex">
              <Shield className="h-3 w-3 text-[color:var(--color-iris-cyan)]" />
              <span>End-to-end encrypted</span>
            </span>
            <span className="hidden items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-1 font-mono md:flex">
              <Zap className="h-3 w-3 text-[color:var(--color-iris-warm)]" />
              <span>{totalTokens.toLocaleString()} tok</span>
            </span>
            <Link
              to="/image"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white/70 px-2.5 text-[11px] font-medium text-slate-700 transition hover:border-[color:var(--color-iris-cyan)]/40 hover:bg-[color:var(--color-iris-cyan)]/[0.08] hover:text-slate-900"
              title="Free unlimited AI image generation"
            >
              <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                <span className="absolute inset-0 rounded-full opacity-70 blur-[3px]" style={{ background: "linear-gradient(135deg, var(--color-iris-deep), var(--color-iris-cyan))" }} />
                <span className="relative h-2 w-2 rounded-full" style={{ background: "linear-gradient(135deg, var(--color-iris-cyan), var(--color-iris-warm))" }} />
              </span>
              <span className="hidden sm:inline">Image Studio</span>
              <span className="sm:hidden">Image</span>
            </Link>
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
        <div className="relative border-t border-slate-200" style={{
          background: "linear-gradient(0deg, rgba(255,255,255,0.92) 60%, rgba(255,255,255,0.5) 100%)",
          backdropFilter: "blur(10px)",
        }}>

          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
            <div className="group relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-[3px] rounded-[20px] opacity-30 blur-lg transition duration-500 group-focus-within:opacity-70 group-hover:opacity-60"
                style={{ background: "var(--iris-gradient)" }}
              />
              <div
                className="relative rounded-2xl border border-slate-200 p-2 transition focus-within:border-[color:var(--color-iris)]/60 iris-animated-border"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,255,0.95))",
                  boxShadow: "0 20px 60px -20px rgba(80,90,160,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
                }}
              >
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Compose a query for Axis Intelligence…"
                  className="max-h-52 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[14px] leading-relaxed text-slate-900 placeholder:text-slate-500 focus:outline-none"
                />
                <div className="flex items-center justify-between px-1.5 pb-1 pt-1.5">
                  <div className="flex items-center gap-0.5">
                    <ComposerBtn label="Attach"><Paperclip className="h-4 w-4" /></ComposerBtn>
                    <ComposerBtn label="Image"><ImageIcon className="h-4 w-4" /></ComposerBtn>
                    <ComposerBtn label="Voice"><Mic className="h-4 w-4" /></ComposerBtn>
                    <ComposerBtn label="Commands"><Command className="h-4 w-4" /></ComposerBtn>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-slate-500 sm:inline">
                      <kbd className="rounded border border-slate-200 bg-white/70 px-1 py-0.5 font-mono">⏎</kbd> send
                      <span className="mx-1 text-slate-300">·</span>
                      <kbd className="rounded border border-slate-200 bg-white/70 px-1 py-0.5 font-mono">⇧⏎</kbd> newline
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

            <div className="mt-2.5 flex items-center justify-center gap-2 text-[10.5px] text-slate-500">
              <span>Powered by <span className="text-[color:var(--color-gold)]">{model.name}</span></span>
              <span className="text-slate-300">·</span>
              <span>Verify critical outputs. Nexus X is an assistant, not an oracle.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Live preview panel (Sandpack) */}
      <PreviewPanel />
    </div>
  );
}

function ComposerBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      className="group relative rounded-lg p-2 text-slate-500 transition hover:text-slate-900"
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
      <div className="my-4 overflow-x-auto rounded-xl border border-slate-200/80">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border-b border-slate-200/80 bg-[color:var(--color-gold)]/[0.06] px-3 py-2 text-left font-medium uppercase tracking-wider text-[11px] text-[color:var(--color-gold-soft)]">{children}</th>;
  },
  td({ children }) {
    return <td className="border-b border-slate-200 px-3 py-2 align-top">{children}</td>;
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
  const { openPreview } = usePreview();
  const previewable = isPreviewable(language);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {/* ignore */}
  };
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-slate-200/80" style={{
      background: "linear-gradient(180deg, #ffffff 0%, #f7f7fb 100%)",
      boxShadow: "0 10px 30px -18px rgba(80,90,160,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
    }}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-iris-warm)]/50" />
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-iris)]/50" />
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-iris-cyan)]/60" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{language}</span>
        </div>
        <div className="flex items-center gap-1">
          {previewable && (
            <button
              onClick={() => openPreview(value, language)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] text-[color:var(--color-iris-deep)] hover:bg-[color:var(--color-iris)]/10"
              aria-label="Open in live preview"
              title="Open in live workspace"
            >
              <PlayCircle className="h-3 w-3" />
              <span className="uppercase tracking-wider">Preview</span>
            </button>
          )}
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] text-slate-500 hover:bg-slate-900/5 hover:text-[color:var(--color-iris-deep)]"
            aria-label="Copy code"
          >
            {copied ? <Check className="h-3 w-3 text-[color:var(--color-iris-deep)]" /> : <Copy className="h-3 w-3" />}
            <span className="uppercase tracking-wider">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneLight}
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
            ? "border-slate-200 bg-white/80"
            : "border-transparent p-[1.5px]",
        )}
        style={!isUser ? { background: "var(--iris-gradient)" } : undefined}
      >
        {isUser ? (
          <span className="text-xs font-medium text-slate-900">A</span>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-white">
            <span className="font-display text-sm leading-none gold-text">C</span>
          </div>
        )}
      </div>
      <div className={cn("min-w-0 max-w-[92%] sm:max-w-[85%]", isUser ? "text-right" : "text-left")}>
        <div className={cn("mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500", isUser && "justify-end")}>
          <span>{isUser ? "You" : "Axis"}</span>
          {!isUser && message.model && (
            <>
              <span className="text-slate-300">·</span>
              <span className="normal-case tracking-normal font-mono text-[color:var(--color-iris-cyan)]/90">
                {AI_MODELS.find((m) => m.id === message.model)?.name ?? message.model}
              </span>
            </>
          )}
          <span className="text-slate-300">·</span>
          <span className="normal-case font-mono">{time}</span>
        </div>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
            isUser
              ? "inline-block text-slate-900"
              : "border border-slate-200 text-slate-900",
          )}
          style={isUser ? {
            background: "linear-gradient(135deg, color-mix(in oklab, var(--color-iris-deep) 55%, transparent), color-mix(in oklab, var(--color-iris) 35%, transparent))",
            border: "1px solid color-mix(in oklab, var(--color-iris) 40%, transparent)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px -12px color-mix(in oklab, var(--color-iris-deep) 60%, transparent)",
          } : {
            background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,250,255,0.86))",
            boxShadow: "0 10px 30px -18px rgba(80,90,160,0.25), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >

          {isUser ? (
            <div className="whitespace-pre-wrap break-words text-left">{message.content}</div>
          ) : (
            <div className="prose prose-slate prose-sm max-w-none break-words prose-p:my-2 prose-headings:font-display prose-headings:tracking-tight prose-headings:mt-3 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-[color:var(--color-iris-deep)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (message.tokens || message.latencyMs) && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-slate-500">
            {message.latencyMs && <span>{(message.latencyMs / 1000).toFixed(2)}s</span>}
            {message.tokens && <><span className="text-slate-200">·</span><span>{message.tokens} tokens</span></>}
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
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-white">
          <span className="font-display text-sm gold-text">C</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Axis · <span className="normal-case tracking-normal font-mono text-[color:var(--color-iris-cyan)]/90">{model.name}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3" style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,250,255,0.86))",
          boxShadow: "0 10px 30px -18px rgba(80,90,160,0.25), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}>
          <div className="relative h-4 w-16 overflow-hidden rounded-full bg-slate-100">
            <div className="absolute inset-0 shimmer-gold" />
          </div>
          <span className="text-[11px] text-slate-700">reasoning…</span>

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
      cls: "sm:col-span-3",
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
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-iris-deep)] backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-iris-cyan)] shadow-[0_0_8px_rgba(120,200,240,0.9)]" />
        <TierI className="h-3 w-3" />
        <span>{model.tier} · {model.name}</span>
      </div>
      <h1 className="text-center font-display text-[44px] font-extrabold leading-[1.02] tracking-tight text-slate-900 sm:text-[60px]">
        What's next,{" "}
        <span className="gold-text italic">Creative?</span>
      </h1>
      <p className="mt-4 max-w-xl text-center text-[14px] leading-relaxed text-slate-500">
        Architect your vision with Nexus X AI — a free multi-model intelligence network wired to Groq, Gemini, DeepSeek and more.
      </p>

      <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" style={{ gridAutoRows: "minmax(170px, auto)" }}>
        {bento.map((b) => {
          const I = b.icon;
          return (
            <button
              key={b.key}
              onClick={() => onPick(b.prompt)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 p-5 text-left transition hover:border-[color:var(--color-iris)]/40 sm:p-6",
                b.cls,
              )}
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,250,255,0.78))",
                boxShadow: "0 20px 50px -30px rgba(80,90,160,0.35), inset 0 1px 0 rgba(255,255,255,0.9)",
              }}
            >
              {/* accent glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl transition-all duration-700 group-hover:opacity-50 group-hover:scale-110"
                style={{ background: `radial-gradient(circle, ${b.accent}, transparent 70%)` }}
              />
              {/* iridescent hairline on hover */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px opacity-0 transition group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)` }} />

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200" style={{ background: "rgba(255,255,255,0.6)" }}>
                  <I className="h-5 w-5" style={{ color: b.accent, filter: `drop-shadow(0 0 6px ${b.accent})` }} />
                </div>
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-slate-500">{b.eyebrow}</span>
              </div>

              <div className={cn("relative", b.large ? "mt-6" : "mt-4")}>
                <h3 className={cn("font-display font-bold text-slate-900", b.large ? "text-2xl sm:text-[28px]" : "text-lg")}>
                  {b.title}
                </h3>
                <p className={cn("mt-2 leading-relaxed text-slate-600", b.large ? "text-[13.5px] max-w-sm" : "text-[12px]")}>
                  {b.body}
                </p>
                {(b.large || b.cta) && (
                  <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--color-iris-ink)] transition group-hover:text-[color:var(--color-iris-deep)]">
                    Compose
                    <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10.5px] text-slate-600">
        <span className="flex items-center gap-1.5"><Shield className="h-3 w-3 text-[color:var(--color-iris-cyan)]" />E2E encrypted</span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5"><Crown className="h-3 w-3 text-[color:var(--color-iris-deep)]" />SOC 2 · ISO 27001</span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-[color:var(--color-iris-warm)]" />Sub-second routing</span>
      </div>
    </div>
  );
}
