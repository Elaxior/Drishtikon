import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getHealth, searchNews, type ClaimGroup, type SearchArticle } from "../lib/api";

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 px-4 text-zinc-100">
      <section className="w-full max-w-4xl space-y-8 text-center">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Drishtikon
          </h1>
          <Link
            to="/trending"
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            View Trending
          </Link>
        </div>

        <form
          onSubmit={handleSearch}
          className="rounded-2xl border border-zinc-700/70 bg-zinc-900/70 p-4 shadow-2xl backdrop-blur sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a topic (e.g., US elections, AI regulation, climate policy)"
              className="h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-5 text-lg text-zinc-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
              aria-label="News topic search"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="h-14 rounded-xl bg-cyan-500 px-6 font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        <p className={isBackendConnected ? "text-emerald-400" : "text-amber-300"}>
          {connectionMessage}
        </p>

        {searchError ? <p className="text-red-300">{searchError}</p> : null}

        {lastQuery && !searchError && !isSearching && articles.length === 0 ? (
          <p className="text-zinc-300">No results found for "{lastQuery}".</p>
        ) : null}

        {articles.length > 0 ? (
          <section className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-5 text-left">
            <h2 className="text-lg font-semibold text-cyan-200">AI Neutral Summary</h2>
            <p className="mt-2 text-zinc-100">{summary || "Summary unavailable"}</p>
          </section>
        ) : null}

        {articles.length > 0 ? (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-left">
            <p className="text-sm uppercase tracking-wide text-zinc-400">Consensus</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{consensusScore}%</p>
          </div>
        ) : null}

        {articles.length > 0 ? (
          <div className="space-y-4 text-left">
            {articles.map((article, index) => (
              <article key={`${article.link ?? article.title ?? "article"}-${index}`} className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
                <h2 className="text-xl font-semibold text-white">
                  {article.title ?? "Untitled article"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-200">
                    {article.source ?? "UNKNOWN SOURCE"}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 ${getBiasBadgeClasses(article.bias)}`}>
                    {article.bias}
                  </span>
                  {article.pubDate ? (
                    <span className="text-zinc-400">{article.pubDate}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-zinc-200">
                  {article.description ?? "No description available."}
                </p>
                {article.claims.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-zinc-100">Claims:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-300">
                      {article.claims.map((claim, claimIndex) => (
                        <li key={`${article.link ?? article.title ?? "claim"}-${claimIndex}`}>
                          {claim}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {article.link ? (
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-cyan-400 hover:text-cyan-300"
                  >
                    Read full article
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {claimGroups.length > 0 ? (
          <section className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-left">
            <h2 className="text-lg font-semibold text-white">Claim Groups</h2>
            <div className="mt-3 space-y-3">
              {claimGroups.map((group, index) => (
                <div key={`${group.representative_claim}-${index}`} className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 p-3">
                  <p className="text-zinc-100">{group.representative_claim}</p>
                  <p className="mt-1 text-sm text-zinc-400">Sources: {group.sources.join(", ")}</p>
                  <p className="text-sm text-zinc-500">Supporting claims: {group.count}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default Home;
