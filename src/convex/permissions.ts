import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ROLES } from "./schema";

export type AnyCtx = QueryCtx | MutationCtx;

export type AccountRole = "admin" | "member" | "user";

/** The signed-in user document, or null when nobody is signed in. */
export async function currentUserDoc(ctx: AnyCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

export function roleOf(user: Doc<"users"> | null): AccountRole {
  if (!user) return "user";
  return (user.role as AccountRole | undefined) ?? "user";
}

export async function requireUser(ctx: AnyCtx): Promise<Doc<"users">> {
  const user = await currentUserDoc(ctx);
  if (!user) {
    throw new ConvexError("Sign in to use this feature.");
  }
  return user;
}

export async function requireAdmin(ctx: AnyCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (roleOf(user) !== ROLES.ADMIN) {
    throw new ConvexError(
      "Admin access is required for that action. Ask an existing admin to grant you the role.",
    );
  }
  return user;
}

export async function adminDocs(ctx: AnyCtx): Promise<Doc<"users">[]> {
  return await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", ROLES.ADMIN))
    .collect();
}

export async function adminCount(ctx: AnyCtx): Promise<number> {
  const admins = await adminDocs(ctx);
  return admins.length;
}

export function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null || Number.isNaN(value)) return undefined;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function cleanText(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}
