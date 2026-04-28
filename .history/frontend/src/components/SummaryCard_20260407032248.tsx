import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type SummaryCardProps = {
  summary: string;
};

function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <Card className="border-cyan-500/40 bg-cyan-50/80 transition-all duration-200 hover:shadow-md dark:bg-cyan-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-cyan-700 dark:text-cyan-200">AI Neutral Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-slate-800 dark:text-zinc-100">{summary || "Summary unavailable"}</p>
      </CardContent>
    </Card>
  );
}

export default SummaryCard;
