import { useState } from "react";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
type ProviderType = "newsdata" | "gnews" | "currents" | "newsapi";

type ArticleCardProps = {
  title: string | null;
  description: string | null;
  source: string | null;
  bias: BiasType;
  imageUrl?: string | null;
  provider?: ProviderType;
  onViewAnalysis?: () => void;
  isActionDisabled?: boolean;
  variant?: "default" | "featured" | "compact";
};

function getBiasBadgeClass(bias: BiasType): string {
  if (bias === "LEFT") return "bias-badge bias-badge-left";
  if (bias === "CENTER") return "bias-badge bias-badge-center";
  if (bias === "RIGHT") return "bias-badge bias-badge-right";
  return "bias-badge bias-badge-unknown";
}

const PROVIDER_STYLES: Record<ProviderType, { label: string; class: string }> = {
  newsdata: {
    label: "NewsData",
    class: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-300",
  },
  gnews: {
    label: "GNews",
    class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300",
  },
  currents: {
    label: "Currents",
    class: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:text-cyan-300",
  },
  newsapi: {
    label: "NewsAPI",
    class: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-200",
  },
};

function ArticleCard({
  title,
  description,
  source,
  bias,
  imageUrl,
  provider,
  onViewAnalysis,
  isActionDisabled = false,
  variant = "default",
}: ArticleCardProps) {
  const [imgError, setImgError] = useState(false);

  const providerInfo = provider ? PROVIDER_STYLES[provider] : null;

  const imageRatioClass = variant === "compact" ? "aspect-square" : variant === "featured" ? "aspect-[21/10]" : "aspect-[16/9]";

  if (variant === "compact") {
    return (
      <article className="group flex h-full items-stretch gap-3 overflow-hidden rounded-2xl border border-parchment-300 bg-white/85 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink-muted/40 hover:shadow-editorial dark:border-[#2a313d] dark:bg-[#151922]/80 dark:hover:border-[#546076]/40">
        {imageUrl && !imgError ? (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-parchment-dark dark:bg-[#202631]">
            <img
              src={imageUrl}
              alt={title ?? "News article"}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-parchment-dark text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:bg-[#202631] dark:text-[#8892a3]">
            No image
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex items-center gap-2">
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-muted dark:text-[#8892a3]">
              {source ?? "Unknown Source"}
            </span>
            <span className={getBiasBadgeClass(bias)}>{bias}</span>
          </div>
          <h3 className="line-clamp-2 font-serif text-base leading-snug text-ink dark:text-[#eef1f8]">
            {title ?? "Untitled story"}
          </h3>
          <button
            type="button"
            onClick={onViewAnalysis}
            disabled={!onViewAnalysis || isActionDisabled}
            className="inline-flex w-fit items-center gap-1 rounded-full border border-parchment-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary transition-all hover:border-accent hover:text-ink disabled:opacity-50 dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:border-accent dark:hover:text-[#eef1f8]"
          >
            Read
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-parchment-300 bg-white/85 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink-muted/30 hover:shadow-editorial dark:border-[#2a313d] dark:bg-[#151922]/80 dark:hover:border-[#546076]/40">
      {/* Image */}
      {imageUrl && !imgError ? (
        <div className={`relative ${imageRatioClass} w-full overflow-hidden bg-parchment-dark dark:bg-[#202631]`}>
          <img
            src={imageUrl}
            alt={title ?? "News article"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
          {/* Provider chip - on image */}
          {providerInfo && (
            <div className="absolute top-2 right-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-sm ${providerInfo.class}`}
              >
                {providerInfo.label}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className={`relative flex ${imageRatioClass} w-full items-center justify-center bg-parchment-dark dark:bg-[#202631]`}>
          <div className="flex flex-col items-center gap-2 text-ink-muted dark:text-[#6b6560]">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z"
              />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="m21 15-5-5L5 21"
              />
            </svg>
            <span className="text-[10px] uppercase tracking-wider">No image</span>
          </div>
          {/* Provider chip - no image */}
          {providerInfo && (
            <div className="absolute top-2 right-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${providerInfo.class}`}
              >
                {providerInfo.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Source & Bias header */}
      <div className="flex items-center gap-2 border-b border-parchment-200 px-4 py-2.5 dark:border-[#202631]">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-parchment-dark text-[10px] font-bold uppercase text-ink-secondary dark:bg-[#2e2923] dark:text-[#b8b0a4]">
          {(source ?? "?")[0]}
        </div>
        <span className="flex-1 truncate text-xs font-medium text-ink-secondary dark:text-[#b8b0a4]">
          {source ?? "Unknown Source"}
        </span>
        <span className={getBiasBadgeClass(bias)}>{bias}</span>
      </div>

      {/* Content */}
      <div className={`flex flex-1 flex-col gap-3 p-4 ${variant === "featured" ? "sm:p-5" : ""}`}>
        <h3 className={`line-clamp-2 font-serif leading-snug text-ink dark:text-[#eef1f8] ${variant === "featured" ? "text-2xl" : "text-lg"}`}>
          {title ?? "Untitled story"}
        </h3>
        <p className={`flex-1 text-sm leading-relaxed text-ink-secondary dark:text-[#adb7c7] ${variant === "featured" ? "line-clamp-4" : "line-clamp-3"}`}>
          {description ?? "No description available."}
        </p>

        <button
          type="button"
          onClick={onViewAnalysis}
          disabled={!onViewAnalysis || isActionDisabled}
          className={`mt-1 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 ${
            variant === "featured"
              ? "bg-accent text-white hover:bg-accent-hover"
              : "bg-ink text-white hover:bg-ink-secondary dark:bg-[#eef1f8] dark:text-[#111317] dark:hover:bg-[#d8deeb]"
          }`}
        >
          Read more
        </button>
      </div>
    </article>
  );
}

export default ArticleCard;
