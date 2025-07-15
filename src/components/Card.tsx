import React from 'react';

interface CardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

const Card: React.FC<CardProps> = ({ icon, title, description }) => {
  return (
    <div className="bg-background/70 dark:bg-slate-800/60 backdrop-blur-xs border border-slate-700/50 rounded-lg p-6 flex flex-col items-center text-center shadow-lg h-full">
      {icon && <div className="text-4xl mb-4 text-accent">{icon}</div>}
      <h3 className="text-xl font-bold text-brand-text-primary font-sans mb-2">{title}</h3>
      <p className="text-sm text-brand-text-primary/80 font-body">{description}</p>
    </div>
  );
};

export default Card;
