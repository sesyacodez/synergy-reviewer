import { generateObject } from "ai";
import { z } from "zod";

import type {
  AgentReview,
  ScoredFinding,
  SynthesizedReview,
} from "@/lib/types";
import { getSynthesizerModel } from "@/lib/models/providers";

const synthesizedReviewSchema = z.object({
  consensusFindings: z
    .array(
      z.object({
        file: z.string(),
        line: z.number().optional(),
        endLine: z.number().optional(),
        severity: z.enum(["critical", "warning", "info"]),
        category: z.string(),
        title: z.string(),
        description: z.string(),
        suggestion: z.string().optional(),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe("Confidence score based on cross-agent agreement"),
        agreedBy: z
          .array(z.string())
          .describe("Agent IDs that found this or a similar issue"),
      })
    )
    .describe("Findings reported by 2 or more agents (high confidence)"),
  uniqueFindings: z
    .array(
      z.object({
        file: z.string(),
        line: z.number().optional(),
        endLine: z.number().optional(),
        severity: z.enum(["critical", "warning", "info"]),
        category: z.string(),
        title: z.string(),
        description: z.string(),
        suggestion: z.string().optional(),
        confidence: z.number().min(0).max(1),
        agreedBy: z.array(z.string()),
      })
    )
    .describe(
      "Findings from only 1 agent that you determine are still valid after analysis"
    ),
  disputedFindings: z
    .array(
      z.object({
        file: z.string(),
        line: z.number().optional(),
        endLine: z.number().optional(),
        severity: z.enum(["critical", "warning", "info"]),
        category: z.string(),
        title: z.string(),
        description: z.string(),
        suggestion: z.string().optional(),
        confidence: z.number().min(0).max(1),
        agreedBy: z.array(z.string()),
      })
    )
    .describe(
      "Findings where agents contradict each other or that you determine are likely false positives"
    ),
  overallSummary: z
    .string()
    .describe(
      "A comprehensive 3-5 sentence summary of the PR quality, synthesized from all agent reviews. Note areas of agreement and disagreement."
    ),
  agentSummaries: z
    .record(z.string(), z.string())
    .describe("Map of agentId -> that agent's original summary"),
});

function buildSynthesizerPrompt(reviews: AgentReview[]): string {
  const parts: string[] = [
    "You are a senior engineering lead synthesizing code reviews from multiple independent AI reviewers.",
    "",
    "## Your Task",
    `You received ${reviews.length} independent code reviews of the same pull request from different AI models.`,
    "Each reviewer analyzed the code independently without seeing the others' work.",
    "",
    "Your job is to:",
    "1. Cross-reference all findings across reviewers",
    "2. Group similar findings (same file, similar line range, similar issue)",
    "3. Assign confidence scores based on agreement:",
    "   - 1.0: All reviewers agree on this exact issue",
    "   - 0.8: Majority agree (e.g., 2 of 3)",
    "   - 0.5: Only one reviewer found it, but it's clearly valid after your analysis",
    "   - 0.3: Only one reviewer found it, and it's uncertain",
    "   - 0.1: Likely a false positive or bias artifact",
    "4. Categorize findings as consensus, unique-but-valid, or disputed",
    "5. When findings conflict, use your judgment to determine which is correct",
    "6. Produce a unified, de-biased synthesis",
    "",
    "## Rules",
    "- Prefer findings that multiple agents agree on (these are almost certainly real issues)",
    "- A unique finding from one agent can still be valid -- evaluate it on merit, not just agreement",
    "- If agents contradict each other on the same code, explain the dispute",
    "- Merge duplicate findings into the best-written version",
    "- Use the most specific and helpful description from among the agents",
    "- If a finding has a code suggestion, prefer the most correct one",
    "- Keep the overall summary balanced and actionable",
    "",
    "## Agent Reviews",
    "",
  ];

  for (const review of reviews) {
    parts.push(
      `### Agent: ${review.agentId} (model: ${review.model}, duration: ${review.durationMs}ms)`,
      "",
      `**Summary:** ${review.summary}`,
      "",
      `**Findings (${review.findings.length}):**`,
      "```json",
      JSON.stringify(review.findings, null, 2),
      "```",
      ""
    );
  }

  return parts.join("\n");
}

export async function synthesizeReviews(
  reviews: AgentReview[]
): Promise<SynthesizedReview> {
  if (reviews.length === 0) {
    return {
      consensusFindings: [],
      uniqueFindings: [],
      disputedFindings: [],
      overallSummary: "No agent reviews were completed.",
      agentSummaries: {},
    };
  }

  // If only one agent succeeded, skip synthesis and return its findings directly
  const successfulReviews = reviews.filter((r) => r.findings.length > 0);
  if (successfulReviews.length <= 1) {
    const review = successfulReviews[0] ?? reviews[0];
    return {
      consensusFindings: [],
      uniqueFindings: review.findings.map((f) => ({
        ...f,
        confidence: 0.5,
        agreedBy: [review.agentId],
      })),
      disputedFindings: [],
      overallSummary: review.summary,
      agentSummaries: Object.fromEntries(
        reviews.map((r) => [r.agentId, r.summary])
      ),
    };
  }

  const model = getSynthesizerModel();
  const prompt = buildSynthesizerPrompt(reviews);

  const result = await generateObject({
    model,
    schema: synthesizedReviewSchema,
    system: prompt,
    messages: [
      {
        role: "user",
        content:
          "Synthesize these independent reviews into a single, de-biased assessment. Cross-reference findings and assign confidence scores.",
      },
    ],
    temperature: 0.3,
  });

  return {
    ...result.object,
    agentSummaries: Object.fromEntries(
      reviews.map((r) => [r.agentId, r.summary])
    ),
  };
}
