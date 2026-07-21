import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider, resolveGatewayModel } from "@/lib/ai-gateway.server";

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatBody {
  messages?: IncomingMessage[];
  modelId?: string;
}

const SYSTEM_PROMPT = `You are CodeAxis Studio AI — a premium, precise coding and product intelligence assistant.
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

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json(
            { error: "LOVABLE_API_KEY is not configured on the server." },
            { status: 500 },
          );
        }

        const gateway = createLovableAiGatewayProvider(key);
        const modelId = resolveGatewayModel(body.modelId);
        const model = gateway(modelId);

        const started = Date.now();
        try {
          const result = await generateText({
            model,
            system: SYSTEM_PROMPT,
            messages: messages
              .filter((m) => m && typeof m.content === "string" && m.content.length > 0)
              .map((m) => ({
                role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
                content: m.content,
              })),
          });

          const latencyMs = Date.now() - started;
          const usage = result.usage ?? {};
          const tokens =
            (usage as { totalTokens?: number }).totalTokens ??
            Math.round(result.text.length / 3.6);

          return Response.json({
            content: result.text,
            model: modelId,
            tokens,
            latencyMs,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const lower = message.toLowerCase();
          let status = 500;
          if (lower.includes("429") || lower.includes("rate")) status = 429;
          else if (lower.includes("402") || lower.includes("credit")) status = 402;
          return Response.json({ error: message, model: modelId }, { status });
        }
      },
    },
  },
});
