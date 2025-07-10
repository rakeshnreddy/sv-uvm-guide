import React from 'react';

interface CardProps {
  icon?: React.ReactNode; // Placeholder for an icon
  title: string;
  description: string;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#1E2D4B', // Slightly lighter than page background
  padding: '1.5rem',
  borderRadius: '8px',
  border: '1px solid #304A6E',
  minHeight: '150px', // Ensure cards have some height
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
};

const iconStyle: React.CSSProperties = {
  fontSize: '2rem', // Placeholder icon size
  marginBottom: '1rem',
  color: '#64FFDA', // Accent color for icon
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 'bold',
  color: '#CCD6F6',
  marginBottom: '0.5rem',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#8892B0',
};

const Card: React.FC<CardProps> = ({ icon, title, description }) => {
  return (
    <div style={cardStyle}>
      {icon && <div style={iconStyle}>{icon}</div>}
      <h3 style={titleStyle}>{title}</h3>
      <p style={descriptionStyle}>{description}</p>
    </div>
  );
};

export default Card;
