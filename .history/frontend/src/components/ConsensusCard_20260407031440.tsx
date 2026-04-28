import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type ConsensusCardProps = {
  score: number;
};

ChartJS.register(ArcElement, Tooltip, Legend);

function ConsensusCard({ score }: ConsensusCardProps) {
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const disagreement = Math.max(0, 100 - normalizedScore);

  const chartData = {
    labels: ["Agreement", "Disagreement"],
    datasets: [
      {
        data: [normalizedScore, disagreement],
        backgroundColor: ["rgba(52, 211, 153, 0.9)", "rgba(248, 113, 113, 0.9)"],
        borderColor: ["rgba(52, 211, 153, 1)", "rgba(248, 113, 113, 1)"],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Consensus Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative mx-auto h-56 w-full max-w-[260px] sm:h-64 sm:max-w-[300px]">
          <Doughnut data={chartData} options={chartOptions} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-white">{normalizedScore}%</p>
            <p className="text-xs uppercase tracking-wide text-zinc-400">Consensus</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-2 text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Agreement
          </span>
          <span className="inline-flex items-center gap-2 text-red-300">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />Disagreement
          </span>
        </div>

        <p className="text-center text-sm text-zinc-400">
          Higher score means sources agree more on facts.
        </p>
      </CardContent>
    </Card>
  );
}

export default ConsensusCard;
