import * as React from "react";
import { cn } from "../../lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, onWheel, onKeyDown, min, ...props }, ref) => {
    const isNumber = type === "number";

    return (
      <input
        type={type}
        min={min ?? (isNumber ? 0 : undefined)}
        onWheel={(e) => {
          if (isNumber) {
            // Prevent accidental mouse wheel value changes
            e.currentTarget.blur();
          }
          onWheel?.(e);
        }}
        onKeyDown={(e) => {
          // Block negative sign on number inputs
          if (isNumber && (e.key === "-" || e.key === "e")) {
            e.preventDefault();
          }
          onKeyDown?.(e);
        }}
        className={cn(
          "flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isNumber && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
