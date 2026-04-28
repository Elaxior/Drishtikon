import { Lightbulb } from "lucide-react";

type SummaryCardProps = {
  summary: string;
};

function SummaryCard({ summary }: SummaryCardProps) {
  // Split summary into bullet points if it contains multiple sentences
  const sentences = (summary || "Summary unavailable")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  return (
    <div className="rounded-xl border border-parchment-300 bg-white/80 p-6 dark:border-[#3a342c] dark:bg-[#1c1917]/80">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-gold" />
        <h3 className="font-serif text-lg text-ink dark:text-[#f5f0e8]">
          Insights by AI
        </h3>
      </div>

      {sentences.length > 1 ? (
        <ul className="space-y-3">
          {sentences.map((sentence, index) => (
            <li
              key={index}
              className="flex gap-3 text-sm leading-relaxed text-ink-secondary dark:text-[#b8b0a4]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted dark:bg-[#6b6560]" />
              <span>{sentence}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-ink-secondary dark:text-[#b8b0a4]">
          {summary || "Summary unavailable"}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-parchment-200 pt-3 text-[11px] text-ink-muted dark:border-[#2e2923] dark:text-[#8a8279]">
        <span className="flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            Insights by Drishtikon AI
        </span>
      </div>
    </div>
  );
}

export default SummaryCard;
