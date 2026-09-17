import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useAuth } from "./use-auth";

export type AccountRole = "admin" | "member" | "user";

export interface AccountState {
  isLoading: boolean;
  signedIn: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  adminExists: boolean;
  adminCount: number;
  role: AccountRole;
  name: string | null;
  email: string | null;
  isAnonymous: boolean;
  isVerified: boolean;
  userId: string | null;
}

/** Everything the header, workspace and admin gate need to know about the viewer. */
export function useAccount(): AccountState {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const me = useQuery(api.admin.me);
  const isLoading = authLoading || me === undefined;

  return {
    isLoading,
    signedIn: Boolean(me?.signedIn),
    isAuthenticated,
    isAdmin: Boolean(me?.isAdmin),
    adminExists: Boolean(me?.adminExists),
    adminCount: me?.adminCount ?? 0,
    role: (me?.role as AccountRole | undefined) ?? "user",
    name: me?.name ?? null,
    email: me?.email ?? null,
    isAnonymous: Boolean(me?.isAnonymous),
    isVerified: Boolean(me?.isVerified),
    userId: me?.userId ?? null,
  };
}
