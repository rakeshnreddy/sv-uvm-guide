'use client'; // Needed for Next.js App Router if using client components like <Link> effectively or hooks

import Link from 'next/link';
import React from 'react';
import { usePathname } from 'next/navigation'; // To highlight active link

const headerStyle: React.CSSProperties = {
  backgroundColor: 'var(--background-light)',
  padding: '1rem 2rem',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const logoStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 'bold',
  color: 'var(--accent-color)',
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
};

const navLinkStyle: React.CSSProperties = {
  color: 'var(--text-light)',
  textDecoration: 'none',
  fontSize: '1rem',
  paddingBottom: '0.25rem', // For border-bottom effect on active
};

const activeLinkStyle: React.CSSProperties = {
  ...navLinkStyle, // Inherit base styles
  color: 'var(--accent-color)',
  borderBottom: '2px solid var(--accent-color)',
  fontWeight: 'bold',
};

const navLinks = [
  { href: '/', text: 'Home' },
  { href: '/curriculum', text: 'Curriculum' },
  { href: '/practice', text: 'Practice Hub' },
  { href: '/resources', text: 'Resources' },
  { href: '/community', text: 'Community' },
  { href: '/dashboard', text: 'Dashboard' },
];

const Header: React.FC = () => {
  const pathname = usePathname();

  return (
    <header style={headerStyle}>
      <Link href="/" style={logoStyle}>
        LearnUVM
      </Link>
      <nav style={navStyle}>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={pathname === link.href ? activeLinkStyle : navLinkStyle}
          >
            {link.text}
          </Link>
        ))}
      </nav>
    </header>
  );
};

export default Header;
