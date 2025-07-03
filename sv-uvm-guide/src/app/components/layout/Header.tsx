import Link from 'next/link';

const Header = () => {
  return (
    <header className="bg-background/80 backdrop-blur-sm sticky top-0 z-50 w-full border-b border-gray-700/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          {/* Placeholder for Logo */}
          <Link href="/" className="text-2xl font-bold text-brand-text-primary hover:text-accent transition-colors">
            Logo
          </Link>
        </div>
        <nav className="flex items-center space-x-6">
          <Link href="/curriculum" className="text-brand-text-primary hover:text-accent transition-colors">
            Curriculum
          </Link>
          <Link href="/practice" className="text-brand-text-primary hover:text-accent transition-colors">
            Practice Hub
          </Link>
          <Link href="/resources" className="text-brand-text-primary hover:text-accent transition-colors">
            Resources
          </Link>
          <Link href="/community" className="text-brand-text-primary hover:text-accent transition-colors">
            Community
          </Link>
          <Link href="/dashboard" className="text-brand-text-primary hover:text-accent transition-colors">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
