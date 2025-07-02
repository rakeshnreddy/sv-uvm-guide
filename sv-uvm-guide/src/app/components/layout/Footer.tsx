import Link from 'next/link';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-gray-700/50 py-8">
      <div className="container mx-auto px-4 text-center text-primary-text/70">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-2">Navigation</h3>
            <ul className="space-y-1">
              <li><Link href="/curriculum" className="hover:text-accent transition-colors">Curriculum</Link></li>
              <li><Link href="/practice" className="hover:text-accent transition-colors">Practice Hub</Link></li>
              <li><Link href="/dashboard" className="hover:text-accent transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-2">Company</h3>
            <ul className="space-y-1">
              <li><Link href="/about" className="hover:text-accent transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-accent transition-colors">Contact</Link></li>
              <li><Link href="/careers" className="hover:text-accent transition-colors">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-primary-text mb-2">Legal</h3>
            <ul className="space-y-1">
              <li><Link href="/privacy-policy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-accent transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <p className="text-sm">
          &copy; {currentYear} SystemVerilog & UVM Mastery. All rights reserved.
        </p>
        <p className="text-xs mt-2">
          Built with <span className="text-accent">❤</span> for the love of hardware design.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
