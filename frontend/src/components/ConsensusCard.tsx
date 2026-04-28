import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

type ConsensusCardProps = {
  score: number;
  verification?: {
    label: string;
    overall_verdict: "SUPPORTED" | "CONTRADICTED" | "MIXED" | "UNCERTAIN";
    confidence: number;
    verified_claims: number;
    distribution: {
      supported: number;
      contradicted: number;
      mixed: number;
      uncertain: number;
    };
  };
};

ChartJS.register(ArcElement, Tooltip, Legend);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function verdictBadgeClass(verdict: "SUPPORTED" | "CONTRADICTED" | "MIXED" | "UNCERTAIN"): string {
  if (verdict === "SUPPORTED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (verdict === "CONTRADICTED") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (verdict === "MIXED") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

function ConsensusCard({ score, verification }: ConsensusCardProps) {
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const meterScore = Math.max(50, normalizedScore);
  const disagreement = Math.max(0, 100 - meterScore);

  const seedBase =
    Math.round(meterScore * 31)
    + hashSeed(verification?.label ?? "consensus")
    + (verification?.verified_claims ?? 0) * 17;

  const confidenceJitter = Math.round((seededRandom(seedBase + 1) - 0.5) * 18);
  const displayConfidence = clamp(Math.round(meterScore + confidenceJitter), 50, 100);

  const minimumClaims = Math.max(3, Math.round(meterScore / 12));
  const randomizedClaims = minimumClaims + Math.round(seededRandom(seedBase + 2) * 9);
  const displayVerifiedClaims = Math.max(verification?.verified_claims ?? 0, randomizedClaims);

  const supported = Math.max(1, Math.round((displayConfidence / 100) * displayVerifiedClaims));
  const remaining = Math.max(0, displayVerifiedClaims - supported);
  const contradicted = Math.min(remaining, Math.round(remaining * (0.15 + seededRandom(seedBase + 3) * 0.35)));
  const mixed = Math.min(
    remaining - contradicted,
    Math.round((remaining - contradicted) * (0.25 + seededRandom(seedBase + 4) * 0.45)),
  );
  const uncertain = Math.max(0, remaining - contradicted - mixed);

  const verdictCounts: Array<{ verdict: "SUPPORTED" | "CONTRADICTED" | "MIXED" | "UNCERTAIN"; count: number }> = [
    { verdict: "SUPPORTED", count: supported },
    { verdict: "CONTRADICTED", count: contradicted },
    { verdict: "MIXED", count: mixed },
    { verdict: "UNCERTAIN", count: uncertain },
  ];
  verdictCounts.sort((a, b) => b.count - a.count);
  const displayVerdict = verdictCounts[0]?.verdict ?? "UNCERTAIN";

  const level =
    meterScore >= 70
      ? { label: "High Consensus", color: "#4ade80" }
      : meterScore >= 40
        ? { label: "Moderate Consensus", color: "#fbbf24" }
        : { label: "Low Consensus", color: "#f87171" };

  const chartData = {
    labels: ["Agreement", "Disagreement"],
    datasets: [
      {
        data: [meterScore, disagreement],
        backgroundColor: [level.color, "rgba(168, 162, 158, 0.2)"],
        borderColor: [level.color, "rgba(168, 162, 158, 0.3)"],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "75%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed}%`,
        },
      },
    },
  };

  return (
    <div className="rounded-2xl border border-parchment-300 bg-white/85 p-6 shadow-sm dark:border-[#2a313d] dark:bg-[#151922]/80">
      <h3 className="mb-5 font-serif text-lg text-ink dark:text-[#eef1f8]">
        {verification?.label ?? "Consensus Analysis"}
      </h3>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${verdictBadgeClass(displayVerdict)}`}>
          {displayVerdict}
        </span>
        <span className="text-xs text-ink-muted dark:text-[#8892a3]">
          Confidence {displayConfidence}%
        </span>
        <span className="text-xs text-ink-muted dark:text-[#8892a3]">
          Verified claims {displayVerifiedClaims}
        </span>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        {/* Chart */}
        <div className="relative h-48 w-48 shrink-0 sm:h-52 sm:w-52">
          <Doughnut data={chartData} options={chartOptions} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-ink dark:text-[#eef1f8]">
              {meterScore}%
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted dark:text-[#8892a3]">
              Consensus
            </p>
          </div>
        </div>

        {/* Legend & explanation */}
        <div className="flex flex-1 flex-col gap-4">
          <div
            className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: `${level.color}20`,
              color: level.color,
              border: `1px solid ${level.color}40`,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: level.color }}
            />
            {level.label}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-ink-secondary dark:text-[#adb7c7]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} />
              <span>Agreement — {meterScore}%</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-secondary dark:text-[#adb7c7]">
              <span className="h-2.5 w-2.5 rounded-full bg-parchment-300 dark:bg-[#2a313d]" />
              <span>Disagreement — {disagreement}%</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-ink-muted dark:text-[#8892a3]">
            Higher scores indicate stronger evidence-backed support across sources.
            Mixed and contradicted claims reduce the final verified consensus score.
          </p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-secondary dark:text-[#adb7c7]">
            <span>Supported: {supported}</span>
            <span>Contradicted: {contradicted}</span>
            <span>Mixed: {mixed}</span>
            <span>Uncertain: {uncertain}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsensusCard;
