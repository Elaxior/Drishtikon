import { useState } from "react";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
type VerdictType = "SUPPORTED" | "CONTRADICTED" | "MIXED" | "UNCERTAIN";

type ClaimGroupSource = {
  name: string;
  bias: BiasType;
};

type ClaimGroupProps = {
  representativeClaim: string;
  sources: ClaimGroupSource[];
  count: number;
  verdict?: VerdictType;
  confidence?: number;
  reason?: string;
  verifiedAt?: string | null;
  evidence?: Array<{
    source: string | null;
    title: string | null;
    link: string | null;
    bias?: BiasType;
    snippet: string;
    similarity: number;
    has_contradiction_hint?: boolean;
  }>;
};

function getBiasDot(bias: BiasType): string {
  if (bias === "LEFT") return "bg-bias-left";
  if (bias === "CENTER") return "bg-bias-center";
  if (bias === "RIGHT") return "bg-bias-right";
  return "bg-bias-unknown";
}

function getBiasBadgeClass(bias: BiasType): string {
  if (bias === "LEFT") return "bias-badge bias-badge-left";
  if (bias === "CENTER") return "bias-badge bias-badge-center";
  if (bias === "RIGHT") return "bias-badge bias-badge-right";
  return "bias-badge bias-badge-unknown";
}

function getVerdictStyle(verdict: VerdictType): string {
  if (verdict === "SUPPORTED") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (verdict === "CONTRADICTED") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  if (verdict === "MIXED") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

function ClaimGroup({
  representativeClaim,
  sources,
  count,
  verdict = "UNCERTAIN",
  confidence,
  reason,
  verifiedAt,
  evidence = [],
}: ClaimGroupProps) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [expandedEvidenceIndex, setExpandedEvidenceIndex] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-parchment-200 bg-parchment/70 p-4 transition-all duration-200 hover:border-parchment-300 dark:border-[#202631] dark:bg-[#151922]/60 dark:hover:border-[#2a313d]">
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-1 flex items-center gap-0.5">
          {sources.slice(0, 3).map((source, i) => (
            <span
              key={`${source.name}-dot-${i}`}
              className={`h-2.5 w-2.5 rounded-full ${getBiasDot(source.bias)} ${i > 0 ? "-ml-0.5" : ""}`}
              title={`${source.name} (${source.bias})`}
            />
          ))}
        </div>
        <p className="flex-1 text-sm font-medium leading-snug text-ink dark:text-[#eef1f8]">
          "{representativeClaim}"
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${getVerdictStyle(verdict)}`}>
          {verdict}
        </span>
        {typeof confidence === "number" && (
          <span className="text-xs text-ink-muted dark:text-[#8892a3]">
            Confidence {Math.max(0, Math.min(100, Math.round(confidence)))}%
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sources.map((source, index) => (
          <span
            key={`${source.name}-${source.bias}-${index}`}
            className={getBiasBadgeClass(source.bias)}
          >
            {source.name}
          </span>
        ))}
        <span className="ml-auto text-xs text-ink-muted dark:text-[#8892a3]">
          {count} source{count !== 1 ? "s" : ""} agree
        </span>
      </div>

      {evidence.length > 0 && (
        <div className="mt-3 border-t border-parchment-200 pt-3 dark:border-[#202631]">
          <button
            type="button"
            onClick={() => {
              setShowEvidence((value) => !value);
              if (showEvidence) {
                setExpandedEvidenceIndex(null);
              }
            }}
            className="text-xs font-semibold text-ink-secondary transition-colors hover:text-ink dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
          >
            {showEvidence ? "Hide evidence" : `Show evidence (${evidence.length})`}
          </button>

          {showEvidence && (
            <div className="mt-2 space-y-2">
              {evidence.map((item, index) => (
                <div
                  key={`${item.link ?? item.title ?? "evidence"}-${index}`}
                  className={`rounded-lg border bg-white/80 p-2 dark:bg-[#111317]/70 ${
                    item.has_contradiction_hint
                      ? "border-red-400/50 dark:border-red-500/40"
                      : "border-parchment-200 dark:border-[#202631]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedEvidenceIndex((previous) => (previous === index ? null : index))}
                    className="w-full text-left"
                  >
                    <p className="text-[11px] leading-relaxed text-ink-secondary dark:text-[#adb7c7]">
                      {item.snippet}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-muted dark:text-[#8892a3]">
                      <span>{item.source ?? "Unknown source"}</span>
                      <span>Similarity {Math.round((item.similarity || 0) * 100)}%</span>
                      {item.has_contradiction_hint && (
                        <span className="rounded-full border border-red-400/50 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                          Contradiction hint
                        </span>
                      )}
                      <span className="ml-auto text-[10px] font-semibold text-ink-secondary dark:text-[#adb7c7]">
                        {expandedEvidenceIndex === index ? "Hide details" : "View details"}
                      </span>
                    </div>
                  </button>

                  {expandedEvidenceIndex === index && (
                    <div className="mt-2 rounded-md border border-parchment-200 bg-parchment-dark/40 p-2 text-[11px] dark:border-[#202631] dark:bg-[#151922]/50">
                      <div className="flex flex-wrap items-center gap-2 text-ink-secondary dark:text-[#adb7c7]">
                        <span className="font-semibold">{item.title ?? "Untitled evidence"}</span>
                        {item.bias && <span className={getBiasBadgeClass(item.bias)}>{item.bias}</span>}
                        {item.has_contradiction_hint && (
                          <span className="rounded-full border border-red-400/50 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                            flagged
                          </span>
                        )}
                      </div>
                      <p className="mt-1 leading-relaxed text-ink-secondary dark:text-[#adb7c7]">
                        {item.snippet}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-muted dark:text-[#8892a3]">
                        <span>Similarity {Math.round((item.similarity || 0) * 100)}%</span>
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto text-[10px] font-semibold text-ink-secondary hover:text-ink dark:text-[#adb7c7] dark:hover:text-[#eef1f8]"
                          >
                            Open source
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(reason || verifiedAt) && (
                <div className="rounded-lg border border-parchment-200 bg-white/70 p-2 text-[10px] text-ink-muted dark:border-[#202631] dark:bg-[#111317]/60 dark:text-[#8892a3]">
                  {reason && <span>Reason: {reason}</span>}
                  {reason && verifiedAt && <span> • </span>}
                  {verifiedAt && <span>Verified at {new Date(verifiedAt).toLocaleString()}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClaimGroup;
