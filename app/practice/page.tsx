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

export default function PracticePage() {
  return (
    <div style={pageContainerStyle}>
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
