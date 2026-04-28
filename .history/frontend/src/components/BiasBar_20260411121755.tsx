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

  const exactLeft = (leftCount / distributionBase) * 100;
  const exactCenter = (centerCount / distributionBase) * 100;
  const exactRight = (rightCount / distributionBase) * 100;

  const flooredLeft = Math.floor(exactLeft);
  const flooredCenter = Math.floor(exactCenter);
  const flooredRight = Math.floor(exactRight);

  let leftPct = flooredLeft;
  let centerPct = flooredCenter;
  let rightPct = flooredRight;

  let remainder = Math.max(0, 100 - (flooredLeft + flooredCenter + flooredRight));

  const fractionalParts: Array<{ key: "left" | "center" | "right"; fraction: number; hasValue: boolean }> = [
    { key: "left", fraction: exactLeft - flooredLeft, hasValue: leftCount > 0 },
    { key: "center", fraction: exactCenter - flooredCenter, hasValue: centerCount > 0 },
    { key: "right", fraction: exactRight - flooredRight, hasValue: rightCount > 0 },
  ];

  fractionalParts.sort((a, b) => b.fraction - a.fraction);

  while (remainder > 0) {
    const candidate = fractionalParts.find((part) => part.hasValue);
    if (!candidate) break;

    if (candidate.key === "left") leftPct += 1;
    if (candidate.key === "center") centerPct += 1;
    if (candidate.key === "right") rightPct += 1;

    candidate.hasValue = false;
    remainder -= 1;

    if (fractionalParts.every((part) => !part.hasValue) && remainder > 0) {
      fractionalParts.forEach((part) => {
        part.hasValue = part.key === "left" ? leftCount > 0 : part.key === "center" ? centerCount > 0 : rightCount > 0;
      });
    }
  }


  const heightClass = size === "sm" ? "h-6" : size === "lg" ? "h-10" : "h-8";
  const textClass =
    size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs";

  return (
    <div className="w-full space-y-1.5">
      <div className={`flex ${heightClass} w-full overflow-hidden rounded-full border border-parchment-300 dark:border-[#2a313d]`}>
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
            className="bias-bar-segment flex items-center justify-center bg-parchment-300 font-semibold text-ink dark:bg-[#2a313d] dark:text-[#adb7c7]"
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
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-ink-muted dark:text-[#8892a3]">
            <span>Left</span>
            <span>Center</span>
            <span>Right</span>
          </div>
          {unknownCount > 0 && (
            <p className="text-[10px] text-ink-muted dark:text-[#8892a3]">
              Unrated sources: {unknownCount}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default BiasBar;
