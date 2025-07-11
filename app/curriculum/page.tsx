import React from 'react';
import Link from 'next/link';
import { curriculumData, CurriculumNode } from '@/lib/curriculum-data'; // Adjust path as needed

// Styles similar to other hub pages
const titleStyle: React.CSSProperties = {
  marginBottom: '1rem',
  borderBottom: '2px solid var(--border-color)',
  paddingBottom: '0.5rem',
};

const paragraphStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: '1.6',
  color: 'var(--text-medium)',
  marginBottom: '2rem',
};

const moduleLinkStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '1.2rem',
  color: 'var(--accent-color)',
  textDecoration: 'underline',
  marginBottom: '0.75rem',
};

export default function CurriculumHomePage() {
  const rootNode = curriculumData; // The main curriculumData object is the root

  if (!rootNode) {
    return (
      <div className="page-container">
        <h1 style={titleStyle}>Curriculum Not Found</h1>
        <p style={paragraphStyle}>The main curriculum data could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 style={titleStyle}>{rootNode.title}</h1>
      <p style={paragraphStyle}>
        Welcome to the main curriculum page. Below are the top-level modules available.
        Click on a module to explore its topics.
      </p>

      {rootNode.children && rootNode.children.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-light)', marginBottom: '1rem' }}>Modules:</h2>
          <ul>
            {rootNode.children.map((childNode: CurriculumNode) => (
              <li key={childNode.id} style={{listStyleType: 'none', marginLeft: '0', paddingLeft: '0'}}>
                <Link href={childNode.path} style={moduleLinkStyle}>
                  {childNode.title}
                </Link>
                {/* Optionally, add a short description of the module if available in your data */}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!rootNode.children || rootNode.children.length === 0 && (
        <p style={paragraphStyle}>No curriculum modules are currently available.</p>
      )}
    </div>
  );
}
