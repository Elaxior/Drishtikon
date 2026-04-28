import { AlertTriangle } from "lucide-react";

function Footer() {
  return (
    <footer className="mt-12 bg-[#161618] px-4 pb-8 pt-10 text-[#f0efe9]">
      <div className="mx-auto max-w-[980px] space-y-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="mb-3 font-serif text-lg">Drishtikon</h3>
            <p className="text-xs leading-relaxed text-[#a8a8ad]">
              Multi-source news intelligence with bias transparency and claim verification.
            </p>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a8a8ad]">Topics</p>
            <div className="space-y-1.5 text-xs text-[#dfdee0]">
              <p>Politics</p>
              <p>Technology</p>
              <p>Economy</p>
              <p>World</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a8a8ad]">Quick links</p>
            <div className="space-y-1.5 text-xs text-[#dfdee0]">
              <p>Home</p>
              <p>Trending</p>
              <p>Analysis</p>
              <p>About</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a8a8ad]">Trust note</p>
            <div className="flex items-start gap-2 text-xs leading-relaxed text-[#dfdee0]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff824c]" />
              <p>This analysis is AI-assisted. Always verify from original sources.</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-[#2a2a2d]" />

        <div className="flex items-center justify-between gap-3 text-[11px] text-[#8f8f95]">
          <span>© {new Date().getFullYear()} Drishtikon</span>
          <span>Built for media literacy</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
