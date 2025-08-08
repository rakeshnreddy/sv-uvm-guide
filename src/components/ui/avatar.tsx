import React from 'react';

export const Avatar: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-full overflow-hidden bg-muted ${className}`}>{children}</div>
);

export const AvatarImage: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => (
  <img src={src} alt={alt} className="w-full h-full object-cover" />
);

export const AvatarFallback: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="w-full h-full flex items-center justify-center text-sm">{children}</div>
);

export default Avatar;
