import { createFileRoute } from "@tanstack/react-router";
import { callChatCompletion, resolveRoute } from "@/lib/ai-gateway.server";

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatBody {
  messages?: IncomingMessage[];
  modelId?: string;
}

const SYSTEM_PROMPT = `You are Nexus X AI — a premium, precise coding and product intelligence assistant.
Respond in clean Markdown. Use fenced code blocks with language tags (tsx, ts, js, html, css, sql, bash, json)
whenever you include code. Prefer tables for comparisons and bullet lists for enumerations. Be concise, senior,
and opinionated. When appropriate, include one small runnable example.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }

        const route = resolveRoute(body.modelId || "nx-pollinations");
        if ("error" in route) {
          return Response.json({ error: route.error }, { status: 500 });
        }

        const started = Date.now();
        const cleanMessages = [
          { role: "system" as const, content: SYSTEM_PROMPT },
          ...messages
            .filter((m) => m && typeof m.content === "string" && m.content.length > 0)
            .slice(-16)
            .map((m) => ({
              role:
                m.role === "assistant"
                  ? ("assistant" as const)
                  : m.role === "system"
                  ? ("system" as const)
                  : ("user" as const),
              content: m.content,
            })),
        ];

        try {
          const { content, tokens } = await callChatCompletion(
            route.config,
            route.upstream,
            cleanMessages,
          );
          return Response.json({
            content,
            model: route.friendlyId,
            provider: route.config.id,
            tokens,
            latencyMs: Date.now() - started,
          });
        } catch (err) {
          const e = err as Error & { status?: number };
          const status =
            e.status === 429
              ? 429
              : e.status === 401 || e.status === 402 || e.status === 403
              ? 402
              : 500;
          return Response.json(
            { error: e.message, model: route.friendlyId, provider: route.config.id },
            { status },
          );
        }
      },
    },
  },
});
