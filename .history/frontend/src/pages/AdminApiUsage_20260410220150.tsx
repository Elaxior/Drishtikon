import { useEffect, useState } from "react";
import axios from "axios";
import { RefreshCcw, ShieldAlert } from "lucide-react";

import {
  getAdminApiUsage,
  type AdminApiUsageResponse,
  type AdminProviderUsage,
} from "../lib/api";

const TOKEN_STORAGE_KEY = "drishtikon-admin-token";

function formatRemaining(value: number | null): string {
  if (value == null) return "Unknown";
  return value.toString();
}

function ProviderCard({ provider }: { provider: AdminProviderUsage }) {
  const usagePercent = provider.usage_percent ?? null;

  return (
    <section className="rounded-xl border border-parchment-300 bg-white/80 p-5 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-xl text-ink dark:text-[#f5f0e8]">{provider.display_name}</h3>
          <p className="text-xs text-ink-muted dark:text-[#8a8279]">
            {provider.keys_configured} key{provider.keys_configured === 1 ? "" : "s"} configured
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            provider.configured
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          {provider.configured ? "Active" : "Not configured"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-parchment-dark/50 px-3 py-2 dark:bg-[#151310]/60">
          <p className="text-[11px] text-ink-muted dark:text-[#8a8279]">Used today</p>
          <p className="mt-0.5 font-semibold text-ink dark:text-[#f5f0e8]">{provider.used_today}</p>
        </div>
        <div className="rounded-lg bg-parchment-dark/50 px-3 py-2 dark:bg-[#151310]/60">
          <p className="text-[11px] text-ink-muted dark:text-[#8a8279]">Remaining</p>
          <p className="mt-0.5 font-semibold text-ink dark:text-[#f5f0e8]">{formatRemaining(provider.remaining_today)}</p>
        </div>
        <div className="rounded-lg bg-parchment-dark/50 px-3 py-2 dark:bg-[#151310]/60">
          <p className="text-[11px] text-ink-muted dark:text-[#8a8279]">Total limit</p>
          <p className="mt-0.5 font-semibold text-ink dark:text-[#f5f0e8]">{provider.total_daily_limit ?? "Unknown"}</p>
        </div>
        <div className="rounded-lg bg-parchment-dark/50 px-3 py-2 dark:bg-[#151310]/60">
          <p className="text-[11px] text-ink-muted dark:text-[#8a8279]">Per-key limit</p>
          <p className="mt-0.5 font-semibold text-ink dark:text-[#f5f0e8]">{provider.per_key_daily_limit ?? "Unknown"}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-ink-muted dark:text-[#8a8279]">
          <span>Usage</span>
          <span>{usagePercent == null ? "Unknown" : `${usagePercent}%`}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-parchment-300 dark:bg-[#3a342c]">
          <div
            className="h-full bg-ink transition-all duration-500 dark:bg-[#f5f0e8]"
            style={{ width: `${Math.max(0, Math.min(100, usagePercent ?? 0))}%` }}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-parchment-300 text-left text-ink-muted dark:border-[#3a342c] dark:text-[#8a8279]">
              <th className="py-2 pr-2 font-medium">Key</th>
              <th className="py-2 pr-2 font-medium">Used</th>
              <th className="py-2 pr-2 font-medium">Remaining</th>
              <th className="py-2 pr-2 font-medium">Success</th>
              <th className="py-2 pr-2 font-medium">Failed</th>
              <th className="py-2 font-medium">Quota errors</th>
            </tr>
          </thead>
          <tbody>
            {provider.key_stats.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-ink-muted dark:text-[#8a8279]">
                  No key usage recorded yet.
                </td>
              </tr>
            ) : (
              provider.key_stats.map((keyStat, index) => (
                <tr key={`${provider.provider}-${keyStat.key_mask}-${index}`} className="border-b border-parchment-200 dark:border-[#2e2923]">
                  <td className="py-2 pr-2 font-medium text-ink dark:text-[#f5f0e8]">{keyStat.key_mask}</td>
                  <td className="py-2 pr-2 text-ink-secondary dark:text-[#b8b0a4]">{keyStat.used_today}</td>
                  <td className="py-2 pr-2 text-ink-secondary dark:text-[#b8b0a4]">{formatRemaining(keyStat.remaining_today)}</td>
                  <td className="py-2 pr-2 text-emerald-700 dark:text-emerald-300">{keyStat.success_calls}</td>
                  <td className="py-2 pr-2 text-red-700 dark:text-red-300">{keyStat.failed_calls}</td>
                  <td className="py-2 text-amber-700 dark:text-amber-300">{keyStat.quota_related_errors}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminApiUsage() {
  const [tokenInput, setTokenInput] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [data, setData] = useState<AdminApiUsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchUsage = async (token: string) => {
    if (!token.trim()) {
      setErrorMessage("Enter your admin token.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await getAdminApiUsage(token.trim());
      setData(response);
      setAuthToken(token.trim());
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } catch (error) {
      setData(null);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setErrorMessage("Unauthorized token. Please try again.");
      } else if (axios.isAxiosError(error) && error.response?.status === 503) {
        setErrorMessage("ADMIN_STATS_TOKEN is not configured on the backend.");
      } else {
        setErrorMessage("Failed to load usage stats. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const saved = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!saved) return;
    setTokenInput(saved);
    void fetchUsage(saved);
  }, []);

  return (
    <main className="px-4 pb-16 pt-8">
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-serif text-4xl text-ink dark:text-[#f5f0e8] sm:text-5xl">Admin API Usage</h1>
          <p className="max-w-2xl text-sm text-ink-secondary dark:text-[#b8b0a4]">
            Private dashboard for key usage. Limits and remaining values are calculated from configured daily limits and in-memory usage for today (UTC).
          </p>
        </header>

        <div className="rounded-xl border border-parchment-300 bg-white/80 p-5 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void fetchUsage(tokenInput);
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-sm text-ink-secondary dark:text-[#b8b0a4]">
              Admin token
              <input
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Enter ADMIN_STATS_TOKEN"
                className="mt-1.5 h-11 w-full rounded-lg border border-parchment-300 bg-white px-3 text-sm text-ink outline-none focus:border-ink-muted dark:border-[#3a342c] dark:bg-[#151310] dark:text-[#f5f0e8]"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-ink-secondary disabled:opacity-60 dark:bg-[#f5f0e8] dark:text-[#1c1917] dark:hover:bg-[#d8d0c4]"
            >
              {isLoading ? "Loading..." : "Unlock dashboard"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!authToken) return;
                void fetchUsage(authToken);
              }}
              disabled={isLoading || !authToken}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-parchment-300 px-4 text-sm font-medium text-ink-secondary transition-colors hover:text-ink disabled:opacity-60 dark:border-[#3a342c] dark:text-[#b8b0a4] dark:hover:text-[#f5f0e8]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthToken("");
                setTokenInput("");
                setData(null);
                setErrorMessage("");
                window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
              }}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-parchment-300 px-4 text-sm font-medium text-ink-secondary transition-colors hover:text-ink dark:border-[#3a342c] dark:text-[#b8b0a4] dark:hover:text-[#f5f0e8]"
            >
              Lock
            </button>
          </form>

          {errorMessage && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
              <ShieldAlert className="h-4 w-4" />
              {errorMessage}
            </div>
          )}

          {data && (
            <p className="mt-3 text-xs text-ink-muted dark:text-[#8a8279]">
              Snapshot date (UTC): {data.date_utc} · Generated: {new Date(data.generated_at).toLocaleString()}
            </p>
          )}
        </div>

        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.providers.map((provider) => (
              <ProviderCard key={provider.provider} provider={provider} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminApiUsage;
