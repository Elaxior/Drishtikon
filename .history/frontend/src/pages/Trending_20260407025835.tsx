import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getTrending, type TrendingItem, type TrendingResponse } from "../lib/api";

function getBiasBadgeClasses(bias: TrendingItem["bias"]): string {
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

    navigate(`/?q=${encodeURIComponent(query)}`);
  };

  const sections: Array<{ key: keyof TrendingResponse; title: string }> = [
    { key: "general", title: "🔥 General Trending" },
    { key: "war", title: "⚔️ War Updates" },
    { key: "geopolitics", title: "🌍 Geopolitics Spotlight" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Trending</h1>
          <Link to="/" className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-400 hover:text-cyan-300">
            Back to Search
          </Link>
        </div>

        {isLoading ? <p className="text-zinc-300">Loading trending stories...</p> : null}
        {errorMessage ? <p className="text-red-300">{errorMessage}</p> : null}

        {!isLoading && !errorMessage
          ? sections.map((section) => (
              <section key={section.key} className="space-y-3">
                <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {data[section.key].length === 0 ? (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-zinc-400">
                      No stories available.
                    </div>
                  ) : (
                    data[section.key].map((item, index) => (
                      <article key={`${section.key}-${item.keyword}-${index}`} className="min-w-[280px] max-w-[320px] flex-1 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
                        <h3 className="text-lg font-semibold text-white">{item.title ?? "Untitled story"}</h3>
                        <p className="mt-2 line-clamp-4 text-sm text-zinc-300">{item.description ?? "No description available."}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-200">
                            {item.source ?? "UNKNOWN SOURCE"}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 ${getBiasBadgeClasses(item.bias)}`}>
                            {item.bias}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onViewAnalysis(item.keyword)}
                          className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400"
                        >
                          View Analysis
                        </button>
                      </article>
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
