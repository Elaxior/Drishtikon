import { Moon, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "./ui/button";
import { cn } from "../lib/utils";

type NavbarProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

function Navbar({ theme, onToggleTheme }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur transition-colors dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <NavLink
          to="/"
          className="text-lg font-extrabold tracking-tight text-slate-900 transition-colors hover:text-cyan-700 dark:text-white dark:hover:text-cyan-300 sm:text-xl"
        >
          Drishtikon
        </NavLink>

        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn("rounded-md px-2", isActive ? "text-cyan-700 dark:text-cyan-300" : "text-slate-600 dark:text-zinc-300")
              }
            >
              Home
            </NavLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/trending"
              className={({ isActive }) =>
                cn("rounded-md px-2", isActive ? "text-cyan-700 dark:text-cyan-300" : "text-slate-600 dark:text-zinc-300")
              }
            >
              Trending
            </NavLink>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleTheme}
            className="ml-1 min-w-[104px] gap-1.5"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
