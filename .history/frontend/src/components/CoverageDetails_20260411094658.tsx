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

function CoverageDetails({ articles, lastUpdated, secondsSinceUpdate }: CoverageDetailsProps) {
  const leftCount = articles.filter((a) => a.bias === "LEFT").length;
  const centerCount = articles.filter((a) => a.bias === "CENTER").length;
  const rightCount = articles.filter((a) => a.bias === "RIGHT").length;
  const unknownCount = articles.filter((a) => a.bias === "UNKNOWN").length;
  const trackedTotal = leftCount + centerCount + rightCount;
  const hasFullSpectrum = leftCount > 0 && centerCount > 0 && rightCount > 0;

  const leftPct = trackedTotal > 0 ? Math.round((leftCount / trackedTotal) * 100) : 0;
  const centerPct = trackedTotal > 0 ? Math.round((centerCount / trackedTotal) * 100) : 0;
  const rightPct = trackedTotal > 0 ? Math.round((rightCount / trackedTotal) * 100) : 0;

  return (
    <div className="space-y-5">
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

      <div className="rounded-2xl border border-parchment-300 bg-white/85 p-5 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
        <h3 className="mb-3 font-serif text-lg text-ink dark:text-[#eef1f8]">
          Bias Distribution
        </h3>
        <p className="mb-4 text-xs text-ink-muted dark:text-[#8892a3]">
          {leftPct}% of tracked sources lean Left, {centerPct}% are Center, {rightPct}% lean Right
        </p>
        <BiasBar articles={articles} showLabels={true} size="lg" />
      </div>
    </div>
  );
}

export default CoverageDetails;
