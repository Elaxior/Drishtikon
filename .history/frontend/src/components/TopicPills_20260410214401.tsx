import { TrendingUp } from "lucide-react";

type TopicPillsProps = {
  topics: string[];
  onTopicClick: (topic: string) => void;
};

function TopicPills({ topics, onTopicClick }: TopicPillsProps) {
  if (topics.length === 0) return null;

  return (
    <div className="border-y border-parchment-300/80 bg-parchment-dark/45 dark:border-[#2f2d2a] dark:bg-[#1e1e1e]">
      <div className="mx-auto flex max-w-[980px] items-center gap-3 px-4 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-[#f5f4ef] dark:text-[#131313]">
          <TrendingUp className="h-3 w-3" />
          In The Loop
        </span>

        <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => onTopicClick(topic)}
              className="shrink-0 text-[11px] font-medium text-ink-secondary transition-colors hover:text-ink dark:text-[#cac8c2] dark:hover:text-[#f5f4ef]"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TopicPills;
