import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import TopicPills from "../components/TopicPills";
import ArticleCard from "../components/ArticleCard";
import { getHealth, getTrending, type TrendingResponse, type TrendingItem } from "../lib/api";
import { useAuth } from "../lib/auth-store";
import { getSavedArticleId, toSaveArticleInputFromTrending } from "../lib/saved-articles";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  Shield,
  BarChart3,
  Globe,
  Swords,
  Landmark,
  Newspaper,
  Clock3,
  Heart,
  MessageCircle,
  Repeat2,
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

const SOCIAL_WINDOW_POSTS = [
  {
    name: "Narendra Modi",
    username: "@narendramodi",
    body: "Today, India takes a defining step in its civil nuclear journey, advancing the second stage of its nuclear programme.",
    country: "🇮🇳 India",
    platform: "X",
    timestamp: "3m",
    likes: "24.1K",
    replies: "2.7K",
    reposts: "5.4K",
    accentClass: "from-orange-500 to-rose-500",
    screenshot: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "BBC News UK",
    username: "@BBCNews",
    body: "Bill Gates set to testify before US Congress in Epstein investigation",
    country: "🇬🇧 UK",
    platform: "X",
    timestamp: "11m",
    likes: "8.9K",
    replies: "1.2K",
    reposts: "2.3K",
    accentClass: "from-sky-500 to-blue-600",
    screenshot: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "The Guardian",
    username: "@guardian",
    body: "Australians' wages increase faster than inflation for fourth quarter running",
    country: "🇬🇧 UK",
    platform: "Threads",
    timestamp: "19m",
    likes: "6.4K",
    replies: "943",
    reposts: "1.1K",
    accentClass: "from-emerald-500 to-teal-600",
    screenshot: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Sambit Patra",
    username: "@sambitswaraj",
    body: "भारत माता की जय🙏",
    country: "🇮🇳 India",
    platform: "Koo",
    timestamp: "24m",
    likes: "12.7K",
    replies: "3.1K",
    reposts: "4.2K",
    accentClass: "from-amber-500 to-orange-600",
    screenshot: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Al Jazeera English",
    username: "@AJEnglish",
    body: "UK blocks rapper Kanye West from entry over anti-Semitism and Nazi support",
    country: "🇶🇦 Qatar",
    platform: "X",
    timestamp: "41m",
    likes: "9.2K",
    replies: "2.4K",
    reposts: "3.8K",
    accentClass: "from-fuchsia-500 to-purple-600",
    screenshot: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Rahul Gandhi",
    username: "@RahulGandhi",
    body: "Wars are tragic, yet they remain a reality.",
    country: "🇮🇳 India",
    platform: "X",
    timestamp: "57m",
    likes: "19.8K",
    replies: "4.7K",
    reposts: "6.3K",
    accentClass: "from-violet-500 to-indigo-600",
    screenshot: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "The Wire",
    username: "@thewire_in",
    body: "IAF Lost Fighter Jets to Pak Because of Political Leadership's Constraints': Indian Defence Attache",
    country: "🇮🇳 India",
    platform: "Threads",
    timestamp: "1h",
    likes: "7.3K",
    replies: "1.6K",
    reposts: "2.2K",
    accentClass: "from-cyan-500 to-blue-600",
    screenshot: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "CNN",
    username: "@cnn",
    body: "Trump threatens \"a whole civilization will die tonight\"",
    country: "🇺🇸 USA",
    platform: "X",
    timestamp: "1h",
    likes: "11.1K",
    replies: "2.2K",
    reposts: "3.9K",
    accentClass: "from-rose-500 to-red-600",
    screenshot: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Hindustan Times",
    username: "@HindustanTimes",
    body: "6 ministers from non-BJP states file review petition in Supreme Court for postponement of NEET, JEE.",
    country: "🇮🇳 India",
    platform: "Instagram",
    timestamp: "2h",
    likes: "14.8K",
    replies: "2.1K",
    reposts: "1.9K",
    accentClass: "from-pink-500 to-fuchsia-600",
    screenshot: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveArticle, removeSavedArticle, savedArticleIds } = useAuth();
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [trendingTopics, setTrendingTopics] = useState<string[]>(SAMPLE_TOPICS);

  // Trending preview state
  const [trendingData, setTrendingData] = useState<TrendingResponse | null>(null);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TrendingTabKey>("general");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [socialSlideIndex, setSocialSlideIndex] = useState(0);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const result = await getHealth();
        setIsBackendConnected(result.status === "ok");
      } catch {
        setIsBackendConnected(false);
      }
    };

    void checkHealth();
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSocialSlideIndex((previous) => (previous + 1) % SOCIAL_WINDOW_POSTS.length);
    }, 3200);

    return () => window.clearInterval(intervalId);
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

  const handleAnalyzeTrendingItem = (item: TrendingItem) => {
    const exactHeadline = (item.title ?? "").trim();
    const fallback = (item.keyword ?? "").trim();
    const q = exactHeadline || fallback;

    if (!q) {
      navigate("/");
      return;
    }

    navigate(`/analysis?q=${encodeURIComponent(q)}`, {
      state: {
        seedArticle: {
          title: item.title,
          description: item.description,
          source: item.source,
          bias: item.bias,
          claims: [],
          link: null,
          pubDate: null,
          image_url: item.image_url,
          provider: item.provider,
        },
      },
    });
  };

  const handleToggleSave = async (item: TrendingItem, origin: "home" | "trending") => {
    const saveInput = toSaveArticleInputFromTrending(item, origin);
    const articleId = getSavedArticleId(saveInput);

    setSavingIds((previous) => new Set(previous).add(articleId));

    try {
      if (savedArticleIds.has(articleId)) {
        await removeSavedArticle(articleId);
      } else {
        await saveArticle(saveInput);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        const redirect = `${location.pathname}${location.search}`;
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
      }
    } finally {
      setSavingIds((previous) => {
        const next = new Set(previous);
        next.delete(articleId);
        return next;
      });
    }
  };

  const currentTrendingItems: TrendingItem[] =
    trendingData ? trendingData[activeTab] : [];

  const allTrendingItems = trendingData
    ? [...trendingData.general, ...trendingData.war, ...trendingData.geopolitics]
    : [];

  const heroFeatured = currentTrendingItems[0] ?? null;
  const heroSideStories = currentTrendingItems.slice(1, 4);
  const latestStories = currentTrendingItems.slice(4, 8);

  const popularFeatured = allTrendingItems[4] ?? allTrendingItems[0] ?? null;
  const popularStories = allTrendingItems.slice(5, 10);

  const highlightFeatured = allTrendingItems[8] ?? allTrendingItems[1] ?? null;
  const highlightStories = allTrendingItems.slice(9, 13);

  return (
    <>
      <TopicPills topics={trendingTopics} onTopicClick={handleTopicClick} />

      <main className="px-4 pb-14 pt-6">
        <section className="mx-auto max-w-7xl space-y-10">
          <header className="surface-panel relative animate-fade-in-scale overflow-hidden rounded-[2rem] px-5 py-8 sm:px-8 md:px-10 md:py-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
              <div>
                <p className="section-kicker mb-4">AI powered media intelligence</p>
                <h1 className="headline-glow max-w-3xl font-serif text-4xl leading-[1.05] text-ink dark:text-[#eef1f8] sm:text-5xl md:text-6xl">
                  Find News that Meet With
                  <br />
                  Your Needs
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-secondary dark:text-[#adb7c7] sm:text-base">
                  Compare the same story across political leanings, discover
                  verified consensus, and act on evidence rather than noise.
                </p>

                <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted dark:text-[#8892a3]" />
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search any claim, story, or social post"
                      className="h-12 w-full rounded-full border border-parchment-300 bg-white/95 pl-12 pr-4 text-sm text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/10 dark:border-[#2a313d] dark:bg-[#111317] dark:text-[#eef1f8] dark:placeholder:text-[#8892a3] dark:focus:ring-[#eef1f8]/10"
                      disabled={isSearching}
                      aria-label="News topic search"
                      id="hero-search"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white transition-all duration-200 hover:bg-accent-hover disabled:opacity-50"
                  >
                    {isSearching ? "Analyzing" : "Search News"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                {searchError && (
                  <div className="mt-4 text-xs text-red-600 dark:text-red-400">{searchError}</div>
                )}
              </div>

              <div className="flex h-full flex-col">
                <p
                  className={`mb-2 inline-flex self-end items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
                    isBackendConnected
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-300"
                  }`}
                >
                  <span
                    className={`h-1 w-1 rounded-full ${
                      isBackendConnected ? "animate-pulse bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {isBackendConnected ? "Connected" : "Offline"}
                </p>

                <div className="flex min-h-[240px] flex-1 flex-col rounded-3xl border border-parchment-300 bg-white/80 p-4 shadow-sm dark:border-[#2a313d] dark:bg-[#111317]/75 lg:min-h-0">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary dark:text-[#adb7c7]">
                      Social Window
                    </p>
                    <div className="flex gap-1">
                      {SOCIAL_WINDOW_POSTS.map((_, index) => (
                        <span
                          key={`social-dot-${index}`}
                          className={`h-1.5 rounded-full transition-all ${
                            socialSlideIndex === index
                              ? "w-4 bg-accent"
                              : "w-1.5 bg-parchment-300 dark:bg-[#2a313d]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="relative mt-1 flex-1 overflow-hidden rounded-2xl border border-parchment-300 bg-parchment-dark/50 dark:border-[#2a313d] dark:bg-[#151922]/70">
                    {SOCIAL_WINDOW_POSTS.map((post, index) => (
                      <div
                        key={`${post.username}-${index}`}
                        className="absolute inset-0 flex flex-col p-4 transition-transform duration-700 ease-out"
                        style={{ transform: `translateX(${(index - socialSlideIndex) * 100}%)` }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${post.accentClass} text-[11px] font-bold text-white`}>
                            {getInitials(post.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink-secondary dark:text-[#adb7c7]">
                              {post.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-ink-muted dark:text-[#8892a3]">
                              <span className="truncate">{post.username}</span>
                              <span>•</span>
                              <span>{post.timestamp}</span>
                            </div>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-[11px] text-ink-muted dark:text-[#8892a3]">{post.country}</span>
                            <span className="rounded-full border border-parchment-300 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary dark:border-[#2a313d] dark:bg-[#151922] dark:text-[#adb7c7]">
                              {post.platform}
                            </span>
                          </div>
                        </div>

                        <p className="line-clamp-5 text-sm leading-relaxed text-ink blur-[1.3px] dark:text-[#d7dfeb]">
                          {post.body}
                        </p>

                        <div className="relative mt-3 h-24 overflow-hidden rounded-lg border border-parchment-300/80 dark:border-[#2a313d]">
                          <img
                            src={post.screenshot}
                            alt={`${post.name} social post preview`}
                            loading="lazy"
                            className="h-full w-full scale-110 object-cover blur-[3.5px]"
                          />
                          <div className="absolute inset-0 bg-black/15" />
                        </div>

                        <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-ink-muted dark:text-[#8892a3]">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {post.likes}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {post.replies}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Repeat2 className="h-3 w-3" /> {post.reposts}
                            </span>
                          </div>
                          <span>Social stream</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </header>

          <div className="rounded-2xl border border-parchment-300 bg-white/75 px-4 py-3 dark:border-[#2a313d] dark:bg-[#111317]/65">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border border-parchment-300 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary dark:border-[#2a313d] dark:bg-[#111317] dark:text-[#adb7c7]">
                  <Clock3 className="h-3 w-3" />
                  Live Feed
                </span>
                <p className="text-sm text-ink-secondary dark:text-[#adb7c7]">
                  {trendingLoading
                    ? "Pulling trending story clusters from all providers..."
                    : `${currentTrendingItems.length} stories in ${TRENDING_TABS.find((tab) => tab.key === activeTab)?.label ?? "selected"} now`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {TRENDING_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                        activeTab === tab.key
                          ? "border-accent bg-accent text-white"
                          : "border-parchment-300 bg-white/80 text-ink-secondary hover:border-accent hover:text-ink dark:border-[#2a313d] dark:bg-[#111317] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {trendingLoading ? (
            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="aspect-[16/10] rounded-3xl skeleton-shimmer" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`home-side-skeleton-${index}`} className="h-28 rounded-2xl skeleton-shimmer" />
                ))}
              </div>
            </section>
          ) : currentTrendingItems.length === 0 ? (
            <section className="rounded-2xl border border-parchment-300 bg-parchment-dark/45 p-8 text-center text-sm text-ink-muted dark:border-[#2a313d] dark:bg-[#151922]/45 dark:text-[#8892a3]">
              No trending stories available right now. Check back soon.
            </section>
          ) : (
            <>
              <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                {heroFeatured && (
                  (() => {
                    const saveInput = toSaveArticleInputFromTrending(heroFeatured, "home");
                    const articleId = getSavedArticleId(saveInput);
                    return (
                  <ArticleCard
                    title={heroFeatured.title}
                    description={heroFeatured.description}
                    source={heroFeatured.source}
                    bias={heroFeatured.bias}
                    imageUrl={heroFeatured.image_url}
                    provider={heroFeatured.provider}
                    variant="featured"
                    onViewAnalysis={() => handleAnalyzeTrendingItem(heroFeatured)}
                    onToggleSave={() => void handleToggleSave(heroFeatured, "home")}
                    isSaved={savedArticleIds.has(articleId)}
                    isSaveDisabled={savingIds.has(articleId)}
                  />
                    );
                  })()
                )}
                <div className="space-y-3">
                  {heroSideStories.map((item, index) => (
                    <div key={`hero-side-${item.keyword}-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${index * 70}ms` }}>
                      {(() => {
                        const saveInput = toSaveArticleInputFromTrending(item, "home");
                        const articleId = getSavedArticleId(saveInput);
                        return (
                      <ArticleCard
                        title={item.title}
                        description={item.description}
                        source={item.source}
                        bias={item.bias}
                        imageUrl={item.image_url}
                        provider={item.provider}
                        variant="compact"
                        onViewAnalysis={() => handleAnalyzeTrendingItem(item)}
                        onToggleSave={() => void handleToggleSave(item, "home")}
                        isSaved={savedArticleIds.has(articleId)}
                        isSaveDisabled={savingIds.has(articleId)}
                      />
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="section-kicker">Latest News</p>
                    <h2 className="font-serif text-3xl text-ink dark:text-[#eef1f8]">Fresh Coverage</h2>
                  </div>
                  <button
                    onClick={() => navigate("/trending")}
                    className="inline-flex items-center gap-1 rounded-full border border-parchment-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-colors hover:border-accent hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
                  >
                    More News
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {latestStories.map((item, index) => (
                    <div key={`latest-${item.keyword}-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${index * 70}ms` }}>
                      {(() => {
                        const saveInput = toSaveArticleInputFromTrending(item, "home");
                        const articleId = getSavedArticleId(saveInput);
                        return (
                      <ArticleCard
                        title={item.title}
                        description={item.description}
                        source={item.source}
                        bias={item.bias}
                        imageUrl={item.image_url}
                        provider={item.provider}
                        variant="compact"
                        onViewAnalysis={() => handleAnalyzeTrendingItem(item)}
                        onToggleSave={() => void handleToggleSave(item, "home")}
                        isSaved={savedArticleIds.has(articleId)}
                        isSaveDisabled={savingIds.has(articleId)}
                      />
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {popularFeatured && (
            <section className="overflow-hidden rounded-[2rem] bg-[#17191f] px-4 py-8 text-[#eef1f8] sm:px-6 md:px-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="section-kicker text-[#9aa7bd]">Popular Story</p>
                  <h2 className="font-serif text-3xl text-white">Most Discussed</h2>
                </div>
                <button
                  onClick={() => navigate("/trending")}
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-hover"
                >
                  See More
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="overflow-hidden rounded-2xl border border-[#30384a] bg-[#1f2430]">
                  {(() => {
                    const saveInput = toSaveArticleInputFromTrending(popularFeatured, "home");
                    const articleId = getSavedArticleId(saveInput);
                    return (
                  <ArticleCard
                    title={popularFeatured.title}
                    description={popularFeatured.description}
                    source={popularFeatured.source}
                    bias={popularFeatured.bias}
                    imageUrl={popularFeatured.image_url}
                    provider={popularFeatured.provider}
                    variant="featured"
                    onViewAnalysis={() => handleAnalyzeTrendingItem(popularFeatured)}
                    onToggleSave={() => void handleToggleSave(popularFeatured, "home")}
                    isSaved={savedArticleIds.has(articleId)}
                    isSaveDisabled={savingIds.has(articleId)}
                  />
                    );
                  })()}
                </div>
                <div className="hide-scrollbar max-h-[780px] space-y-3 overflow-y-auto pr-1">
                  {popularStories.map((item, index) => (
                    (() => {
                      const saveInput = toSaveArticleInputFromTrending(item, "home");
                      const articleId = getSavedArticleId(saveInput);
                      return (
                    <ArticleCard
                      key={`popular-${item.keyword}-${index}`}
                      title={item.title}
                      description={item.description}
                      source={item.source}
                      bias={item.bias}
                      imageUrl={item.image_url}
                      provider={item.provider}
                      variant="default"
                      onViewAnalysis={() => handleAnalyzeTrendingItem(item)}
                      onToggleSave={() => void handleToggleSave(item, "home")}
                      isSaved={savedArticleIds.has(articleId)}
                      isSaveDisabled={savingIds.has(articleId)}
                    />
                      );
                    })()
                  ))}
                </div>
              </div>
            </section>
          )}

          {highlightFeatured && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="section-kicker">Highlight</p>
                  <h2 className="font-serif text-3xl text-ink dark:text-[#eef1f8]">Editor Pick</h2>
                </div>
                <button
                  onClick={() => navigate("/trending")}
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-hover"
                >
                  See More News
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {(() => {
                  const saveInput = toSaveArticleInputFromTrending(highlightFeatured, "home");
                  const articleId = getSavedArticleId(saveInput);
                  return (
                <ArticleCard
                  title={highlightFeatured.title}
                  description={highlightFeatured.description}
                  source={highlightFeatured.source}
                  bias={highlightFeatured.bias}
                  imageUrl={highlightFeatured.image_url}
                  provider={highlightFeatured.provider}
                  variant="featured"
                  onViewAnalysis={() => handleAnalyzeTrendingItem(highlightFeatured)}
                  onToggleSave={() => void handleToggleSave(highlightFeatured, "home")}
                  isSaved={savedArticleIds.has(articleId)}
                  isSaveDisabled={savingIds.has(articleId)}
                />
                  );
                })()}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {highlightStories.map((item, index) => (
                    (() => {
                      const saveInput = toSaveArticleInputFromTrending(item, "home");
                      const articleId = getSavedArticleId(saveInput);
                      return (
                    <ArticleCard
                      key={`highlight-mini-${item.keyword}-${index}`}
                      title={item.title}
                      description={item.description}
                      source={item.source}
                      bias={item.bias}
                      imageUrl={item.image_url}
                      provider={item.provider}
                      variant="compact"
                      onViewAnalysis={() => handleAnalyzeTrendingItem(item)}
                      onToggleSave={() => void handleToggleSave(item, "home")}
                      isSaved={savedArticleIds.has(articleId)}
                      isSaveDisabled={savingIds.has(articleId)}
                    />
                      );
                    })()
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="surface-panel rounded-[2rem] px-6 py-10 text-center">
            <Newspaper className="mx-auto mb-3 h-6 w-6 text-accent" />
            <h2 className="font-serif text-4xl text-ink dark:text-[#eef1f8]">Find News that Meet With Your Needs</h2>
            <button
              onClick={() => navigate("/trending")}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Trending
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Multi-Source Search",
                description:
                  "Search any topic and aggregate coverage from independent APIs across the spectrum.",
              },
              {
                icon: Shield,
                title: "Bias Detection",
                description:
                  "Each source is labeled Left, Center, or Right so perspective gaps become visible.",
              },
              {
                icon: BarChart3,
                title: "Consensus Analysis",
                description:
                  "Extracted claims are verified and scored to highlight what is actually supported.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="surface-panel rounded-2xl p-5">
                <div className="mb-3 inline-flex rounded-xl bg-parchment-dark p-2 dark:bg-[#202631]">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <h3 className="font-serif text-lg text-ink dark:text-[#eef1f8]">{title}</h3>
                <p className="mt-2 text-sm text-ink-secondary dark:text-[#adb7c7]">{description}</p>
              </div>
            ))}
          </section>
        </section>
      </main>
    </>
  );
}

export default Home;
