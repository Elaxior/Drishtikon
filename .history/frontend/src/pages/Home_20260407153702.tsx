import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopicPills from "../components/TopicPills";
import ArticleCard from "../components/ArticleCard";
import { getHealth, getTrending, type TrendingResponse, type TrendingItem } from "../lib/api";
import {
  ArrowRight,
  Search,
  Shield,
  BarChart3,
  Eye,
  Flame,
  Globe,
  Swords,
  Landmark,
  Zap,
} from "lucide-react";

const SAMPLE_TOPICS = [
  "US Elections",
  "Artificial Intelligence",
  "Climate Policy",
  "Ukraine War",
  "China Taiwan",
  "Iran War",
  "Modi",
  "BRICS",
  "NATO",
  "Economy",
];

type TrendingTabKey = "general" | "war" | "geopolitics";

const TRENDING_TABS: Array<{
  key: TrendingTabKey;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "general", label: "Top Stories", icon: Globe },
  { key: "war", label: "War & Conflict", icon: Swords },
  { key: "geopolitics", label: "Geopolitics", icon: Landmark },
];

function Home() {
  const navigate = useNavigate();
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [connectionMessage, setConnectionMessage] =
    useState("Checking backend...");
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [trendingTopics, setTrendingTopics] = useState<string[]>(SAMPLE_TOPICS);

  // Trending preview state
  const [trendingData, setTrendingData] = useState<TrendingResponse | null>(null);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TrendingTabKey>("general");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const result = await getHealth();
        if (result.status === "ok") {
          setIsBackendConnected(true);
          setConnectionMessage("Connected");
          return;
        }
        setConnectionMessage("Backend response was unexpected.");
      } catch {
        setConnectionMessage("Backend not reachable");
      }
    };

    checkHealth();
  }, []);

  useEffect(() => {
    const loadTrending = async () => {
      setTrendingLoading(true);
      try {
        const data: TrendingResponse = await getTrending();
        setTrendingData(data);
        const keywords = [
          ...data.general.map((i) => i.keyword),
          ...data.war.map((i) => i.keyword),
          ...data.geopolitics.map((i) => i.keyword),
        ].filter((k) => k && k.length > 0);

        if (keywords.length > 0) {
          setTrendingTopics(keywords.slice(0, 12));
        }
      } catch {
        // Use default topics
      } finally {
        setTrendingLoading(false);
      }
    };

    loadTrending();
  }, []);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchError("Please enter a topic to search.");
      return;
    }

    setIsSearching(true);
    setSearchError("");
    navigate(`/analysis?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleTopicClick = (topic: string) => {
    navigate(`/analysis?q=${encodeURIComponent(topic)}`);
  };

  const currentTrendingItems: TrendingItem[] =
    trendingData ? trendingData[activeTab] : [];

  return (
    <>
      {/* Trending topic pills bar */}
      <TopicPills topics={trendingTopics} onTopicClick={handleTopicClick} />

      <main className="px-4 pb-16 pt-0">
        {/* Hero section */}
        <section className="mx-auto max-w-4xl pb-12 pt-16 text-center sm:pt-24">
          <h1 className="font-serif text-4xl leading-tight text-ink dark:text-[#f5f0e8] sm:text-6xl md:text-7xl">
            See every side of
            <br />
            every news story.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-secondary dark:text-[#b8b0a4]">
            Read the news from multiple perspectives. We aggregate{" "}
            <span className="font-semibold text-ink dark:text-[#f5f0e8]">
              4 news APIs
            </span>{" "}
            to show you bias-analyzed coverage from diverse sources worldwide.
          </p>

          {/* Search input */}
          <form
            onSubmit={handleSearch}
            className="mx-auto mt-10 flex max-w-xl items-center gap-3"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted dark:text-[#8a8279]" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Paste a social link or type a claim (Instagram, Facebook, X, YouTube, TikTok, or text)"
                className="h-14 w-full rounded-xl border border-parchment-300 bg-white pl-12 pr-4 text-base text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/10 dark:border-[#3a342c] dark:bg-[#151310] dark:text-[#f5f0e8] dark:placeholder:text-[#8a8279] dark:focus:ring-[#f5f0e8]/10"
                disabled={isSearching}
                aria-label="News topic search"
                id="hero-search"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="flex h-14 items-center gap-2 rounded-xl bg-ink px-6 font-medium text-white transition-all duration-200 hover:bg-ink-secondary disabled:opacity-50 dark:bg-[#f5f0e8] dark:text-[#1c1917] dark:hover:bg-[#d8d0c4]"
            >
              {isSearching ? "Analyzing..." : "Analyze"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Status indicators */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                isBackendConnected
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isBackendConnected
                    ? "animate-pulse bg-emerald-500"
                    : "bg-amber-500"
                }`}
              />
              {connectionMessage}
            </span>
            {searchError && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {searchError}
              </span>
            )}
          </div>

          {/* Provider badges */}
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            {[
              { name: "NewsData", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
              { name: "GNews", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
              { name: "Currents", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
            ].map((p) => (
              <span
                key={p.name}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${p.color}`}
              >
                <Zap className="h-3 w-3" />
                {p.name}
              </span>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            TRENDING PREVIEW SECTION
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl" id="trending-preview">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 dark:from-amber-400/10 dark:to-orange-500/10">
                <Flame className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-serif text-2xl text-ink dark:text-[#f5f0e8] sm:text-3xl">
                  Trending Now
                </h2>
                <p className="text-xs text-ink-muted dark:text-[#8a8279]">
                  Live from multiple news APIs • Auto-updated every 10 min
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/trending")}
              className="hidden items-center gap-1.5 rounded-lg border border-parchment-300 px-4 py-2 text-xs font-medium text-ink-secondary transition-all hover:border-ink-muted hover:text-ink dark:border-[#3a342c] dark:text-[#b8b0a4] dark:hover:border-[#6b6560] dark:hover:text-[#f5f0e8] sm:inline-flex"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Category tabs */}
          <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-parchment-300 bg-white/60 p-1 dark:border-[#3a342c] dark:bg-[#1c1917]/60">
            {TRENDING_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-ink text-white shadow-sm dark:bg-[#f5f0e8] dark:text-[#1c1917]"
                      : "text-ink-secondary hover:bg-parchment-dark hover:text-ink dark:text-[#b8b0a4] dark:hover:bg-[#2e2923] dark:hover:text-[#f5f0e8]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Trending cards grid */}
          {trendingLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`trending-sk-${index}`}
                  className="rounded-xl border border-parchment-300 bg-white/80 p-0 dark:border-[#3a342c] dark:bg-[#1c1917]/80 overflow-hidden"
                >
                  <div className="aspect-[16/9] w-full skeleton-shimmer" />
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 skeleton-shimmer rounded-full" />
                      <div className="h-3 w-20 skeleton-shimmer rounded" />
                    </div>
                    <div className="h-5 w-3/4 skeleton-shimmer rounded" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-full skeleton-shimmer rounded" />
                      <div className="h-3 w-5/6 skeleton-shimmer rounded" />
                    </div>
                    <div className="h-10 w-full skeleton-shimmer rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : currentTrendingItems.length === 0 ? (
            <div className="rounded-xl border border-parchment-300 bg-parchment-dark/50 p-8 text-center text-sm text-ink-muted dark:border-[#3a342c] dark:bg-[#151310]/50 dark:text-[#8a8279]">
              No trending stories available right now. Check back soon.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {currentTrendingItems.slice(0, 8).map((item, index) => (
                <div
                  key={`${activeTab}-${item.keyword}-${index}`}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <ArticleCard
                    title={item.title}
                    description={item.description}
                    source={item.source}
                    bias={item.bias}
                    imageUrl={item.image_url}
                    provider={item.provider}
                    onViewAnalysis={() =>
                      navigate(
                        `/analysis?q=${encodeURIComponent(item.keyword)}`
                      )
                    }
                    isActionDisabled={false}
                  />
                </div>
              ))}
            </div>
          )}

          {/* View all trending button - mobile */}
          <div className="mt-6 text-center sm:hidden">
            <button
              onClick={() => navigate("/trending")}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-ink-secondary dark:bg-[#f5f0e8] dark:text-[#1c1917] dark:hover:bg-[#d8d0c4]"
            >
              View All Trending
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* How it works — features grid */}
        <section className="mx-auto mt-20 max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="font-serif text-3xl text-ink dark:text-[#f5f0e8]">
              How It Works
            </h2>
            <p className="mt-2 text-sm text-ink-secondary dark:text-[#b8b0a4]">
              Three steps to unbiased understanding
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Multi-Source Search",
                description:
                  "Search any topic and we aggregate coverage from 3 independent news APIs across the political spectrum.",
              },
              {
                icon: Shield,
                title: "Bias Detection",
                description:
                  "Every source is labeled with its political leaning — Left, Center, or Right — so you see the full picture.",
              },
              {
                icon: BarChart3,
                title: "Consensus Analysis",
                description:
                  "Our AI extracts factual claims and measures agreement across sources to show you what's actually confirmed.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-xl border border-parchment-300 bg-white/60 p-6 transition-all duration-300 hover:border-ink-muted/30 hover:shadow-md dark:border-[#3a342c] dark:bg-[#1c1917]/60 dark:hover:border-[#6b6560]/40"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-parchment-dark dark:bg-[#2e2923]">
                  <Icon className="h-5 w-5 text-ink-secondary dark:text-[#b8b0a4]" />
                </div>
                <h3 className="mb-2 font-serif text-lg text-ink dark:text-[#f5f0e8]">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-secondary dark:text-[#b8b0a4]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Browse trending CTA */}
        <section className="mx-auto mt-16 max-w-2xl text-center">
          <div className="rounded-xl border border-parchment-300 bg-parchment-dark/40 p-8 dark:border-[#3a342c] dark:bg-[#151310]/40">
            <Eye className="mx-auto mb-4 h-8 w-8 text-ink-muted dark:text-[#8a8279]" />
            <h2 className="font-serif text-2xl text-ink dark:text-[#f5f0e8]">
              Explore Full Trending
            </h2>
            <p className="mt-2 text-sm text-ink-secondary dark:text-[#b8b0a4]">
              Dive deeper — see all categories with full coverage from all 3
              news APIs.
            </p>
            <button
              onClick={() => navigate("/trending")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-ink-secondary dark:bg-[#f5f0e8] dark:text-[#1c1917] dark:hover:bg-[#d8d0c4]"
            >
              View Trending
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

export default Home;
