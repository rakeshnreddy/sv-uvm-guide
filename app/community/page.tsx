import React from 'react';

// Basic styling, assuming a global layout handles overall page structure
// Most styles are now expected to come from globals.css

const titleStyle: React.CSSProperties = {
  // fontSize: '2.5rem', // Handled by global h1
  // color: 'var(--accent-color)', // Handled by global h1
  marginBottom: '1rem',
  borderBottom: '2px solid var(--border-color)', // Use CSS variable
  paddingBottom: '0.5rem',
};

const paragraphStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: '1.6',
  color: 'var(--text-medium)', // Use CSS variable
};

export default function CommunityPage() {
  return (
    // Added className for consistent padding via globals.css
    <div className="page-container">
      <h1 style={titleStyle}>Community Forum</h1>
      <p style={paragraphStyle}>
        Connect with other learners and experienced verification engineers in our community forum.
        Ask questions, share your projects and insights, discuss challenging concepts, and collaborate
        on solutions. Learning is better together!
      </p>
      {/* Forum integration or content will be added here */}
    </div>
  );
}
