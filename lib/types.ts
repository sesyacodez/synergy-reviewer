export interface ReviewFinding {
  file: string;
  line?: number;
  endLine?: number;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  suggestion?: string;
}

export interface AgentReview {
  agentId: string;
  model: string;
  findings: ReviewFinding[];
  summary: string;
  durationMs: number;
}

export interface ScoredFinding extends ReviewFinding {
  confidence: number;
  agreedBy: string[];
}

export interface SynthesizedReview {
  consensusFindings: ScoredFinding[];
  uniqueFindings: ScoredFinding[];
  disputedFindings: ScoredFinding[];
  overallSummary: string;
  agentSummaries: Record<string, string>;
}

export interface PRContext {
  owner: string;
  repo: string;
  prNumber: number;
  prBranch: string;
  baseBranch: string;
  repoFullName: string;
  installationToken: string;
}
