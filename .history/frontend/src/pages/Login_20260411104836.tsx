import { Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth-store";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, authError } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);

  const redirectTarget = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const candidate = searchParams.get("redirect");
    if (!candidate) return "/profile";
    if (!candidate.startsWith("/")) return "/profile";
    return candidate;
  }, [location.search]);

  useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget, user]);

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in right now.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    if (isCreateMode && password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isCreateMode) {
        await signUpWithEmail(normalizedEmail, password);
      } else {
        await signInWithEmail(normalizedEmail, password);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to authenticate right now.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="px-4 pb-14 pt-10">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-parchment-300 bg-white/85 p-8 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
        <div className="mb-5 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-accent" />
          <h1 className="font-serif text-3xl text-ink dark:text-[#eef1f8]">Welcome Back</h1>
          <p className="mt-2 text-sm text-ink-secondary dark:text-[#adb7c7]">
            Sign in to save stories and access your personal profile.
          </p>
        </div>

        {(authError || errorMessage) && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
            {errorMessage || authError}
          </div>
        )}

        <form className="space-y-3" onSubmit={(event) => void handleEmailAuth(event)}>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary dark:text-[#adb7c7]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-parchment-300 bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent dark:border-[#2a313d] dark:bg-[#0f131b] dark:text-[#eef1f8]"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary dark:text-[#adb7c7]">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isCreateMode ? "new-password" : "current-password"}
              className="h-11 w-full rounded-xl border border-parchment-300 bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent dark:border-[#2a313d] dark:bg-[#0f131b] dark:text-[#eef1f8]"
              placeholder={isCreateMode ? "Minimum 6 characters" : "Enter your password"}
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            {isSubmitting ? "Please wait..." : (isCreateMode ? "Create account" : "Sign in with email")}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-ink-muted dark:text-[#8892a3]">
          <span className="h-px flex-1 bg-parchment-300 dark:bg-[#2a313d]" />
          Or
          <span className="h-px flex-1 bg-parchment-300 dark:bg-[#2a313d]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-parchment-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60 dark:border-[#2a313d] dark:bg-[#0f131b] dark:text-[#eef1f8]"
        >
          {isSubmitting ? "Please wait..." : "Continue with Google"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsCreateMode((previous) => !previous);
            setErrorMessage("");
          }}
          disabled={isSubmitting}
          className="mt-3 w-full text-center text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-colors hover:text-ink disabled:opacity-60 dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
        >
          {isCreateMode ? "Already have an account? Sign in" : "Need an account? Create one"}
        </button>
      </section>
    </main>
  );
}

export default Login;
