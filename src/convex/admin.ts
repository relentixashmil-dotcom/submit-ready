import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  adminDocs,
  currentUserDoc,
  requireAdmin,
  requireUser,
  roleOf,
} from "./permissions";
import { ROLES, roleValidator } from "./schema";
import { seedTools } from "./tools";
import { seedPresets } from "./presets";

/** Who am I, and does this deployment already have an admin? */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUserDoc(ctx);
    const admins = await adminDocs(ctx);
    return {
      signedIn: Boolean(user),
      userId: user ? String(user._id) : null,
      name: user?.name ?? null,
      email: user?.email ?? null,
      isAnonymous: user?.isAnonymous ?? false,
      isVerified: Boolean(user?.emailVerificationTime),
      role: roleOf(user),
      isAdmin: roleOf(user) === ROLES.ADMIN,
      adminExists: admins.length > 0,
      adminCount: admins.length,
    };
  },
});

/**
 * First-run setup. The first signed-in account can claim the admin role, and the
 * tool registry plus the default requirement presets are seeded at the same time.
 * Once an admin exists this only seeds missing catalog rows.
 */
export const bootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const admins = await adminDocs(ctx);
    const seededTools = await seedTools(ctx);
    const seededPresets = await seedPresets(ctx);

    if (admins.length > 0) {
      return {
        granted: false,
        reason:
          "An admin account already exists on this deployment. Ask them to grant you the role.",
        seededTools,
        seededPresets,
      };
    }

    await ctx.db.patch(user._id, { role: ROLES.ADMIN });
    return {
      granted: true,
      reason: "You are the first account here, so you have been made the admin.",
      seededTools,
      seededPresets,
    };
  },
});

/** Account list for the admin console, with per-account activity counters. */
export const users = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Capped so the console stays responsive on large deployments.
    const accounts = await ctx.db.query("users").order("desc").take(50);

    return await Promise.all(
      accounts.map(async (account) => {
        const runs = await ctx.db
          .query("runs")
          .withIndex("by_user", (q) => q.eq("userId", account._id))
          .order("desc")
          .take(50);
        return {
          id: account._id,
          name: account.name ?? null,
          email: account.email ?? null,
          isAnonymous: account.isAnonymous ?? false,
          isVerified: Boolean(account.emailVerificationTime),
          role: roleOf(account),
          joinedAt: account._creationTime,
          runCount: runs.length,
          lastRunAt: runs[0]?.createdAt ?? null,
          inputBytes: runs.reduce((sum, run) => sum + run.inputBytes, 0),
          outputBytes: runs.reduce((sum, run) => sum + run.outputBytes, 0),
        };
      }),
    );
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (String(admin._id) === String(args.userId)) {
      throw new ConvexError("You can't change your own role.");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("That account no longer exists.");

    if (args.role !== ROLES.ADMIN && roleOf(target) === ROLES.ADMIN) {
      const admins = await adminDocs(ctx);
      if (admins.length <= 1) {
        throw new ConvexError(
          "This is the only admin account — grant admin to someone else before demoting it.",
        );
      }
    }

    await ctx.db.patch(args.userId, { role: args.role });
    return { role: args.role };
  },
});

/** Everything the admin overview needs, in one round trip. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const tools = await ctx.db.query("tools").withIndex("by_order").collect();
    const recentRuns = await ctx.db.query("runs").order("desc").take(300);
    const accounts = await ctx.db.query("users").take(300);
    const presets = await ctx.db
      .query("presets")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .collect();

    let inputBytes = 0;
    let outputBytes = 0;
    let ok = 0;
    let partial = 0;
    let failed = 0;
    const usage = new Map<string, number>();

    for (const run of recentRuns) {
      inputBytes += run.inputBytes;
      outputBytes += run.outputBytes;
      if (run.status === "ok") ok += 1;
      else if (run.status === "partial") partial += 1;
      else failed += 1;
      usage.set(run.tool, (usage.get(run.tool) ?? 0) + 1);
    }

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    return {
      accounts: {
        total: accounts.length,
        admins: accounts.filter((account) => roleOf(account) === ROLES.ADMIN).length,
        guests: accounts.filter((account) => account.isAnonymous).length,
        emailAccounts: accounts.filter((account) => Boolean(account.email)).length,
        newLast24h: accounts.filter((account) => account._creationTime >= dayAgo).length,
        newLastWeek: accounts.filter((account) => account._creationTime >= weekAgo).length,
      },
      runs: {
        sampled: recentRuns.length,
        ok,
        partial,
        failed,
        last24h: recentRuns.filter((run) => run.createdAt >= dayAgo).length,
        inputBytes,
        outputBytes,
        savedBytes: Math.max(0, inputBytes - outputBytes),
      },
      tools: tools.map((tool) => ({
        id: tool._id,
        slug: tool.slug,
        name: tool.name,
        enabled: tool.enabled,
        runCount: tool.runCount ?? 0,
        recentRuns: usage.get(tool.slug) ?? 0,
      })),
      presets: { global: presets.length },
      recent: recentRuns.slice(0, 12).map((run) => ({
        id: String(run._id),
        tool: run.tool,
        label: run.label,
        status: run.status,
        inputBytes: run.inputBytes,
        outputBytes: run.outputBytes,
        createdAt: run.createdAt,
        fileCount: run.fileCount,
      })),
    };
  },
});
