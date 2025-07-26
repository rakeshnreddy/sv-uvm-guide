"use client";
import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  type?: 'info' | 'warning';
}

const Alert: React.FC<AlertProps> = ({ children, type = 'info' }) => {
  const color = type === 'warning' ? 'bg-yellow-500/10 border-yellow-500' : 'bg-blue-500/10 border-blue-500';
  return (
    <div className={`my-4 p-4 border-l-4 ${color} rounded`}> {children} </div>
  );
};

export { Alert };
export default Alert;
