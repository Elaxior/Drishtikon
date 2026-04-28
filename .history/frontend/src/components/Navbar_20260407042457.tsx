import { Moon, Search, Sun } from "lucide-react";
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    navigate(`/analysis?q=${encodeURIComponent(trimmed)}`);
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-parchment-300 bg-parchment/95 backdrop-blur-sm transition-colors dark:border-[#3a342c] dark:bg-[#1c1917]/95">
      {/* Utility bar */}
      <div className="border-b border-parchment-200 bg-parchment-dark/60 px-4 py-1.5 dark:border-[#2e2923] dark:bg-[#151310]/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[11px] text-ink-muted dark:text-[#8a8279]">
          <div className="flex items-center gap-3">
            <span>Theme:</span>
            <button
              onClick={() => theme === "dark" && onToggleTheme()}
              className={`transition-colors ${theme === "light" ? "font-semibold text-ink dark:text-[#f5f0e8]" : "hover:text-ink-secondary dark:hover:text-[#b8b0a4]"}`}
            >
              Light
            </button>
            <button
              onClick={() => theme === "light" && onToggleTheme()}
              className={`transition-colors ${theme === "dark" ? "font-semibold text-ink dark:text-[#f5f0e8]" : "hover:text-ink-secondary dark:hover:text-[#b8b0a4]"}`}
            >
              Dark
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Main navbar */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <NavLink
            to="/"
            className="font-serif text-xl tracking-tight text-ink transition-colors hover:text-ink-secondary dark:text-[#f5f0e8] dark:hover:text-[#b8b0a4] sm:text-2xl"
          >
            Drishtikon
          </NavLink>

          <nav className="hidden items-center gap-1 sm:flex">
            {[
              { to: "/", label: "Home" },
              { to: "/trending", label: "Trending" },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-ink dark:text-[#f5f0e8]"
                      : "text-ink-secondary hover:text-ink dark:text-[#b8b0a4] dark:hover:text-[#f5f0e8]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile nav */}
          <nav className="flex items-center gap-1 sm:hidden">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-ink dark:text-[#f5f0e8]"
                    : "text-ink-secondary dark:text-[#b8b0a4]"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/trending"
              className={({ isActive }) =>
                `rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-ink dark:text-[#f5f0e8]"
                    : "text-ink-secondary dark:text-[#b8b0a4]"
                }`
              }
            >
              Trending
            </NavLink>
          </nav>

          {/* Search bar */}
          {searchOpen ? (
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center rounded-lg border border-parchment-300 bg-white px-3 py-1.5 dark:border-[#3a342c] dark:bg-[#151310]"
            >
              <Search className="mr-2 h-4 w-4 text-ink-muted dark:text-[#8a8279]" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-32 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted dark:text-[#f5f0e8] dark:placeholder:text-[#8a8279] sm:w-48"
                onBlur={() => {
                  if (!searchQuery.trim()) setSearchOpen(false);
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-parchment-300 bg-white px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-ink-muted dark:border-[#3a342c] dark:bg-[#151310] dark:text-[#8a8279] dark:hover:border-[#6b6560]"
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          )}

          {/* Theme toggle for mobile */}
          <button
            onClick={onToggleTheme}
            className="rounded-lg border border-parchment-300 p-1.5 text-ink-muted transition-colors hover:text-ink sm:hidden dark:border-[#3a342c] dark:text-[#8a8279] dark:hover:text-[#f5f0e8]"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
