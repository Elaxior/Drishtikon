import { TrendingUp } from "lucide-react";

type TopicPillsProps = {
  topics: string[];
  onTopicClick: (topic: string) => void;
};

function TopicPills({ topics, onTopicClick }: TopicPillsProps) {
  if (topics.length === 0) return null;

  return (
    <div className="border-y border-parchment-300 bg-white/60 dark:border-[#2a313d] dark:bg-[#151922]/55">
      <div className="flex w-full items-center gap-3 py-2.5">
        <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
        <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
          {topics.map((topic, index) => (
            <button
              key={`${topic}-${index}`}
              onClick={() => onTopicClick(topic)}
              className="shrink-0 rounded-full border border-parchment-300 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-all duration-200 hover:border-accent hover:text-ink dark:border-[#2a313d] dark:bg-[#111317] dark:text-[#adb7c7] dark:hover:border-accent dark:hover:text-[#eef1f8]"
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
