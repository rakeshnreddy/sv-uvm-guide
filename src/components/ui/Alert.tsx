"use client";
import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  type?: 'info' | 'warning';
}

const Alert: React.FC<AlertProps> = ({ children, type = 'info' }) => {
  const color = type === 'warning' ? 'bg-warning-subtle border-warning' : 'bg-info-subtle border-info';
  return (
    <div className={`my-4 rounded-lg border-l-4 p-4 text-foreground ${color}`}> {children} </div>
  );
};

export { Alert };
export default Alert;
