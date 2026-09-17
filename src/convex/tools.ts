import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { SEED_TOOLS } from "./catalog";
import { cleanText, requireAdmin } from "./permissions";

/** The full registry, in display order. Public so tool pages can honour the enabled flag. */
export const list = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    return await ctx.db.query("tools").withIndex("by_order").collect();
  },
});

export const setEnabled = mutation({
  args: { id: v.id("tools"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { enabled: args.enabled, updatedAt: Date.now() });
    return { enabled: args.enabled };
  },
});

export const update = mutation({
  args: {
    id: v.id("tools"),
    name: v.optional(v.string()),
    tagline: v.optional(v.string()),
    accepts: v.optional(v.string()),
    badge: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const patch: Record<string, string | number> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = cleanText(args.name, 60);
    if (args.tagline !== undefined) patch.tagline = cleanText(args.tagline, 180);
    if (args.accepts !== undefined) patch.accepts = cleanText(args.accepts, 60);
    if (args.badge !== undefined) patch.badge = cleanText(args.badge, 40);
    if (args.order !== undefined) {
      patch.order = Math.min(999, Math.max(0, Math.round(args.order)));
    }
    await ctx.db.patch(args.id, patch);
    return await ctx.db.get(args.id);
  },
});

/** Populates the registry the first time an admin signs in. Idempotent. */
export async function seedTools(ctx: MutationCtx): Promise<number> {
  const existing = await ctx.db.query("tools").take(1);
  if (existing.length > 0) return 0;
  const now = Date.now();
  for (const tool of SEED_TOOLS) {
    await ctx.db.insert("tools", {
      slug: tool.slug,
      name: tool.name,
      tagline: tool.tagline,
      accepts: tool.accepts,
      badge: tool.badge,
      enabled: true,
      order: tool.order,
      runCount: 0,
      updatedAt: now,
    });
  }
  return SEED_TOOLS.length;
}
