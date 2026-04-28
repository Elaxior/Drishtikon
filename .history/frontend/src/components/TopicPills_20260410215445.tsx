import { TrendingUp } from "lucide-react";

type TopicPillsProps = {
  topics: string[];
  onTopicClick: (topic: string) => void;
};

function TopicPills({ topics, onTopicClick }: TopicPillsProps) {
  if (topics.length === 0) return null;

  return (
    <div className="border-y border-parchment-300 bg-parchment-dark/40 dark:border-[#3a342c] dark:bg-[#151310]/40">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <TrendingUp className="h-4 w-4 shrink-0 text-ink-muted dark:text-[#8a8279]" />
        <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => onTopicClick(topic)}
              className="shrink-0 rounded-full border border-parchment-300 bg-parchment px-3.5 py-1.5 text-xs font-medium text-ink-secondary transition-all duration-200 hover:border-ink-muted hover:bg-parchment-dark hover:text-ink dark:border-[#3a342c] dark:bg-[#1c1917] dark:text-[#b8b0a4] dark:hover:border-[#6b6560] dark:hover:text-[#f5f0e8]"
            >
              {topic} +
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TopicPills;
