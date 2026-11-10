import React from 'react';
import Link from 'next/link';

interface PanelProps {
  href: string;
  title: string;
  description: string;
}

const Panel: React.FC<PanelProps> = ({ href, title, description }) => {
  return (
    <Link href={href} className="block rounded-xl border border-border bg-card p-6 shadow-card transition-colors duration-150 ease-bench hover:border-input hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <h3 className="mb-2 text-h3 text-foreground">{title}</h3>
      <p className="text-ui text-muted-foreground">{description}</p>
    </Link>
  );
};

export default Panel;
