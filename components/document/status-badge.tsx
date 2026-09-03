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
    dotClass: "bg-[--warning]",
    textClass: "text-[--warning]",
    pulse: true,
    description: "Awaiting Project Manager approval signature.",
  },
  queried: {
    variant: "queried",
    label: "Queried",
    dotClass: "bg-[--warning]",
    textClass: "text-[--warning]",
    pulse: true,
    description: "Returned to supervisor with feedback/clarification requested.",
  },
  ready_for_cc: {
    variant: "success",
    label: "Ready for CC",
    dotClass: "bg-[--success]",
    textClass: "text-[--success]",
    description: "Approved by manager; ready for RFQ & Vendor Cost Comparison.",
  },
  review_cc: {
    variant: "processing",
    label: "In Review (CC)",
    dotClass: "bg-[--info]",
    textClass: "text-[--info]",
    pulse: true,
    description: "Cost comparison submitted and under financial review.",
  },
  ready_for_po: {
    variant: "success",
    label: "Ready for PO",
    dotClass: "bg-[--success]",
    textClass: "text-[--success]",
    description: "Winning quote approved; ready to generate Purchase Order.",
  },
  review_po: {
    variant: "processing",
    label: "In Review (PO)",
    dotClass: "bg-[--info]",
    textClass: "text-[--info]",
    pulse: true,
    description: "Purchase order created and under authorization.",
  },
  pending_po: {
    variant: "pending",
    label: "Pending PO",
    dotClass: "bg-[--warning]",
    textClass: "text-[--warning]",
    description: "Purchase order issued and awaiting vendor confirmation.",
  },
  delivery_processing: {
    variant: "delivery",
    label: "In Delivery",
    dotClass: "bg-[--info]",
    textClass: "text-[--info]",
    pulse: true,
    description: "Dispatched from vendor; transit in progress to site.",
  },
  delivered: {
    variant: "success",
    label: "Delivered",
    dotClass: "bg-[--success]",
    textClass: "text-[--success]",
    description: "Items received on site and verified via Goods Received Note (GRN).",
  },
  rejected: {
    variant: "danger",
    label: "Rejected",
    dotClass: "bg-[--destructive]",
    textClass: "text-[--destructive]",
    description: "Declined by management; pipeline terminated.",
  },
  cancelled: {
    variant: "danger",
    label: "Cancelled",
    dotClass: "bg-[--destructive]",
    textClass: "text-[--destructive]",
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
