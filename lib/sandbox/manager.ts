import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Sandbox {
  id: string;
  path: string;
  cleanup: () => void;
}

export function createSandbox(
  repoFullName: string,
  token: string,
  branch: string
): Sandbox {
  const sandboxPath = mkdtempSync(join(tmpdir(), "synergy-review-"));

  const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;

  execSync(
    `git clone --depth 1 --single-branch --branch ${branch} ${cloneUrl} .`,
    { cwd: sandboxPath, stdio: "pipe", timeout: 120_000 }
  );

  return {
    id: sandboxPath,
    path: sandboxPath,
    cleanup: () => {
      try {
        rmSync(sandboxPath, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    },
  };
}

export function installDependencies(sandboxPath: string): void {
  const pm = detectPackageManager(sandboxPath);
  if (!pm) return;

  try {
    execSync(pm.installCmd, {
      cwd: sandboxPath,
      stdio: "pipe",
      timeout: 300_000,
      env: { ...process.env, CI: "true" },
    });
  } catch (err) {
    console.warn("[sandbox] dependency install failed:", err);
  }
}

interface PackageManagerInfo {
  name: string;
  installCmd: string;
}

function detectPackageManager(dir: string): PackageManagerInfo | null {
  if (existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))) {
    return { name: "bun", installCmd: "bun install --frozen-lockfile" };
  }
  if (existsSync(join(dir, "pnpm-lock.yaml"))) {
    return { name: "pnpm", installCmd: "pnpm install --frozen-lockfile" };
  }
  if (existsSync(join(dir, "yarn.lock"))) {
    return { name: "yarn", installCmd: "yarn install --frozen-lockfile" };
  }
  if (existsSync(join(dir, "package-lock.json"))) {
    return { name: "npm", installCmd: "npm ci" };
  }
  if (existsSync(join(dir, "package.json"))) {
    return { name: "npm", installCmd: "npm install" };
  }
  return null;
}

export function getPRDiff(sandboxPath: string, baseBranch: string): string {
  try {
    execSync(`git fetch origin ${baseBranch} --depth=1`, {
      cwd: sandboxPath,
      stdio: "pipe",
      timeout: 60_000,
    });
    const diff = execSync(`git diff origin/${baseBranch}...HEAD`, {
      cwd: sandboxPath,
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return diff.toString("utf-8");
  } catch {
    return execSync("git diff HEAD~1", {
      cwd: sandboxPath,
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    }).toString("utf-8");
  }
}

export function getChangedFiles(
  sandboxPath: string,
  baseBranch: string
): string[] {
  try {
    const output = execSync(
      `git diff --name-only origin/${baseBranch}...HEAD`,
      { cwd: sandboxPath, timeout: 15_000 }
    );
    return output
      .toString("utf-8")
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}
