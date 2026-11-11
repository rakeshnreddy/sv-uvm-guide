"use client";

import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"; // Assumes a utility like this exists or will be created

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors duration-150 ease-bench focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // The one filled accent action per view. The transparent border keeps a
        // visible boundary in Windows forced-colours mode (gap-6). sheen-primary
        // (globals.css, DESIGN.md section 11) lays the vertical sheen and inset
        // highlight over bg-primary, darkens or lightens it on hover and keeps
        // the focus ring; bg-primary stays as the fallback fill.
        default:
          "sheen-primary border border-transparent bg-primary text-primary-foreground forced-colors:border-[ButtonText]",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 forced-colors:border-[ButtonText]",
        // Transparent: it takes the surface it sits on, so it never reads as a page-coloured hole in a card.
        outline:
          "border border-input bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-border/70",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
