import { NavLink } from "react-router-dom";

import { Button } from "./ui/button";
import { cn } from "../lib/utils";

function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <NavLink to="/" className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
          Drishtikon
        </NavLink>

        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/"
              className={({ isActive }) => cn("rounded-md px-2", isActive ? "text-cyan-300" : "text-zinc-300")}
            >
              Home
            </NavLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/trending"
              className={({ isActive }) => cn("rounded-md px-2", isActive ? "text-cyan-300" : "text-zinc-300")}
            >
              Trending
            </NavLink>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
