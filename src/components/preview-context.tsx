import { createContext, useContext, useState, type ReactNode } from "react";

export type PreviewLang = "react" | "html" | "vanilla" | "css" | "mdx";
export type PreviewTab = "preview" | "code" | "console";

export interface PreviewPayload {
  code: string;
  lang: PreviewLang;
}

interface PreviewContextValue {
  payload: PreviewPayload | null;
  isOpen: boolean;
  tab: PreviewTab;
  setTab: (t: PreviewTab) => void;
  widthPct: number;
  setWidthPct: (n: number) => void;
  openPreview: (code: string, rawLang: string) => void;
  closePreview: () => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

const PREVIEWABLE = new Set([
  "jsx", "tsx", "js", "javascript", "ts", "typescript",
  "html", "htm", "css", "mdx", "md", "markdown",
]);

export function isPreviewable(lang: string) {
  return PREVIEWABLE.has(lang.toLowerCase());
}

function detectLang(rawLang: string): PreviewLang {
  const l = rawLang.toLowerCase();
  if (l === "html" || l === "htm") return "html";
  if (l === "jsx" || l === "tsx") return "react";
  if (l === "css") return "css";
  if (l === "mdx" || l === "md" || l === "markdown") return "mdx";
  // ts/js — treat React-looking code as react, otherwise vanilla
  return "vanilla";
}

function smartDetect(code: string, rawLang: string): PreviewLang {
  const base = detectLang(rawLang);
  if (base !== "vanilla") return base;
  // Heuristics: JSX / React hints -> react template
  if (/\bimport\s+React\b|from\s+["']react["']|export\s+default\s+function|<\/[A-Za-z][\w.-]*>|<[A-Z][\w.-]*[\s/>]/.test(code)) {
    return "react";
  }
  // <html>/<body> -> html
  if (/<!doctype html>|<html[\s>]|<body[\s>]/i.test(code)) return "html";
  return "vanilla";
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("preview");
  const [widthPct, setWidthPctState] = useState(48);

  const setWidthPct = (n: number) => setWidthPctState(Math.min(75, Math.max(28, n)));

  const openPreview = (code: string, rawLang: string) => {
    setPayload({ code, lang: smartDetect(code, rawLang) });
    setIsOpen(true);
    setTab("preview"); // always focus Preview tab on open
  };

  const closePreview = () => setIsOpen(false);

  return (
    <PreviewContext.Provider value={{ payload, isOpen, tab, setTab, widthPct, setWidthPct, openPreview, closePreview }}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("usePreview must be used within PreviewProvider");
  return ctx;
}
