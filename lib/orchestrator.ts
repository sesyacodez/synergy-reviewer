import type { PRContext, AgentReview } from "@/lib/types";
import { getInstallationOctokit } from "@/lib/github/app";
import { getAgentSlots } from "@/lib/models/providers";
import { runReviewAgent } from "@/lib/agents/reviewer";
import { synthesizeReviews } from "@/lib/agents/synthesizer";
import {
  postInlineComments,
  postSummaryComment,
} from "@/lib/github/publisher";

export async function runOrchestrator(
  ctx: PRContext,
  userInstruction: string
): Promise<void> {
  console.log(
    `[orchestrator] starting review for ${ctx.repoFullName}#${ctx.prNumber}`
  );

  try {
    const octokit = await getInstallationOctokit();

    const diffResp = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: ctx.owner,
        repo: ctx.repo,
        pull_number: ctx.prNumber,
        mediaType: { format: "diff" },
      }
    );
    const diff = diffResp.data as unknown as string;

    const filesResp = await octokit.paginate(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      {
        owner: ctx.owner,
        repo: ctx.repo,
        pull_number: ctx.prNumber,
        per_page: 100,
      }
    );
    const changedFiles = filesResp.map((f) => f.filename);

    if (!diff.trim()) {
      await postSummaryComment(
        ctx,
        "No changes detected in this PR.",
        [],
        {}
      );
      return;
    }

    const slots = getAgentSlots();

    console.log(
      `[orchestrator] launching ${slots.length} agents: ${slots.map((s) => s.id).join(", ")}`
    );

    // Run all agents in parallel -- each is fully independent
    const agentPromises = slots.map((slot) =>
      runReviewAgent({
        agentId: slot.id,
        model: slot.model,
        temperature: slot.temperature,
        sandboxPath: "",
        prNumber: ctx.prNumber,
        repoFullName: ctx.repoFullName,
        diff,
        changedFiles,
        userInstruction,
      })
    );

    const reviews = await Promise.allSettled(agentPromises);

    const completedReviews: AgentReview[] = reviews
      .filter(
        (r): r is PromiseFulfilledResult<AgentReview> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);

    const failedResults = reviews.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    const failedCount = failedResults.length;

    if (failedCount > 0) {
      console.warn(
        `[orchestrator] ${failedCount}/${reviews.length} agents failed`
      );
      for (const failed of failedResults) {
        console.error("[orchestrator] agent error:", failed.reason);
      }
    }

    if (completedReviews.length === 0) {
      await postSummaryComment(
        ctx,
        "All review agents failed to complete. Please check your API key configuration and try again.",
        [],
        {}
      );
      return;
    }

    console.log(
      `[orchestrator] ${completedReviews.length} agents completed, synthesizing...`
    );

    const synthesized = await synthesizeReviews(completedReviews);

    // Post inline comments for high-confidence findings
    const highConfidenceFindings = [
      ...synthesized.consensusFindings,
      ...synthesized.uniqueFindings.filter((f) => f.confidence >= 0.66),
    ].filter((f) => f.line != null);

    if (highConfidenceFindings.length > 0) {
      await postInlineComments(ctx, highConfidenceFindings);
    }

    await postSummaryComment(
      ctx,
      synthesized.overallSummary,
      [
        ...synthesized.consensusFindings,
        ...synthesized.uniqueFindings,
        ...synthesized.disputedFindings,
      ],
      synthesized.agentSummaries,
      {
        consensusCount: synthesized.consensusFindings.length,
        uniqueCount: synthesized.uniqueFindings.length,
        disputedCount: synthesized.disputedFindings.length,
        agentCount: completedReviews.length,
        totalAgents: slots.length,
        failedAgents: failedCount,
      }
    );

    console.log(
      `[orchestrator] review complete for ${ctx.repoFullName}#${ctx.prNumber}`
    );
  } catch (err) {
    console.error("[orchestrator] fatal error:", err);
    try {
      await postSummaryComment(
        ctx,
        `An error occurred during the review:\n\`\`\`\n${String(err)}\n\`\`\``,
        [],
        {}
      );
    } catch {
      // best-effort error reporting
    }
  }
}
