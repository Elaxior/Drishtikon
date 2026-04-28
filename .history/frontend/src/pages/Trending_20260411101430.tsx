import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Globe, Landmark, Swords } from "lucide-react";

import ArticleCard from "../components/ArticleCard";
import { getTrending, type TrendingItem, type TrendingResponse } from "../lib/api";

const SECTION_CONFIG: Array<{
  key: keyof TrendingResponse;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}> = [
  {
    key: "general",
    title: "India + Global Trending",
    subtitle: "Top headlines with stronger India relevance",
    icon: Globe,
  },
  {
    key: "war",
    title: "Conflict Updates",
    subtitle: "Major conflict coverage including South Asia angles",
    icon: Swords,
  },
  {
    key: "geopolitics",
    title: "India & Geopolitics",
    subtitle: "Strategic power dynamics centered on India and its region",
    icon: Landmark,
  },
];

function Trending() {
  const navigate = useNavigate();
  const [data, setData] = useState<TrendingResponse>({
    general: [],
    war: [],
    geopolitics: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadTrending = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await getTrending();
        setData(response);
      } catch {
        setErrorMessage("Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadTrending();
  }, []);

  const onViewAnalysis = (item: TrendingItem) => {
    const query = [item.title ?? "", item.source ?? ""]
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join(" ")
      .trim() || item.keyword.trim();

    if (!query) {
      navigate("/");
      return;
    }

    navigate(`/analysis?q=${encodeURIComponent(query)}`);
  };

  return (
    <main className="px-4 pb-14 pt-8">
      <section className="mx-auto w-full max-w-7xl space-y-10">
        <header className="surface-panel rounded-[2rem] px-6 py-8 sm:px-8">
          <p className="section-kicker mb-3">Live editorial feed</p>
          <h1 className="font-serif text-4xl text-ink dark:text-[#eef1f8] sm:text-5xl">
            Trending
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-secondary dark:text-[#adb7c7]">
            Major developments at a glance with stronger India context. Each
            cluster is grouped as a lead story plus rapid briefs for faster scanning.
          </p>
        </header>

        {isLoading && (
          <div className="space-y-8">
            <p className="text-sm text-ink-muted dark:text-[#8892a3]">
              Loading trending topics...
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`trending-loading-${index}`}
                  className="rounded-2xl border border-parchment-300 bg-white/80 p-5 dark:border-[#2a313d] dark:bg-[#151922]/80"
                >
                  <div className="aspect-[21/10] w-full rounded-2xl skeleton-shimmer" />
                  <div className="mt-4 h-4 w-32 skeleton-shimmer rounded" />
                  <div className="mt-2 h-6 w-4/5 skeleton-shimmer rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          SECTION_CONFIG.map((section) => {
            const Icon = section.icon;
            const sectionItems = data[section.key];
            const featured = sectionItems[0] ?? null;
            const sideStories = sectionItems.slice(1, 4);
            const extraStories = sectionItems.slice(4, 10);

            return (
              <section key={section.key} className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-parchment-dark dark:bg-[#202631]">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <h2 className="font-serif text-2xl text-ink dark:text-[#eef1f8]">
                        {section.title}
                      </h2>
                      <p className="text-xs text-ink-muted dark:text-[#8892a3]">
                        {section.subtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/")}
                    className="hidden items-center gap-1 rounded-full border border-parchment-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary transition-colors hover:border-accent hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8] sm:inline-flex"
                  >
                    Analyze Topic
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="h-px bg-parchment-300 dark:bg-[#2a313d]" />

                {sectionItems.length === 0 ? (
                  <div className="rounded-2xl border border-parchment-300 bg-parchment-dark/50 p-5 text-sm text-ink-muted dark:border-[#2a313d] dark:bg-[#151922]/50 dark:text-[#8892a3]">
                      No stories available.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      {featured && (
                        <ArticleCard
                          title={featured.title}
                          description={featured.description}
                          source={featured.source}
                          bias={featured.bias}
                          imageUrl={featured.image_url}
                          provider={featured.provider}
                          variant="featured"
                          onViewAnalysis={() => onViewAnalysis(featured)}
                          isActionDisabled={isLoading}
                        />
                      )}

                      <div className="space-y-3">
                        {sideStories.map((item, index) => (
                          <div key={`${section.key}-side-${item.keyword}-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${index * 70}ms` }}>
                            <ArticleCard
                              title={item.title}
                              description={item.description}
                              source={item.source}
                              bias={item.bias}
                              imageUrl={item.image_url}
                              provider={item.provider}
                              variant="compact"
                              onViewAnalysis={() => onViewAnalysis(item)}
                              isActionDisabled={isLoading}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {extraStories.length > 0 && (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {extraStories.map((item, index) => (
                          <ArticleCard
                            key={`${section.key}-extra-${item.keyword}-${index}`}
                            title={item.title}
                            description={item.description}
                            source={item.source}
                            bias={item.bias}
                            imageUrl={item.image_url}
                            provider={item.provider}
                            variant="compact"
                            onViewAnalysis={() => onViewAnalysis(item)}
                            isActionDisabled={isLoading}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
      </section>
    </main>
  );
}

export default Trending;
