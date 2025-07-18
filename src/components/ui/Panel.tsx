import React from 'react';
import Link from 'next/link';

interface PanelProps {
  href: string;
  title: string;
  description: string;
}

const Panel: React.FC<PanelProps> = ({ href, title, description }) => {
  return (
    <Link href={href} className="p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
      <h3 className="text-xl font-semibold text-accent-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
};

export default Panel;
