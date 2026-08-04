import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Chrome, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cofoundr OS" },
      { name: "description", content: "Sign in to your AI co-founder workspace and pick up where your company memory left off." },
      { property: "og:title", content: "Sign in — Cofoundr OS" },
      { property: "og:description", content: "Access your persistent company memory, agents and decision engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});

function Auth() {
  return (
    <div className="aurora grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          Cofoundr OS
        </Link>
        <div className="panel p-7">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back, founder</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your co-founder ran 4 background jobs while you were away.
          </p>
          <div className="mt-6 space-y-3">
            <input
              placeholder="founder@company.com"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <Link
              to="/app"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              Enter workspace <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Link
            to="/app"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 py-2.5 text-sm hover:border-primary/40"
          >
            <Chrome className="size-4" /> Continue with Google
          </Link>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            New here?{" "}
            <Link to="/onboarding" className="text-primary hover:underline">
              Start conversational onboarding
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
