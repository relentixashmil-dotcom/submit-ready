import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";

/**
 * Gate for the admin console. When no admin exists yet, the first signed-in
 * account can claim the role and seed the catalog from here.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoading, isAdmin, adminExists, name, email } = useAccount();
  const bootstrap = useMutation(api.admin.bootstrap);
  const [claiming, setClaiming] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
        <span className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          checking role…
        </span>
      </div>
    );
  }

  if (isAdmin) return <>{children}</>;

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-6">
      <span className="flex size-11 items-center justify-center rounded-lg border border-warning/40 bg-warning/10">
        <ShieldAlert className="size-5 text-warning" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold tracking-tight">Admin access required</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {adminExists ? (
            <>
              The console is limited to admin accounts. You are signed in as{" "}
              <span className="font-mono text-foreground">
                {email ?? name ?? "a guest account"}
              </span>{" "}
              with the <span className="font-mono">user</span> role. Ask an existing
              admin to promote you from the Users tab.
            </>
          ) : (
            <>
              This deployment has no admin account yet. The first signed-in account
              can claim the role, which also seeds the tool registry and the default
              requirement presets.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!adminExists ? (
          <Button
            type="button"
            className="gap-2"
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              try {
                const result = await bootstrap({});
                if (result.granted) {
                  toast.success("You are now the admin", {
                    description: `Seeded ${result.seededTools} tools and ${result.seededPresets} presets.`,
                  });
                } else {
                  toast.warning("Admin already exists", {
                    description: result.reason,
                  });
                }
              } catch (error) {
                toast.error("Could not claim admin", {
                  description:
                    error instanceof Error
                      ? error.message
                      : "Try signing in again and retry.",
                });
              } finally {
                setClaiming(false);
              }
            }}
          >
            {claiming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Claim admin console
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to="/workspace">Back to the workspace</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/tools">Use the tools</Link>
        </Button>
      </div>
    </div>
  );
}
