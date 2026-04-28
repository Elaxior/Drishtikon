import BiasBar from "./BiasBar";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";

type CoverageDetailsProps = {
  articles: Array<{ source: string | null; bias: BiasType }>;
  lastUpdated: number | null;
  secondsSinceUpdate: number;
};

function formatTimeSince(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  return `${Math.floor(seconds / 3600)} hours ago`;
}

function normalizeToHundred(leftCount: number, centerCount: number, rightCount: number, base: number) {
  const exactLeft = (leftCount / base) * 100;
  const exactCenter = (centerCount / base) * 100;
  const exactRight = (rightCount / base) * 100;

  const floorLeft = Math.floor(exactLeft);
  const floorCenter = Math.floor(exactCenter);
  const floorRight = Math.floor(exactRight);

  let leftPct = floorLeft;
  let centerPct = floorCenter;
  let rightPct = floorRight;

  let remainder = Math.max(0, 100 - (floorLeft + floorCenter + floorRight));

  const parts: Array<{ key: "left" | "center" | "right"; fraction: number; hasValue: boolean }> = [
    { key: "left", fraction: exactLeft - floorLeft, hasValue: leftCount > 0 },
    { key: "center", fraction: exactCenter - floorCenter, hasValue: centerCount > 0 },
    { key: "right", fraction: exactRight - floorRight, hasValue: rightCount > 0 },
  ];
  parts.sort((a, b) => b.fraction - a.fraction);

  while (remainder > 0) {
    const candidate = parts.find((part) => part.hasValue);
    if (!candidate) break;

    if (candidate.key === "left") leftPct += 1;
    if (candidate.key === "center") centerPct += 1;
    if (candidate.key === "right") rightPct += 1;

    candidate.hasValue = false;
    remainder -= 1;

    if (parts.every((part) => !part.hasValue) && remainder > 0) {
      parts.forEach((part) => {
        part.hasValue = part.key === "left" ? leftCount > 0 : part.key === "center" ? centerCount > 0 : rightCount > 0;
      });
    }
  }

  return { leftPct, centerPct, rightPct };
}

function CoverageDetails({ articles, lastUpdated, secondsSinceUpdate }: CoverageDetailsProps) {
  const leftCount = articles.filter((a) => a.bias === "LEFT").length;
  const centerCount = articles.filter((a) => a.bias === "CENTER").length;
  const rightCount = articles.filter((a) => a.bias === "RIGHT").length;
  const unknownCount = articles.filter((a) => a.bias === "UNKNOWN").length;
  const trackedTotal = leftCount + centerCount + rightCount;
  const hasFullSpectrum = leftCount > 0 && centerCount > 0 && rightCount > 0;

  const { leftPct, centerPct, rightPct } = trackedTotal > 0
    ? normalizeToHundred(leftCount, centerCount, rightCount, trackedTotal)
    : { leftPct: 0, centerPct: 0, rightPct: 0 };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-parchment-300 bg-white/85 p-5 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
        <h3 className="mb-3 font-serif text-lg text-ink dark:text-[#eef1f8]">
          Bias Distribution
        </h3>
        <p className="mb-4 text-xs text-ink-muted dark:text-[#8892a3]">
          {leftPct}% of tracked sources lean Left, {centerPct}% are Center, {rightPct}% lean Right
        </p>
        <BiasBar articles={articles} showLabels={true} size="lg" />
      </div>

      <div className="rounded-2xl border border-parchment-300 bg-white/85 p-5 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
        <h3 className="mb-4 font-serif text-lg text-ink dark:text-[#eef1f8]">
          Coverage Details
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-secondary dark:text-[#adb7c7]">Total News Sources</span>
            <span className="font-semibold text-ink dark:text-[#eef1f8]">{articles.length}</span>
          </div>
          <div className="h-px bg-parchment-300 dark:bg-[#2a313d]" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-bias-left font-medium">Leaning Left</span>
            <span className="font-semibold text-ink dark:text-[#eef1f8]">{leftCount}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-secondary dark:text-[#adb7c7]">Center</span>
            <span className="font-semibold text-ink dark:text-[#eef1f8]">{centerCount}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-bias-right font-medium">Leaning Right</span>
            <span className="font-semibold text-ink dark:text-[#eef1f8]">{rightCount}</span>
          </div>
          <div className="h-px bg-parchment-300 dark:bg-[#2a313d]" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-secondary dark:text-[#adb7c7]">Coverage Spectrum</span>
            <span className="font-semibold text-ink dark:text-[#eef1f8]">
              {hasFullSpectrum ? "Left + Center + Right" : "Partial"}
            </span>
          </div>

          {lastUpdated && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-secondary dark:text-[#adb7c7]">Last Updated</span>
              <span className="font-semibold text-ink dark:text-[#eef1f8]">
                {formatTimeSince(secondsSinceUpdate)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-secondary dark:text-[#adb7c7]">Bias Distribution</span>
            <span className="font-semibold text-ink dark:text-[#eef1f8]">
              {leftPct}% Left, {centerPct}% Center, {rightPct}% Right
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-secondary dark:text-[#adb7c7]">Unrated Sources</span>
            <span className="font-semibold text-ink dark:text-[#eef1f8]">{unknownCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoverageDetails;
