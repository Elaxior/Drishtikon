import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type ConsensusCardProps = {
  score: number;
};

function ConsensusCard({ score }: ConsensusCardProps) {
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Consensus Score: {normalizedScore}%</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${normalizedScore}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default ConsensusCard;
