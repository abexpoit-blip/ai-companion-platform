import { useEffect, useState } from "react";
import type { PreviewPayload } from "./preview-context";

type Tab = "code" | "preview" | "console";

interface Props {
  payload: PreviewPayload;
  tab: Tab;
}

type RuntimeComponent = (props: Props) => JSX.Element;

export default function SandpackStage(props: Props) {
  const [Runtime, setRuntime] = useState<RuntimeComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    import("./SandpackRuntime")
      .then((mod) => {
        if (mounted) setRuntime(() => mod.default as RuntimeComponent);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Preview engine failed to load.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loadError) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-xs text-red-200">
        <div className="max-w-sm rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="font-semibold text-red-100">Preview engine failed to start</p>
          <p className="mt-2 break-words font-mono text-[11px] text-red-200/80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!Runtime) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-iris)]" />
          Loading preview engine…
        </div>
      </div>
    );
  }

  return <Runtime {...props} />;
}
