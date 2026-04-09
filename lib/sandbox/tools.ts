import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { tool } from "ai";
import { z } from "zod";

function ensureWithinSandbox(sandboxPath: string, filePath: string): string {
  const resolved = resolve(sandboxPath, filePath);
  const rel = relative(sandboxPath, resolved);
  if (rel.startsWith("..") || resolve(resolved) !== resolved.replace(/[\\/]$/, "")) {
    if (rel.startsWith("..")) {
      throw new Error(`Path traversal blocked: ${filePath}`);
    }
  }
  return resolved;
}

export function createBashTool(sandboxPath: string) {
  return tool({
    description: [
      "Execute a bash command in the repository sandbox.",
      `Working directory: ${sandboxPath}`,
      "Use for: running linters, searching code, listing files, etc.",
    ].join("\n"),
    parameters: z.object({
      command: z.string().describe("The bash command to execute"),
    }),
    execute: async ({ command }) => {
      try {
        const result = execSync(command, {
          cwd: sandboxPath,
          timeout: 30_000,
          maxBuffer: 5 * 1024 * 1024,
          env: { ...process.env, PATH: process.env.PATH },
        });
        const stdout = result.toString("utf-8");
        return {
          stdout: stdout.length > 20_000
            ? stdout.slice(0, 20_000) + "\n...(truncated)"
            : stdout,
          exitCode: 0,
        };
      } catch (err: unknown) {
        const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
        return {
          stdout: e.stdout?.toString("utf-8")?.slice(0, 10_000) ?? "",
          stderr: e.stderr?.toString("utf-8")?.slice(0, 10_000) ?? "",
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

export function createWriteFileTool(sandboxPath: string) {
  return tool({
    description:
      "Write content to a file in the repository. Use relative paths from the repo root.",
    parameters: z.object({
      path: z.string().describe("Relative file path from repo root"),
      content: z.string().describe("The full file content to write"),
    }),
    execute: async ({ path: filePath, content }) => {
      try {
        const abs = ensureWithinSandbox(sandboxPath, filePath);
        writeFileSync(abs, content, "utf-8");
        return { success: true, path: filePath };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });
}
