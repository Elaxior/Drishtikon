import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ArticleCard from "../components/ArticleCard";
import { getTrending, type TrendingResponse } from "../lib/api";

const SECTION_CONFIG: Array<{ key: keyof TrendingResponse; title: string }> = [
  { key: "general", title: "General Trending" },
  { key: "war", title: "War Updates" },
  { key: "geopolitics", title: "Geopolitics" },
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

  const onViewAnalysis = (keyword: string) => {
    const query = keyword.trim();
    if (!query) {
      navigate("/");
      return;
    }

    navigate(`/analysis?q=${encodeURIComponent(query)}`);
  };

  return (
    <main className="px-4 pb-16 pt-10">
      <section className="mx-auto w-full max-w-6xl space-y-10">
        <header className="space-y-2 text-center sm:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">Trending</h1>
          <p className="text-slate-600 dark:text-zinc-300">Major developments at a glance across global news flows.</p>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <p className="animate-pulse text-center text-slate-600 dark:text-zinc-300">Loading trending topics...</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`trending-loading-${index}`} className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                  <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                  <div className="mt-4 h-9 w-full animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {errorMessage ? <p className="text-center text-red-700 dark:text-red-300">{errorMessage}</p> : null}

        {!isLoading && !errorMessage
          ? SECTION_CONFIG.map((section) => (
              <section key={section.key} className="space-y-4">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{section.title}</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data[section.key].length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
                      No stories available.
                    </div>
                  ) : (
                    data[section.key].map((item, index) => (
                      <ArticleCard
                        key={`${section.key}-${item.keyword}-${index}`}
                        title={item.title}
                        description={item.description}
                        source={item.source}
                        bias={item.bias}
                        onViewAnalysis={() => onViewAnalysis(item.keyword)}
                        isActionDisabled={isLoading}
                      />
                    ))
                  )}
                </div>
              </section>
            ))
          : null}
      </section>
    </main>
  );
}

export default Trending;
