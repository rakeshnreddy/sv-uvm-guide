import React from 'react';

interface CardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

const Card: React.FC<CardProps> = ({ icon, title, description }) => {
  return (
    <div className="glass-card h-full px-6 py-8 flex flex-col items-center text-center">
      {icon && (
        <div className="text-4xl mb-4 text-[color:var(--blueprint-accent)]">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-[color:var(--blueprint-foreground)] font-sans mb-2">
        {title}
      </h3>
      <p className="text-sm text-[color:var(--blueprint-foreground)]/75">
        {description}
      </p>
    </div>
  );
};

export default Card;
