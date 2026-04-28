import { AlertTriangle } from "lucide-react";

function Footer() {
  return (
    <footer className="border-t border-parchment-300 bg-parchment-dark/60 px-4 py-6 transition-colors dark:border-[#3a342c] dark:bg-[#151310]/60">
      <div className="mx-auto max-w-7xl space-y-3">
        <div className="flex items-center justify-center gap-2 text-sm text-ink-muted dark:text-[#8a8279]">
          <AlertTriangle className="h-3.5 w-3.5" />
          <p>This analysis is AI-assisted. Always verify information from original sources.</p>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-ink-muted/60 dark:text-[#8a8279]/60">
          <span>© {new Date().getFullYear()} Drishtikon</span>
          <span className="h-3 w-px bg-parchment-300 dark:bg-[#3a342c]" />
          <span>Built for media literacy</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
