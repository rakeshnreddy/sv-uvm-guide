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

export default function PracticePage() {
  return (
    // Added className for consistent padding via globals.css
    <div className="page-container">
      <h1 style={titleStyle}>Practice Hub</h1>
      <p style={paragraphStyle}>
        This is where you will find interactive coding labs, quizzes, and the Waveform Studio.
        Sharpen your SystemVerilog and UVM skills with hands-on exercises designed to reinforce
        concepts learned in the curriculum. Prepare for real-world verification challenges.
      </p>
      {/* More content will be added here */}
    </div>
  );
}
