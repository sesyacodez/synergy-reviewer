# Synergy Reviewer

An ensemble AI code review bot. Multiple independent AI agents review your PRs in parallel, then a synthesizer cross-references their findings to eliminate bias and surface high-confidence issues.

## Demo 

https://github.com/user-attachments/assets/9394b4b1-e18a-4b00-aa5b-38d2d54908fc

## Why Ensemble Review?

A single AI reviewer can be biased — it may hallucinate issues, miss real problems, or fixate on style over substance. Synergy Reviewer runs **3 independent agents** (via [OpenRouter](https://openrouter.ai), using distinct models — defaults use free `:free` endpoints) against the same PR diff. When multiple models independently flag the same issue, confidence is high. When they disagree, the dispute is surfaced for human judgment.

## How It Works

```
GitHub PR Comment (@synergy-reviewer)
        │
        ▼
  Webhook Handler (verify + parse)
        │
        ▼
    Orchestrator
        │
    ┌───┼───┐
    │   │   │
    ▼   ▼   ▼
  Model A  B  C         ← 3 independent reviews (OpenRouter)
    │   │   │
    └───┼───┘
        │
        ▼
    Synthesizer
    (cross-reference, score confidence, de-bias)
        │
        ▼
    GitHub Publisher
    ├── Inline PR comments (high-confidence findings)
    └── Summary comment (consensus + disputed + scores)
```

1. Mention `@synergy-reviewer` in any PR comment (optionally with specific instructions)
2. The bot clones the repo and launches 3 AI agents in parallel — each reviews the diff independently
3. A synthesizer agent cross-references all findings and assigns confidence scores
4. High-confidence findings are posted as inline PR comments with suggestion blocks
5. A summary comment shows consensus findings, unique findings, disputed findings, and per-agent comparisons

## Confidence Scoring

| Score | Meaning |
|-------|---------|
| **1.0** | All 3 agents independently found this issue |
| **0.8** | 2 of 3 agents agree |
| **0.5** | Single agent, but synthesizer deems it valid |
| **0.3** | Single agent, uncertain validity |
| **< 0.3** | Likely false positive or bias artifact |

Findings with confidence >= 0.66 are posted as inline comments. All findings appear in the summary.

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-org/synergy-reviewer.git
cd synergy-reviewer
npm install
```

### 2. Create a GitHub App

Create a new [GitHub App](https://github.com/settings/apps/new) with:

**Webhook URL**: `https://your-deployment.example.com/api/webhooks`

**Repository permissions**:
- Contents: Read-only
- Issues: Read & write
- Pull requests: Read & write
- Metadata: Read-only

**Subscribe to events**:
- Issue comment
- Pull request review comment

Generate a private key and webhook secret.

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | [OpenRouter](https://openrouter.ai) API key (free models: use IDs ending in `:free`) |
| `OPENROUTER_HTTP_REFERER` | No | Your app URL; recommended by OpenRouter for free-tier attribution |
| `OPENROUTER_REVIEW_MODELS` | No | Comma-separated OpenRouter model IDs for reviewers. Default: three different free models |
| `OPENROUTER_SYNTH_MODEL` | No | Model ID for the synthesizer. Default: a larger free instruct model |
| `GITHUB_APP_ID` | Yes | Your GitHub App ID |
| `GITHUB_APP_INSTALLATION_ID` | Yes | Installation ID for your repo |
| `GITHUB_APP_PRIVATE_KEY` | Yes | GitHub App private key (with `\n` for newlines) |
| `GITHUB_APP_WEBHOOK_SECRET` | Yes | Webhook secret |
| `AGENT_COUNT` | No | Number of parallel agents (1-5). Default: `3` |

Browse [free models on OpenRouter](https://openrouter.ai/models?q=free) and set `OPENROUTER_REVIEW_MODELS` / `OPENROUTER_SYNTH_MODEL` if defaults change or rate-limit.

### 4. Run

```bash
npm run dev
```

### 5. Install the GitHub App

Install the app on your repositories. Mention `@your-bot-name` in any PR comment to trigger a review.

## Usage

```
@synergy-reviewer                              # General review
@synergy-reviewer check for security issues     # Focused review
@synergy-reviewer review the error handling     # Specific focus
```

## Architecture

```
synergy-reviewer/
  app/
    api/webhooks/route.ts     # GitHub webhook endpoint
    page.tsx                  # Landing page
    layout.tsx
  lib/
    agents/
      reviewer.ts             # Review agent (parameterized by model)
      synthesizer.ts          # Cross-references and scores findings
      prompts.ts              # System prompts + output schemas
    models/
      providers.ts            # Multi-model provider configuration
    orchestrator.ts           # Parallel execution coordinator
    sandbox/
      manager.ts              # Temp dir, git clone, dependency install
      tools.ts                # Agent tools (bash, readFile, writeFile)
    github/
      app.ts                  # GitHub App auth
      webhooks.ts             # Webhook parsing + verification
      publisher.ts            # Posts reviews to GitHub
    types.ts                  # Shared TypeScript types
    env.ts                    # Environment validation
```

## Tech Stack

- **Next.js** — App framework
- **AI SDK** — OpenAI-compatible client to **OpenRouter** (multi-model, including free tiers)
- **Octokit** — GitHub API client
- **Zod** — Schema validation for structured agent outputs
- **Tailwind CSS** — Landing page styling

## License

MIT
