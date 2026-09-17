import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { SEED_TOOLS } from "./catalog";
import {
  cleanText,
  currentUserDoc,
  requireAdmin,
  requireUser,
} from "./permissions";
import { runStatusValidator } from "./schema";

/** Guard rails so a client can never write nonsense into the activity log. */
const MAX_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_FILES = 2000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Stores metadata about one completed operation. File contents are never sent
 * to the server — only the numbers shown in the summary.
 */
export const record = mutation({
  args: {
    tool: v.string(),
    label: v.string(),
    fileCount: v.number(),
    inputBytes: v.number(),
    outputBytes: v.number(),
    status: runStatusValidator,
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const slug = cleanText(args.tool, 60);
    if (!SEED_TOOLS.some((tool) => tool.slug === slug)) {
      throw new ConvexError("Unknown tool.");
    }

    const runId = await ctx.db.insert("runs", {
      userId: user._id,
      tool: slug,
      label: cleanText(args.label, 120) || "Untitled",
      fileCount: clamp(args.fileCount, 0, MAX_FILES),
      inputBytes: clamp(args.inputBytes, 0, MAX_BYTES),
      outputBytes: clamp(args.outputBytes, 0, MAX_BYTES),
      status: args.status,
      detail: args.detail ? cleanText(args.detail, 200) : undefined,
      createdAt: Date.now(),
    });

    const toolDoc = await ctx.db
      .query("tools")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (toolDoc) {
      await ctx.db.patch(toolDoc._id, { runCount: (toolDoc.runCount ?? 0) + 1 });
    }

    return { runId };
  },
});

/** The signed-in account's recent activity. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUserDoc(ctx);
    if (!user) return [];
    return await ctx.db
      .query("runs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(40);
  },
});

/** Aggregate counters for the workspace dashboard. */
export const summaryMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUserDoc(ctx);
    if (!user) {
      return {
        totalRuns: 0,
        failedRuns: 0,
        inputBytes: 0,
        outputBytes: 0,
        savedBytes: 0,
        byTool: [] as {
          tool: string;
          count: number;
          inputBytes: number;
          outputBytes: number;
        }[],
        truncated: false,
      };
    }
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(500);

    const byTool = new Map<
      string,
      { tool: string; count: number; inputBytes: number; outputBytes: number }
    >();
    let inputBytes = 0;
    let outputBytes = 0;
    let failed = 0;

    for (const run of runs) {
      inputBytes += run.inputBytes;
      outputBytes += run.outputBytes;
      if (run.status === "failed") failed += 1;
      const entry = byTool.get(run.tool) ?? {
        tool: run.tool,
        count: 0,
        inputBytes: 0,
        outputBytes: 0,
      };
      entry.count += 1;
      entry.inputBytes += run.inputBytes;
      entry.outputBytes += run.outputBytes;
      byTool.set(run.tool, entry);
    }

    return {
      totalRuns: runs.length,
      failedRuns: failed,
      inputBytes,
      outputBytes,
      savedBytes: Math.max(0, inputBytes - outputBytes),
      byTool: Array.from(byTool.values()).sort((a, b) => b.count - a.count),
      truncated: runs.length >= 500,
    };
  },
});

/** Site-wide activity feed for the admin console. */
export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const runs = await ctx.db.query("runs").order("desc").take(60);
    const cache = new Map<string, { name?: string; email?: string }>();
    const items = [];

    for (const run of runs) {
      const key = String(run.userId);
      if (!cache.has(key)) {
        const user = await ctx.db.get(run.userId);
        cache.set(key, {
          name: user?.name,
          email: user?.email,
        });
      }
      items.push({ ...run, account: cache.get(key) ?? {} });
    }

    return items;
  },
});
