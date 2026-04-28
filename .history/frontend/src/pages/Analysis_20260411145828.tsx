import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Bookmark, BookmarkCheck, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import axios from "axios";
import { jsPDF } from "jspdf";

import BiasBar from "../components/BiasBar";
import ClaimGroup from "../components/ClaimGroup";
import ConsensusCard from "../components/ConsensusCard";
import CoverageDetails from "../components/CoverageDetails";
import SummaryCard from "../components/SummaryCard";
import { useAuth } from "../lib/auth-store";
import { searchNews, type ClaimGroup as ApiClaimGroup, type SearchArticle, type SearchResponse } from "../lib/api";
import { getSavedArticleId, toSaveArticleInputFromSearch } from "../lib/saved-articles";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
type ContradictionInfo = {
  claim: string;
  score: number;
  direct: boolean;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getArticleKey(article: SearchArticle): string {
  const link = normalizeText(article.link);
  if (link) return `link:${link}`;
  return `source:${normalizeText(article.source)}|title:${normalizeText(article.title)}`;
}

function getBiasBadgeClass(bias: BiasType): string {
  if (bias === "LEFT") return "bias-badge bias-badge-left";
  if (bias === "CENTER") return "bias-badge bias-badge-center";
  if (bias === "RIGHT") return "bias-badge bias-badge-right";
  return "bias-badge bias-badge-unknown";
}

function formatTimeAgo(pubDate: string | null): string {
  if (!pubDate) return "";
  try {
    const diff = Date.now() - new Date(pubDate).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "";
  }
}

function Analysis() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveArticle, removeSavedArticle, savedArticleIds } = useAuth();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done" | "failed">("idle");
  const [activeFilter, setActiveFilter] = useState<"ALL" | BiasType>("ALL");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const exportTargetRef = useRef<HTMLDivElement | null>(null);

  const query = searchParams.get("q")?.trim() ?? "";

  useEffect(() => {
    if (!query) {
      setData(null);
      setErrorMessage("Please provide a topic query to analyze.");
      return;
    }

    const runAnalysis = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await searchNews(query);
        setData(result);
        setLastUpdatedAt(Date.now());
        setSecondsSinceUpdate(0);
      } catch (error) {
        setData(null);
        const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
        if (typeof detail === "string" && detail.trim()) {
          setErrorMessage(detail);
        } else {
          setErrorMessage("Something went wrong. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void runAnalysis();
  }, [query]);

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const intervalId = window.setInterval(() => {
      setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [lastUpdatedAt]);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  useEffect(() => {
    if (exportStatus !== "done" && exportStatus !== "failed") return;
    const timeoutId = window.setTimeout(() => setExportStatus("idle"), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [exportStatus]);

  const handleCopySummary = async () => {
    if (!data?.summary) { setCopyStatus("failed"); return; }
    try {
      await navigator.clipboard.writeText(data.summary);
      setCopyStatus("copied");
    } catch { setCopyStatus("failed"); }
  };

  const handleExportPdf = async () => {
    if (exportStatus === "exporting") {
      return;
    }

    if (!data?.summary) {
      setExportStatus("failed");
      return;
    }

    setExportStatus("exporting");

    try {
      const querySlug = query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "analysis";
      const datePart = new Date().toISOString().slice(0, 10);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      let cursorY = 20;

      const ensureSpace = (neededHeight = 6) => {
        if (cursorY + neededHeight > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
      };

      const writeWrapped = (text: string, maxWidth: number, lineHeight = 6) => {
        const lines = doc.splitTextToSize(text, maxWidth) as string[];
        lines.forEach((line) => {
          ensureSpace(lineHeight);
          doc.text(line, margin, cursorY);
          cursorY += lineHeight;
        });
      };

      const insights = data.summary
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);

      const articleRows = data.articles.map((article, index) => {
        const title = (article.title ?? "Untitled article").trim();
        const source = (article.source ?? "Unknown source").trim();
        return `${index + 1}. ${title} (${source}, ${article.bias})`;
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Drishtikon AI Insights", margin, cursorY);
      cursorY += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      writeWrapped(`Topic: ${query}`, pageWidth - margin * 2, 6);
      writeWrapped(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin * 2, 6);
      writeWrapped(`Articles analyzed: ${data.articles.length}`, pageWidth - margin * 2, 6);

      cursorY += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      ensureSpace(8);
      doc.text("Articles Considered", margin, cursorY);
      cursorY += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      if (articleRows.length === 0) {
        writeWrapped("No article metadata available", pageWidth - margin * 2, 5);
      } else {
        const visibleRows = articleRows.slice(0, 20);
        visibleRows.forEach((row) => {
          writeWrapped(row, pageWidth - margin * 2, 5);
          cursorY += 1;
        });
        if (articleRows.length > visibleRows.length) {
          writeWrapped(
            `... plus ${articleRows.length - visibleRows.length} more articles`,
            pageWidth - margin * 2,
            5,
          );
        }
      }

      cursorY += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      ensureSpace(8);
      doc.text("Insights", margin, cursorY);
      cursorY += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      if (insights.length === 0) {
        writeWrapped("Summary unavailable", pageWidth - margin * 2, 6);
      } else {
        insights.forEach((sentence) => {
          const lines = doc.splitTextToSize(sentence, pageWidth - margin * 2 - 4) as string[];
          lines.forEach((line, index) => {
            ensureSpace(6);
            const prefix = index === 0 ? "* " : "  ";
            doc.text(`${prefix}${line}`, margin, cursorY);
            cursorY += 6;
          });
          cursorY += 1;
        });
      }

      doc.save(`drishtikon-ai-insights-${querySlug}-${datePart}.pdf`);

      setExportStatus("done");
    } catch {
      setExportStatus("failed");
    }
  };

  const sourceBiasMap = useMemo(() => {
    const map = new Map<string, BiasType>();
    if (!data) return map;
    data.articles.forEach((a) => {
      const s = a.source?.trim();
      if (s && !map.has(s)) map.set(s, a.bias);
    });
    return map;
  }, [data]);

  const claimExtractionByBias = useMemo(() => {
    const buckets: Record<"LEFT" | "CENTER" | "RIGHT", string[]> = {
      LEFT: [],
      CENTER: [],
      RIGHT: [],
    };
    if (!data) return buckets;

    const biasOrder = ["LEFT", "CENTER", "RIGHT"] as const;
    const claimBiasCounts = new Map<string, Record<"LEFT" | "CENTER" | "RIGHT", number>>();

    const pickDominantBias = (counts: Record<"LEFT" | "CENTER" | "RIGHT", number>) => {
      let best: "LEFT" | "CENTER" | "RIGHT" = "LEFT";
      for (const bias of biasOrder.slice(1)) {
        if (counts[bias] > counts[best]) {
          best = bias;
        }
      }
      return best;
    };

    data.articles.forEach((article) => {
      const articleBias = article.bias;
      if (articleBias !== "LEFT" && articleBias !== "CENTER" && articleBias !== "RIGHT") {
        return;
      }

      article.claims.forEach((rawClaim) => {
        const claim = rawClaim?.trim();
        if (!claim) return;

        const counts = claimBiasCounts.get(claim) ?? { LEFT: 0, CENTER: 0, RIGHT: 0 };
        counts[articleBias] += 1;
        claimBiasCounts.set(claim, counts);
      });
    });

    const weightedBuckets: Record<"LEFT" | "CENTER" | "RIGHT", Array<{ claim: string; weight: number }>> = {
      LEFT: [],
      CENTER: [],
      RIGHT: [],
    };

    claimBiasCounts.forEach((counts, claim) => {
      const targetBias = pickDominantBias(counts);
      const weight = counts.LEFT + counts.CENTER + counts.RIGHT;
      weightedBuckets[targetBias].push({ claim, weight });
    });

    biasOrder.forEach((bias) => {
      weightedBuckets[bias].sort((a, b) => b.weight - a.weight);
      buckets[bias] = weightedBuckets[bias].map((item) => item.claim);
    });

    const hasAnyClaimPoints = biasOrder.some((bias) => buckets[bias].length > 0);
    if (hasAnyClaimPoints) {
      return buckets;
    }

    // Fallback when article-level claim extraction is empty.
    const fallbackSeen: Record<"LEFT" | "CENTER" | "RIGHT", Set<string>> = {
      LEFT: new Set<string>(),
      CENTER: new Set<string>(),
      RIGHT: new Set<string>(),
    };

    data.claim_groups.forEach((group) => {
      const claim = group.representative_claim?.trim();
      if (!claim) return;

      const counts: Record<"LEFT" | "CENTER" | "RIGHT", number> = { LEFT: 0, CENTER: 0, RIGHT: 0 };

      group.sources.forEach((source) => {
        const bias = sourceBiasMap.get(source);
        if (bias === "LEFT" || bias === "CENTER" || bias === "RIGHT") {
          counts[bias] += 1;
        }
      });

      if (counts.LEFT + counts.CENTER + counts.RIGHT === 0 && group.evidence?.length) {
        group.evidence.forEach((item) => {
          if (item.bias === "LEFT" || item.bias === "CENTER" || item.bias === "RIGHT") {
            counts[item.bias] += 1;
          }
        });
      }

      if (counts.LEFT + counts.CENTER + counts.RIGHT === 0) return;

      const targetBias = pickDominantBias(counts);
      if (!fallbackSeen[targetBias].has(claim)) {
        fallbackSeen[targetBias].add(claim);
        buckets[targetBias].push(claim);
      }
    });

    return buckets;
  }, [data, sourceBiasMap]);

  const topContradictions = useMemo(() => {
    if (!data) return [] as Array<{
      index: number;
      group: ApiClaimGroup;
      contradictionScore: number;
      contradictionHints: number;
      evidenceCount: number;
      confidencePct: number;
    }>;

    return data.claim_groups
      .map((group, index) => {
        const evidence = group.evidence ?? [];
        const contradictionHints = evidence.filter((item) => item.has_contradiction_hint).length;
        const evidenceCount = evidence.length;
        const confidencePct = typeof group.confidence === "number"
          ? Math.max(0, Math.min(100, Math.round(group.confidence)))
          : 0;

        const verdictWeight = group.verdict === "CONTRADICTED" ? 1 : group.verdict === "MIXED" ? 0.55 : 0.15;
        const hintDensity = evidenceCount > 0 ? contradictionHints / evidenceCount : 0;
        const contradictionScore = Math.round(
          (verdictWeight * 0.55 + hintDensity * 0.35 + (confidencePct / 100) * 0.1) * 100,
        );

        return {
          index,
          group,
          contradictionScore,
          contradictionHints,
          evidenceCount,
          confidencePct,
        };
      })
      .filter((item) => item.group.verdict === "CONTRADICTED" || item.contradictionHints > 0)
      .sort((left, right) => right.contradictionScore - left.contradictionScore)
      .slice(0, 3);
  }, [data]);

  const articleTopContradictions = useMemo(() => {
    const map = new Map<string, ContradictionInfo>();
    if (!data) return map;

    const contradictionCandidates = data.claim_groups
      .map((group) => {
        const evidence = group.evidence ?? [];
        const contradictionHints = evidence.filter((item) => item.has_contradiction_hint).length;
        const evidenceCount = evidence.length;
        const confidencePct = typeof group.confidence === "number"
          ? Math.max(0, Math.min(100, Math.round(group.confidence)))
          : 0;

        const verdictWeight = group.verdict === "CONTRADICTED" ? 1 : group.verdict === "MIXED" ? 0.55 : 0.15;
        const hintDensity = evidenceCount > 0 ? contradictionHints / evidenceCount : 0;
        const contradictionScore = Math.round(
          (verdictWeight * 0.55 + hintDensity * 0.35 + (confidencePct / 100) * 0.1) * 100,
        );

        const sourceSet = new Set(group.sources.map((source) => normalizeText(source)).filter(Boolean));
        const evidenceSourceSet = new Set(
          evidence.map((item) => normalizeText(item.source)).filter(Boolean),
        );
        const evidenceLinkSet = new Set(
          evidence.map((item) => normalizeText(item.link)).filter(Boolean),
        );
        const evidenceTitleSet = new Set(
          evidence.map((item) => normalizeText(item.title)).filter(Boolean),
        );

        return {
          claim: group.representative_claim,
          score: contradictionScore,
          sourceSet,
          evidenceSourceSet,
          evidenceLinkSet,
          evidenceTitleSet,
        };
      })
      .filter((item) => Boolean(item.claim?.trim()))
      .sort((left, right) => right.score - left.score);

    const globalTop = contradictionCandidates[0] ?? null;

    data.articles.forEach((article) => {
      const source = normalizeText(article.source);
      const link = normalizeText(article.link);
      const title = normalizeText(article.title);

      const directMatch = contradictionCandidates.find((candidate) => (
        (source && (candidate.sourceSet.has(source) || candidate.evidenceSourceSet.has(source)))
        || (link && candidate.evidenceLinkSet.has(link))
        || (title && candidate.evidenceTitleSet.has(title))
      ));

      const selected = directMatch ?? globalTop;

      if (!selected) {
        map.set(getArticleKey(article), {
          claim: "No strong contradiction detected for this source in the current evidence set.",
          score: 0,
          direct: false,
        });
        return;
      }

      map.set(getArticleKey(article), {
        claim: selected.claim,
        score: selected.score,
        direct: Boolean(directMatch),
      });
    });

    return map;
  }, [data]);

  const jumpToClaimGroup = (index: number) => {
    const target = document.getElementById(`claim-group-${index}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasFullSpectrumCoverage = useMemo(() => {
    if (!data) return false;
    return ["LEFT", "CENTER", "RIGHT"].every((bias) =>
      data.articles.some((article) => article.bias === bias),
    );
  }, [data]);

  // Group articles by bias for comparison view
  const biasGroups = useMemo(() => {
    if (!data) return { LEFT: [], CENTER: [], RIGHT: [], UNKNOWN: [] };
    const groups: Record<BiasType, SearchArticle[]> = { LEFT: [], CENTER: [], RIGHT: [], UNKNOWN: [] };
    data.articles.forEach((a) => groups[a.bias].push(a));
    return groups;
  }, [data]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    if (!data) return [];
    if (activeFilter === "ALL") return data.articles;
    return data.articles.filter((a) => a.bias === activeFilter);
  }, [data, activeFilter]);

  // Featured article (first one with an image)
  const featuredArticle = useMemo(() => {
    if (!data) return null;
    return data.articles.find((a) => a.image_url) ?? data.articles[0] ?? null;
  }, [data]);

  const handleToggleSave = async (article: SearchArticle) => {
    const saveInput = toSaveArticleInputFromSearch(article, query);
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

  return (
    <main className="px-4 pb-14 pt-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-[#8892a3]">
          <Link to="/" className="transition-colors hover:text-ink dark:hover:text-[#eef1f8]">
            Home
          </Link>
          <span>/</span>
          <span>Analysis</span>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <div className="h-8 w-72 skeleton-shimmer rounded" />
            <div className="h-6 w-48 skeleton-shimmer rounded" />
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="aspect-[16/9] w-full skeleton-shimmer rounded-xl" />
                <div className="rounded-xl border border-parchment-300 p-6 dark:border-[#2a313d]">
                  <div className="space-y-2">
                    <div className="h-3 w-full skeleton-shimmer rounded" />
                    <div className="h-3 w-5/6 skeleton-shimmer rounded" />
                    <div className="h-3 w-4/6 skeleton-shimmer rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={`col-sk-${i}`} className="space-y-3 rounded-xl border border-parchment-300 p-4 dark:border-[#2a313d]">
                      <div className="h-4 w-16 skeleton-shimmer rounded" />
                      <div className="h-32 w-full skeleton-shimmer rounded-lg" />
                      <div className="h-3 w-full skeleton-shimmer rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-parchment-300 p-5 dark:border-[#2a313d]">
                  <div className="mb-4 h-5 w-36 skeleton-shimmer rounded" />
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={`sd-sk-${i}`} className="flex justify-between">
                        <div className="h-3 w-28 skeleton-shimmer rounded" />
                        <div className="h-3 w-8 skeleton-shimmer rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {!isLoading && errorMessage && (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoading && data && (
          <div ref={exportTargetRef} className={`report-export ${exportStatus === "exporting" ? "exporting" : ""}`}>
            <div className="export-only mb-4 rounded-xl border border-parchment-300 bg-white/90 p-4 dark:border-[#2a313d] dark:bg-[#151922]/90">
              <h2 className="font-serif text-2xl text-ink dark:text-[#eef1f8]">Drishtikon Judge Report</h2>
              <p className="mt-1 text-xs text-ink-secondary dark:text-[#adb7c7]">
                Topic: {query} • Generated: {new Date().toLocaleString()}
              </p>
            </div>

            {/* Hero section */}
            <header className="mb-8">
              {data.warning && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {data.warning}
                </div>
              )}

                <div className="surface-panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex-1">
                    <p className="section-kicker mb-2">
                    Published {formatTimeAgo(data.articles[0]?.pubDate ?? null)}
                    {data.articles[0]?.pubDate && ` • Updated ${secondsSinceUpdate}s ago`}
                  </p>
                    <h1 className="font-serif text-3xl leading-tight text-ink dark:text-[#eef1f8] sm:text-4xl md:text-5xl">
                    {query}
                  </h1>
                  {data.effective_query && data.effective_query !== query && (
                      <p className="mt-2 text-xs text-ink-muted dark:text-[#8892a3]">
                      Analyzed using derived query: {data.effective_query}
                    </p>
                  )}

                  {data.providers && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink-muted dark:text-[#8892a3]">
                        {data.total_sources ?? data.articles.length} sources from:
                      </span>
                      {data.providers.newsdata != null && data.providers.newsdata > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          NewsData ({data.providers.newsdata})
                        </span>
                      )}
                      {data.providers.gnews != null && data.providers.gnews > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          GNews ({data.providers.gnews})
                        </span>
                      )}
                      {data.providers.currents != null && data.providers.currents > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">
                          Currents ({data.providers.currents})
                        </span>
                      )}
                      {data.providers.newsapi != null && data.providers.newsapi > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          NewsAPI ({data.providers.newsapi})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <div className="flex items-center overflow-hidden rounded-full border border-parchment-300 dark:border-[#2a313d]">
                  {(["ALL", "LEFT", "CENTER", "RIGHT"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab as "ALL" | BiasType)}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        activeFilter === tab
                          ? "bg-accent text-white"
                          : "text-ink-secondary hover:bg-parchment-dark dark:text-[#adb7c7] dark:hover:bg-[#1d212a]"
                      } ${tab !== "ALL" ? "border-l border-parchment-300 dark:border-[#2a313d]" : ""}`}
                    >
                      {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                <div className="w-48 sm:w-64">
                  <BiasBar articles={data.articles} showLabels={false} size="sm" />
                </div>

                <span className="text-xs text-ink-muted dark:text-[#8892a3]">
                  {filteredArticles.length} / {data.articles.length} sources
                </span>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    hasFullSpectrumCoverage
                      ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {hasFullSpectrumCoverage
                    ? "Full Spectrum: Left, Center, Right"
                    : "Partial Spectrum: Missing one side"}
                </span>
              </div>
            </header>

            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <section className="space-y-8">

                {featuredArticle && featuredArticle.image_url && (
                  <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-parchment-300 bg-white/85 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
                    <div className="relative aspect-[2/1] w-full overflow-hidden bg-parchment-dark dark:bg-[#202631]">
                      <img
                        src={featuredArticle.image_url}
                        alt={featuredArticle.title ?? "Featured article"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold uppercase text-white backdrop-blur-sm">
                            {(featuredArticle.source ?? "?")[0]}
                          </div>
                          <span className="text-xs text-white/80">
                            {featuredArticle.source ?? "Unknown"}
                          </span>
                          <span className={getBiasBadgeClass(featuredArticle.bias)}>
                            {featuredArticle.bias}
                          </span>
                          {(() => {
                            const saveInput = toSaveArticleInputFromSearch(featuredArticle, query);
                            const articleId = getSavedArticleId(saveInput);
                            const isSaved = savedArticleIds.has(articleId);
                            const isSaveDisabled = savingIds.has(articleId);
                            return (
                              <button
                                type="button"
                                onClick={() => void handleToggleSave(featuredArticle)}
                                disabled={isSaveDisabled}
                                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/25 text-white backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-black/35 disabled:opacity-60"
                                aria-label={isSaved ? "Remove from saved" : "Save article"}
                              >
                                {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                              </button>
                            );
                          })()}
                        </div>
                        {featuredArticle.link ? (
                          <a href={featuredArticle.link} target="_blank" rel="noreferrer"
                            className="font-serif text-xl leading-snug text-white transition-colors hover:text-white/80 sm:text-2xl">
                            {featuredArticle.title}
                          </a>
                        ) : (
                          <p className="font-serif text-xl leading-snug text-white sm:text-2xl">
                            {featuredArticle.title}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <SummaryCard summary={data.summary} />

                <div className="export-hidden flex flex-wrap items-center gap-3">
                  <button type="button" onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 rounded-full border border-parchment-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-all hover:border-accent hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]">
                    <Copy className="h-3.5 w-3.5" /> Copy Summary
                  </button>
                  <button type="button" onClick={() => void handleExportPdf()} disabled={exportStatus === "exporting"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-parchment-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-all hover:border-accent hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]">
                    <Download className="h-3.5 w-3.5" /> {exportStatus === "exporting" ? "Exporting..." : "Export PDF"}
                  </button>
                  <button type="button"
                    onClick={() => navigator.share?.({ title: `Drishtikon: ${query}`, url: window.location.href }).catch(() => {})}
                    className="inline-flex items-center gap-1.5 rounded-full border border-parchment-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-all hover:border-accent hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]">
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  {copyStatus === "copied" && <span className="text-xs text-emerald-600 dark:text-emerald-400">Copied!</span>}
                  {copyStatus === "failed" && <span className="text-xs text-red-600 dark:text-red-400">Failed to copy</span>}
                  {exportStatus === "done" && <span className="text-xs text-emerald-600 dark:text-emerald-400">PDF downloaded</span>}
                  {exportStatus === "failed" && <span className="text-xs text-red-600 dark:text-red-400">PDF export failed</span>}
                </div>

                <div className="rounded-2xl border border-parchment-300 bg-white/85 p-6 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
                  <h3 className="mb-1 font-serif text-xl text-ink dark:text-[#eef1f8]">
                    Claim Extraction
                  </h3>
                  <p className="mb-5 text-xs text-ink-muted dark:text-[#8892a3]">
                    Points extracted from Left, Center, and Right leaning sources.
                  </p>

                  <div className="grid gap-4 md:grid-cols-3">
                    {([
                      { key: "LEFT", label: "Left", headingClass: "text-bias-left", dotClass: "bg-bias-left", borderClass: "border-bias-left" },
                      { key: "CENTER", label: "Center", headingClass: "text-ink-secondary dark:text-[#adb7c7]", dotClass: "bg-bias-center", borderClass: "border-parchment-300 dark:border-[#546076]" },
                      { key: "RIGHT", label: "Right", headingClass: "text-bias-right", dotClass: "bg-bias-right", borderClass: "border-bias-right" },
                    ] as const).map((column) => {
                      const points = claimExtractionByBias[column.key];
                      return (
                        <div key={column.key} className="space-y-3">
                          <div className={`flex items-center gap-2 border-b-2 pb-2 ${column.borderClass}`}>
                            <span className={`h-3 w-3 rounded-full ${column.dotClass}`} />
                            <span className={`text-sm font-semibold ${column.headingClass}`}>{column.label}</span>
                            <span className="ml-auto text-xs text-ink-muted dark:text-[#8892a3]">
                              {points.length} point{points.length !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {points.length === 0 ? (
                            <p className="py-4 text-center text-xs text-ink-muted dark:text-[#8892a3]">
                              No extracted points
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {points.slice(0, 6).map((point, index) => (
                                <li
                                  key={`${column.key}-${index}`}
                                  className="flex gap-2 text-sm leading-relaxed text-ink-secondary dark:text-[#adb7c7]"
                                >
                                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${column.dotClass}`} />
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-parchment-300 bg-white/85 p-6 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
                  <h3 className="mb-1 font-serif text-xl text-ink dark:text-[#eef1f8]">
                    Top Contradictions
                  </h3>
                  <p className="mb-5 text-xs text-ink-muted dark:text-[#8892a3]">
                    Highest conflict claim groups ranked by contradiction hints, verdict, and confidence.
                  </p>

                  {topContradictions.length === 0 ? (
                    <p className="text-sm text-ink-muted dark:text-[#8892a3]">No strong contradictions detected for this query.</p>
                  ) : (
                    <div className="space-y-3">
                      {topContradictions.map((item, position) => (
                        <button
                          key={`contradiction-${item.index}`}
                          type="button"
                          onClick={() => jumpToClaimGroup(item.index)}
                          className="w-full rounded-xl border border-red-400/30 bg-red-500/5 p-3 text-left transition-colors hover:border-red-500/40 dark:border-red-500/25 dark:bg-red-500/10"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                              #{position + 1} contradiction
                            </span>
                            <span className="text-[10px] text-ink-muted dark:text-[#8892a3]">Score {item.contradictionScore}</span>
                            <span className="text-[10px] text-ink-muted dark:text-[#8892a3]">Confidence {item.confidencePct}%</span>
                            <span className="text-[10px] text-ink-muted dark:text-[#8892a3]">
                              Hints {item.contradictionHints}/{item.evidenceCount || 0}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-ink dark:text-[#eef1f8]">
                            {item.group.representative_claim}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-parchment-300 bg-white/85 p-6 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
                  <h3 className="mb-1 font-serif text-xl text-ink dark:text-[#eef1f8]">
                    News Comparison
                  </h3>
                  <p className="mb-5 text-xs text-ink-muted dark:text-[#8892a3]">
                    See how different sources across the political spectrum cover this story
                  </p>

                  {/* Bias distribution bar */}
                  <div className="mb-6">
                    <BiasBar articles={data.articles} showLabels={true} size="lg" />
                  </div>

                  {/* Three-column comparison */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b-2 border-bias-left pb-2">
                        <span className="h-3 w-3 rounded-full bg-bias-left" />
                        <span className="text-sm font-semibold text-bias-left">Left</span>
                        <span className="ml-auto text-xs text-ink-muted dark:text-[#8892a3]">
                          {biasGroups.LEFT.length} source{biasGroups.LEFT.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {biasGroups.LEFT.length === 0 ? (
                        <p className="py-4 text-center text-xs text-ink-muted dark:text-[#8892a3]">
                          No left-leaning sources
                        </p>
                      ) : (
                        biasGroups.LEFT.map((article, i) => (
                          <ComparisonArticle
                            key={`left-${i}`}
                            article={article}
                            topContradiction={articleTopContradictions.get(getArticleKey(article))}
                            onToggleSave={() => void handleToggleSave(article)}
                            isSaved={savedArticleIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                            isSaveDisabled={savingIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                          />
                        ))
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b-2 border-parchment-300 pb-2 dark:border-[#546076]">
                        <span className="h-3 w-3 rounded-full bg-bias-center" />
                        <span className="text-sm font-semibold text-ink-secondary dark:text-[#adb7c7]">Center</span>
                        <span className="ml-auto text-xs text-ink-muted dark:text-[#8892a3]">
                          {biasGroups.CENTER.length} source{biasGroups.CENTER.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {biasGroups.CENTER.length === 0 ? (
                        <p className="py-4 text-center text-xs text-ink-muted dark:text-[#8892a3]">
                          No center sources
                        </p>
                      ) : (
                        biasGroups.CENTER.map((article, i) => (
                          <ComparisonArticle
                            key={`center-${i}`}
                            article={article}
                            topContradiction={articleTopContradictions.get(getArticleKey(article))}
                            onToggleSave={() => void handleToggleSave(article)}
                            isSaved={savedArticleIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                            isSaveDisabled={savingIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                          />
                        ))
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b-2 border-bias-right pb-2">
                        <span className="h-3 w-3 rounded-full bg-bias-right" />
                        <span className="text-sm font-semibold text-bias-right">Right</span>
                        <span className="ml-auto text-xs text-ink-muted dark:text-[#8892a3]">
                          {biasGroups.RIGHT.length} source{biasGroups.RIGHT.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {biasGroups.RIGHT.length === 0 ? (
                        <p className="py-4 text-center text-xs text-ink-muted dark:text-[#8892a3]">
                          No right-leaning sources
                        </p>
                      ) : (
                        biasGroups.RIGHT.map((article, i) => (
                          <ComparisonArticle
                            key={`right-${i}`}
                            article={article}
                            topContradiction={articleTopContradictions.get(getArticleKey(article))}
                            onToggleSave={() => void handleToggleSave(article)}
                            isSaved={savedArticleIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                            isSaveDisabled={savingIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {biasGroups.UNKNOWN.length > 0 && (
                    <div className="mt-4 border-t border-parchment-200 pt-4 dark:border-[#202631]">
                      <p className="mb-2 text-xs font-medium text-ink-muted dark:text-[#8892a3]">
                        Untracked bias ({biasGroups.UNKNOWN.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {biasGroups.UNKNOWN.map((a, i) => (
                          <span key={`unknown-${i}`} className="bias-badge bias-badge-unknown">
                            {a.source ?? "Unknown"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <ConsensusCard score={data.consensus} verification={data.verification} />

                <div className="rounded-2xl border border-parchment-300 bg-white/85 p-6 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
                  <h3 className="mb-4 font-serif text-lg text-ink dark:text-[#eef1f8]">
                    Claim Comparison
                  </h3>
                  {data.claim_groups.length === 0 ? (
                    <p className="text-sm text-ink-muted dark:text-[#8892a3]">No grouped claims available.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.claim_groups.map((group, index) => (
                        <div key={`${group.representative_claim}-${index}`} id={`claim-group-${index}`} className="scroll-mt-24">
                          <ClaimGroup
                            representativeClaim={group.representative_claim}
                            count={group.count}
                            verdict={group.verdict}
                            confidence={group.confidence}
                            reason={group.reason}
                            verifiedAt={group.verified_at}
                            evidence={group.evidence}
                            sources={group.sources.map((source) => ({
                              name: source,
                              bias: sourceBiasMap.get(source) ?? "UNKNOWN",
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-parchment-300 bg-white/85 p-6 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
                  <h3 className="mb-4 font-serif text-lg text-ink dark:text-[#eef1f8]">
                    All Sources ({filteredArticles.length})
                  </h3>
                  {filteredArticles.length === 0 ? (
                    <p className="text-sm text-ink-muted dark:text-[#8892a3]">No source articles found.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredArticles.map((article, index) => (
                        <SourceRow
                          key={`${article.link ?? article.title ?? "src"}-${index}`}
                          article={article}
                          index={index}
                          topContradiction={articleTopContradictions.get(getArticleKey(article))}
                          onToggleSave={() => void handleToggleSave(article)}
                          isSaved={savedArticleIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                          isSaveDisabled={savingIds.has(getSavedArticleId(toSaveArticleInputFromSearch(article, query)))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
                <CoverageDetails
                  articles={data.articles}
                  lastUpdated={lastUpdatedAt}
                  secondsSinceUpdate={secondsSinceUpdate}
                />
              </aside>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════
   Sub-components for the comparison view & source list
   ═══════════════════════════════════════════════════════ */

/** Small article card used in Left/Center/Right columns */
function ComparisonArticle({
  article,
  topContradiction,
  onToggleSave,
  isSaved,
  isSaveDisabled,
}: {
  article: SearchArticle;
  topContradiction?: ContradictionInfo;
  onToggleSave: () => void;
  isSaved: boolean;
  isSaveDisabled: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="group rounded-xl border border-parchment-200 bg-parchment/65 transition-all duration-200 hover:border-parchment-300 hover:shadow-sm dark:border-[#202631] dark:bg-[#111317]/65 dark:hover:border-[#2a313d]">
      {article.image_url && !imgErr ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl bg-parchment-dark dark:bg-[#202631]">
          <img
            src={article.image_url}
            alt={article.title ?? ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-parchment-dark text-[8px] font-bold uppercase text-ink-secondary dark:bg-[#202631] dark:text-[#adb7c7]">
            {(article.source ?? "?")[0]}
          </div>
          <span className="text-[11px] text-ink-muted dark:text-[#8892a3]">
            {article.source ?? "Unknown"}
          </span>
          {article.pubDate && (
            <span className="ml-auto text-[10px] text-ink-muted/60 dark:text-[#8892a3]/60">
              {formatTimeAgo(article.pubDate)}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleSave}
            disabled={isSaveDisabled}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-parchment-300 text-ink-secondary transition-colors hover:border-accent hover:text-ink disabled:opacity-60 dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
            aria-label={isSaved ? "Remove from saved" : "Save article"}
          >
            {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>

        {article.link ? (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium leading-snug text-ink transition-colors hover:text-ink-secondary dark:text-[#eef1f8] dark:hover:text-[#adb7c7]"
          >
            {article.title ?? "Untitled"}
          </a>
        ) : (
          <p className="text-sm font-medium leading-snug text-ink dark:text-[#eef1f8]">
            {article.title ?? "Untitled"}
          </p>
        )}

        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted transition-colors hover:text-ink dark:text-[#8892a3] dark:hover:text-[#eef1f8]"
          >
            Open original source
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {topContradiction && (
          <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/5 px-2 py-1.5 dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              Top contradiction {topContradiction.direct ? "for this article" : "in this analysis"} • score {topContradiction.score}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-secondary dark:text-[#adb7c7]">
              {topContradiction.claim}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Source row with image thumbnail, used in the "All Sources" list */
function SourceRow({
  article,
  index,
  topContradiction,
  onToggleSave,
  isSaved,
  isSaveDisabled,
}: {
  article: SearchArticle;
  index: number;
  topContradiction?: ContradictionInfo;
  onToggleSave: () => void;
  isSaved: boolean;
  isSaveDisabled: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      className="animate-fade-in-up flex gap-4 rounded-xl border border-parchment-200 bg-parchment/65 p-3 transition-all duration-200 hover:border-parchment-300 dark:border-[#202631] dark:bg-[#111317]/65 dark:hover:border-[#2a313d]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {article.image_url && !imgErr ? (
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-parchment-dark dark:bg-[#202631]">
          <img
            src={article.image_url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-parchment-dark dark:bg-[#202631]">
          <span className="text-[9px] uppercase tracking-wider text-ink-muted dark:text-[#8892a3]">
            No image
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {article.link ? (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="group/link inline-flex items-center gap-1.5 text-sm font-medium leading-snug text-ink transition-colors hover:text-ink-secondary dark:text-[#eef1f8] dark:hover:text-[#adb7c7]"
          >
            <span>{article.title ?? "Untitled article"}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
          </a>
        ) : (
          <p className="text-sm font-medium leading-snug text-ink dark:text-[#eef1f8]">
            {article.title ?? "Untitled article"}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-parchment-dark text-[8px] font-bold uppercase text-ink-secondary dark:bg-[#202631] dark:text-[#adb7c7]">
            {(article.source ?? "?")[0]}
          </div>
          <span className="text-xs text-ink-muted dark:text-[#8892a3]">
            {article.source ?? "Unknown"}
          </span>
          <span className={getBiasBadgeClass(article.bias)}>
            {article.bias}
          </span>
          {article.pubDate && (
            <span className="text-[10px] text-ink-muted/60 dark:text-[#8892a3]/60">
              {formatTimeAgo(article.pubDate)}
            </span>
          )}

          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted transition-colors hover:text-ink dark:text-[#8892a3] dark:hover:text-[#eef1f8]"
            >
              Original
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={onToggleSave}
            disabled={isSaveDisabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-parchment-300 text-ink-secondary transition-colors hover:border-accent hover:text-ink disabled:opacity-60 dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
            aria-label={isSaved ? "Remove from saved" : "Save article"}
          >
            {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>

        {topContradiction && (
          <div className="mt-1 rounded-lg border border-red-400/30 bg-red-500/5 px-2.5 py-2 text-[11px] dark:border-red-500/30 dark:bg-red-500/10">
            <p className="font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              Top contradiction {topContradiction.direct ? "for this source" : "in this analysis"}
            </p>
            <p className="mt-1 leading-relaxed text-ink-secondary dark:text-[#adb7c7]">
              {topContradiction.claim}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analysis;
