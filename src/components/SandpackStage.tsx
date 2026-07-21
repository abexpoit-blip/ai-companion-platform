import { useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  useSandpack,
  type SandpackFiles,
} from "@codesandbox/sandpack-react";
import { AlertTriangle, Copy, Check } from "lucide-react";
import type { PreviewPayload, PreviewLang } from "./preview-context";

type Tab = "code" | "preview" | "console";

interface Props {
  payload: PreviewPayload;
  tab: Tab;
}

// Ensure the AI snippet has a default export so `import App from './App'`
// resolves to a component even when authors used `export function Name()`.
function ensureDefaultExport(src: string): string {
  if (/\bexport\s+default\b/.test(src)) return src;
  const m = src.match(/export\s+(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/);
  if (m) return `${src}\n\nexport default ${m[1]};\n`;
  const anyDecl = src.match(/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/);
  if (anyDecl) return `${src}\n\nexport default ${anyDecl[1]};\n`;
  return `${src}\n\nexport default function App(){ return null; }\n`;
}

const REACT_INDEX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")).render(React.createElement(App));
`;

const REACT_STYLES = `:root { color-scheme: dark; }
html, body, #root { height: 100%; margin: 0; }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: #0a0a12;
  color: #f5f5f7;
  padding: 24px;
}
`;

const VANILLA_HTML = (js: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Preview</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a12; color: #f5f5f7; padding: 24px; margin: 0; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      try {
${js}
      } catch (e) {
        console.error(e);
        document.body.innerHTML = '<pre style="color:#ff6b6b;white-space:pre-wrap;font-family:ui-monospace,monospace">' + (e && e.stack || e) + '</pre>';
      }
    </script>
  </body>
</html>`;

const CSS_DEMO_HTML = (css: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a12; color: #f5f5f7; padding: 24px; margin: 0; }
      .demo-grid { display: grid; gap: 16px; }
      .demo-card { padding: 16px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(255,255,255,0.02); }
    </style>
    <style id="user-css">${css}</style>
  </head>
  <body>
    <div class="demo-grid">
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <p>The quick brown fox jumps over the lazy dog. This is a paragraph to showcase typography.</p>
      <div class="demo-card">
        <button class="btn btn-primary">Primary Button</button>
        <button class="btn">Default Button</button>
      </div>
      <a href="#">A sample link</a>
      <ul><li>Item one</li><li>Item two</li><li>Item three</li></ul>
      <input placeholder="Type here…" />
    </div>
  </body>
</html>`;

const MDX_HTML = (md: string) => {
  const escaped = md
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a12; color: #eaeaf0; padding: 32px; margin: 0; max-width: 780px; margin-inline:auto; line-height:1.65; }
      h1,h2,h3 { color:#fff; margin-top:1.6em; }
      code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.9em; }
      pre { background:#111120; padding:14px; border-radius:10px; overflow-x:auto; }
      pre code { background: transparent; padding: 0; }
      blockquote { border-left: 3px solid #6b7cff; margin: 1em 0; padding: 0 1em; color:#c7c9db; }
      table { border-collapse: collapse; width:100%; }
      th, td { border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; text-align:left; }
      a { color: #7ee0ff; }
      img { max-width:100%; border-radius:8px; }
    </style>
  </head>
  <body>
    <article id="content"><p style="color:#888">Rendering…</p></article>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
      const src = \`${escaped}\`;
      try {
        document.getElementById('content').innerHTML = marked.parse(src);
      } catch (e) {
        document.getElementById('content').innerHTML = '<pre style="color:#ff6b6b">' + (e.stack||e) + '</pre>';
      }
    </script>
  </body>
</html>`;
};

type SpTemplate = "react" | "react-ts" | "static" | "vanilla-ts";

function buildFiles(payload: PreviewPayload): { template: SpTemplate; files: SandpackFiles } {
  const lang: PreviewLang = payload.lang;
  if (lang === "react") {
    return {
      template: "react",
      files: {
        "/App.js": { code: payload.code },
        "/index.js": { code: REACT_INDEX, hidden: true },
        "/styles.css": { code: REACT_STYLES, hidden: true },
      },
    };
  }
  if (lang === "react-ts") {
    return {
      template: "react-ts",
      files: {
        "/App.tsx": { code: payload.code },
        "/index.tsx": { code: REACT_INDEX.replace('"./App"', '"./App"'), hidden: true },
        "/styles.css": { code: REACT_STYLES, hidden: true },
      },
    };
  }
  if (lang === "vanilla-ts") {
    return {
      template: "vanilla-ts",
      files: {
        "/src/index.ts": { code: payload.code + "\n// Output logged to console.\n" },
      },
    };
  }
  if (lang === "html") {
    return { template: "static", files: { "/index.html": { code: payload.code } } };
  }
  if (lang === "css") {
    return { template: "static", files: { "/index.html": { code: CSS_DEMO_HTML(payload.code) } } };
  }
  if (lang === "mdx") {
    return { template: "static", files: { "/index.html": { code: MDX_HTML(payload.code) } } };
  }
  return { template: "static", files: { "/index.html": { code: VANILLA_HTML(payload.code) } } };
}

export default function SandpackStage({ payload, tab }: Props) {
  const { template, files } = useMemo(() => buildFiles(payload), [payload]);

  return (
    <SandpackProvider
      template={template}
      theme="dark"
      files={files}
      options={{ recompileMode: "delayed", recompileDelay: 400 }}
      customSetup={
        payload.lang === "react"
          ? { dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" } }
          : undefined
      }
    >
      <div className="sp-stage relative" style={{ height: "100%" }}>
        <ErrorBanner />
        {tab === "preview" && (
          <SandpackPreview
            style={{ height: "100%" }}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
          />
        )}
        {tab === "code" && (
          <SandpackCodeEditor
            style={{ height: "100%" }}
            showTabs
            showLineNumbers
            wrapContent
          />
        )}
        {tab === "console" && <ConsolePane />}
      </div>
    </SandpackProvider>
  );
}

function ErrorBanner() {
  const { sandpack } = useSandpack();
  const [copied, setCopied] = useState(false);
  const err = sandpack.error;
  if (!err) return null;
  const text = `${err.message}${err.path ? `\n at ${err.path}` : ""}${err.line ? `:${err.line}${err.column ? ":" + err.column : ""}` : ""}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div
      className="absolute inset-x-0 top-0 z-10 mx-2 mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[12px] text-red-100 shadow-[0_10px_30px_-10px_rgba(220,38,38,0.5)] backdrop-blur"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300">Runtime error</span>
            {err.path && <span className="truncate font-mono text-[10px] text-red-200/70">{err.path}{err.line ? `:${err.line}` : ""}</span>}
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-red-50/95">
{err.message}
          </pre>
        </div>
        <button
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-400/30 bg-black/30 px-2 py-1 text-[10px] text-red-100 hover:bg-black/50"
          aria-label="Copy error"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function ConsolePane() {
  const { sandpack } = useSandpack();
  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    try {
      const nodes = document.querySelectorAll(".sp-stage .sp-console [class*='log']");
      const text = Array.from(nodes).map((n) => (n as HTMLElement).innerText).join("\n");
      await navigator.clipboard.writeText(text || "(console empty)");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="relative h-full">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          onClick={copyAll}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[10.5px] text-neutral-200 hover:bg-black/80"
          aria-label="Copy console output"
          title="Copy all logs"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy logs"}
        </button>
        <button
          onClick={() => sandpack.runSandpack()}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[10.5px] text-neutral-200 hover:bg-black/80"
          title="Re-run"
        >
          Re-run
        </button>
      </div>
      <SandpackConsole
        style={{ height: "100%" }}
        resetOnPreviewRestart
        showHeader={false}
        showSyntaxError
        showSetupProgress={false}
      />
    </div>
  );
}
