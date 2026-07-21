import { createContext, useContext, useState, type ReactNode } from "react";

export type PreviewLang =
  | "react"
  | "react-ts"
  | "html"
  | "vanilla"
  | "vanilla-ts"
  | "css"
  | "mdx";
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

const hasJsx = (code: string) =>
  /<\/[A-Za-z][\w.-]*>|<[A-Z][\w.-]*[\s/>]|<[a-z]+[^<>]*\/>/.test(code) ||
  /\bimport\s+React\b|from\s+["']react["']/.test(code);

function smartDetect(code: string, rawLang: string): PreviewLang {
  const l = rawLang.toLowerCase();
  if (l === "html" || l === "htm") return "html";
  if (l === "css") return "css";
  if (l === "mdx" || l === "md" || l === "markdown") return "mdx";
  if (l === "tsx") return "react-ts";
  if (l === "jsx") return "react";
  if (l === "ts" || l === "typescript") return hasJsx(code) ? "react-ts" : "vanilla-ts";
  if (l === "js" || l === "javascript") {
    if (hasJsx(code)) return "react";
    if (/<!doctype html>|<html[\s>]|<body[\s>]/i.test(code)) return "html";
    return "vanilla";
  }
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
