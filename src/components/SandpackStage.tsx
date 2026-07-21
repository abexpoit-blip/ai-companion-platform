import { useMemo } from "react";
import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  type SandpackFiles,
} from "@codesandbox/sandpack-react";
import type { PreviewPayload } from "./preview-context";

type Tab = "code" | "preview" | "console";

interface Props {
  payload: PreviewPayload;
  tab: Tab;
}

const REACT_INDEX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
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
    <script>${js}</script>
  </body>
</html>`;

export default function SandpackStage({ payload, tab }: Props) {
  const { template, files } = useMemo(() => {
    if (payload.lang === "react") {
      return {
        template: "react" as const,
        files: {
          "/App.js": { code: payload.code },
          "/index.js": { code: REACT_INDEX, hidden: true },
          "/styles.css": { code: REACT_STYLES, hidden: true },
        },
      };
    }
    if (payload.lang === "html") {
      return {
        template: "static" as const,
        files: {
          "/index.html": { code: payload.code },
        },
      };
    }
    // vanilla js
    return {
      template: "static" as const,
      files: {
        "/index.html": { code: VANILLA_HTML(payload.code) },
      },
    };
  }, [payload]);

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
      <div className="sp-stage" style={{ height: "100%" }}>
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
        {tab === "console" && (
          <SandpackConsole style={{ height: "100%" }} resetOnPreviewRestart />
        )}
      </div>
    </SandpackProvider>
  );
}
