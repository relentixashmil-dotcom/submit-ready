import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { SITE_SETTINGS_KEY } from "./catalog";
import { cleanText, requireAdmin } from "./permissions";

export const TONES = ["info", "success", "warning"] as const;

/** Site-wide banner shown above every page. Empty when unset. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();
    return {
      announcement: settings?.announcement ?? null,
      tone: settings?.announcementTone ?? "info",
      updatedAt: settings?.updatedAt ?? null,
    };
  },
});

export const setAnnouncement = mutation({
  args: {
    announcement: v.string(),
    tone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const announcement = cleanText(args.announcement, 200);
    const tone = (TONES as readonly string[]).includes(args.tone ?? "")
      ? (args.tone as string)
      : "info";

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SITE_SETTINGS_KEY))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        announcement: announcement || undefined,
        announcementTone: tone,
        updatedAt: Date.now(),
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("settings", {
        key: SITE_SETTINGS_KEY,
        announcement: announcement || undefined,
        announcementTone: tone,
        updatedAt: Date.now(),
        updatedBy: admin._id,
      });
    }

    return { announcement: announcement || null, tone };
  },
});
