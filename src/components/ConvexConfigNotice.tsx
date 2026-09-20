import { BrandWordmark } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ConvexConfigNoticeProps {
  /** True when VITE_CONVEX_URL was set to something unusable rather than left empty. */
  invalid?: boolean;
}

/**
 * Shown instead of the app when the production build has no Convex deployment
 * URL baked in. Without it the Convex client throws while the entry module
 * loads, which used to leave the deployed site completely blank. This screen
 * deliberately imports nothing from Convex so it can always render.
 */
export function ConvexConfigNotice({ invalid = false }: ConvexConfigNoticeProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-2xl">
        <BrandWordmark />

        <section className="mt-6 rounded-xl border bg-card p-5 sm:p-7">
          <p className="mono-label flex items-center gap-2 text-warning">
            <AlertTriangle className="size-3.5" />
            configuration required
          </p>

          <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
            {invalid
              ? "VITE_CONVEX_URL is not a valid Convex address"
              : "This deployment is missing VITE_CONVEX_URL"}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            SubmitReady loaded successfully, but this build has no Convex backend to connect to.
            Accounts, the workspace, saved presets and the admin console cannot start until it is
            configured.
            {invalid
              ? " The value that was provided is not an absolute URL, so the Convex client refused to start."
              : null}
          </p>

          <div className="mt-5 rounded-lg border bg-muted/40 px-4 py-3">
            <p className="mono-label text-muted-foreground">what it expects</p>
            <code className="mt-1.5 block font-mono text-xs leading-relaxed break-all text-foreground">
              VITE_CONVEX_URL=https://&lt;your-deployment&gt;.convex.cloud
            </code>
          </div>

          <ol className="mt-5 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <li className="flex gap-3">
              <span className="mono-label mt-0.5 text-primary">01</span>
              <span>
                Copy your Convex deployment URL — the value printed by{" "}
                <code className="font-mono text-xs">npx convex dev</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mono-label mt-0.5 text-primary">02</span>
              <span>
                Add it as <code className="font-mono text-xs">VITE_CONVEX_URL</code> in the
                environment the build runs in (on Vercel: Project → Settings → Environment
                Variables). Vite inlines <code className="font-mono text-xs">VITE_*</code> values at
                build time, so the variable has to exist when the build runs and the site must be
                redeployed after changing it.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mono-label mt-0.5 text-primary">03</span>
              <span>
                Working locally? Put the same value in{" "}
                <code className="font-mono text-xs">.env.local</code> and run{" "}
                <code className="font-mono text-xs">npx convex dev</code>.
              </span>
            </li>
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="button" className="gap-2" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" />
              Reload page
            </Button>
            <span className="text-xs text-muted-foreground">
              Configured it already? Reload after the new build finishes.
            </span>
          </div>

          <p className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
            Your files are processed in your browser and never uploaded — that has not changed.
          </p>
        </section>
      </div>
    </main>
  );
}
