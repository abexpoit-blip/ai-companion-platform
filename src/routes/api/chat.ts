import { createFileRoute } from "@tanstack/react-router";
import { callChatCompletion, resolveFallbackRoute, resolveRoute } from "@/lib/ai-gateway.server";

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

function withPollinationsInstruction(messages: IncomingMessage[]): IncomingMessage[] {
  const index = messages.findIndex((message) => message.role === "user" && message.content.trim());
  if (index === -1) return messages;
  return messages.map((message, i) =>
    i === index
      ? { ...message, content: `${SYSTEM_PROMPT}\n\nUser request:\n${message.content}` }
      : message,
  );
}

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
        const normalizedMessages = messages
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
          }));

        const cleanMessages =
          route.config.id === "pollinations"
            ? withPollinationsInstruction(normalizedMessages)
            : [{ role: "system" as const, content: SYSTEM_PROMPT }, ...normalizedMessages];

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
          if (route.config.id === "pollinations") {
            const fallback = resolveFallbackRoute("pollinations");
            if (!("error" in fallback)) {
              try {
                const { content, tokens } = await callChatCompletion(
                  fallback.config,
                  fallback.upstream,
                  [{ role: "system" as const, content: SYSTEM_PROMPT }, ...normalizedMessages],
                );
                return Response.json({
                  content,
                  model: fallback.friendlyId,
                  provider: fallback.config.id,
                  primaryProvider: route.config.id,
                  tokens,
                  latencyMs: Date.now() - started,
                });
              } catch {
                // Return the primary-provider error below so the UI shows the real first failure.
              }
            }
          }
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
