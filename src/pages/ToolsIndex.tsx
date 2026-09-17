import { Link } from "react-router";
import { ArrowRight, Gauge, Lock, ShieldCheck, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolCard } from "@/components/ToolCard";
import { toolIcon } from "@/components/ToolPageShell";
import { useSeo } from "@/hooks/use-seo";
import { POPULAR_REQUIREMENTS, QUICK_ACTIONS, TOOLS, type ToolKind } from "@/lib/seo";

const ORDER: ToolKind[] = [
  "image-compress",
  "image-resize",
  "images-to-pdf",
  "pdf-compress",
  "pdf-merge",
  "pdf-split",
  "application-pack",
];

export default function ToolsIndex() {
  useSeo({
    title: "All tools — SubmitReady document preparation toolkit",
    description:
      "Every SubmitReady tool in one place: image compressor, image resizer, images to PDF, PDF compressor, PDF merger, PDF splitter and the Application Pack checklist. All browser-based.",
    path: "/tools",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4">
          <Badge variant="secondary" className="w-fit gap-1.5">
            <Wand2 className="size-3" />
            7 tools · 1 workflow
          </Badge>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Every tool you need to make a file submission-ready
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Compress, resize, convert, merge, split and verify. Each tool shows the real
            output size before you download it, and each one runs on your device.
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-success" />
            No uploads and no per-file limits. Use every tool signed out, or sign in to
            keep a history.
          </p>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((kind, index) => (
            <ToolCard
              key={kind}
              title={TOOLS[kind].name}
              subtitle={TOOLS[kind].blurb}
              to={TOOLS[kind].path}
              icon={toolIcon(kind)}
              accepts={TOOLS[kind].accepts}
              index={index}
              size={kind === "application-pack" ? "large" : "default"}
            />
          ))}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-bold tracking-tight">Quick actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button key={action.path} asChild variant="outline" size="sm">
                <Link to={action.path}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: <Gauge className="size-4" />,
              title: "Your workspace",
              body: "Sign in to keep a run history, save requirement presets and see how much you saved.",
              to: "/workspace",
              cta: "Open the workspace",
            },
            {
              icon: <ShieldCheck className="size-4" />,
              title: "Admin console",
              body: "Manage accounts and roles, enable tools, publish global presets and post announcements.",
              to: "/admin",
              cta: "Open the console",
            },
            {
              icon: <Lock className="size-4" />,
              title: "How processing works",
              body: "Exactly what runs locally, and the small amount of metadata an account stores.",
              to: "/privacy",
              cta: "Read the details",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border bg-secondary text-primary">
                {item.icon}
              </span>
              <span className="text-sm font-semibold tracking-tight">{item.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {item.body}
              </span>
              <Link
                to={item.to}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {item.cta}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-bold tracking-tight">Popular requirements</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tools with the target size already set for the limits that appear most often
            on application portals.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {POPULAR_REQUIREMENTS.map((item) => (
              <Link
                key={item.path + item.label}
                to={item.path}
                className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/50"
              >
                <span className="flex flex-col">
                  <span className="font-mono text-sm font-semibold tracking-tight">
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
