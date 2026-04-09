import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";

import { env } from "@/lib/env";

export interface AgentSlot {
  id: string;
  provider: string;
  model: LanguageModelV1;
  temperature: number;
}

const DEFAULT_TEMPERATURE = 0.5;

function buildAvailableSlots(): AgentSlot[] {
  const slots: AgentSlot[] = [];

  if (env.ANTHROPIC_API_KEY) {
    slots.push({
      id: "claude",
      provider: "anthropic",
      model: anthropic("claude-sonnet-4-20250514"),
      temperature: DEFAULT_TEMPERATURE,
    });
  }

  if (env.OPENAI_API_KEY) {
    slots.push({
      id: "gpt4",
      provider: "openai",
      model: openai("gpt-4o"),
      temperature: DEFAULT_TEMPERATURE,
    });
  }

  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    slots.push({
      id: "gemini",
      provider: "google",
      model: google("gemini-2.5-pro-preview-05-06"),
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
      "No LLM API keys configured. Set at least ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY."
    );
  }

  const requested = count ?? env.AGENT_COUNT;

  // If fewer providers than requested, cycle through available ones
  const slots: AgentSlot[] = [];
  for (let i = 0; i < requested; i++) {
    const base = cachedSlots[i % cachedSlots.length];
    slots.push({
      ...base,
      id: cachedSlots.length > 1 ? base.id : `${base.id}-${i}`,
      // Vary temperature slightly when reusing the same provider
      temperature:
        i >= cachedSlots.length
          ? base.temperature + (i - cachedSlots.length + 1) * 0.15
          : base.temperature,
    });
  }

  return slots;
}

export function getSynthesizerModel(): LanguageModelV1 {
  const provider = env.SYNTH_MODEL;

  if (provider === "openai" && env.OPENAI_API_KEY) {
    return openai("gpt-4o");
  }
  if (provider === "google" && env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.5-pro-preview-05-06");
  }
  if (env.ANTHROPIC_API_KEY) {
    return anthropic("claude-sonnet-4-20250514");
  }
  if (env.OPENAI_API_KEY) {
    return openai("gpt-4o");
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.5-pro-preview-05-06");
  }

  throw new Error("No LLM API key configured for the synthesizer.");
}
