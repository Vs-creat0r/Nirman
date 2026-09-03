"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  FileBarChart2,
  ShoppingBag,
  Truck,
  ClipboardCheck,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { StatusBadge } from "./status-badge";

export interface LineageStep {
  type: "mr" | "cc" | "po" | "dc" | "grn";
  label: string;
  refNo?: string;
  status?: string;
  href?: string;
  isCurrent?: boolean;
}

interface DocumentLineageBarProps {
  currentType: "mr" | "cc" | "po" | "dc" | "grn";
  mr?: { id: string; refNo: string; status: string; role?: string };
  cc?: { id: string; refNo: string; status: string; role?: string };
  po?: { id: string; refNo: string; status: string; role?: string };
  dc?: { id: string; refNo: string; status: string; role?: string };
  grn?: { id: string; refNo: string; status: string; role?: string };
  userRole?: string;
}

export function DocumentLineageBar({
  currentType,
  mr,
  cc,
  po,
  dc,
  grn,
  userRole = "procurement",
}: DocumentLineageBarProps) {
  // Determine role-based prefix for routes
  const prefix =
    userRole === "project_manager" || userRole === "manager"
      ? "/dashboard/manager"
      : userRole === "site_supervisor" || userRole === "supervisor"
      ? "/dashboard/supervisor"
      : "/dashboard/procurement";

  const steps: LineageStep[] = [
    {
      type: "mr",
      label: "Material Request",
      refNo: mr?.refNo,
      status: mr?.status,
      href: mr?.id
        ? userRole === "site_supervisor" || userRole === "supervisor"
          ? `/dashboard/supervisor/material-requests/${mr.id}`
          : `/dashboard/manager/material-requests/${mr.id}`
        : undefined,
      isCurrent: currentType === "mr",
    },
    {
      type: "cc",
      label: "Cost Comparison",
      refNo: cc?.refNo,
      status: cc?.status,
      href: cc?.id
        ? userRole === "project_manager" || userRole === "manager"
          ? `/dashboard/manager/cost-comparisons/${cc.id}`
          : `/dashboard/procurement/cost-comparisons/${cc.id}`
        : undefined,
      isCurrent: currentType === "cc",
    },
    {
      type: "po",
      label: "Purchase Order",
      refNo: po?.refNo,
      status: po?.status,
      href: po?.id
        ? userRole === "project_manager" || userRole === "manager"
          ? `/dashboard/manager/purchase-orders/${po.id}`
          : `/dashboard/procurement/purchase-orders/${po.id}`
        : undefined,
      isCurrent: currentType === "po",
    },
    {
      type: "dc",
      label: "Delivery Challan",
      refNo: dc?.refNo,
      status: dc?.status,
      href: dc?.id ? `/dashboard/deliveries/${dc.id}` : undefined,
      isCurrent: currentType === "dc",
    },
    {
      type: "grn",
      label: "Goods Receipt (GRN)",
      refNo: grn?.refNo,
      status: grn?.status,
      href: grn?.id ? `/dashboard/grn/${grn.id}` : undefined,
      isCurrent: currentType === "grn",
    },
  ];

  const icons = {
    mr: FileText,
    cc: FileBarChart2,
    po: ShoppingBag,
    dc: Truck,
    grn: ClipboardCheck,
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-xs">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-[11px] text-muted-foreground font-semibold">
        <span>Document Pipeline Lineage & Traceability</span>
        <span className="text-[10px] font-normal italic">
          Click a step to inspect related document
        </span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {steps.map((step, idx) => {
          const Icon = icons[step.type];
          const hasDocument = !!step.refNo;

          const content = (
            <div
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors select-none ${
                step.isCurrent
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                  : hasDocument
                  ? "border-border bg-muted/30 text-foreground hover:bg-muted/60 font-medium cursor-pointer"
                  : "border-dashed border-border/60 bg-muted/10 text-muted-foreground opacity-60"
              }`}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {step.label}
                </span>
                {hasDocument ? (
                  <span className="font-mono text-xs font-bold leading-tight">
                    {step.refNo}
                  </span>
                ) : (
                  <span className="text-[10px] italic leading-tight">Pending</span>
                )}
              </div>
              {step.status && (
                <div className="ml-1 pl-1 border-l border-border/60">
                  <StatusBadge status={step.status} size="sm" showTooltip={false} />
                </div>
              )}
            </div>
          );

          return (
            <React.Fragment key={step.type}>
              {step.href && !step.isCurrent ? (
                <Link href={step.href} className="hover:opacity-90 transition-opacity">
                  {content}
                </Link>
              ) : (
                content
              )}
              {idx < steps.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
