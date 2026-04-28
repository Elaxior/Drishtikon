import { CircleDot, Compass, LogOut, Moon, Search, Sun, User } from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth-store";

type NavbarProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const navigate = useNavigate();
  const { user, logout, isAuthLoading } = useAuth();
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

  const handleQuickTopicClick = (topic: string) => {
    navigate(`/analysis?q=${encodeURIComponent(topic)}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const profileLabel = user?.displayName?.split(" ")[0]
    || user?.email?.split("@")[0]
    || "Profile";
  const avatarInitial = (user?.displayName?.trim()?.[0] || user?.email?.trim()?.[0] || "U").toUpperCase();

  const quickTopics = [
    "Music",
    "Sport",
    "Economy",
    "Politics",
    "Technology",
    "Science",
    "Weather",
    "World",
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-parchment-300 bg-parchment/95 backdrop-blur-md transition-colors dark:border-[#2a313d] dark:bg-[#111317]/95">
      <div className="border-b border-parchment-200 bg-parchment-dark/65 px-4 py-1.5 dark:border-[#202631] dark:bg-[#151922]/65">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[11px] text-ink-muted dark:text-[#8892a3]">
          <div className="flex items-center gap-3">
            <CircleDot className="h-3 w-3" />
            <span>Theme</span>
            <button
              onClick={() => theme === "dark" && onToggleTheme()}
              className={`transition-colors ${theme === "light" ? "font-semibold text-ink dark:text-[#eef1f8]" : "hover:text-ink-secondary dark:hover:text-[#adb7c7]"}`}
            >
              Light
            </button>
            <button
              onClick={() => theme === "light" && onToggleTheme()}
              className={`transition-colors ${theme === "dark" ? "font-semibold text-ink dark:text-[#eef1f8]" : "hover:text-ink-secondary dark:hover:text-[#adb7c7]"}`}
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

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <NavLink
            to="/"
            className="inline-flex items-center gap-2 font-serif text-xl tracking-tight text-ink transition-colors hover:text-ink-secondary dark:text-[#eef1f8] dark:hover:text-[#adb7c7] sm:text-2xl"
          >
            <Compass className="h-4 w-4 text-accent" />
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
                  `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-accent text-white"
                      : "text-ink-secondary hover:bg-parchment-dark hover:text-ink dark:text-[#adb7c7] dark:hover:bg-[#1d212a] dark:hover:text-[#eef1f8]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 sm:hidden">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-2 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-ink-secondary dark:text-[#adb7c7]"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/trending"
              className={({ isActive }) =>
                `rounded-full px-2 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-ink-secondary dark:text-[#adb7c7]"
                }`
              }
            >
              Trending
            </NavLink>
          </nav>

          {searchOpen ? (
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center rounded-full border border-parchment-300 bg-white px-3 py-1.5 dark:border-[#2a313d] dark:bg-[#151922]"
            >
              <Search className="mr-2 h-4 w-4 text-ink-muted dark:text-[#8892a3]" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-32 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted dark:text-[#eef1f8] dark:placeholder:text-[#8892a3] sm:w-48"
                onBlur={() => {
                  if (!searchQuery.trim()) setSearchOpen(false);
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-full border border-parchment-300 bg-white px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-ink-muted dark:border-[#2a313d] dark:bg-[#151922] dark:text-[#8892a3] dark:hover:border-[#546076]"
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          )}

          {!isAuthLoading && user && (
            <>
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="hidden items-center gap-2 rounded-full border border-parchment-300 bg-white pl-1 pr-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-colors hover:border-accent hover:text-ink dark:border-[#2a313d] dark:bg-[#151922] dark:text-[#adb7c7] dark:hover:text-[#eef1f8] sm:inline-flex"
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-parchment-300 bg-parchment text-xs font-bold text-ink-secondary dark:border-[#2a313d] dark:bg-[#111317] dark:text-[#adb7c7]">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    avatarInitial
                  )}
                </span>
                {profileLabel}
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="hidden items-center gap-1 rounded-full border border-parchment-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary transition-colors hover:border-accent hover:text-ink dark:border-[#2a313d] dark:bg-[#151922] dark:text-[#adb7c7] dark:hover:text-[#eef1f8] sm:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </>
          )}

          {!isAuthLoading && !user && (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="hidden rounded-full bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-hover sm:inline-flex"
            >
              Login
            </button>
          )}

          <button
            onClick={onToggleTheme}
            className="rounded-full border border-parchment-300 p-1.5 text-ink-muted transition-colors hover:text-ink sm:hidden dark:border-[#2a313d] dark:text-[#8892a3] dark:hover:text-[#eef1f8]"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {!isAuthLoading && (
            <button
              type="button"
              onClick={() => {
                if (user) {
                  navigate("/profile");
                } else {
                  navigate("/login");
                }
              }}
              className="rounded-full border border-parchment-300 p-1.5 text-ink-muted transition-colors hover:text-ink sm:hidden dark:border-[#2a313d] dark:text-[#8892a3] dark:hover:text-[#eef1f8]"
              aria-label={user ? "Open profile" : "Open login"}
            >
              {user ? (
                <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold leading-none">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    avatarInitial
                  )}
                </span>
              ) : (
                <User className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="hidden border-t border-parchment-200 px-4 py-2 sm:block dark:border-[#202631]">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-secondary dark:text-[#adb7c7]">
          {quickTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => handleQuickTopicClick(topic)}
              className="transition-colors hover:text-ink dark:hover:text-[#eef1f8]"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
