"use client";

import * as React from "react";
import { History } from "lucide-react";
import type { AuditLogEntry } from "./document-view";

export function DocumentAuditTrail({ logs }: { logs?: AuditLogEntry[] }) {
  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Audit Trail & History
        </h3>
      </div>
      <div className="space-y-2.5">
        {logs && logs.length > 0 ? (
          logs.map((log, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border text-xs"
            >
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {log.actorName}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal capitalize">
                      ({log.actorRole.replace(/_/g, " ")})
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    •{" "}
                    {new Date(log.timestamp).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Action:{" "}
                  <span className="font-medium text-foreground">
                    {log.action.replace(/_/g, " ")}
                  </span>
                  {log.toStatus && (
                    <>
                      {" "}
                      → Status:{" "}
                      <span className="font-semibold text-foreground capitalize">
                        {log.toStatus.replace(/_/g, " ")}
                      </span>
                    </>
                  )}
                </div>
                {log.note && (
                  <p className="text-[11px] text-foreground/80 mt-1 italic pl-2 border-l-2 border-primary/40">
                    &ldquo;{log.note}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No log entries recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
