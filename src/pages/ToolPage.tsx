import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { ToolPageShell } from "@/components/ToolPageShell";
import { SEO_PAGE_BY_SLUG, type SeoPage } from "@/lib/seo";
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

  if (!page) return <NotFound />;

  return (
    <ToolPageShell page={page}>
      <Suspense fallback={<ToolLoading />}>{renderTool(page)}</Suspense>
    </ToolPageShell>
  );
}
