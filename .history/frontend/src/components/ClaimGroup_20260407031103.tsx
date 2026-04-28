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

function ClaimGroup({ representativeClaim, sources, count }: ClaimGroupProps) {
  return (
    <Card className="border-zinc-700/80 bg-zinc-950/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-zinc-100">{representativeClaim}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <span key={`${source.name}-${source.bias}-${index}`} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getBiasBadgeClasses(source.bias)}`}>
              {source.name} ({source.bias})
            </span>
          ))}
        </div>
        <p className="text-sm text-zinc-500">Supporting claims: {count}</p>
      </CardContent>
    </Card>
  );
}

export default ClaimGroup;
