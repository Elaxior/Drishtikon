import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import ClaimGroup from "../components/ClaimGroup";
import ConsensusCard from "../components/ConsensusCard";
import SummaryCard from "../components/SummaryCard";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { searchNews, type SearchArticle, type SearchResponse } from "../lib/api";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";

function getBiasBadgeClasses(bias: BiasType): string {
  if (bias === "LEFT") {
    return "bg-blue-500/20 text-blue-300 border-blue-400/40";
  }

  if (bias === "CENTER") {
    return "bg-zinc-500/20 text-zinc-200 border-zinc-400/40";
  }

  if (bias === "RIGHT") {
    return "bg-red-500/20 text-red-300 border-red-400/40";
  }

  return "bg-yellow-500/20 text-yellow-300 border-yellow-400/40";
}

function Analysis() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const query = searchParams.get("q")?.trim() ?? "";

  useEffect(() => {
    if (!query) {
      setData(null);
      setErrorMessage("Please provide a topic query to analyze.");
      return;
    }

    const runAnalysis = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await searchNews(query);
        setData(result);
        setLastUpdatedAt(Date.now());
        setSecondsSinceUpdate(0);
      } catch {
        setData(null);
        setErrorMessage("Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void runAnalysis();
  }, [query]);

  useEffect(() => {
    if (!lastUpdatedAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
      setSecondsSinceUpdate(seconds);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lastUpdatedAt]);

  useEffect(() => {
    if (copyStatus === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyStatus("idle");
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyStatus]);

  const handleCopySummary = async () => {
    if (!data?.summary) {
      setCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(data.summary);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const sourceBiasMap = useMemo(() => {
    const map = new Map<string, BiasType>();
    if (!data) {
      return map;
    }

    data.articles.forEach((article) => {
      const source = article.source?.trim();
      if (!source) {
        return;
      }

      if (!map.has(source)) {
        map.set(source, article.bias);
      }
    });

    return map;
  }, [data]);

  return (
    <main className="px-4 pb-16 pt-10">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-zinc-400">Analysis</p>
          <h1 className="break-words text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {query ? `Results for "${query}"` : "News Analysis"}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/" className="text-sm font-medium text-cyan-700 transition-colors hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
              Back to Home
            </Link>
            {data && !isLoading ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400">Last updated: {secondsSinceUpdate} seconds ago</p>
            ) : null}
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <p className="animate-pulse text-center text-slate-600 dark:text-zinc-300">Analyzing news...</p>
            <Card className="overflow-hidden">
              <CardContent className="space-y-3 p-6">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                <div className="h-3 w-4/6 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
              </CardContent>
            </Card>
          </div>
        ) : null}
        {!isLoading && errorMessage ? <p className="text-center text-red-700 dark:text-red-300">{errorMessage}</p> : null}

        {!isLoading && data ? (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={handleCopySummary}>
                Copy Summary
              </Button>
              <Button type="button" variant="outline" onClick={handleExportPdf}>
                Export as PDF
              </Button>
              {copyStatus === "copied" ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-300">Summary copied.</p>
              ) : null}
              {copyStatus === "failed" ? (
                <p className="text-sm text-red-700 dark:text-red-300">Unable to copy summary right now.</p>
              ) : null}
            </div>

            <SummaryCard summary={data.summary} />

            <ConsensusCard score={data.consensus} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Claim Comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.claim_groups.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-zinc-400">No grouped claims available.</p>
                ) : (
                  data.claim_groups.map((group, index) => (
                    <ClaimGroup
                      key={`${group.representative_claim}-${index}`}
                      representativeClaim={group.representative_claim}
                      count={group.count}
                      sources={group.sources.map((source) => ({
                        name: source,
                        bias: sourceBiasMap.get(source) ?? "UNKNOWN",
                      }))}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.articles.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-zinc-400">No source articles found.</p>
                ) : (
                  data.articles.map((article: SearchArticle, index: number) => (
                    <div
                      key={`${article.link ?? article.title ?? "source"}-${index}`}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition-all duration-200 hover:shadow-sm dark:border-zinc-700/80 dark:bg-zinc-950/40"
                    >
                      {article.link ? (
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-base font-semibold text-cyan-700 transition-colors hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                        >
                          {article.title ?? "Untitled article"}
                        </a>
                      ) : (
                        <p className="text-base font-semibold text-slate-900 dark:text-zinc-100">{article.title ?? "Untitled article"}</p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-700 dark:text-cyan-200">
                          {article.source ?? "UNKNOWN SOURCE"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 ${getBiasBadgeClasses(article.bias)}`}>
                          {article.bias}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default Analysis;
