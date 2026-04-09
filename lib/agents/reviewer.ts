import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";

import type { AgentReview, ReviewFinding } from "@/lib/types";
import {
  buildReviewerSystemPrompt,
  agentOutputSchema,
} from "./prompts";

export interface ReviewAgentConfig {
  agentId: string;
  model: LanguageModelV1;
  temperature: number;
  sandboxPath: string;
  prNumber: number;
  repoFullName: string;
  diff: string;
  changedFiles: string[];
  userInstruction: string;
}

export async function runReviewAgent(
  config: ReviewAgentConfig
): Promise<AgentReview> {
  const startTime = Date.now();

  const systemPrompt = buildReviewerSystemPrompt(
    config.prNumber,
    config.repoFullName,
    config.diff,
    config.changedFiles,
    config.userInstruction
  );

  try {
    const result = await generateText({
      model: config.model,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Review this PR thoroughly based on the diff provided. Analyze for security vulnerabilities, bugs, performance issues, and code quality problems. Output your findings as JSON.",
        },
      ],
      maxSteps: 1,
      temperature: config.temperature,
    });

    const findings = extractFindings(result.text);

    return {
      agentId: config.agentId,
      model: config.model.modelId ?? config.agentId,
      findings: findings.findings,
      summary: findings.summary,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    console.error(`[agent:${config.agentId}] review failed:`, err);
    return {
      agentId: config.agentId,
      model: config.model.modelId ?? config.agentId,
      findings: [],
      summary: `Agent ${config.agentId} failed to complete the review: ${String(err)}`,
      durationMs: Date.now() - startTime,
    };
  }
}

function extractFindings(text: string): {
  findings: ReviewFinding[];
  summary: string;
} {
  // Try to parse structured JSON from the response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  const rawJson = jsonMatch ? jsonMatch[1] : text;

  // Try to find a JSON object in the text
  const objectMatch = rawJson.match(/\{[\s\S]*"findings"[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = agentOutputSchema.parse(JSON.parse(objectMatch[0]));
      return parsed;
    } catch {
      // fall through
    }
  }

  // Try to find a JSON array of findings
  const arrayMatch = rawJson.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const arr = JSON.parse(arrayMatch[0]);
      if (Array.isArray(arr)) {
        return {
          findings: arr.filter(
            (f: unknown) =>
              typeof f === "object" &&
              f !== null &&
              "file" in f &&
              "title" in f
          ) as ReviewFinding[],
          summary: extractSummaryFromText(text),
        };
      }
    } catch {
      // fall through
    }
  }

  // Fallback: no structured output, treat entire text as summary
  return {
    findings: [],
    summary: text.slice(0, 2000),
  };
}

function extractSummaryFromText(text: string): string {
  const summaryMatch = text.match(
    /(?:summary|overall|conclusion)[:\s]*(.{20,500})/i
  );
  if (summaryMatch) return summaryMatch[1].trim();
  // Take the last paragraph as summary
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return paragraphs[paragraphs.length - 1]?.slice(0, 500) ?? "";
}
