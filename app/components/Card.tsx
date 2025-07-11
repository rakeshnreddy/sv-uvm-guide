import React from 'react';

interface CardProps {
  icon?: React.ReactNode; // Placeholder for an icon
  title: string;
  description: string;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--background-light)', // Using CSS variable
  padding: '1.5rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)', // Using CSS variable
  // minHeight: '150px', // This is now handled by .embla__slide min-height in globals.css
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  boxShadow: '0 4px 8px rgba(0,0,0,0.2)', // Slightly darker shadow for contrast
  height: '100%', // Make card fill the slide's height
};

const iconStyle: React.CSSProperties = {
  fontSize: '2rem',
  marginBottom: '1rem',
  color: 'var(--accent-color)', // Using CSS variable
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.25rem', // This could become an h3 and inherit from globals.css
  fontWeight: 'bold',
  color: 'var(--text-light)', // Using CSS variable
  marginBottom: '0.5rem',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--text-medium)', // Using CSS variable
};

const Card: React.FC<CardProps> = ({ icon, title, description }) => {
  return (
    <div style={cardStyle}>
      {icon && <div style={iconStyle}>{icon}</div>}
      {/* Changed h3 to use global styling, specific overrides via style prop if needed */}
      <h3 style={titleStyle}>{title}</h3>
      <p style={descriptionStyle}>{description}</p>
    </div>
  );
};

export default Card;
