import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth-store";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signInWithGoogle, authError } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in right now.";
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

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Continue with Google"}
        </button>
      </section>
    </main>
  );
}

export default Login;
