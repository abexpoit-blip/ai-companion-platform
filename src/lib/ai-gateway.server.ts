// Multi-provider free-AI gateway for Nexus X AI.
// Pollinations Text is the primary no-key route; other providers auto-enable from env keys.
// All providers use OpenAI-compatible chat completions.

export type ProviderId = "pollinations" | "groq" | "gemini" | "openrouter" | "ollama" | "lovable";

interface ProviderConfig {
  id: ProviderId;
  baseURL: string;
  chatPath?: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
}

function providerFromEnv(id: ProviderId): ProviderConfig | null {
  switch (id) {
    case "pollinations":
      return { id, baseURL: "https://text.pollinations.ai", chatPath: "/openai" };
    case "groq": {
      const key = process.env.GROQ_API_KEY;
      if (!key) return null;
      return { id, baseURL: "https://api.groq.com/openai/v1", apiKey: key };
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!key) return null;
      return { id, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: key };
    }
    case "openrouter": {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return null;
      return {
        id,
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: key,
        extraHeaders: {
          "HTTP-Referer": "https://nexusx.ai",
          "X-Title": "Nexus X AI",
        },
      };
    }
    case "ollama": {
      const url = process.env.OLLAMA_BASE_URL;
      if (!url) return null;
      return { id, baseURL: url.replace(/\/$/, "") + "/v1", apiKey: "ollama" };
    }
    case "lovable": {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) return null;
      return {
        id,
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey: key,
      };
    }
  }
}

// Friendly model ids used in the UI -> { provider, upstream model name }
const MODEL_ROUTES: Record<string, { provider: ProviderId; upstream: string }> = {
  // Pollinations Text — primary no-key route, anonymous OpenAI-compatible endpoint
  "nx-pollinations":  { provider: "pollinations", upstream: "openai" },
  // Groq — blazing fast, generous free tier
  "nx-flash":         { provider: "groq",       upstream: "llama-3.3-70b-versatile" },
  "nx-lite":          { provider: "groq",       upstream: "llama-3.1-8b-instant" },
  "nx-reasoner":      { provider: "groq",       upstream: "deepseek-r1-distill-llama-70b" },
  // Google Gemini — free tier
  "nx-gemini":        { provider: "gemini",     upstream: "gemini-2.0-flash" },
  "nx-gemini-pro":    { provider: "gemini",     upstream: "gemini-2.5-flash" },
  // OpenRouter — many free-tier models
  "nx-deepseek":      { provider: "openrouter", upstream: "deepseek/deepseek-chat-v3.1:free" },
  "nx-llama-or":      { provider: "openrouter", upstream: "meta-llama/llama-3.3-70b-instruct:free" },
  // Ollama — user's own local
  "nx-local":         { provider: "ollama",     upstream: process.env.OLLAMA_MODEL || "llama3.1" },
  // Lovable fallback
  "nx-lovable":       { provider: "lovable",    upstream: "google/gemini-3.5-flash" },
};

const PROVIDER_ORDER: ProviderId[] = ["pollinations", "groq", "gemini", "openrouter", "ollama", "lovable"];

export function resolveRoute(
  friendlyId: string | undefined,
): { config: ProviderConfig; upstream: string; friendlyId: string } | { error: string } {
  // Explicit pick
  if (friendlyId && MODEL_ROUTES[friendlyId]) {
    const r = MODEL_ROUTES[friendlyId];
    const cfg = providerFromEnv(r.provider);
    if (cfg) return { config: cfg, upstream: r.upstream, friendlyId };
  }
  // Auto-fallback: first available provider's default model
  for (const p of PROVIDER_ORDER) {
    const cfg = providerFromEnv(p);
    if (!cfg) continue;
    const defaults: Record<ProviderId, string> = {
      pollinations: "nx-pollinations",
      groq: "nx-flash",
      gemini: "nx-gemini",
      openrouter: "nx-deepseek",
      ollama: "nx-local",
      lovable: "nx-lovable",
    };
    const fid = defaults[p];
    return { config: cfg, upstream: MODEL_ROUTES[fid].upstream, friendlyId: fid };
  }
  return {
    error:
      "No AI provider is available right now. Pollinations Text should work without a key; check outbound network access or add GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, OLLAMA_BASE_URL, or LOVABLE_API_KEY.",
  };
}

export function resolveFallbackRoute(
  excludedProvider: ProviderId,
): { config: ProviderConfig; upstream: string; friendlyId: string } | { error: string } {
  const defaults: Record<ProviderId, string> = {
    pollinations: "nx-pollinations",
    groq: "nx-flash",
    gemini: "nx-gemini",
    openrouter: "nx-deepseek",
    ollama: "nx-local",
    lovable: "nx-lovable",
  };

  for (const provider of PROVIDER_ORDER) {
    if (provider === excludedProvider) continue;
    const config = providerFromEnv(provider);
    if (!config) continue;
    const friendlyId = defaults[provider];
    return { config, upstream: MODEL_ROUTES[friendlyId].upstream, friendlyId };
  }

  return { error: "No fallback AI provider is configured right now." };
}

export async function callChatCompletion(
  config: ProviderConfig,
  upstreamModel: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<{ content: string; tokens: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.extraHeaders ?? {}),
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const body =
    config.id === "pollinations"
      ? {
          model: upstreamModel,
          messages: messages
            .filter((message) => message.role !== "system")
            .map((message) => ({ role: message.role, content: message.content })),
        }
      : {
          model: upstreamModel,
          messages,
          temperature: 0.7,
          stream: false,
        };

  const res = await fetch(`${config.baseURL}${config.chatPath ?? "/chat/completions"}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`[${config.id}] ${res.status} ${text.slice(0, 400)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const tokens = data.usage?.total_tokens ?? Math.round(content.length / 3.6);
  return { content, tokens };
}
