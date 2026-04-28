import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";

type ArticleCardProps = {
  title: string | null;
  description: string | null;
  source: string | null;
  bias: BiasType;
  onViewAnalysis?: () => void;
  isActionDisabled?: boolean;
};

function getBiasBadgeClasses(bias: BiasType): string {
  if (bias === "LEFT") {
    return "bg-blue-500/20 text-blue-300 border-blue-400/40";
  }

  if (bias === "CENTER") {
    return "bg-zinc-500/20 text-zinc-200 border-zinc-400/40";
  }

  if (bias === "RIGHT") {
    return "bg-red-500/20 text-red-300 border-red-400/40";
  }

  return "bg-yellow-500/20 text-yellow-300 border-yellow-400/40";
}

function ArticleCard({ title, description, source, bias, onViewAnalysis, isActionDisabled = false }: ArticleCardProps) {
  return (
    <Card className="h-full transition-transform hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title ?? "Untitled story"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-4 text-sm text-zinc-300">{description ?? "No description available."}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-200">
            {source ?? "UNKNOWN SOURCE"}
          </span>
          <span className={`rounded-full border px-2.5 py-1 ${getBiasBadgeClasses(bias)}`}>{bias}</span>
        </div>

        <Button type="button" onClick={onViewAnalysis} disabled={!onViewAnalysis || isActionDisabled} className="w-full">
          View Analysis
        </Button>
      </CardContent>
    </Card>
  );
}

export default ArticleCard;
