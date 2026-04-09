import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

import { env } from "@/lib/env";

export interface AgentSlot {
  id: string;
  provider: string;
  model: LanguageModelV1;
  temperature: number;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const DEFAULT_TEMPERATURE = 0.5;

/** Distinct free models for ensemble diversity; override with OPENROUTER_REVIEW_MODELS. */
const DEFAULT_REVIEW_MODELS = [
  "meta-llama/llama-3.2-3b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-2-9b-it:free",
] as const;

const DEFAULT_SYNTH_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

let cachedClient: ReturnType<typeof createOpenAI> | null = null;

function parseReviewModelIds(): string[] {
  const raw = env.OPENROUTER_REVIEW_MODELS?.trim();
  if (raw) {
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) return ids;
  }
  return [...DEFAULT_REVIEW_MODELS];
}

function shortIdFromModel(modelId: string): string {
  const segment = modelId.split("/").pop() ?? modelId;
  const base = segment.split(":")[0] ?? segment;
  const slug = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 28);
  return slug || "model";
}

function getOpenRouter(): ReturnType<typeof createOpenAI> {
  const key = env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Create a key at https://openrouter.ai (free `:free` models available)."
    );
  }
  if (!cachedClient) {
    cachedClient = createOpenAI({
      baseURL: OPENROUTER_BASE,
      apiKey: key,
      headers: {
        ...(env.OPENROUTER_HTTP_REFERER?.trim() && {
          "HTTP-Referer": env.OPENROUTER_HTTP_REFERER.trim(),
        }),
        "X-Title": "Synergy Reviewer",
      },
    });
  }
  return cachedClient;
}

function buildAvailableSlots(): AgentSlot[] {
  const client = getOpenRouter();
  const modelIds = parseReviewModelIds();
  const slots: AgentSlot[] = [];
  const seenIds = new Map<string, number>();

  for (const modelId of modelIds) {
    let id = shortIdFromModel(modelId);
    const n = (seenIds.get(id) ?? 0) + 1;
    seenIds.set(id, n);
    if (n > 1) id = `${id}-${n}`;

    slots.push({
      id,
      provider: "openrouter",
      model: client(modelId),
      temperature: DEFAULT_TEMPERATURE,
    });
  }

  return slots;
}

let cachedSlots: AgentSlot[] | null = null;

export function getAgentSlots(count?: number): AgentSlot[] {
  if (!cachedSlots) {
    cachedSlots = buildAvailableSlots();
  }

  if (cachedSlots.length === 0) {
    throw new Error(
      "No review models configured. Set OPENROUTER_REVIEW_MODELS to a comma-separated list of OpenRouter model IDs."
    );
  }

  const requested = count ?? env.AGENT_COUNT;

  const slots: AgentSlot[] = [];
  for (let i = 0; i < requested; i++) {
    const base = cachedSlots[i % cachedSlots.length];
    const id =
      i < cachedSlots.length && cachedSlots.length > 1
        ? base.id
        : `${base.id}-${i}`;
    slots.push({
      ...base,
      id,
      temperature:
        i >= cachedSlots.length
          ? base.temperature + (i - cachedSlots.length + 1) * 0.15
          : base.temperature,
    });
  }

  return slots;
}

export function getSynthesizerModel(): LanguageModelV1 {
  const client = getOpenRouter();
  const modelId = env.OPENROUTER_SYNTH_MODEL?.trim() || DEFAULT_SYNTH_MODEL;
  return client(modelId);
}
