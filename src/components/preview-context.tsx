import { createContext, useContext, useState, type ReactNode } from "react";

export type PreviewLang = "react" | "html" | "vanilla";

export interface PreviewPayload {
  code: string;
  lang: PreviewLang;
}

interface PreviewContextValue {
  payload: PreviewPayload | null;
  isOpen: boolean;
  openPreview: (code: string, rawLang: string) => void;
  closePreview: () => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

const PREVIEWABLE = new Set([
  "jsx", "tsx", "js", "javascript", "ts", "typescript", "html", "htm", "css",
]);

export function isPreviewable(lang: string) {
  return PREVIEWABLE.has(lang.toLowerCase());
}

function detectLang(rawLang: string): PreviewLang {
  const l = rawLang.toLowerCase();
  if (l === "html" || l === "htm") return "html";
  if (l === "jsx" || l === "tsx") return "react";
  return "vanilla";
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openPreview = (code: string, rawLang: string) => {
    setPayload({ code, lang: detectLang(rawLang) });
    setIsOpen(true);
  };

  const closePreview = () => setIsOpen(false);

  return (
    <PreviewContext.Provider value={{ payload, isOpen, openPreview, closePreview }}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("usePreview must be used within PreviewProvider");
  return ctx;
}
