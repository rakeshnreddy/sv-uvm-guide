import React from 'react';
import Link from 'next/link';

interface PanelProps {
  href: string;
  title: string;
  description: string;
}

const Panel: React.FC<PanelProps> = ({ href, title, description }) => {
  return (
    <Link href={href} className="p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg transition-all hover:shadow-xl transform hover:-translate-y-1">
      <h3 className="text-xl font-semibold text-primary mb-2">{title}</h3>
      <p className="text-sm text-foreground/80">{description}</p>
    </Link>
  );
};

export default Panel;
