import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";

type ClaimGroupSource = {
  name: string;
  bias: BiasType;
};

type ClaimGroupProps = {
  representativeClaim: string;
  sources: ClaimGroupSource[];
  count: number;
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

function ClaimGroup({ representativeClaim, sources, count }: ClaimGroupProps) {
  return (
    <Card className="border-slate-200 bg-slate-50/70 transition-all duration-200 hover:shadow-sm dark:border-zinc-700/80 dark:bg-zinc-950/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">{representativeClaim}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <span key={`${source.name}-${source.bias}-${index}`} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getBiasBadgeClasses(source.bias)}`}>
              {source.name} ({source.bias})
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-500">Supporting claims: {count}</p>
      </CardContent>
    </Card>
  );
}

export default ClaimGroup;
