import type { PRContext, ScoredFinding } from "@/lib/types";
import { getInstallationOctokit } from "./app";

export async function addReaction(
  owner: string,
  repo: string,
  commentId: number,
  reaction: "eyes" | "+1" | "-1" | "rocket"
) {
  try {
    const octokit = await getInstallationOctokit();
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: commentId,
      content: reaction,
    });
  } catch (err) {
    console.warn("[publisher] failed to add reaction:", err);
  }
}

export async function postInlineComments(
  ctx: PRContext,
  findings: ScoredFinding[]
) {
  const octokit = await getInstallationOctokit();

  // Get the latest commit SHA for inline comments
  const { data: pr } = await octokit.rest.pulls.get({
    owner: ctx.owner,
    repo: ctx.repo,
    pull_number: ctx.prNumber,
  });
  const commitSha = pr.head.sha;

  const comments = findings
    .filter((f) => f.file && f.line)
    .map((f) => {
      let body = `**${severityEmoji(f.severity)} ${f.title}** (confidence: ${Math.round(f.confidence * 100)}%)\n\n`;
      body += f.description;

      if (f.agreedBy.length > 1) {
        body += `\n\n_Found independently by ${f.agreedBy.length} agents: ${f.agreedBy.join(", ")}_`;
      }

      if (f.suggestion) {
        body += `\n\n\`\`\`suggestion\n${f.suggestion}\n\`\`\``;
      }

      return {
        path: f.file,
        line: f.line!,
        body,
      };
    });

  if (comments.length === 0) return;

  try {
    await octokit.rest.pulls.createReview({
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.prNumber,
      commit_id: commitSha,
      event: "COMMENT",
      comments,
    });
  } catch (err) {
    console.warn(
      "[publisher] failed to post inline review, falling back to individual comments:",
      err
    );
    // Fall back to individual comments if the batch fails
    for (const comment of comments.slice(0, 20)) {
      try {
        await octokit.rest.pulls.createReviewComment({
          owner: ctx.owner,
          repo: ctx.repo,
          pull_number: ctx.prNumber,
          commit_id: commitSha,
          path: comment.path,
          line: comment.line,
          body: comment.body,
        });
      } catch {
        // skip individual failures
      }
    }
  }
}

interface SummaryMeta {
  consensusCount: number;
  uniqueCount: number;
  disputedCount: number;
  agentCount: number;
  totalAgents: number;
  failedAgents: number;
}

export async function postSummaryComment(
  ctx: PRContext,
  overallSummary: string,
  allFindings: ScoredFinding[],
  agentSummaries: Record<string, string>,
  meta?: SummaryMeta
) {
  const octokit = await getInstallationOctokit();

  const body = buildSummaryBody(
    overallSummary,
    allFindings,
    agentSummaries,
    meta
  );

  await octokit.rest.issues.createComment({
    owner: ctx.owner,
    repo: ctx.repo,
    issue_number: ctx.prNumber,
    body,
  });
}

function buildSummaryBody(
  overallSummary: string,
  allFindings: ScoredFinding[],
  agentSummaries: Record<string, string>,
  meta?: SummaryMeta
): string {
  const parts: string[] = ["## Synergy Review"];

  if (meta) {
    parts.push(
      "",
      `> ${meta.agentCount}/${meta.totalAgents} agents completed | ` +
        `${meta.consensusCount} consensus | ${meta.uniqueCount} unique | ${meta.disputedCount} disputed` +
        (meta.failedAgents > 0
          ? ` | ${meta.failedAgents} failed`
          : ""),
      ""
    );
  }

  parts.push("### Summary", "", overallSummary, "");

  // Consensus findings (high confidence)
  const consensus = allFindings.filter((f) => f.agreedBy.length >= 2);
  if (consensus.length > 0) {
    parts.push(
      "### Consensus Findings",
      "_Multiple agents independently identified these issues:_",
      ""
    );
    for (const f of consensus) {
      parts.push(formatFindingRow(f));
    }
    parts.push("");
  }

  // Unique findings (single agent)
  const unique = allFindings.filter(
    (f) => f.agreedBy.length === 1 && f.confidence >= 0.4
  );
  if (unique.length > 0) {
    parts.push(
      "### Additional Findings",
      "_Found by a single agent but deemed valid:_",
      ""
    );
    for (const f of unique) {
      parts.push(formatFindingRow(f));
    }
    parts.push("");
  }

  // Disputed findings
  const disputed = allFindings.filter((f) => f.confidence < 0.4);
  if (disputed.length > 0) {
    parts.push(
      "<details>",
      "<summary>Disputed / Low-Confidence Findings</summary>",
      "",
      "_These findings had low agreement or may be false positives:_",
      ""
    );
    for (const f of disputed) {
      parts.push(formatFindingRow(f));
    }
    parts.push("", "</details>", "");
  }

  // Per-agent comparison
  const agentEntries = Object.entries(agentSummaries);
  if (agentEntries.length > 1) {
    parts.push(
      "<details>",
      "<summary>Individual Agent Assessments</summary>",
      ""
    );
    for (const [agentId, summary] of agentEntries) {
      parts.push(`**${agentId}:** ${summary}`, "");
    }
    parts.push("</details>", "");
  }

  parts.push(
    "---",
    "*Powered by [Synergy Reviewer](https://github.com/synergy-reviewer) — ensemble AI code review*"
  );

  return parts.join("\n");
}

function formatFindingRow(f: ScoredFinding): string {
  const emoji = severityEmoji(f.severity);
  const confidence = Math.round(f.confidence * 100);
  const location = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
  const agents =
    f.agreedBy.length > 1 ? ` (${f.agreedBy.join(", ")})` : "";

  return `- ${emoji} **${f.title}** — ${location} [${confidence}%]${agents}\n  ${f.description.split("\n")[0]}`;
}

function severityEmoji(
  severity: "critical" | "warning" | "info"
): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "warning":
      return "🟡";
    case "info":
      return "🔵";
  }
}
