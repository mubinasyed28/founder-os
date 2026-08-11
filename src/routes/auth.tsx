import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getProfileApi } from "@/lib/api-client";
import { useOs } from "@/lib/os-store";

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
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const { completeOnboarding } = useOs();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!email || !username || !password) {
          throw new Error("Please fill in all fields");
        }
        await signup(email, username, password);
        // New user: always go to onboarding
        navigate({ to: "/onboarding" });
      } else {
        if (!email || !password) {
          throw new Error("Please provide your username/email and password");
        }
        await login(email, password);

        // Returning user: try to load their existing profile from server
        try {
          const serverProfile = await getProfileApi();
          if (serverProfile && serverProfile.company_name) {
            // They have a profile — mark as onboarded and load it
            completeOnboarding(serverProfile);
            navigate({ to: "/app" });
          } else {
            // No profile yet — send to onboarding
            navigate({ to: "/onboarding" });
          }
        } catch {
          // Profile fetch failed — send to onboarding as fallback
          navigate({ to: "/onboarding" });
        }
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          <div className="mb-6 flex border-b border-border">
            <button
              onClick={() => { setIsSignUp(false); setError(null); }}
              className={`pb-2.5 text-sm font-semibold transition-colors flex-1 text-center ${
                !isSignUp ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsSignUp(true); setError(null); }}
              className={`pb-2.5 text-sm font-semibold transition-colors flex-1 text-center ${
                isSignUp ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">
            {isSignUp ? "Create your founder account" : "Welcome back, founder"}
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {isSignUp
              ? "Start your AI-driven conversational onboarding and build your persistent company profile."
              : "Access your saved startup memory and continue where you left off."}
          </p>

          {error ? (
            <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {isSignUp ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@company.com"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                  required
                />
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                {isSignUp ? "Username" : "Email or Username"}
              </label>
              <input
                type="text"
                value={isSignUp ? username : email}
                onChange={(e) => (isSignUp ? setUsername(e.target.value) : setEmail(e.target.value))}
                placeholder={isSignUp ? "alex_founder" : "founder@company.com or alex"}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  {isSignUp ? "Create Account & Start Onboarding" : "Sign In to Workspace"} <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Want to start directly?{" "}
            <Link to="/onboarding" className="text-primary hover:underline">
              Go to conversational onboarding
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
