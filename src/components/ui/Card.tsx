import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={twMerge(
        clsx(
          "bg-background/70 backdrop-blur-sm", // Slightly lighter/more transparent than main background, with blur
          "rounded-lg",
          "border border-[rgba(100,255,218,0.2)]", // accent color with 20% opacity
          "shadow-lg", // Adding a subtle shadow for depth
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// For more complex card structures, you might want to export sub-components:
// CardHeader, CardContent, CardFooter, CardTitle, CardDescription

// Example:
const CardHeader: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx("p-6 flex flex-col space-y-1.5", className))} {...props}>
    {children}
  </div>
);
CardHeader.displayName = "CardHeader";

const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className, ...props }) => (
  <h3 className={twMerge(clsx("text-2xl font-semibold leading-none tracking-tight text-primary-text", className))} {...props}>
    {children}
  </h3>
);
CardTitle.displayName = "CardTitle";

const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className, ...props }) => (
  <p className={twMerge(clsx("text-sm text-primary-text/80", className))} {...props}>
    {children}
  </p>
);
CardDescription.displayName = "CardDescription";


const CardContent: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx("p-6 pt-0", className))} {...props}>
    {children}
  </div>
);
CardContent.displayName = "CardContent";

const CardFooter: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={twMerge(clsx("flex items-center p-6 pt-0", className))} {...props}>
    {children}
  </div>
);
CardFooter.displayName = "CardFooter";


export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription };
