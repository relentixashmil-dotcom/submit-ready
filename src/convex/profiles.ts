import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { cleanText, requireUser } from "./permissions";

/** Lets an account holder set the display name shown across the console. */
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = cleanText(args.name, 60);
    await ctx.db.patch(user._id, {
      name: name || undefined,
    });
    return { name: name || null };
  },
});
