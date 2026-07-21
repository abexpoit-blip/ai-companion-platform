import { lazy, Suspense, useState } from "react";
import { X, Code2, Eye, Terminal, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreview, type PreviewPayload } from "./preview-context";

// Sandpack touches window at import; keep it out of the SSR graph.
const SandpackStage = lazy(() => import("./SandpackStage"));

type Tab = "code" | "preview" | "console";

export function PreviewPanel() {
  const { isOpen, payload, closePreview } = usePreview();
  const [tab, setTab] = useState<Tab>("preview");
  const [reloadKey, setReloadKey] = useState(0);

  if (!isOpen || !payload) return null;

  return (
    <aside
      className="relative flex h-full w-full flex-col border-l border-white/[0.06] lg:w-[52%] xl:w-[48%]"
      style={{
        background: "linear-gradient(180deg, rgba(10,10,18,0.95) 0%, rgba(6,6,12,0.98) 100%)",
        backdropFilter: "blur(14px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Live Workspace</span>
        <span className="ml-1 rounded-md border border-white/[0.06] bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
          {payload.lang}
        </span>

        <div className="ml-3 flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-0.5">
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye} label="Preview" />
          <TabBtn active={tab === "code"} onClick={() => setTab("code")} icon={Code2} label="Code" />
          <TabBtn active={tab === "console"} onClick={() => setTab("console")} icon={Terminal} label="Console" />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
            aria-label="Reload preview"
            title="Reload"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={closePreview}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sandpack */}
      <div className="relative flex-1 overflow-hidden">
        <Suspense fallback={<LoadingSkeleton />}>
          <SandpackStage key={reloadKey} payload={payload} tab={tab} />
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
          ? "bg-white/[0.06] text-white shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-iris)_35%,transparent)]"
          : "text-neutral-400 hover:text-white",
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
      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-iris)]" />
        Booting live workspace…
      </div>
    </div>
  );
}

export type { PreviewPayload };
