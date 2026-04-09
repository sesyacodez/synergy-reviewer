import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { assertConfigured } from "@/lib/env";
import { getAppSlug, getInstallationToken } from "@/lib/github/app";
import {
  verifyWebhookSignature,
  isBotMentioned,
  extractUserInstruction,
  getPRDetails,
} from "@/lib/github/webhooks";
import type { WebhookEvent } from "@/lib/github/webhooks";
import { runOrchestrator } from "@/lib/orchestrator";
import type { PRContext } from "@/lib/types";
import { addReaction } from "@/lib/github/publisher";

export async function POST(request: NextRequest) {
  assertConfigured();

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event !== "issue_comment" && event !== "pull_request_review_comment") {
    return NextResponse.json({ ok: true, skipped: "irrelevant event" });
  }

  const payload: WebhookEvent = JSON.parse(rawBody);

  if (payload.action !== "created") {
    return NextResponse.json({ ok: true, skipped: "not a new comment" });
  }

  const botSlug = await getAppSlug();
  if (!isBotMentioned(payload.comment.body, botSlug)) {
    return NextResponse.json({ ok: true, skipped: "bot not mentioned" });
  }

  const repoFullName = payload.repository.full_name;
  const [owner, repo] = repoFullName.split("/");

  let prNumber: number;
  if (payload.issue?.pull_request) {
    prNumber = payload.issue.number;
  } else if (payload.pull_request) {
    prNumber = payload.pull_request.number;
  } else {
    return NextResponse.json({ ok: true, skipped: "not a PR comment" });
  }

  const token = await getInstallationToken();

  await addReaction(owner, repo, payload.comment.id, "eyes");

  const prDetails = await getPRDetails(owner, repo, prNumber);
  const userInstruction = extractUserInstruction(
    payload.comment.body,
    botSlug
  );

  const ctx: PRContext = {
    owner,
    repo,
    prNumber,
    prBranch: prDetails.prBranch,
    baseBranch: prDetails.baseBranch,
    repoFullName,
    installationToken: token,
  };

  runOrchestrator(ctx, userInstruction).catch((err) => {
    console.error("[webhook] orchestrator failed:", err);
  });

  return NextResponse.json({ ok: true, status: "review started" });
}
