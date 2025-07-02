"use client";

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-secondary-accent text-background hover:bg-secondary-accent/90",
        secondary: "bg-transparent border border-accent text-accent hover:bg-accent/10",
        // Adding a few more common variants for completeness, can be removed if not needed
        ghost: "hover:bg-accent/10 hover:text-accent",
        link: "text-primary-text underline-offset-4 hover:underline",
        destructive: "bg-red-500 text-primary-text hover:bg-red-500/90 dark:bg-red-700 dark:hover:bg-red-700/90"
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps extends HTMLMotionProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean; // For compatibility with Radix Slot if needed later
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? motion.div : motion.button; // Use motion.div if asChild to avoid button-inside-button

    // Animation props
    const hoverAnimation = {
      scale: 1.05,
      boxShadow:
        variant === 'primary' ? "0px 0px 15px rgba(255, 202, 134, 0.6)" : // secondary-accent glow
        variant === 'secondary' ? "0px 0px 15px rgba(100, 255, 218, 0.6)" : // accent glow
        "none", // No glow for other variants by default
      transition: { type: "spring", stiffness: 300, damping: 15 }
    };

    const tapAnimation = {
      scale: 0.97,
      transition: { type: "spring", stiffness: 400, damping: 10 }
    };

    return (
      <Comp
        className={twMerge(clsx(buttonVariants({ variant, size, className })))}
        ref={ref}
        whileHover={hoverAnimation}
        whileTap={tapAnimation}
        // Pass type="button" by default if not specified, to prevent accidental form submissions
        type={props.type || "button"}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
