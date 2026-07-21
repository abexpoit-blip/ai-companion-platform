import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { X, Code2, Eye, Terminal, RefreshCw, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreview, type PreviewPayload, type PreviewTab } from "./preview-context";

// Sandpack touches window at import; keep it out of the SSR graph.
const SandpackStage = lazy(() => import("./SandpackStage"));

export function PreviewPanel() {
  const { isOpen, payload, closePreview, tab, setTab, widthPct, setWidthPct } = usePreview();
  const asideRef = useRef<HTMLElement>(null);
  const draggingRef = useRef(false);
  const reloadKeyRef = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const vw = window.innerWidth;
      const pct = ((vw - e.clientX) / vw) * 100;
      setWidthPct(pct);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setWidthPct]);

  if (!isOpen || !payload) return null;

  return (
    <aside
      ref={asideRef}
      className="relative flex h-full shrink-0 flex-col border-l border-slate-200"
      style={{
        width: `min(100%, ${widthPct}%)`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,255,0.95) 100%)",
        backdropFilter: "blur(14px)",
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize preview panel"
        className="group absolute left-0 top-0 z-20 flex h-full w-1.5 -translate-x-1/2 cursor-col-resize items-center justify-center hover:bg-[color:var(--color-iris)]/30"
        title="Drag to resize"
      >
        <div className="pointer-events-none flex h-10 w-3 items-center justify-center rounded-full border border-slate-200 bg-white/80 opacity-0 shadow-lg transition group-hover:opacity-100">
          <GripVertical className="h-3 w-3 text-slate-600" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Live Workspace</span>
        <span className="ml-1 rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          {payload.lang}
        </span>

        <div className="ml-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/60 p-0.5">
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye} label="Preview" />
          <TabBtn active={tab === "code"} onClick={() => setTab("code")} icon={Code2} label="Code" />
          <TabBtn active={tab === "console"} onClick={() => setTab("console")} icon={Terminal} label="Console" />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden font-mono text-[10px] text-slate-500 sm:inline">{Math.round(widthPct)}%</span>
          <button
            onClick={() => { reloadKeyRef.current += 1; /* force remount via key below */ setTab(tab as PreviewTab); }}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
            aria-label="Reload preview"
            title="Reload"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={closePreview}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sandpack */}
      <div className="relative flex-1 overflow-hidden">
        <Suspense fallback={<LoadingSkeleton />}>
          <SandpackStage key={`${payload.lang}-${reloadKeyRef.current}`} payload={payload} tab={tab} />
        </Suspense>
      </div>
    </aside>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition",
        active
          ? "bg-white/70 text-slate-900 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-iris)_35%,transparent)]"
          : "text-slate-500 hover:text-slate-900",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-iris)]" />
        Booting live workspace…
      </div>
    </div>
  );
}

export type { PreviewPayload };
