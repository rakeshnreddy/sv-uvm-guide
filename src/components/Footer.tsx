import Link from 'next/link';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[rgba(5,11,26,0.95)] text-[var(--blueprint-foreground)]">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--blueprint-accent)] to-transparent opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(100,255,218,0.12),_transparent_60%)]" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center text-sm text-[rgba(230,241,255,0.7)] sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.35em] text-[rgba(230,241,255,0.5)]">SystemVerilog &amp; UVM Mastery</p>
        <p>&copy; {currentYear} All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <Link href="/privacy-policy" className="rounded-full px-3 py-1 transition hover:bg-white/10 hover:text-[var(--blueprint-accent)]">
            Privacy Policy
          </Link>
          <span className="text-[rgba(230,241,255,0.35)]">•</span>
          <Link href="/terms-of-service" className="rounded-full px-3 py-1 transition hover:bg-white/10 hover:text-[var(--blueprint-accent)]">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
