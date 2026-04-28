import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopicPills from "../components/TopicPills";
import { getHealth, getTrending, type TrendingResponse, type TrendingItem } from "../lib/api";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Flame,
  Globe,
  Swords,
  Landmark,
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

  const heroStory =
    currentTrendingItems[0] ?? trendingData?.general[0] ?? null;
  const heroSideStories =
    currentTrendingItems.slice(1, 4).length > 0
      ? currentTrendingItems.slice(1, 4)
      : (trendingData?.general ?? []).slice(1, 4);

  const latestStories = currentTrendingItems.slice(0, 4);
  const popularLead = trendingData?.war[0] ?? null;
  const popularMini = (trendingData?.war ?? []).slice(1, 4);
  const highlightLead = trendingData?.geopolitics[0] ?? null;
  const highlightMini = (trendingData?.geopolitics ?? []).slice(1, 5);

  const openAnalysis = (keyword: string) => {
    navigate(`/analysis?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <>
      <TopicPills topics={trendingTopics} onTopicClick={handleTopicClick} />

      <main className="px-4 pb-14 pt-8">
        <section className="mx-auto max-w-[980px] text-center">
          <p className="section-label">Front Page</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-6xl">
            Find News that Meet With
            <br />
            Your Needs
          </h1>

          <form
            onSubmit={handleSearch}
            className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full border border-parchment-300 bg-white px-2 py-2 dark:border-[#2f2d2a] dark:bg-[#121212]"
          >
            <div className="relative flex-1 px-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-[#9f9b93]" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search any news that suit you"
                className="h-10 w-full bg-transparent pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted outline-none dark:text-[#f5f4ef] dark:placeholder:text-[#9f9b93]"
                disabled={isSearching}
                aria-label="News topic search"
                id="hero-search"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="orange-pill h-10 px-5 text-sm font-semibold transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {isSearching ? "Analyzing..." : "Search News"}
            </button>
          </form>

          <div className="mt-3 flex items-center justify-center gap-3 text-xs">
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
              <span className="text-red-600 dark:text-red-400">{searchError}</span>
            )}
          </div>
        </section>

        <section className="mx-auto mt-8 grid max-w-[980px] gap-4 lg:grid-cols-[1.7fr_1fr]">
          {trendingLoading ? (
            <>
              <div className="surface-card overflow-hidden">
                <div className="aspect-[16/10] w-full skeleton-shimmer" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`hero-side-skel-${idx}`} className="surface-card p-3">
                    <div className="h-20 w-full skeleton-shimmer rounded-xl" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <article className="group surface-card relative overflow-hidden bg-[#121212] text-white">
                {heroStory?.image_url ? (
                  <img src={heroStory.image_url} alt={heroStory.title ?? "Featured"} className="aspect-[16/10] w-full object-cover opacity-85" loading="lazy" />
                ) : (
                  <div className="aspect-[16/10] w-full bg-[#252525]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
                    <Flame className="h-3 w-3" />
                    {activeTab}
                  </span>
                  <h2 className="max-w-xl font-serif text-3xl leading-tight sm:text-4xl">
                    {heroStory?.title ?? "No featured story available"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-xs text-white/80 sm:text-sm">
                    {heroStory?.description ?? "Trending stories will appear here as soon as feeds are available."}
                  </p>
                  {heroStory?.keyword && (
                    <button
                      onClick={() => openAnalysis(heroStory.keyword)}
                      className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                      aria-label="Open detailed analysis"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </article>

              <div className="space-y-3">
                {heroSideStories.map((item, idx) => (
                  <article key={`${item.keyword}-${idx}`} className="surface-card group flex gap-3 p-3">
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-parchment-dark dark:bg-[#242424]">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title ?? "story"} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-ink dark:text-[#f5f4ef]">
                        {item.title ?? "Untitled story"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-ink-muted dark:text-[#9f9b93]">
                        {item.description ?? "No description available."}
                      </p>
                    </div>
                    <button
                      onClick={() => openAnalysis(item.keyword)}
                      className="self-end rounded-xl bg-[#191919] p-2 text-white transition-colors hover:bg-[var(--color-accent)] dark:bg-[#f5f4ef] dark:text-[#131313]"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="mx-auto mt-7 max-w-[980px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-serif text-3xl text-ink">Latest News</h3>
            <button
              onClick={() => navigate("/trending")}
              className="inline-flex items-center gap-1 rounded-full border border-parchment-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary transition-colors hover:text-ink dark:border-[#2f2d2a] dark:text-[#cac8c2]"
            >
              See more
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {TRENDING_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === tab.key
                      ? "orange-pill"
                      : "border border-parchment-300 text-ink-secondary hover:text-ink dark:border-[#2f2d2a] dark:text-[#cac8c2]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(latestStories.length > 0 ? latestStories : trendingData?.general ?? []).slice(0, 4).map((item, idx) => (
              <article key={`${item.keyword}-${idx}`} className="surface-card group overflow-hidden">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-parchment-dark dark:bg-[#242424]">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title ?? "story"} className="h-full w-full object-cover transition-transform duration-400 group-hover:scale-105" loading="lazy" />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-ink dark:text-[#f5f4ef]">{item.title ?? "Untitled story"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted dark:text-[#9f9b93]">{item.description ?? "No description available."}</p>
                  <button
                    onClick={() => openAnalysis(item.keyword)}
                    className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#191919] text-white transition-colors hover:bg-[var(--color-accent)] dark:bg-[#f5f4ef] dark:text-[#131313]"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[980px] rounded-[28px] bg-[#171719] px-5 py-7 text-white sm:px-8">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-serif text-3xl">Popular Story</h3>
            <button onClick={() => navigate("/trending")} className="orange-pill inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
              See more
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {popularLead && (
            <article className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="overflow-hidden rounded-2xl bg-[#2a2a2d]">
                {popularLead.image_url ? (
                  <img src={popularLead.image_url} alt={popularLead.title ?? "Popular story"} className="aspect-[16/10] w-full object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-[16/10] w-full" />
                )}
              </div>
              <div className="flex flex-col justify-center">
                <h4 className="font-serif text-4xl leading-tight">{popularLead.title ?? "No popular story available"}</h4>
                <p className="mt-3 text-sm text-white/75">{popularLead.description ?? "Latest conflict stories will be shown here."}</p>
                <button
                  onClick={() => openAnalysis(popularLead.keyword)}
                  className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#131313] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
                >
                  <ArrowUpRight className="h-5 w-5" />
                </button>
              </div>
            </article>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {popularMini.map((item, idx) => (
              <article key={`${item.keyword}-${idx}`} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-white/10">
                  {item.image_url ? <img src={item.image_url} alt={item.title ?? "story"} className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold">{item.title ?? "Untitled story"}</p>
                  <button onClick={() => openAnalysis(item.keyword)} className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#131313]">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[980px]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-3xl text-ink">Highlight</h3>
            <button onClick={() => navigate("/trending")} className="orange-pill inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
              See more
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {highlightLead && (
            <article className="group relative overflow-hidden rounded-[30px] bg-[#141414] text-white">
              {highlightLead.image_url ? (
                <img src={highlightLead.image_url} alt={highlightLead.title ?? "Highlight"} className="aspect-[16/8] w-full object-cover opacity-85" loading="lazy" />
              ) : (
                <div className="aspect-[16/8] w-full bg-[#242424]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <h4 className="max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{highlightLead.title ?? "No highlighted report"}</h4>
                <p className="mt-2 max-w-2xl text-sm text-white/75">{highlightLead.description ?? "Top geopolitics briefings appear here."}</p>
                <button
                  onClick={() => openAnalysis(highlightLead.keyword)}
                  className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/35 bg-black/35 text-white backdrop-blur-sm"
                >
                  <ArrowUpRight className="h-5 w-5" />
                </button>
              </div>
            </article>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {highlightMini.map((item, idx) => (
              <article key={`${item.keyword}-${idx}`} className="surface-card overflow-hidden">
                <div className="aspect-[16/10] w-full overflow-hidden bg-parchment-dark dark:bg-[#242424]">
                  {item.image_url ? <img src={item.image_url} alt={item.title ?? "story"} className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold text-ink dark:text-[#f5f4ef]">{item.title ?? "Untitled story"}</p>
                  <button onClick={() => openAnalysis(item.keyword)} className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#191919] text-white dark:bg-[#f5f4ef] dark:text-[#131313]">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-[980px] border-y border-parchment-300 py-10 text-center dark:border-[#2f2d2a]">
          <p className="section-label">Drishtikon</p>
          <h3 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
            Find News that Meet With
            <br />
            Your Needs
          </h3>
          <button className="orange-pill mt-6 px-5 py-2.5 text-sm font-semibold">
            Join Newsletter
          </button>
          <p className="mt-4 text-xs text-ink-muted">Fast, multi-source, bias-aware intelligence.</p>
        </section>

        {!trendingLoading && !heroStory && (
          <section className="mx-auto mt-8 max-w-[980px] rounded-2xl border border-parchment-300 bg-parchment-dark/40 p-6 text-center text-sm text-ink-muted dark:border-[#2f2d2a] dark:bg-[#1e1e1e]">
            No trending stories available right now. Check back soon.
          </div>
        </section>
      </main>
    </>
  );
}

export default Home;
