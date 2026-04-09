import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),

    GITHUB_APP_ID: z.string().min(1).default(""),
    GITHUB_APP_INSTALLATION_ID: z.coerce.number().int().default(0),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1).default(""),
    GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).default(""),

    SYNTH_MODEL: z
      .enum(["anthropic", "openai", "google"])
      .default("anthropic"),
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
