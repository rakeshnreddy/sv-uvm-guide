import React from 'react';

interface CardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

const Card: React.FC<CardProps> = ({ icon, title, description }) => {
  return (
    <div className="bg-primary border border-secondary rounded-lg p-6 flex flex-col items-center text-center shadow-lg h-full">
      {icon && <div className="text-4xl mb-4 text-accent">{icon}</div>}
      <h3 className="text-xl font-bold text-text-primary font-sans mb-2">{title}</h3>
      <p className="text-sm text-text-secondary font-body">{description}</p>
    </div>
  );
};

export default Card;
