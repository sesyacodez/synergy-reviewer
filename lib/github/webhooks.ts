import crypto from "node:crypto";

import { env } from "@/lib/env";
import { getInstallationOctokit } from "./app";

export interface WebhookEvent {
  action: string;
  comment: {
    id: number;
    body: string;
    user: { login: string };
  };
  issue?: {
    number: number;
    pull_request?: { url: string };
  };
  pull_request?: {
    number: number;
    head: { ref: string };
    base: { ref: string };
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
}

export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", env.GITHUB_APP_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export function isBotMentioned(body: string, botName: string): boolean {
  const pattern = new RegExp(`@${botName}\\b`, "i");
  return pattern.test(body);
}

export function extractUserInstruction(
  body: string,
  botName: string
): string {
  return body.replace(new RegExp(`@${botName}\\s*`, "gi"), "").trim();
}

export async function getPRDetails(
  owner: string,
  repo: string,
  prNumber: number
) {
  const octokit = await getInstallationOctokit();
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return {
    prNumber: pr.number,
    prBranch: pr.head.ref,
    baseBranch: pr.base.ref,
  };
}
