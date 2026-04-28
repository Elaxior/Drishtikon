type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";

type BiasBarProps = {
  articles: Array<{ bias: BiasType }>;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
};

function BiasBar({ articles, showLabels = true, size = "md" }: BiasBarProps) {
  const total = articles.length;
  if (total === 0) return null;

  const leftCount = articles.filter((a) => a.bias === "LEFT").length;
  const centerCount = articles.filter((a) => a.bias === "CENTER").length;
  const rightCount = articles.filter((a) => a.bias === "RIGHT").length;
  const unknownCount = articles.filter((a) => a.bias === "UNKNOWN").length;
  const trackedTotal = leftCount + centerCount + rightCount;
  const distributionBase = trackedTotal > 0 ? trackedTotal : total;

  const leftPct = Math.round((leftCount / distributionBase) * 100);
  const centerPct = Math.round((centerCount / distributionBase) * 100);
  const rightPct = Math.round((rightCount / distributionBase) * 100);


  const heightClass = size === "sm" ? "h-6" : size === "lg" ? "h-10" : "h-8";
  const textClass =
    size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs";

  return (
    <div className="w-full space-y-1.5">
      <div className={`flex ${heightClass} w-full overflow-hidden rounded-md`}>
        {leftPct > 0 && (
          <div
            className="bias-bar-segment flex items-center justify-center bg-bias-left font-semibold text-white"
            style={{ width: `${leftPct}%`, animationDelay: "0ms" }}
          >
            {showLabels && leftPct >= 15 && (
              <span className={textClass}>L {leftPct}%</span>
            )}
          </div>
        )}
        {centerPct > 0 && (
          <div
            className="bias-bar-segment flex items-center justify-center bg-parchment-300 font-semibold text-ink dark:bg-[#3a342c] dark:text-ink-secondary"
            style={{ width: `${centerPct}%`, animationDelay: "100ms" }}
          >
            {showLabels && centerPct >= 15 && (
              <span className={textClass}>C {centerPct}%</span>
            )}
          </div>
        )}
        {rightPct > 0 && (
          <div
            className="bias-bar-segment flex items-center justify-center bg-bias-right font-semibold text-white"
            style={{ width: `${rightPct}%`, animationDelay: "200ms" }}
          >
            {showLabels && rightPct >= 15 && (
              <span className={textClass}>R {rightPct}%</span>
            )}
          </div>
        )}
      </div>

      {showLabels && (
        <>
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-ink-muted">
            <span>Left</span>
            <span>Center</span>
            <span>Right</span>
          </div>
          {unknownCount > 0 && (
            <p className="text-[10px] text-ink-muted">
              Unrated sources: {unknownCount}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default BiasBar;
