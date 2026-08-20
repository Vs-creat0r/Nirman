"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type StatusCategory =
  | "draft"
  | "pending"
  | "queried"
  | "processing"
  | "delivery"
  | "success"
  | "danger";

interface StatusConfig {
  variant: StatusCategory;
  label: string;
  dotClass: string;
  textClass: string;
  pulse?: boolean;
  description: string;
}

const STATUS_CONFIG_MAP: Record<string, StatusConfig> = {
  draft: {
    variant: "draft",
    label: "Draft",
    dotClass: "bg-muted-foreground/60",
    textClass: "text-muted-foreground",
    description: "Saved locally by creator; not yet submitted for review.",
  },
  pending: {
    variant: "pending",
    label: "Pending Review",
    dotClass: "bg-amber-500",
    textClass: "text-amber-500 dark:text-amber-400",
    pulse: true,
    description: "Awaiting Project Manager approval signature.",
  },
  queried: {
    variant: "queried",
    label: "Queried",
    dotClass: "bg-orange-500",
    textClass: "text-orange-500 dark:text-orange-400",
    pulse: true,
    description: "Returned to supervisor with feedback/clarification requested.",
  },
  ready_for_cc: {
    variant: "success",
    label: "Ready for CC",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    description: "Approved by manager; ready for RFQ & Vendor Cost Comparison.",
  },
  review_cc: {
    variant: "processing",
    label: "In Review (CC)",
    dotClass: "bg-blue-500",
    textClass: "text-blue-600 dark:text-blue-400",
    pulse: true,
    description: "Cost comparison submitted and under financial review.",
  },
  ready_for_po: {
    variant: "success",
    label: "Ready for PO",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    description: "Winning quote approved; ready to generate Purchase Order.",
  },
  review_po: {
    variant: "processing",
    label: "In Review (PO)",
    dotClass: "bg-blue-500",
    textClass: "text-blue-600 dark:text-blue-400",
    pulse: true,
    description: "Purchase order created and under authorization.",
  },
  pending_po: {
    variant: "pending",
    label: "Pending PO",
    dotClass: "bg-amber-500",
    textClass: "text-amber-500 dark:text-amber-400",
    description: "Purchase order issued and awaiting vendor confirmation.",
  },
  delivery_processing: {
    variant: "delivery",
    label: "In Delivery",
    dotClass: "bg-indigo-500",
    textClass: "text-indigo-600 dark:text-indigo-400",
    pulse: true,
    description: "Dispatched from vendor; transit in progress to site.",
  },
  delivered: {
    variant: "success",
    label: "Delivered",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    description: "Items received on site and verified via Goods Received Note (GRN).",
  },
  rejected: {
    variant: "danger",
    label: "Rejected",
    dotClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
    description: "Declined by management; pipeline terminated.",
  },
  cancelled: {
    variant: "danger",
    label: "Cancelled",
    dotClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
    description: "Cancelled by authorizer.",
  },
};

export function getStatusConfig(status: string): StatusConfig {
  if (!status) return STATUS_CONFIG_MAP.draft;
  const s = status.toLowerCase();
  if (STATUS_CONFIG_MAP[s]) {
    return STATUS_CONFIG_MAP[s];
  }

  // Fallback for custom or unknown status
  return {
    variant: "draft",
    label: status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
    description: status,
  };
}

export interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "sm",
  showTooltip = true,
  className,
}: StatusBadgeProps) {
  const config = getStatusConfig(status);

  const sizeClasses = {
    sm: "text-xs gap-1.5",
    md: "text-xs font-semibold gap-2 py-0.5",
    lg: "text-sm font-semibold gap-2.5 py-1 px-2.5 bg-muted/40 rounded-md border border-border/50",
  }[size];

  const dotSize = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
  }[size];

  return (
    <div
      className={cn(
        "inline-flex items-center select-none font-medium transition-colors",
        sizeClasses,
        config.textClass,
        className
      )}
      title={showTooltip ? `${config.label} — ${config.description}` : undefined}
    >
      <span className="relative flex items-center justify-center">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              config.dotClass
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full flex-shrink-0",
            dotSize,
            config.dotClass
          )}
        />
      </span>
      <span className="truncate">{config.label}</span>
    </div>
  );
}
