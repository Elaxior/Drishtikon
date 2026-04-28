import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getHealth, searchNews, type ClaimGroup, type SearchArticle } from "../lib/api";
import SummaryCard from "../components/SummaryCard";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

function getBiasBadgeClasses(bias: SearchArticle["bias"]): string {
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

function Home() {
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("Checking backend...");
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [articles, setArticles] = useState<SearchArticle[]>([]);
  const [claimGroups, setClaimGroups] = useState<ClaimGroup[]>([]);
  const [consensusScore, setConsensusScore] = useState(0);
  const [summary, setSummary] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [lastAutoQuery, setLastAutoQuery] = useState("");

  const runSearch = async (inputQuery: string) => {
    const trimmedQuery = inputQuery.trim();
    if (!trimmedQuery) {
      setSearchError("Please enter a topic to search.");
      setArticles([]);
      setClaimGroups([]);
      setConsensusScore(0);
      setSummary("");
      setLastQuery("");
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      const result = await searchNews(trimmedQuery);
      setArticles(result.articles);
      setClaimGroups(result.claim_groups);
      setConsensusScore(result.consensus);
      setSummary(result.summary);
      setLastQuery(result.query);
    } catch {
      setSearchError("Search failed. Check backend status and API key configuration.");
      setArticles([]);
      setClaimGroups([]);
      setConsensusScore(0);
      setSummary("");
      setLastQuery(trimmedQuery);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const result = await getHealth();
        if (result.status === "ok") {
          setIsBackendConnected(true);
          setConnectionMessage("Backend Connected ✅");
          return;
        }

        setConnectionMessage("Backend response was unexpected.");
      } catch {
        setConnectionMessage("Backend not reachable. Start FastAPI on port 8000.");
      }
    };

    checkHealth();
  }, []);

  useEffect(() => {
    const queryFromUrl = searchParams.get("q")?.trim();
    if (!queryFromUrl || queryFromUrl === lastAutoQuery) {
      return;
    }

    setQuery(queryFromUrl);
    setLastAutoQuery(queryFromUrl);
    void runSearch(queryFromUrl);
  }, [lastAutoQuery, searchParams]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch(query);
  };

  const hasResults = articles.length > 0 || claimGroups.length > 0 || !!summary;

  return (
    <main className="px-4 pb-16 pt-10">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl">Drishtikon</h1>
          <p className="text-base text-zinc-300 sm:text-lg">Understand the truth behind the news</p>
        </header>

        <Card className="mx-auto w-full max-w-3xl">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSearch} className="space-y-3">
              <Input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a topic (e.g., US elections, AI regulation, climate policy)"
                className="h-14 text-lg"
                aria-label="News topic search"
              />
              <Button type="submit" disabled={isSearching} size="lg" className="w-full sm:w-auto">
                {isSearching ? "Analyzing..." : "Analyze"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className={isBackendConnected ? "text-center text-emerald-400" : "text-center text-amber-300"}>
          {connectionMessage}
        </p>

        {isSearching ? <p className="text-center text-zinc-300">Loading...</p> : null}
        {searchError ? <p className="text-center text-red-300">{searchError}</p> : null}
        {lastQuery && !searchError && !isSearching && !hasResults ? (
          <p className="text-center text-zinc-300">No results found for "{lastQuery}".</p>
        ) : null}

        {hasResults ? (
          <section className="space-y-6">
            <SummaryCard summary={summary} />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Consensus</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-300">{consensusScore}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Claim Groups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {claimGroups.length === 0 ? (
                  <p className="text-sm text-zinc-400">No grouped claims available.</p>
                ) : (
                  claimGroups.map((group, index) => (
                    <div key={`${group.representative_claim}-${index}`} className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 p-3">
                      <p className="text-zinc-100">{group.representative_claim}</p>
                      <p className="mt-1 text-sm text-zinc-400">Sources: {group.sources.join(", ")}</p>
                      <p className="text-sm text-zinc-500">Supporting claims: {group.count}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Articles</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {articles.map((article, index) => (
                  <Card key={`${article.link ?? article.title ?? "article"}-${index}`} className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{article.title ?? "Untitled article"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-200">
                          {article.source ?? "UNKNOWN SOURCE"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 ${getBiasBadgeClasses(article.bias)}`}>
                          {article.bias}
                        </span>
                        {article.pubDate ? <span className="text-zinc-400">{article.pubDate}</span> : null}
                      </div>

                      <p className="text-sm text-zinc-200">{article.description ?? "No description available."}</p>

                      {article.link ? (
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300"
                        >
                          Read full article
                        </a>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default Home;
