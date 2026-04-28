import { Flame, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

type NavbarProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    "Music",
    "Sport",
    "Economy",
    "Politics",
    "Technology",
    "Science",
    "Weather",
    "World",
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    navigate(`/analysis?q=${encodeURIComponent(trimmed)}`);
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-parchment-300/90 bg-[color:var(--shell-bg)]/95 backdrop-blur-sm dark:border-[#2f2d2a]">
      <div className="border-b border-parchment-200/70 px-4 py-2 dark:border-[#242321]">
        <div className="mx-auto flex max-w-[980px] items-center justify-between text-[11px] text-ink-muted dark:text-[#9f9b93]">
          <span>
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
          <button
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1 rounded-full border border-parchment-300 px-2.5 py-1 text-[10px] font-semibold text-ink-secondary transition-colors hover:text-ink dark:border-[#2f2d2a] dark:text-[#cac8c2]"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[980px] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <NavLink to="/" className="inline-flex items-center gap-2 text-ink transition-colors hover:text-ink-secondary dark:text-[#f5f4ef]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-parchment-300 dark:border-[#2f2d2a]">
              <Flame className="h-3.5 w-3.5" />
            </span>
            <span className="font-serif text-lg uppercase tracking-[0.16em]">Drishtikon</span>
          </NavLink>

          <div className="hidden items-center gap-1 sm:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isActive
                    ? "bg-parchment-dark text-ink dark:bg-[#242321] dark:text-[#f5f4ef]"
                    : "text-ink-secondary hover:text-ink dark:text-[#cac8c2] dark:hover:text-[#f5f4ef]"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/trending"
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isActive
                    ? "bg-parchment-dark text-ink dark:bg-[#242321] dark:text-[#f5f4ef]"
                    : "text-ink-secondary hover:text-ink dark:text-[#cac8c2] dark:hover:text-[#f5f4ef]"
                }`
              }
            >
              Trending
            </NavLink>
          </div>

          {searchOpen ? (
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center rounded-full border border-parchment-300 bg-white px-3 py-1.5 dark:border-[#2f2d2a] dark:bg-[#101010]"
            >
              <Search className="mr-2 h-4 w-4 text-ink-muted dark:text-[#9f9b93]" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topic"
                className="w-28 bg-transparent text-xs text-ink outline-none placeholder:text-ink-muted dark:text-[#f5f4ef] sm:w-40"
                onBlur={() => {
                  if (!searchQuery.trim()) setSearchOpen(false);
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-parchment-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink dark:border-[#2f2d2a] dark:bg-[#101010] dark:text-[#cac8c2]"
              aria-label="Open search"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
          )}
        </div>

        <div className="mt-4 border-y border-parchment-300/80 py-2 dark:border-[#2f2d2a]">
          <div className="hide-scrollbar flex items-center justify-between gap-4 overflow-x-auto px-1">
            {categories.map((label) => (
              <span key={label} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-secondary dark:text-[#cac8c2]">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
