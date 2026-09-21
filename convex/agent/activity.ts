/**
 * @fileoverview Agent Assisted Activity Feed Query.
 *
 * Implements S7 Admin AI Observability:
 * - Admin-only immutable activity stream of confirmed agent-assisted transitions.
 * - Extracts agent context metadata (model, provider, proposalId).
 * - Enriches actor information for auditing.
 */

import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { resolveCallerScope } from "../scoping";

export interface AgentActivityItem {
  readonly _id: string;
  readonly _creationTime: number;
  readonly actorId: string;
  readonly actorName: string;
  readonly actorUsername: string;
  readonly actorRole: string;
  readonly action: string;
  readonly documentType: string;
  readonly documentId: string;
  readonly referenceId: string;
  readonly fromStatus?: string;
  readonly toStatus?: string;
  readonly note?: string;
  readonly source?: "manual" | "agent-assisted";
  readonly agentContext?: {
    readonly proposalId?: string;
    readonly provider?: string;
    readonly model?: string;
    readonly promptVersion?: string;
  };
  readonly timestamp: string;
}

export async function listAgentAssistedActivityHelper(
  ctx: QueryCtx,
  args: { token?: string; limit?: number }
): Promise<AgentActivityItem[]> {
  let scope;
  try {
    scope = await resolveCallerScope(ctx, args.token);
  } catch {
    return [];
  }

  if (!scope.isAdmin) {
    return [];
  }

  const allLogs = await ctx.db.query("logs").collect();
  const agentLogs = allLogs.filter((l) => l.source === "agent-assisted");

  // Sort descending by timestamp (newest first)
  agentLogs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const limit = args.limit || 100;
  const sliced = agentLogs.slice(0, limit);

  const enrichedLogs: AgentActivityItem[] = await Promise.all(
    sliced.map(async (log) => {
      const actor = await ctx.db.get(log.actorId);
      return {
        _id: String(log._id),
        _creationTime: log._creationTime,
        actorId: String(log.actorId),
        actorName: actor?.name || "Unknown User",
        actorUsername: actor?.username || "unknown",
        actorRole: log.actorRole,
        action: log.action,
        documentType: log.documentType,
        documentId: log.documentId,
        referenceId: log.referenceId,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        note: log.note,
        source: log.source,
        agentContext: log.agentContext,
        timestamp: log.timestamp,
      };
    })
  );

  return enrichedLogs;
}

export const listAgentAssistedActivity = query({
  args: {
    token: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await listAgentAssistedActivityHelper(ctx, args);
  },
});

