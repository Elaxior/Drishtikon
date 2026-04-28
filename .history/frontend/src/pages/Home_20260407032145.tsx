import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getHealth } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

function Home() {
  const navigate = useNavigate();
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("Checking backend...");
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

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

  return (
    <main className="px-4 pb-16 pt-10">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl">Drishtikon</h1>
          <p className="text-base text-slate-600 dark:text-zinc-300 sm:text-lg">Understand the truth behind the news</p>
        </header>

        <Card className="mx-auto w-full max-w-3xl">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSearch} className="space-y-3">
              <Input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a topic (e.g., US elections, AI regulation, climate policy)"
                className="h-14 text-lg"
                disabled={isSearching}
                aria-label="News topic search"
              />
              <Button type="submit" disabled={isSearching} size="lg" className="w-full sm:w-auto">
                {isSearching ? "Analyzing news..." : "Analyze"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className={isBackendConnected ? "text-center text-emerald-600 dark:text-emerald-400" : "text-center text-amber-700 dark:text-amber-300"}>
          {connectionMessage}
        </p>

        {isSearching ? <p className="animate-pulse text-center text-slate-600 dark:text-zinc-300">Analyzing news...</p> : null}
        {searchError ? <p className="text-center text-red-700 dark:text-red-300">{searchError}</p> : null}

        <Card className="mx-auto w-full max-w-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-zinc-300">
            <p>1. Enter a topic and click Analyze.</p>
            <p>2. We aggregate multiple sources and extract factual claims.</p>
            <p>3. The Analysis page shows neutral summary, consensus, claim comparison, and source bias.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default Home;
