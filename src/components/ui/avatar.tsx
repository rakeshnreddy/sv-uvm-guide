import React from 'react';
import Image from 'next/image';

export const Avatar: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`relative rounded-full overflow-hidden bg-muted ${className}`}>{children}</div>
);

export const AvatarImage: React.FC<{ src?: string; alt?: string }> = ({ src, alt = 'Avatar image' }) => {
  if (!src) return null;
  return <Image src={src} alt={alt} fill sizes="48px" className="object-cover" />;
};

export const AvatarFallback: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="w-full h-full flex items-center justify-center text-sm">{children}</div>
);

export default Avatar;
