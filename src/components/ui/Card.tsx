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
          // DESIGN.md section 5: cards are 12 px, one surface step above the page, hairline border.
          "rounded-xl border border-border bg-card text-card-foreground shadow-card",
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
  // The size token sits outside twMerge, which reads text-h3 as a colour and would drop it beside text-foreground.
  <h3 className={`text-h3 ${twMerge(clsx("text-foreground", className))}`} {...props}>
    {children}
  </h3>
);
CardTitle.displayName = "CardTitle";

const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className, ...props }) => (
  <p className={`text-ui ${twMerge(clsx("text-muted-foreground", className))}`} {...props}>
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
