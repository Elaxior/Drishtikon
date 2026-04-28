import { AlertTriangle, Instagram, Linkedin, Mail, Phone } from "lucide-react";

function Footer() {
  return (
    <footer className="mt-16 border-t border-parchment-300 bg-[#16171a] px-4 py-10 text-[#d9dfeb] transition-colors dark:border-[#2a313d] dark:bg-[#0e1014]">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <h3 className="font-serif text-2xl text-white">Drishtikon</h3>
            <p className="max-w-sm text-sm leading-relaxed text-[#a9b1bf]">
              See the full media spectrum for every major story with AI-assisted
              source comparison and verification signals.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="rounded-full border border-[#2c3442] p-2 text-[#b8c1d2] transition-colors hover:text-white" aria-label="LinkedIn">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="#" className="rounded-full border border-[#2c3442] p-2 text-[#b8c1d2] transition-colors hover:text-white" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8e98ac]">Topics</h4>
            <ul className="space-y-2 text-sm text-[#bcc5d6]">
              <li>Politics</li>
              <li>Technology</li>
              <li>Economy</li>
              <li>World</li>
              <li>Science</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8e98ac]">Quick Links</h4>
            <ul className="space-y-2 text-sm text-[#bcc5d6]">
              <li>Home</li>
              <li>Trending</li>
              <li>Analysis</li>
              <li>Privacy Policy</li>
              <li>Terms</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8e98ac]">Contact</h4>
            <ul className="space-y-2 text-sm text-[#bcc5d6]">
              <li className="inline-flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> +1 (555) 234-5678
              </li>
              <li className="inline-flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> hello@drishtikon.ai
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a313d] pt-4 text-xs text-[#8e98ac]">
          <div className="inline-flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>This analysis is AI-assisted. Always verify information from original sources.</span>
          </div>
          <span>© {new Date().getFullYear()} Drishtikon. Built for media literacy.</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
