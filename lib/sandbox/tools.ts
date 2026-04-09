import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { tool } from "ai";
import { z } from "zod";

function ensureWithinSandbox(sandboxPath: string, filePath: string): string {
  const resolved = resolve(sandboxPath, filePath);
  const rel = relative(sandboxPath, resolved);
  if (rel.startsWith("..") || resolve(resolved) !== resolved.replace(/[\\/]$/, "")) {
    throw new Error(`Path traversal blocked: ${filePath}`);
  }
  return resolved;
}

const ALLOWED_COMMANDS = new Set([
  "ls", "find", "grep", "rg", "cat", "head", "tail", "wc",
  "tree", "file", "diff", "sort", "uniq", "sed", "awk",
  "jq", "npm", "npx", "node", "python", "python3",
  "eslint", "tsc", "prettier", "git",
]);

function validateCommand(command: string): void {
  const dangerous = [
    /\bcurl\b/, /\bwget\b/, /\brm\s+-rf\b/, /\brm\s.*\//, /\bmkfs\b/,
    /\bdd\b/, /\bchmod\b/, /\bchown\b/, /\bsudo\b/, /\bsu\b/,
    /\bkill\b/, /\bpkill\b/, /\bnc\b/, /\bncat\b/, /\bsocat\b/,
    /\bssh\b/, /\bscp\b/, /\beval\b/, /\bexec\b/,
    />\s*\//, // redirect to absolute path
    /\/etc\//, /\/proc\//, /\/sys\//, /\/dev\//,
    /\$\(/, /`[^`]*`/, // command substitution
  ];

  for (const pattern of dangerous) {
    if (pattern.test(command)) {
      throw new Error(`Blocked dangerous command pattern: ${pattern}`);
    }
  }

  // Check first command in pipe chain
  const firstCmd = command.trim().split(/[\s|;&]+/)[0];
  if (firstCmd && !ALLOWED_COMMANDS.has(firstCmd)) {
    throw new Error(
      `Command '${firstCmd}' is not in the allowlist. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}`
    );
  }
}

export function createBashTool(sandboxPath: string) {
  return tool({
    description: [
      "Execute a bash command in the repository sandbox.",
      `Working directory: ${sandboxPath}`,
      "Use for: running linters, searching code, listing files, etc.",
      `Allowed commands: ${[...ALLOWED_COMMANDS].join(", ")}`,
    ].join("\n"),
    parameters: z.object({
      command: z.string().describe("The bash command to execute"),
    }),
    execute: async ({ command }) => {
      try {
        validateCommand(command);
        const result = execSync(command, {
          cwd: sandboxPath,
          timeout: 30_000,
          maxBuffer: 5 * 1024 * 1024,
          env: {
            ...process.env,
            HOME: sandboxPath,
            LANG: "en_US.UTF-8",
          } as NodeJS.ProcessEnv,
        });
        const stdout = result.toString("utf-8");
        return {
          stdout: stdout.length > 20_000
            ? stdout.slice(0, 20_000) + "\n...(truncated)"
            : stdout,
          exitCode: 0,
        };
      } catch (err: unknown) {
        const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number; message?: string };
        return {
          stdout: e.stdout?.toString("utf-8")?.slice(0, 10_000) ?? "",
          stderr: e.stderr?.toString("utf-8")?.slice(0, 10_000) ?? e.message ?? "",
          exitCode: e.status ?? 1,
        };
      }
    },
  });
}

export function createReadFileTool(sandboxPath: string) {
  return tool({
    description:
      "Read the contents of a file in the repository. Use relative paths from the repo root.",
    parameters: z.object({
      path: z.string().describe("Relative file path from repo root"),
    }),
    execute: async ({ path: filePath }) => {
      try {
        const abs = ensureWithinSandbox(sandboxPath, filePath);
        if (!existsSync(abs)) {
          return { error: `File not found: ${filePath}` };
        }
        const content = readFileSync(abs, "utf-8");
        if (content.length > 50_000) {
          return {
            content:
              content.slice(0, 50_000) +
              `\n...(truncated, total ${content.length} chars)`,
          };
        }
        return { content };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });
}

