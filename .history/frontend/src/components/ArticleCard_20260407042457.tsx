import { useState } from "react";
import BiasBar from "./BiasBar";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
type ProviderType = "newsdata" | "gnews" | "currents";

type ArticleCardProps = {
  title: string | null;
  description: string | null;
  source: string | null;
  bias: BiasType;
  imageUrl?: string | null;
  provider?: ProviderType;
  onViewAnalysis?: () => void;
  isActionDisabled?: boolean;
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
    class: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  gnews: {
    label: "GNews",
    class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  currents: {
    label: "Currents",
    class: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
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
}: ArticleCardProps) {
  const [imgError, setImgError] = useState(false);

  const providerInfo = provider ? PROVIDER_STYLES[provider] : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-parchment-300 bg-white/80 transition-all duration-300 hover:border-ink-muted/30 hover:shadow-lg dark:border-[#3a342c] dark:bg-[#1c1917]/80 dark:hover:border-[#6b6560]/40">
      {/* Image */}
      {imageUrl && !imgError ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-parchment-dark dark:bg-[#2e2923]">
          <img
            src={imageUrl}
            alt={title ?? "News article"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
          {/* Bias indicator overlay */}
          <div className="absolute bottom-0 left-0 right-0">
            <BiasBar articles={[{ bias }]} showLabels={false} size="sm" />
          </div>
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
        <div className="relative flex aspect-[16/9] w-full items-center justify-center bg-parchment-dark dark:bg-[#2e2923]">
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
      <div className="flex items-center gap-2 border-b border-parchment-200 px-4 py-2.5 dark:border-[#2e2923]">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-parchment-dark text-[10px] font-bold uppercase text-ink-secondary dark:bg-[#2e2923] dark:text-[#b8b0a4]">
          {(source ?? "?")[0]}
        </div>
        <span className="flex-1 truncate text-xs font-medium text-ink-secondary dark:text-[#b8b0a4]">
          {source ?? "Unknown Source"}
        </span>
        <span className={getBiasBadgeClass(bias)}>{bias}</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 font-serif text-lg leading-snug text-ink dark:text-[#f5f0e8]">
          {title ?? "Untitled story"}
        </h3>
        <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-ink-secondary dark:text-[#b8b0a4]">
          {description ?? "No description available."}
        </p>

        {/* Action */}
        <button
          type="button"
          onClick={onViewAnalysis}
          disabled={!onViewAnalysis || isActionDisabled}
          className="mt-1 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-ink-secondary disabled:opacity-50 dark:bg-[#f5f0e8] dark:text-[#1c1917] dark:hover:bg-[#d8d0c4]"
        >
          Read more →
        </button>
      </div>
    </article>
  );
}

export default ArticleCard;
