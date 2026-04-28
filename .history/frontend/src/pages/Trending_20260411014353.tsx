import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Swords, Landmark } from "lucide-react";

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
    <main className="px-4 pb-16 pt-8">
      <section className="mx-auto w-full max-w-7xl space-y-10">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="font-serif text-4xl text-ink dark:text-[#f5f0e8] sm:text-5xl">
            Trending
          </h1>
          <p className="max-w-xl text-base text-ink-secondary dark:text-[#b8b0a4]">
            Major developments at a glance with stronger India context. Every story
            shows bias distribution so you can read across perspectives.
          </p>
        </header>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-8">
            <p className="text-sm text-ink-muted dark:text-[#8a8279]">
              Loading trending topics...
            </p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`trending-loading-${index}`}
                  className="rounded-xl border border-parchment-300 bg-white/80 p-5 dark:border-[#3a342c] dark:bg-[#1c1917]/80"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-7 w-7 skeleton-shimmer rounded-full" />
                    <div className="h-3 w-24 skeleton-shimmer rounded" />
                  </div>
                  <div className="h-5 w-3/4 skeleton-shimmer rounded" />
                  <div className="mt-3 space-y-2">
                    <div className="h-3 w-full skeleton-shimmer rounded" />
                    <div className="h-3 w-5/6 skeleton-shimmer rounded" />
                  </div>
                  <div className="mt-4 h-6 w-full skeleton-shimmer rounded-md" />
                  <div className="mt-4 h-10 w-full skeleton-shimmer rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Sections */}
        {!isLoading &&
          !errorMessage &&
          SECTION_CONFIG.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.key} className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-parchment-dark dark:bg-[#2e2923]">
                    <Icon className="h-4 w-4 text-ink-secondary dark:text-[#b8b0a4]" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl text-ink dark:text-[#f5f0e8]">
                      {section.title}
                    </h2>
                    <p className="text-xs text-ink-muted dark:text-[#8a8279]">
                      {section.subtitle}
                    </p>
                  </div>
                </div>

                {/* divider */}
                <div className="h-px bg-parchment-300 dark:bg-[#3a342c]" />

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {data[section.key].length === 0 ? (
                    <div className="rounded-xl border border-parchment-300 bg-parchment-dark/50 p-5 text-sm text-ink-muted dark:border-[#3a342c] dark:bg-[#151310]/50 dark:text-[#8a8279]">
                      No stories available.
                    </div>
                  ) : (
                    data[section.key].map((item, index) => (
                      <div
                        key={`${section.key}-${item.keyword}-${index}`}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <ArticleCard
                          title={item.title}
                          description={item.description}
                          source={item.source}
                          bias={item.bias}
                          imageUrl={item.image_url}
                          provider={item.provider}
                          onViewAnalysis={() => onViewAnalysis(item)}
                          isActionDisabled={isLoading}
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
      </section>
    </main>
  );
}

export default Trending;
