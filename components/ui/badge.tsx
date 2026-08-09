import * as React from "react";
import { cn } from "../../lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "draft" | "pending" | "queried" | "processing" | "delivery" | "success" | "danger";
}

export function Badge({ className, variant = "draft", children, ...props }: BadgeProps) {
  // Map variant to themes.css status variables
  const dotColorClass = {
    draft: "bg-status-draft",
    pending: "bg-status-pending",
    queried: "bg-status-queried",
    processing: "bg-status-processing",
    delivery: "bg-status-delivery",
    success: "bg-status-success",
    danger: "bg-status-danger",
  };

  const textColorClass = {
    draft: "text-muted-foreground",
    pending: "text-foreground",
    queried: "text-foreground",
    processing: "text-foreground",
    delivery: "text-foreground",
    success: "text-foreground",
    danger: "text-foreground",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-xs font-semibold select-none",
        textColorClass[variant],
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotColorClass[variant])} />
      <span>{children}</span>
    </div>
  );
}
