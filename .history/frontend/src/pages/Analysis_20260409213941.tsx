import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Download, ExternalLink, Share2 } from "lucide-react";

import BiasBar from "../components/BiasBar";
import ClaimGroup from "../components/ClaimGroup";
import ConsensusCard from "../components/ConsensusCard";
import CoverageDetails from "../components/CoverageDetails";
import SummaryCard from "../components/SummaryCard";
import { searchNews, type SearchArticle, type SearchResponse } from "../lib/api";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";

function getBiasBadgeClass(bias: BiasType): string {
  if (bias === "LEFT") return "bias-badge bias-badge-left";
  if (bias === "CENTER") return "bias-badge bias-badge-center";
  if (bias === "RIGHT") return "bias-badge bias-badge-right";
  return "bias-badge bias-badge-unknown";
}

function formatTimeAgo(pubDate: string | null): string {
  if (!pubDate) return "";
  try {
    const diff = Date.now() - new Date(pubDate).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "";
  }
}

function Analysis() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [activeFilter, setActiveFilter] = useState<"ALL" | BiasType>("ALL");

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
    if (!lastUpdatedAt) return;
    const intervalId = window.setInterval(() => {
      setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [lastUpdatedAt]);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const handleCopySummary = async () => {
    if (!data?.summary) { setCopyStatus("failed"); return; }
    try {
      await navigator.clipboard.writeText(data.summary);
      setCopyStatus("copied");
    } catch { setCopyStatus("failed"); }
  };

  const handleExportPdf = () => window.print();

  const sourceBiasMap = useMemo(() => {
    const map = new Map<string, BiasType>();
    if (!data) return map;
    data.articles.forEach((a) => {
      const s = a.source?.trim();
      if (s && !map.has(s)) map.set(s, a.bias);
    });
    return map;
  }, [data]);

  const hasFullSpectrumCoverage = useMemo(() => {
    if (!data) return false;
    return ["LEFT", "CENTER", "RIGHT"].every((bias) =>
      data.articles.some((article) => article.bias === bias),
    );
  }, [data]);

  // Group articles by bias for comparison view
  const biasGroups = useMemo(() => {
    if (!data) return { LEFT: [], CENTER: [], RIGHT: [], UNKNOWN: [] };
    const groups: Record<BiasType, SearchArticle[]> = { LEFT: [], CENTER: [], RIGHT: [], UNKNOWN: [] };
    data.articles.forEach((a) => groups[a.bias].push(a));
    return groups;
  }, [data]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    if (!data) return [];
    if (activeFilter === "ALL") return data.articles;
    return data.articles.filter((a) => a.bias === activeFilter);
  }, [data, activeFilter]);

  // Featured article (first one with an image)
  const featuredArticle = useMemo(() => {
    if (!data) return null;
    return data.articles.find((a) => a.image_url) ?? data.articles[0] ?? null;
  }, [data]);

  return (
    <main className="px-4 pb-16 pt-6">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-ink-muted dark:text-[#8a8279]">
          <Link to="/" className="transition-colors hover:text-ink dark:hover:text-[#f5f0e8]">
            Home
          </Link>
          <span>/</span>
          <span>Analysis</span>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <div className="h-8 w-72 skeleton-shimmer rounded" />
            <div className="h-6 w-48 skeleton-shimmer rounded" />
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="aspect-[16/9] w-full skeleton-shimmer rounded-xl" />
                <div className="rounded-xl border border-parchment-300 p-6 dark:border-[#3a342c]">
                  <div className="space-y-2">
                    <div className="h-3 w-full skeleton-shimmer rounded" />
                    <div className="h-3 w-5/6 skeleton-shimmer rounded" />
                    <div className="h-3 w-4/6 skeleton-shimmer rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={`col-sk-${i}`} className="space-y-3 rounded-xl border border-parchment-300 p-4 dark:border-[#3a342c]">
                      <div className="h-4 w-16 skeleton-shimmer rounded" />
                      <div className="h-32 w-full skeleton-shimmer rounded-lg" />
                      <div className="h-3 w-full skeleton-shimmer rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-parchment-300 p-5 dark:border-[#3a342c]">
                  <div className="mb-4 h-5 w-36 skeleton-shimmer rounded" />
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={`sd-sk-${i}`} className="flex justify-between">
                        <div className="h-3 w-28 skeleton-shimmer rounded" />
                        <div className="h-3 w-8 skeleton-shimmer rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {!isLoading && errorMessage && (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoading && data && (
          <>
            {/* Hero section */}
            <header className="mb-8">
              {data.warning && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {data.warning}
                </div>
              )}

              {data.is_social_media_claim && data.social_media_data && (
                <div className="mb-4 rounded-xl border border-parchment-300 bg-white/80 p-4 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-[#8a8279]">
                    Social Media Claim Analysis
                  </p>
                  <p className="mt-1 text-xs text-ink-secondary dark:text-[#b8b0a4]">
                    From {data.social_media_data.platform ?? "Social media link"}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-ink-secondary dark:text-[#b8b0a4]">
                    <p>
                      <span className="font-semibold text-ink dark:text-[#f5f0e8]">What the post/reel said: </span>
                      {data.social_media_data.original_input}
                    </p>
                    <p>
                      <span className="font-semibold text-ink dark:text-[#f5f0e8]">Extracted factual claim: </span>
                      {data.social_media_data.extracted_claim}
                    </p>
                    {data.social_media_data.derived_search_query && (
                      <p>
                        <span className="font-semibold text-ink dark:text-[#f5f0e8]">News search query used: </span>
                        {data.social_media_data.derived_search_query}
                      </p>
                    )}
                    {!data.social_media_data.success && data.social_media_data.error && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Extraction fallback used: {data.social_media_data.error}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-xs text-ink-muted dark:text-[#8a8279]">
                    Published {formatTimeAgo(data.articles[0]?.pubDate ?? null)}
                    {data.articles[0]?.pubDate && ` • Updated ${secondsSinceUpdate}s ago`}
                  </p>
                  <h1 className="font-serif text-3xl leading-tight text-ink dark:text-[#f5f0e8] sm:text-4xl md:text-5xl">
                    {query}
                  </h1>
                  {/* Provider badges */}
                  {data.providers && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-ink-muted dark:text-[#8a8279]">
                        {data.total_sources ?? data.articles.length} sources from:
                      </span>
                      {data.providers.newsdata != null && data.providers.newsdata > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          NewsData ({data.providers.newsdata})
                        </span>
                      )}
                      {data.providers.gnews != null && data.providers.gnews > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          GNews ({data.providers.gnews})
                        </span>
                      )}
                      {data.providers.currents != null && data.providers.currents > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                          Currents ({data.providers.currents})
                        </span>
                      )}
                      {data.providers.newsapi != null && data.providers.newsapi > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          NewsAPI ({data.providers.newsapi})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bias filter tabs + bias bar */}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <div className="flex items-center overflow-hidden rounded-lg border border-parchment-300 dark:border-[#3a342c]">
                  {(["ALL", "LEFT", "CENTER", "RIGHT"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab as "ALL" | BiasType)}
                      className={`px-4 py-2 text-xs font-medium transition-colors ${
                        activeFilter === tab
                          ? "bg-ink text-white dark:bg-[#f5f0e8] dark:text-[#1c1917]"
                          : "text-ink-secondary hover:bg-parchment-dark dark:text-[#b8b0a4] dark:hover:bg-[#2e2923]"
                      } ${tab !== "ALL" ? "border-l border-parchment-300 dark:border-[#3a342c]" : ""}`}
                    >
                      {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                <div className="w-48 sm:w-64">
                  <BiasBar articles={data.articles} showLabels={false} size="sm" />
                </div>

                <span className="text-xs text-ink-muted dark:text-[#8a8279]">
                  {filteredArticles.length} / {data.articles.length} sources
                </span>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    hasFullSpectrumCoverage
                      ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {hasFullSpectrumCoverage
                    ? "Full Spectrum: Left, Center, Right"
                    : "Partial Spectrum: Missing one side"}
                </span>
              </div>
            </header>

            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              {/* ===== Main content column ===== */}
              <section className="space-y-8">

                {/* Featured article with image */}
                {featuredArticle && featuredArticle.image_url && (
                  <div className="animate-fade-in-up overflow-hidden rounded-xl border border-parchment-300 bg-white/80 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
                    <div className="relative aspect-[2/1] w-full overflow-hidden bg-parchment-dark dark:bg-[#2e2923]">
                      <img
                        src={featuredArticle.image_url}
                        alt={featuredArticle.title ?? "Featured article"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold uppercase text-white backdrop-blur-sm">
                            {(featuredArticle.source ?? "?")[0]}
                          </div>
                          <span className="text-xs text-white/80">
                            {featuredArticle.source ?? "Unknown"}
                          </span>
                          <span className={getBiasBadgeClass(featuredArticle.bias)}>
                            {featuredArticle.bias}
                          </span>
                        </div>
                        {featuredArticle.link ? (
                          <a href={featuredArticle.link} target="_blank" rel="noreferrer"
                            className="font-serif text-xl leading-snug text-white transition-colors hover:text-white/80 sm:text-2xl">
                            {featuredArticle.title}
                          </a>
                        ) : (
                          <p className="font-serif text-xl leading-snug text-white sm:text-2xl">
                            {featuredArticle.title}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================== */}
                {/* NEWS COMPARISON: LEFT / CENTER / RIGHT columns */}
                {/* ============================== */}
                <div className="rounded-xl border border-parchment-300 bg-white/80 p-6 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
                  <h3 className="mb-1 font-serif text-xl text-ink dark:text-[#f5f0e8]">
                    News Comparison
                  </h3>
                  <p className="mb-5 text-xs text-ink-muted dark:text-[#8a8279]">
                    See how different sources across the political spectrum cover this story
                  </p>

                  {/* Bias distribution bar */}
                  <div className="mb-6">
                    <BiasBar articles={data.articles} showLabels={true} size="lg" />
                  </div>

                  {/* Three-column comparison */}
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* LEFT column */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b-2 border-bias-left pb-2">
                        <span className="h-3 w-3 rounded-full bg-bias-left" />
                        <span className="text-sm font-semibold text-bias-left">Left</span>
                        <span className="ml-auto text-xs text-ink-muted dark:text-[#8a8279]">
                          {biasGroups.LEFT.length} source{biasGroups.LEFT.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {biasGroups.LEFT.length === 0 ? (
                        <p className="py-4 text-center text-xs text-ink-muted dark:text-[#8a8279]">
                          No left-leaning sources
                        </p>
                      ) : (
                        biasGroups.LEFT.map((article, i) => (
                          <ComparisonArticle key={`left-${i}`} article={article} />
                        ))
                      )}
                    </div>

                    {/* CENTER column */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b-2 border-parchment-300 pb-2 dark:border-[#6b6560]">
                        <span className="h-3 w-3 rounded-full bg-bias-center" />
                        <span className="text-sm font-semibold text-ink-secondary dark:text-[#b8b0a4]">Center</span>
                        <span className="ml-auto text-xs text-ink-muted dark:text-[#8a8279]">
                          {biasGroups.CENTER.length} source{biasGroups.CENTER.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {biasGroups.CENTER.length === 0 ? (
                        <p className="py-4 text-center text-xs text-ink-muted dark:text-[#8a8279]">
                          No center sources
                        </p>
                      ) : (
                        biasGroups.CENTER.map((article, i) => (
                          <ComparisonArticle key={`center-${i}`} article={article} />
                        ))
                      )}
                    </div>

                    {/* RIGHT column */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b-2 border-bias-right pb-2">
                        <span className="h-3 w-3 rounded-full bg-bias-right" />
                        <span className="text-sm font-semibold text-bias-right">Right</span>
                        <span className="ml-auto text-xs text-ink-muted dark:text-[#8a8279]">
                          {biasGroups.RIGHT.length} source{biasGroups.RIGHT.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {biasGroups.RIGHT.length === 0 ? (
                        <p className="py-4 text-center text-xs text-ink-muted dark:text-[#8a8279]">
                          No right-leaning sources
                        </p>
                      ) : (
                        biasGroups.RIGHT.map((article, i) => (
                          <ComparisonArticle key={`right-${i}`} article={article} />
                        ))
                      )}
                    </div>
                  </div>

                  {/* UNKNOWN sources below if any */}
                  {biasGroups.UNKNOWN.length > 0 && (
                    <div className="mt-4 border-t border-parchment-200 pt-4 dark:border-[#2e2923]">
                      <p className="mb-2 text-xs font-medium text-ink-muted dark:text-[#8a8279]">
                        Untracked bias ({biasGroups.UNKNOWN.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {biasGroups.UNKNOWN.map((a, i) => (
                          <span key={`unknown-${i}`} className="bias-badge bias-badge-unknown">
                            {a.source ?? "Unknown"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Summary — below comparison */}
                <SummaryCard summary={data.summary} />

                {/* Action bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-parchment-300 px-3 py-2 text-xs font-medium text-ink-secondary transition-all hover:border-ink-muted hover:text-ink dark:border-[#3a342c] dark:text-[#b8b0a4] dark:hover:border-[#6b6560] dark:hover:text-[#f5f0e8]">
                    <Copy className="h-3.5 w-3.5" /> Copy Summary
                  </button>
                  <button type="button" onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-parchment-300 px-3 py-2 text-xs font-medium text-ink-secondary transition-all hover:border-ink-muted hover:text-ink dark:border-[#3a342c] dark:text-[#b8b0a4] dark:hover:border-[#6b6560] dark:hover:text-[#f5f0e8]">
                    <Download className="h-3.5 w-3.5" /> Export PDF
                  </button>
                  <button type="button"
                    onClick={() => navigator.share?.({ title: `Drishtikon: ${query}`, url: window.location.href }).catch(() => {})}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-parchment-300 px-3 py-2 text-xs font-medium text-ink-secondary transition-all hover:border-ink-muted hover:text-ink dark:border-[#3a342c] dark:text-[#b8b0a4] dark:hover:border-[#6b6560] dark:hover:text-[#f5f0e8]">
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  {copyStatus === "copied" && <span className="text-xs text-emerald-600 dark:text-emerald-400">Copied!</span>}
                  {copyStatus === "failed" && <span className="text-xs text-red-600 dark:text-red-400">Failed to copy</span>}
                </div>

                {/* Consensus */}
                <ConsensusCard score={data.consensus} />

                {/* Claim Comparison */}
                <div className="rounded-xl border border-parchment-300 bg-white/80 p-6 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
                  <h3 className="mb-4 font-serif text-lg text-ink dark:text-[#f5f0e8]">
                    Claim Comparison
                  </h3>
                  {data.claim_groups.length === 0 ? (
                    <p className="text-sm text-ink-muted dark:text-[#8a8279]">No grouped claims available.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.claim_groups.map((group, index) => (
                        <ClaimGroup
                          key={`${group.representative_claim}-${index}`}
                          representativeClaim={group.representative_claim}
                          count={group.count}
                          sources={group.sources.map((source) => ({
                            name: source,
                            bias: sourceBiasMap.get(source) ?? "UNKNOWN",
                          }))}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* All Sources list with images */}
                <div className="rounded-xl border border-parchment-300 bg-white/80 p-6 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
                  <h3 className="mb-4 font-serif text-lg text-ink dark:text-[#f5f0e8]">
                    All Sources ({filteredArticles.length})
                  </h3>
                  {filteredArticles.length === 0 ? (
                    <p className="text-sm text-ink-muted dark:text-[#8a8279]">No source articles found.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredArticles.map((article, index) => (
                        <SourceRow key={`${article.link ?? article.title ?? "src"}-${index}`} article={article} index={index} />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ===== Sidebar ===== */}
              <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
                <CoverageDetails
                  articles={data.articles}
                  lastUpdated={lastUpdatedAt}
                  secondsSinceUpdate={secondsSinceUpdate}
                />
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════
   Sub-components for the comparison view & source list
   ═══════════════════════════════════════════════════════ */

/** Small article card used in Left/Center/Right columns */
function ComparisonArticle({ article }: { article: SearchArticle }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="group rounded-lg border border-parchment-200 bg-parchment/60 transition-all duration-200 hover:border-parchment-300 hover:shadow-sm dark:border-[#2e2923] dark:bg-[#151310]/60 dark:hover:border-[#3a342c]">
      {/* Thumbnail */}
      {article.image_url && !imgErr ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-lg bg-parchment-dark dark:bg-[#2e2923]">
          <img
            src={article.image_url}
            alt={article.title ?? ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="p-3">
        {/* Source */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-parchment-dark text-[8px] font-bold uppercase text-ink-secondary dark:bg-[#2e2923] dark:text-[#b8b0a4]">
            {(article.source ?? "?")[0]}
          </div>
          <span className="text-[11px] text-ink-muted dark:text-[#8a8279]">
            {article.source ?? "Unknown"}
          </span>
          {article.pubDate && (
            <span className="ml-auto text-[10px] text-ink-muted/60 dark:text-[#8a8279]/60">
              {formatTimeAgo(article.pubDate)}
            </span>
          )}
        </div>

        {/* Title */}
        {article.link ? (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium leading-snug text-ink transition-colors hover:text-ink-secondary dark:text-[#f5f0e8] dark:hover:text-[#b8b0a4]"
          >
            {article.title ?? "Untitled"}
          </a>
        ) : (
          <p className="text-sm font-medium leading-snug text-ink dark:text-[#f5f0e8]">
            {article.title ?? "Untitled"}
          </p>
        )}

        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink dark:text-[#8a8279] dark:hover:text-[#f5f0e8]"
          >
            Open original source
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Source row with image thumbnail, used in the "All Sources" list */
function SourceRow({ article, index }: { article: SearchArticle; index: number }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      className="animate-fade-in-up flex gap-4 rounded-lg border border-parchment-200 bg-parchment/60 p-3 transition-all duration-200 hover:border-parchment-300 dark:border-[#2e2923] dark:bg-[#151310]/60 dark:hover:border-[#3a342c]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Thumbnail */}
      {article.image_url && !imgErr ? (
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-parchment-dark dark:bg-[#2e2923]">
          <img
            src={article.image_url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-parchment-dark dark:bg-[#2e2923]">
          <span className="text-[9px] uppercase tracking-wider text-ink-muted dark:text-[#6b6560]">
            No image
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {article.link ? (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="group/link inline-flex items-center gap-1.5 text-sm font-medium leading-snug text-ink transition-colors hover:text-ink-secondary dark:text-[#f5f0e8] dark:hover:text-[#b8b0a4]"
          >
            <span>{article.title ?? "Untitled article"}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
          </a>
        ) : (
          <p className="text-sm font-medium leading-snug text-ink dark:text-[#f5f0e8]">
            {article.title ?? "Untitled article"}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-parchment-dark text-[8px] font-bold uppercase text-ink-secondary dark:bg-[#2e2923] dark:text-[#b8b0a4]">
            {(article.source ?? "?")[0]}
          </div>
          <span className="text-xs text-ink-muted dark:text-[#8a8279]">
            {article.source ?? "Unknown"}
          </span>
          <span className={getBiasBadgeClass(article.bias)}>
            {article.bias}
          </span>
          {article.pubDate && (
            <span className="text-[10px] text-ink-muted/60 dark:text-[#8a8279]/60">
              {formatTimeAgo(article.pubDate)}
            </span>
          )}

          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink dark:text-[#8a8279] dark:hover:text-[#f5f0e8]"
            >
              Original
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analysis;
