import React from 'react';

// Basic styling, assuming a global layout handles overall page structure
const pageContainerStyle: React.CSSProperties = {
  padding: '2rem',
  color: '#CCD6F6', // Light text for dark theme
};

const titleStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  color: '#64FFDA', // Accent color
  marginBottom: '1rem',
  borderBottom: '2px solid #304A6E',
  paddingBottom: '0.5rem',
};

const paragraphStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: '1.6',
  color: '#8892B0', // Subtler text color
};

export default function ResourcesPage() {
  return (
    <div style={pageContainerStyle}>
      <h1 style={titleStyle}>Resources</h1>
      <p style={paragraphStyle}>
        Discover a curated collection of SystemVerilog and UVM resources. This includes links to official documentation,
        coding style guides, useful articles, recommended books, and third-party tools that can aid your learning
        and development process.
      </p>
      {/* More content will be added here */}
    </div>
  );
}
