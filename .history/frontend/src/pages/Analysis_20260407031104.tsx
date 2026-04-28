import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import ClaimGroup from "../components/ClaimGroup";
import ConsensusCard from "../components/ConsensusCard";
import SummaryCard from "../components/SummaryCard";
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
      } catch {
        setData(null);
        setErrorMessage("Analysis is unavailable right now. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void runAnalysis();
  }, [query]);

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
          <p className="text-sm text-zinc-400">Analysis</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{query ? `Results for "${query}"` : "News Analysis"}</h1>
          <div>
            <Link to="/" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
              Back to Home
            </Link>
          </div>
        </header>

        {isLoading ? <p className="text-center text-zinc-300">Analyzing...</p> : null}
        {!isLoading && errorMessage ? <p className="text-center text-red-300">{errorMessage}</p> : null}

        {!isLoading && data ? (
          <section className="space-y-6">
            <SummaryCard summary={data.summary} />

            <ConsensusCard score={data.consensus} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Claim Comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.claim_groups.length === 0 ? (
                  <p className="text-sm text-zinc-400">No grouped claims available.</p>
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
                  <p className="text-sm text-zinc-400">No source articles found.</p>
                ) : (
                  data.articles.map((article: SearchArticle, index: number) => (
                    <div key={`${article.link ?? article.title ?? "source"}-${index}`} className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 p-3">
                      {article.link ? (
                        <a href={article.link} target="_blank" rel="noreferrer" className="text-base font-semibold text-cyan-300 hover:text-cyan-200">
                          {article.title ?? "Untitled article"}
                        </a>
                      ) : (
                        <p className="text-base font-semibold text-zinc-100">{article.title ?? "Untitled article"}</p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-200">
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
