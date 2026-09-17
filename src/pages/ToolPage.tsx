import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { Loader2, PauseCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ToolPageShell } from "@/components/ToolPageShell";
import { SEO_PAGE_BY_SLUG, TOOLS, type SeoPage } from "@/lib/seo";
import NotFound from "./NotFound";

/* Tools are code-split so the PDF rendering engine only downloads when needed. */
const ImageCompressorTool = lazy(() =>
  import("@/components/tools/ImageCompressorTool").then((module) => ({
    default: module.ImageCompressorTool,
  })),
);
const ImageResizerTool = lazy(() =>
  import("@/components/tools/ImageResizerTool").then((module) => ({
    default: module.ImageResizerTool,
  })),
);
const ImagesToPdfTool = lazy(() =>
  import("@/components/tools/ImagesToPdfTool").then((module) => ({
    default: module.ImagesToPdfTool,
  })),
);
const PdfCompressorTool = lazy(() =>
  import("@/components/tools/PdfCompressorTool").then((module) => ({
    default: module.PdfCompressorTool,
  })),
);
const PdfMergerTool = lazy(() =>
  import("@/components/tools/PdfMergerTool").then((module) => ({
    default: module.PdfMergerTool,
  })),
);
const PdfSplitterTool = lazy(() =>
  import("@/components/tools/PdfSplitterTool").then((module) => ({
    default: module.PdfSplitterTool,
  })),
);
const ApplicationPackChecklist = lazy(() =>
  import("@/components/tools/ApplicationPackChecklist").then((module) => ({
    default: module.ApplicationPackChecklist,
  })),
);

function ToolLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading tool…
      </span>
    </div>
  );
}

function renderTool(page: SeoPage) {
  switch (page.tool) {
    case "image-compress":
      return (
        <ImageCompressorTool initialTargetBytes={page.preset?.targetBytes ?? null} />
      );
    case "pdf-compress":
      return (
        <PdfCompressorTool
          initialTargetBytes={page.preset?.targetBytes ?? null}
          initialLevel={page.preset?.compressLevel ?? "balanced"}
        />
      );
    case "image-resize":
      return <ImageResizerTool />;
    case "images-to-pdf":
      return <ImagesToPdfTool />;
    case "pdf-merge":
      return <PdfMergerTool />;
    case "pdf-split":
      return <PdfSplitterTool />;
    case "application-pack":
      return <ApplicationPackChecklist />;
    default:
      return null;
  }
}

export default function ToolPage() {
  const { slug } = useParams();
  const page = slug ? SEO_PAGE_BY_SLUG[slug] : undefined;
  // The registry is managed from the admin console, so a retired tool stops
  // accepting files without needing a new deploy.
  const registry = useQuery(api.tools.list);

  if (!page) return <NotFound />;

  const entry = registry?.find((tool) => tool.slug === page.tool);
  const retired = entry ? !entry.enabled : false;

  return (
    <ToolPageShell page={page}>
      {retired ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/5 p-5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-warning/40 bg-warning/10">
            <PauseCircle className="size-5 text-warning" />
          </span>
          <h2 className="text-base font-semibold tracking-tight">
            {TOOLS[page.tool].name} is paused
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            An administrator has taken this tool out of service on this deployment.
            Everything else keeps working, and no file has been sent anywhere.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/tools">Browse the other tools</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Suspense fallback={<ToolLoading />}>{renderTool(page)}</Suspense>
      )}
    </ToolPageShell>
  );
}
