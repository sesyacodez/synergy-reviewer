export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-lg font-bold ring-2 ring-[var(--background)]">
              A
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold ring-2 ring-[var(--background)]">
              B
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold ring-2 ring-[var(--background)]">
              C
            </span>
          </div>
          <svg
            className="h-6 w-6 text-[var(--muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-lg font-bold ring-2 ring-[var(--background)]">
            S
          </span>
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Synergy Reviewer
        </h1>

        <p className="mb-8 text-lg text-[var(--muted)]">
          Ensemble AI code review. Multiple independent agents review your
          PRs, then a synthesizer cross-references their findings to
          eliminate bias and surface high-confidence issues.
        </p>

        <div className="mb-12 grid gap-4 text-left sm:grid-cols-3">
          <Card
            title="Multi-Agent"
            description="3 independent AI models review the same PR in parallel, each with zero knowledge of the others."
          />
          <Card
            title="De-Biased"
            description="A synthesizer cross-references all findings. Agreement = high confidence. Contradiction = flagged."
          />
          <Card
            title="Portable"
            description="One OpenRouter key routes to multiple models — including free `:free` endpoints for demos."
          />
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-left">
          <p className="mb-2 text-sm font-medium text-[var(--muted)]">
            Usage
          </p>
          <code className="text-sm text-[var(--accent-light)]">
            @synergy-reviewer review this PR for security issues
          </code>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Mention the bot in any PR comment to trigger an ensemble review.
          </p>
        </div>

        <p className="mt-12 text-xs text-[var(--muted)]">
          Powered by AI SDK, Next.js, and OpenRouter.
        </p>
      </div>
    </main>
  );
}

function Card({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}
