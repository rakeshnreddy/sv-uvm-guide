import Link from 'next/link';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border/50 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-foreground/70">
        <p>
          &copy; {currentYear} SystemVerilog & UVM Mastery. All Rights Reserved.
        </p>
        <div className="mt-2 space-x-4">
          <Link href="/privacy-policy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <span>|</span>
          <Link href="/terms-of-service" className="hover:text-primary transition-colors">
            Terms of Service
          </Link>
        </div>
        {/* Optional: Add a small logo or a link back to your main site if this is part of a larger ecosystem */}
        {/* <div className="mt-3">
          <Link href="https://your-main-site.com" className="hover:text-primary transition-colors">
            Your Main Site
          </Link>
        </div> */}
      </div>
    </footer>
  );
};

export default Footer;
