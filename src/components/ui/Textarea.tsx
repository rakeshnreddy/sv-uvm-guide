"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minRows?: number; // For auto-resizing behavior if implemented
  }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, minRows = 2, ...props }, ref) => {

    // Basic auto-resize logic (can be enhanced)
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    // const [currentValue, setCurrentValue] = React.useState(props.value || props.defaultValue || ""); // Unused

    React.useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (internalRef.current) {
        internalRef.current.style.height = "auto"; // Reset height to shrink if needed
        internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;
      }
      if (props.onChange) {
        props.onChange(event);
      }
      // setCurrentValue(event.target.value); // Unused
    };

    React.useEffect(() => {
        // Initial resize if there's a default value
        if (internalRef.current && (props.value || props.defaultValue)) {
            internalRef.current.style.height = "auto";
            internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;
        }
    }, [props.value, props.defaultValue]);


    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-lg px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "min-h-[40px]", // Ensure a minimum height based on typical single line input + padding
          className
        )}
        ref={internalRef}
        onChange={handleInput}
        style={{ overflowY: "hidden" }} // Hide scrollbar if auto-resizing works well
        rows={minRows} // Initial rows, though auto-resize might override quickly
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
