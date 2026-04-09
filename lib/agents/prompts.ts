import { z } from "zod";

export const reviewFindingSchema = z.object({
  file: z.string().describe("Relative file path from repo root"),
  line: z.number().optional().describe("Start line number of the issue"),
  endLine: z.number().optional().describe("End line number if spanning multiple lines"),
  severity: z.enum(["critical", "warning", "info"]).describe(
    "critical = bugs, security vulns, data loss. warning = performance, error handling gaps. info = style, readability."
  ),
  category: z.string().describe(
    "One of: security, performance, bug, error-handling, race-condition, style, testing, architecture, accessibility, other"
  ),
  title: z.string().describe("Short title summarizing the issue (max 80 chars)"),
  description: z.string().describe(
    "Detailed explanation of the issue: what is wrong, why it matters, and how to fix it"
  ),
  suggestion: z
    .string()
    .optional()
    .describe("Corrected code snippet if applicable (just the fixed lines, not the whole file)"),
});

export const agentOutputSchema = z.object({
  findings: z.array(reviewFindingSchema).describe(
    "All issues found during the review. Empty array if the code looks good."
  ),
  summary: z.string().describe(
    "A 2-4 sentence overall assessment of the PR quality and key concerns."
  ),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

export function buildReviewerSystemPrompt(
  prNumber: number,
  repoFullName: string,
  diff: string,
  changedFiles: string[],
  userInstruction: string
): string {
  const parts: string[] = [
    `You are an expert code reviewer analyzing PR #${prNumber} in ${repoFullName}.`,
    "",
    "Your job is to independently review this pull request for issues. You must be thorough but avoid false positives. Only report genuine problems.",
    "",
    "## Review Focus Areas",
    "- **Bugs**: Logic errors, off-by-one errors, null/undefined issues, incorrect types",
    "- **Security**: Injection, auth bypass, secrets exposure, unsafe deserialization",
    "- **Performance**: Unnecessary computation, N+1 queries, missing memoization, large bundle impact",
    "- **Error handling**: Unhandled promise rejections, missing try/catch, swallowed errors",
    "- **Race conditions**: Concurrent access issues, stale closures, missing locks",
    "- **Architecture**: Tight coupling, circular dependencies, poor separation of concerns",
    "- **Testing**: Missing tests for critical paths, brittle tests",
    "",
    "## Rules",
    "- Do NOT nitpick formatting or style unless it causes actual confusion",
    "- Do NOT report issues in unchanged code unless directly related to the PR changes",
    "- Be specific: reference exact file paths and line numbers",
    "- For each issue, explain WHY it matters, not just what it is",
    "- If you suggest a fix, provide the corrected code snippet",
    "- If the code looks good, return an empty findings array with a positive summary",
    "",
    "## Changed Files",
    changedFiles.map((f) => `- ${f}`).join("\n"),
    "",
    "## PR Diff",
    "```diff",
    diff.length > 100_000
      ? diff.slice(0, 100_000) + "\n...(diff truncated)"
      : diff,
    "```",
  ];

  if (userInstruction) {
    parts.push("", "## User Instructions", userInstruction);
  }

  parts.push(
    "",
    "## Output",
    "After reviewing, output your findings as a JSON object wrapped in ```json code fences.",
    "You MUST use exactly this format:",
    "",
    "```json",
    "{",
    '  "findings": [',
    "    {",
    '      "file": "path/to/file.ts",',
    '      "line": 42,',
    '      "endLine": 45,',
    '      "severity": "critical | warning | info",',
    '      "category": "security | performance | bug | error-handling | race-condition | style | testing | architecture | other",',
    '      "title": "Short title (max 80 chars)",',
    '      "description": "Detailed explanation: what is wrong, why it matters, how to fix it",',
    '      "suggestion": "corrected code snippet (optional)"',
    "    }",
    "  ],",
    '  "summary": "2-4 sentence overall assessment of the PR quality"',
    "}",
    "```",
    "",
    "IMPORTANT: Output ONLY the JSON block after your analysis. No extra text after the JSON.",
    "If the code looks good, return an empty findings array with a positive summary."
  );

  return parts.join("\n");
}
