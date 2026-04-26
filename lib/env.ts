import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    OPENROUTER_API_KEY: z.string().min(1),
    /** Optional; OpenRouter uses this for rankings on https://openrouter.ai */
    OPENROUTER_HTTP_REFERER: z.string().optional(),
    /** Comma-separated OpenRouter model IDs (default: three `:free` models). */
    OPENROUTER_REVIEW_MODELS: z.string().optional(),
    OPENROUTER_SYNTH_MODEL: z.string().optional(),

    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_INSTALLATION_ID: z.coerce.number().int().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),

    AGENT_COUNT: z.coerce.number().int().min(1).max(5).default(3),
  },
  experimental__runtimeEnv: {},
  skipValidation:
    Boolean(process.env.SKIP_ENV_VALIDATION) ||
    process.env.NODE_ENV === "production",
});

export function assertConfigured(): void {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY || !env.GITHUB_APP_WEBHOOK_SECRET) {
    throw new Error(
      "Missing required GitHub App environment variables. " +
      "Set GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_WEBHOOK_SECRET."
    );
  }
}
