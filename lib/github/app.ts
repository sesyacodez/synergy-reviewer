import { App } from "octokit";
import type { Octokit } from "octokit";

import { env } from "@/lib/env";

let app: App | null = null;

export function getGitHubApp(): App {
  if (!app) {
    app = new App({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n"),
      webhooks: { secret: env.GITHUB_APP_WEBHOOK_SECRET },
    });
  }
  return app;
}

export async function getInstallationOctokit(): Promise<Octokit> {
  const githubApp = getGitHubApp();
  return githubApp.getInstallationOctokit(env.GITHUB_APP_INSTALLATION_ID);
}

export async function getInstallationToken(): Promise<string> {
  const githubApp = getGitHubApp();
  const octokit = await githubApp.getInstallationOctokit(
    env.GITHUB_APP_INSTALLATION_ID
  );
  const { data } = await octokit.request(
    "POST /app/installations/{installation_id}/access_tokens",
    { installation_id: env.GITHUB_APP_INSTALLATION_ID }
  );
  return data.token;
}

export async function getAppSlug(): Promise<string> {
  const octokit = await getInstallationOctokit();
  const { data } = (await octokit.request("GET /app")) as {
    data: { slug: string };
  };
  return data.slug;
}
