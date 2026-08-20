"use client";

import { useFormContext } from "react-hook-form";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/form-engine-types";

/**
 * Maps status strings to Badge variant names.
 * Uses a heuristic: match known status prefixes to the variant system.
 */
function statusToVariant(status: string): BadgeProps["variant"] {
  if (!status) return "draft";
  const s = status.toLowerCase();
  if (s === "draft") return "draft";
  if (s === "pending") return "pending";
  if (s === "queried") return "queried";
  if (s === "rejected") return "danger";
  if (s.startsWith("ready_for") || s === "approved") return "success";
  if (s.startsWith("review")) return "processing";
  if (s === "delivery_processing") return "delivery";
  if (s === "delivered") return "success";
  return "draft";
}

function formatStatusLabel(status: string): string {
  if (!status) return "—";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReadonlyBadge({ fieldDef }: { fieldDef: FieldDef }) {
  const { watch } = useFormContext();
  const value = watch(fieldDef.field);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <Label>{fieldDef.label}</Label>
      <div className="flex items-center h-9">
        {value ? (
          <Badge variant={statusToVariant(String(value))}>
            {formatStatusLabel(String(value))}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground italic">
            Auto-generated
          </span>
        )}
      </div>
      {fieldDef.help && (
        <span className="text-[10px] text-muted-foreground">
          {fieldDef.help}
        </span>
      )}
    </div>
  );
}
