import type { ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ChevronRight, Gauge, Lock, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolCard } from "@/components/ToolCard";
import { useToolSeo } from "@/hooks/use-seo";
import { SEO_PAGES, TOOLS, type SeoPage, type ToolKind } from "@/lib/seo";
import { cn } from "@/lib/utils";

const TOOL_ICONS: Record<ToolKind, ReactNode> = {
  "image-compress": <span className="text-lg">🗜️</span>,
  "image-resize": <span className="text-lg">📐</span>,
  "images-to-pdf": <span className="text-lg">🖼️</span>,
  "pdf-compress": <span className="text-lg">📉</span>,
  "pdf-merge": <span className="text-lg">🧩</span>,
  "pdf-split": <span className="text-lg">✂️</span>,
  "application-pack": <span className="text-lg">✅</span>,
};

export function toolIcon(kind: ToolKind) {
  return TOOL_ICONS[kind];
}

export function ToolPageShell({
  page,
  children,
}: {
  page: SeoPage;
  children: ReactNode;
}) {
  useToolSeo(page);
  const tool = TOOLS[page.tool];
  const { isAuthenticated } = useAuth();
  // Administrators can rename or re-badge a tool in the console; those edits win.
  const registry = useQuery(api.tools.list);
  const entry = registry?.find((row) => row.slug === page.tool);
  const displayName = entry?.name ?? tool.name;
  const displayBadge = entry?.badge || page.badge;
  const displayTagline = entry?.tagline ?? tool.blurb;

  const related = page.related.map((path) => {
    const match = SEO_PAGES.find((entry) => entry.path === path);
    return { path, page: match };
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
          <Link
            to="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Home
          </Link>
          <ChevronRight className="size-3 text-muted-foreground" />
          <Link
            to="/tools"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Tools
          </Link>
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="font-medium">{displayName}</span>
        </nav>

        <header className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3" />
              {displayBadge}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              accepts {tool.accepts}
            </span>
          </div>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {page.h1}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {displayTagline}
          </p>
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-3.5 text-success" />
              Your files are processed in your browser whenever technically possible.
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="size-3.5 text-primary" />
              {isAuthenticated ? (
                <>
                  This run is recorded in your workspace — sizes and outcome only.{" "}
                  <Link
                    to="/workspace"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open workspace
                  </Link>
                </>
              ) : (
                <>
                  Sign in to keep a history of what you prepared.{" "}
                  <Link
                    to="/auth"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Create an account
                  </Link>
                </>
              )}
            </p>
          </div>
        </header>

        <div className="mt-8">{children}</div>

        <section className="mt-14 flex flex-col gap-8">
          {page.sections.map((section) => (
            <div key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-xl font-bold tracking-tight">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="max-w-3xl text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">
            Questions about this tool
          </h2>
          <Accordion type="single" collapsible className="mt-4">
            {page.faqs.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">Related tools</h2>
          <div
            className={cn(
              "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {related.map((entry) =>
              entry.page ? (
                <ToolCard
                  key={entry.path}
                  title={TOOLS[entry.page.tool].name}
                  subtitle={entry.page.lede.split(".")[0] + "."}
                  to={entry.path}
                  icon={TOOL_ICONS[entry.page.tool]}
                  accepts={TOOLS[entry.page.tool].accepts}
                />
              ) : (
                <ToolCard
                  key={entry.path}
                  title={entry.path === "/privacy" ? "Privacy & processing" : "SubmitReady"}
                  subtitle="See exactly how processing works and what stays on your device."
                  to={entry.path}
                  icon={<Lock className="size-4" />}
                />
              ),
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
