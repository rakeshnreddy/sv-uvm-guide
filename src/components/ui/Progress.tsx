"use client";
import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, className }) => (
  <div className={cn("w-full bg-muted rounded-full h-2.5", className)}>
    <div
      className="h-2.5 rounded-full bg-success transition-[width] duration-300 ease-bench"
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
    />
  </div>
);


