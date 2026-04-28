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
    return "border-blue-400/40 bg-blue-500/20 text-blue-700 dark:text-blue-300";
  }

  if (bias === "CENTER") {
    return "border-slate-400/40 bg-slate-500/20 text-slate-700 dark:border-zinc-400/40 dark:bg-zinc-500/20 dark:text-zinc-200";
  }

  if (bias === "RIGHT") {
    return "border-red-400/40 bg-red-500/20 text-red-700 dark:text-red-300";
  }

  return "border-yellow-400/40 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300";
}

function ArticleCard({ title, description, source, bias, onViewAnalysis, isActionDisabled = false }: ArticleCardProps) {
  return (
    <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="line-clamp-2 break-words text-lg">{title ?? "Untitled story"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-4 break-words text-sm text-slate-600 dark:text-zinc-300">{description ?? "No description available."}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-700 dark:text-cyan-200">
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
