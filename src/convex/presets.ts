import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { SEED_PRESETS } from "./catalog";
import {
  cleanText,
  clampNumber,
  currentUserDoc,
  requireAdmin,
  requireUser,
  roleOf,
} from "./permissions";
import { PRESET_SCOPES } from "./schema";

const MB = 1024 * 1024;

/** Shared requirement fields — used by both personal and global presets. */
const requirementArgs = {
  slotId: v.string(),
  extensions: v.array(v.string()),
  minBytes: v.optional(v.number()),
  maxBytes: v.optional(v.number()),
  exactWidth: v.optional(v.number()),
  exactHeight: v.optional(v.number()),
  maxWidth: v.optional(v.number()),
  maxHeight: v.optional(v.number()),
  maxPages: v.optional(v.number()),
};

function sanitizeRequirement(args: {
  slotId: string;
  extensions: string[];
  minBytes?: number;
  maxBytes?: number;
  exactWidth?: number;
  exactHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPages?: number;
}) {
  const extensions = Array.from(
    new Set(
      args.extensions
        .map((extension) => cleanText(extension, 8).toLowerCase().replace(/^\./, ""))
        .filter((extension) => extension.length > 0),
    ),
  ).slice(0, 8);

  const minBytes = clampNumber(args.minBytes, 0, 100 * MB);
  const maxBytes = clampNumber(args.maxBytes, 0, 100 * MB);

  return {
    slotId: cleanText(args.slotId, 40),
    extensions,
    minBytes,
    maxBytes,
    exactWidth: clampNumber(args.exactWidth, 1, 20000),
    exactHeight: clampNumber(args.exactHeight, 1, 20000),
    maxWidth: clampNumber(args.maxWidth, 1, 20000),
    maxHeight: clampNumber(args.maxHeight, 1, 20000),
    maxPages: clampNumber(args.maxPages, 1, 500),
  };
}

function sortPresets<T extends { slotId: string; name: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.slotId.localeCompare(b.slotId) || a.name.localeCompare(b.name),
  );
}

/** Global defaults every visitor gets. Used by the Application Pack. */
export const slotDefaults = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    return await ctx.db
      .query("presets")
      .withIndex("by_scope", (q) => q.eq("scope", PRESET_SCOPES.GLOBAL))
      .collect();
  },
});

/** Everything the current viewer may see: global defaults plus their own presets. */
export const list = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await currentUserDoc(ctx);
    const global = await ctx.db
      .query("presets")
      .withIndex("by_scope", (q) => q.eq("scope", PRESET_SCOPES.GLOBAL))
      .collect();
    const personal = user
      ? await ctx.db
          .query("presets")
          .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
          .collect()
      : [];

    return {
      global: sortPresets(global),
      personal: sortPresets(personal),
      isSignedIn: Boolean(user),
      canManageGlobals: roleOf(user) === "admin",
    };
  },
});

export const createPersonal = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    ...requirementArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = await ctx.db.insert("presets", {
      name: cleanText(args.name, 60) || "Untitled preset",
      description: cleanText(args.description ?? "", 200),
      ...sanitizeRequirement(args),
      scope: PRESET_SCOPES.PERSONAL,
      ownerId: user._id,
      builtIn: false,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const updatePersonal = mutation({
  args: {
    id: v.id("presets"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    ...requirementArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const preset = await ctx.db.get(args.id);
    if (!preset) throw new ConvexError("That preset no longer exists.");
    if (preset.ownerId !== user._id && roleOf(user) !== "admin") {
      throw new ConvexError("You can only edit your own presets.");
    }
    await ctx.db.patch(args.id, {
      name: cleanText(args.name ?? preset.name, 60),
      description: cleanText(args.description ?? preset.description, 200),
      ...sanitizeRequirement(args),
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("presets") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const preset = await ctx.db.get(args.id);
    if (!preset) return { removed: false };
    if (preset.ownerId !== user._id && roleOf(user) !== "admin") {
      throw new ConvexError("You can only delete your own presets.");
    }
    await ctx.db.delete(args.id);
    return { removed: true };
  },
});

/** Admins create or update the global defaults every visitor sees. */
export const upsertGlobal = mutation({
  args: {
    id: v.optional(v.id("presets")),
    name: v.string(),
    description: v.optional(v.string()),
    ...requirementArgs,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const payload = {
      name: cleanText(args.name, 60) || "Untitled preset",
      description: cleanText(args.description ?? "", 200),
      ...sanitizeRequirement(args),
      scope: PRESET_SCOPES.GLOBAL,
      builtIn: false,
      updatedAt: Date.now(),
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new ConvexError("That preset no longer exists.");
      await ctx.db.patch(args.id, payload);
      return await ctx.db.get(args.id);
    }

    const id = await ctx.db.insert("presets", {
      ...payload,
      ownerId: admin._id,
    });
    return await ctx.db.get(id);
  },
});

export const removeGlobal = mutation({
  args: { id: v.id("presets") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const preset = await ctx.db.get(args.id);
    if (!preset) return { removed: false };
    await ctx.db.delete(args.id);
    return { removed: true };
  },
});

/** Restores the shipped defaults, replacing every global preset. */
export const resetGlobals = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("presets")
      .withIndex("by_scope", (q) => q.eq("scope", PRESET_SCOPES.GLOBAL))
      .collect();
    for (const preset of existing) await ctx.db.delete(preset._id);

    const now = Date.now();
    for (const preset of SEED_PRESETS) {
      await ctx.db.insert("presets", {
        ...preset,
        scope: PRESET_SCOPES.GLOBAL,
        ownerId: admin._id,
        builtIn: true,
        updatedAt: now,
      });
    }
    return { restored: SEED_PRESETS.length };
  },
});

/** Seeds the global presets on first run. Idempotent. */
export async function seedPresets(ctx: MutationCtx): Promise<number> {
  const existing = await ctx.db.query("presets").take(1);
  if (existing.length > 0) return 0;
  const now = Date.now();
  for (const preset of SEED_PRESETS) {
    await ctx.db.insert("presets", {
      ...preset,
      scope: PRESET_SCOPES.GLOBAL,
      builtIn: true,
      updatedAt: now,
    });
  }
  return SEED_PRESETS.length;
}
