import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Where a requirement preset came from. */
export const PRESET_SCOPES = {
  GLOBAL: "global",
  PERSONAL: "personal",
} as const;

export const presetScopeValidator = v.union(
  v.literal(PRESET_SCOPES.GLOBAL),
  v.literal(PRESET_SCOPES.PERSONAL),
);

/** How a recorded run finished. */
export const RUN_STATUS = {
  OK: "ok",
  PARTIAL: "partial",
  FAILED: "failed",
} as const;

export const runStatusValidator = v.union(
  v.literal(RUN_STATUS.OK),
  v.literal(RUN_STATUS.PARTIAL),
  v.literal(RUN_STATUS.FAILED),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      // SubmitReady: lets the admin console list and count accounts by role.
      .index("by_role", ["role"]),

    /* ------------------------------------------------------------------ */
    /*  SubmitReady management tables                                      */
    /* ------------------------------------------------------------------ */

    /** The tool registry. Admins enable, rename and annotate tools here. */
    tools: defineTable({
      slug: v.string(),
      name: v.string(),
      tagline: v.string(),
      accepts: v.string(),
      badge: v.optional(v.string()),
      enabled: v.boolean(),
      order: v.number(),
      /** Number of recorded runs, kept denormalised for the admin overview. */
      runCount: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_order", ["order"]),

    /**
     * Upload requirement presets. Global presets are the defaults every visitor
     * sees (managed by admins); personal presets belong to one account.
     */
    presets: defineTable({
      name: v.string(),
      description: v.string(),
      /** Pack slot this preset applies to, e.g. "photograph". */
      slotId: v.string(),
      extensions: v.array(v.string()),
      minBytes: v.optional(v.number()),
      maxBytes: v.optional(v.number()),
      exactWidth: v.optional(v.number()),
      exactHeight: v.optional(v.number()),
      maxWidth: v.optional(v.number()),
      maxHeight: v.optional(v.number()),
      maxPages: v.optional(v.number()),
      scope: presetScopeValidator,
      ownerId: v.optional(v.id("users")),
      /** True for the presets SubmitReady ships with. */
      builtIn: v.boolean(),
      updatedAt: v.number(),
    })
      .index("by_scope", ["scope"])
      .index("by_owner", ["ownerId"])
      .index("by_slot", ["slotId"]),

    /**
     * Run metadata only — never file contents. `label` is a filename or a short
     * description supplied by the tool that recorded the run.
     */
    runs: defineTable({
      userId: v.id("users"),
      tool: v.string(),
      label: v.string(),
      fileCount: v.number(),
      inputBytes: v.number(),
      outputBytes: v.number(),
      status: runStatusValidator,
      detail: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_tool", ["tool"]),

    /** Single-row-per-key configuration managed from the admin console. */
    settings: defineTable({
      key: v.string(),
      announcement: v.optional(v.string()),
      announcementTone: v.optional(v.string()),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
