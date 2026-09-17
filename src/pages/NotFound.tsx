import { Link } from "react-router";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useSeo } from "@/hooks/use-seo";
import { PRIMARY_TOOL_ORDER, TOOLS } from "@/lib/seo";

export default function NotFound() {
  useSeo({
    title: "Page not found — SubmitReady",
    description:
      "That page doesn't exist. Browse the SubmitReady document tools: image compression, resizing, images to PDF, PDF compression, merging and splitting.",
    path: "/404",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16 sm:px-6">
        <span className="flex size-12 items-center justify-center rounded-xl border bg-card">
          <Compass className="size-5 text-primary" />
        </span>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs text-muted-foreground">404</p>
          <h1 className="text-3xl font-bold tracking-tight">
            That page isn&apos;t here
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The link may be old or mistyped. Everything SubmitReady does is one of the
            tools below — pick the one that matches the file you need to fix.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRIMARY_TOOL_ORDER.map((kind) => (
            <Button key={kind} asChild variant="outline" size="sm">
              <Link to={TOOLS[kind].path}>{TOOLS[kind].name}</Link>
            </Button>
          ))}
          <Button key="split" asChild variant="outline" size="sm">
            <Link to={TOOLS["pdf-split"].path}>{TOOLS["pdf-split"].name}</Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="gap-2">
            <Link to="/">
              Back to the homepage
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/application-pack">Open the Application Pack</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
