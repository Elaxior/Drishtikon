import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth-store";

function Profile() {
  const navigate = useNavigate();
  const { user, savedArticles, isSavedArticlesLoading, removeSavedArticle } = useAuth();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const handleRemove = async (articleId: string) => {
    setRemovingIds((previous) => new Set(previous).add(articleId));
    try {
      await removeSavedArticle(articleId);
    } finally {
      setRemovingIds((previous) => {
        const next = new Set(previous);
        next.delete(articleId);
        return next;
      });
    }
  };

  return (
    <main className="px-4 pb-14 pt-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="surface-panel rounded-[2rem] px-6 py-8 sm:px-8">
          <p className="section-kicker mb-2">Your account</p>
          <h1 className="font-serif text-4xl text-ink dark:text-[#eef1f8] sm:text-5xl">Profile</h1>
          <p className="mt-2 text-sm text-ink-secondary dark:text-[#adb7c7]">
            Signed in as {user?.email ?? "Unknown user"}
          </p>
        </header>

        <section className="rounded-2xl border border-parchment-300 bg-white/85 p-5 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl text-ink dark:text-[#eef1f8]">Saved Articles</h2>
            <span className="rounded-full border border-parchment-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-secondary dark:border-[#2a313d] dark:text-[#adb7c7]">
              {savedArticles.length} saved
            </span>
          </div>

          {isSavedArticlesLoading ? (
            <p className="text-sm text-ink-muted dark:text-[#8892a3]">Loading saved articles...</p>
          ) : savedArticles.length === 0 ? (
            <div className="rounded-xl border border-parchment-300 bg-parchment-dark/50 px-4 py-8 text-center dark:border-[#2a313d] dark:bg-[#111317]/60">
              <Bookmark className="mx-auto mb-3 h-6 w-6 text-ink-muted dark:text-[#8892a3]" />
              <p className="text-sm text-ink-secondary dark:text-[#adb7c7]">You have no saved articles yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedArticles.map((article) => (
                <article key={article.id} className="rounded-xl border border-parchment-200 bg-parchment/65 p-4 dark:border-[#202631] dark:bg-[#111317]/65">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-[#8892a3]">
                        {article.source ?? "Unknown source"} · {article.bias}
                      </p>
                      <h3 className="font-serif text-lg leading-snug text-ink dark:text-[#eef1f8]">
                        {article.title ?? "Untitled article"}
                      </h3>
                      <p className="text-sm text-ink-secondary dark:text-[#adb7c7]">
                        {article.description ?? "No description available."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemove(article.id)}
                      disabled={removingIds.has(article.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-parchment-300 text-ink-secondary transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-60 dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:border-red-400 dark:hover:text-red-300"
                      aria-label="Remove saved article"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted dark:text-[#8892a3]">
                    <span>
                      Saved {new Date(article.savedAt).toLocaleString()}
                    </span>
                    {article.searchQuery && (
                      <button
                        type="button"
                        onClick={() => navigate(`/analysis?q=${encodeURIComponent(article.searchQuery as string)}`)}
                        className="inline-flex items-center gap-1 rounded-full border border-parchment-300 px-2.5 py-1 font-semibold uppercase tracking-wide text-ink-secondary transition-colors hover:border-accent hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
                      >
                        Open analysis
                      </button>
                    )}
                    {article.link && (
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-parchment-300 px-2.5 py-1 font-semibold uppercase tracking-wide text-ink-secondary transition-colors hover:border-accent hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
                      >
                        Original
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default Profile;
