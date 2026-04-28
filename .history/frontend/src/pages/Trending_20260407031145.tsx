import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ArticleCard from "../components/ArticleCard";
import { getTrending, type TrendingResponse } from "../lib/api";

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
        setErrorMessage("Trending feed unavailable right now. Please try again shortly.");
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

  const sections: Array<{ key: keyof TrendingResponse; title: string }> = [
    { key: "general", title: "🔥 General Trending" },
    { key: "war", title: "⚔️ War Updates" },
    { key: "geopolitics", title: "🌍 Geopolitics" },
  ];

  return (
    <main className="px-4 pb-16 pt-10">
      <section className="mx-auto w-full max-w-6xl space-y-10">
        <header className="space-y-2 text-center sm:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Trending</h1>
          <p className="text-zinc-300">Major developments at a glance across global news flows.</p>
        </header>

        {isLoading ? <p className="text-center text-zinc-300">Loading...</p> : null}
        {errorMessage ? <p className="text-red-300">{errorMessage}</p> : null}

        {!isLoading && !errorMessage
          ? sections.map((section) => (
              <section key={section.key} className="space-y-4">
                <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data[section.key].length === 0 ? (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-sm text-zinc-400">
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
