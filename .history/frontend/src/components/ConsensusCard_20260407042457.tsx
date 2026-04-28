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
};

ChartJS.register(ArcElement, Tooltip, Legend);

function ConsensusCard({ score }: ConsensusCardProps) {
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const disagreement = Math.max(0, 100 - normalizedScore);

  const level =
    normalizedScore >= 70
      ? { label: "High Consensus", color: "#4ade80" }
      : normalizedScore >= 40
        ? { label: "Moderate Consensus", color: "#fbbf24" }
        : { label: "Low Consensus", color: "#f87171" };

  const chartData = {
    labels: ["Agreement", "Disagreement"],
    datasets: [
      {
        data: [normalizedScore, disagreement],
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
    <div className="rounded-xl border border-parchment-300 bg-white/80 p-6 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
      <h3 className="mb-5 font-serif text-lg text-ink dark:text-[#f5f0e8]">
        Consensus Analysis
      </h3>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        {/* Chart */}
        <div className="relative h-48 w-48 shrink-0 sm:h-52 sm:w-52">
          <Doughnut data={chartData} options={chartOptions} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-ink dark:text-[#f5f0e8]">
              {normalizedScore}%
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted dark:text-[#8a8279]">
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
            <div className="flex items-center gap-2 text-sm text-ink-secondary dark:text-[#b8b0a4]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} />
              <span>Agreement — {normalizedScore}%</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-secondary dark:text-[#b8b0a4]">
              <span className="h-2.5 w-2.5 rounded-full bg-parchment-300 dark:bg-[#3a342c]" />
              <span>Disagreement — {disagreement}%</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-ink-muted dark:text-[#8a8279]">
            Higher scores indicate sources agree more on the facts of this story.
            A diverse range of perspectives has been analyzed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConsensusCard;
