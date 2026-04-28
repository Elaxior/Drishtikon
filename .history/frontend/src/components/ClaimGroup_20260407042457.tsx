type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";

type ClaimGroupSource = {
  name: string;
  bias: BiasType;
};

type ClaimGroupProps = {
  representativeClaim: string;
  sources: ClaimGroupSource[];
  count: number;
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

function ClaimGroup({ representativeClaim, sources, count }: ClaimGroupProps) {
  return (
    <div className="rounded-lg border border-parchment-200 bg-parchment/60 p-4 transition-all duration-200 hover:border-parchment-300 dark:border-[#2e2923] dark:bg-[#151310]/60 dark:hover:border-[#3a342c]">
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
        <p className="flex-1 text-sm font-medium leading-snug text-ink dark:text-[#f5f0e8]">
          "{representativeClaim}"
        </p>
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
        <span className="ml-auto text-xs text-ink-muted dark:text-[#8a8279]">
          {count} source{count !== 1 ? "s" : ""} agree
        </span>
      </div>
    </div>
  );
}

export default ClaimGroup;
