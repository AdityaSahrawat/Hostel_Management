"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers";

export default function LoginPage() {
  const router = useRouter();
  const { auth, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (auth) router.replace("/staff/students");
  }, [auth, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace("/staff/students");
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as any).message)
          : "Login failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-foreground/10 rounded-xl p-6 bg-background">
        <h1 className="text-xl font-semibold">Staff Login</h1>
        <p className="text-sm opacity-80 mt-1">Only staff/warden accounts can access this portal.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm">Username</label>
            <input
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-foreground/15 px-3 py-2 font-medium hover:border-foreground/30 disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-xs opacity-70">
          API proxy: set <code className="font-mono">API_BASE_URL</code> in <code className="font-mono">client/.env.local</code> if your server isn’t on <code className="font-mono">http://localhost:4000</code>.
        </div>
      </div>
    </main>
  );
}
