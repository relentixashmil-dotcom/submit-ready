import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Scissors,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/tool/FileDropzone";
import { FileList } from "@/components/tool/FileList";
import { ProgressIndicator } from "@/components/tool/ProgressIndicator";
import { DownloadAllButton, DownloadButton } from "@/components/tool/DownloadButton";
import { ToolStep } from "@/components/tool/ToolStep";
import { parsePageRanges, readPdfInfo, selectionToGroup, splitPdf } from "@/lib/pdf";
import {
  closePdf,
  openPdfForRendering,
  renderPageThumbnail,
} from "@/lib/pdf-render";
import {
  bytesToBlob,
  describeError,
  formatBytes,
  nextFrame,
  readAsArrayBuffer,
} from "@/lib/format";
import { useRunLog } from "@/hooks/use-run-log";
import { cn } from "@/lib/utils";

type Mode = "selected" | "ranges" | "every";

const INITIAL_THUMBNAILS = 40;

interface SplitOutputState {
  name: string;
  blob: Blob;
  pageCount: number;
  size: number;
}

export function PdfSplitterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [encrypted, setEncrypted] = useState(false);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [thumbProgress, setThumbProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [limit, setLimit] = useState(INITIAL_THUMBNAILS);
  const [selected, setSelected] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("selected");
  const [rangeInput, setRangeInput] = useState("");
  const [rangeErrors, setRangeErrors] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<SplitOutputState[] | null>(null);
  /** True once the selection or mode changed after an export, so the previous
   *  files no longer match what is on screen. */
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfRef = useRef<Awaited<ReturnType<typeof openPdfForRendering>> | null>(null);
  const renderToken = useRef(0);
  const logRun = useRunLog();

  const releasePdf = useCallback(async () => {
    const current = pdfRef.current;
    pdfRef.current = null;
    if (current) await closePdf(current);
  }, []);

  useEffect(() => () => void releasePdf(), [releasePdf]);

  const loadFile = useCallback(
    async (next: File) => {
      setLoading(true);
      setError(null);
      setOutputs(null);
      setStale(false);
      setSelected([]);
      setThumbs({});
      setLimit(INITIAL_THUMBNAILS);
      await releasePdf();
      renderToken.current += 1;
      try {
        const buffer = await readAsArrayBuffer(next);
        const data = new Uint8Array(buffer);
        const info = await readPdfInfo(data);
        setFile(next);
        setBytes(data);
        setPageCount(info.pageCount);
        setEncrypted(info.encrypted);
      } catch (err) {
        const message = describeError(
          err,
          "This PDF couldn't be read. It may be corrupted or password protected.",
        );
        setError(message);
        setFile(null);
        setBytes(null);
        toast.error("Could not open that PDF", { description: message });
      } finally {
        setLoading(false);
      }
    },
    [releasePdf],
  );

  /* ------------------------- progressive thumbnails ------------------------ */

  useEffect(() => {
    if (!bytes || pageCount === 0) return;
    let cancelled = false;
    const token = renderToken.current;
    const data = bytes;

    async function run() {
      setThumbProgress({ done: 0, total: Math.min(pageCount, limit) });
      try {
        // Reuse the open document when only the preview limit changed.
        let pdf = pdfRef.current;
        if (!pdf) {
          pdf = await openPdfForRendering(data);
          pdfRef.current = pdf;
        }
        for (let page = 1; page <= Math.min(pageCount, limit); page += 1) {
          if (cancelled || token !== renderToken.current) break;
          try {
            const thumb = await renderPageThumbnail(pdf, page, 150, 0.7);
            setThumbs((current) => ({ ...current, [page]: thumb.dataUrl }));
          } catch {
            // Skip unrenderable pages; the page is still selectable by number.
          }
          setThumbProgress({ done: page, total: Math.min(pageCount, limit) });
          await nextFrame();
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            describeError(
              err,
              "Page previews couldn't be rendered in this browser. You can still export pages by number.",
            ),
          );
        }
      } finally {
        if (!cancelled) setThumbProgress(null);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [bytes, limit, pageCount]);

  /* Selecting pages only makes sense for the single-file export mode. */
  const selectingPages = mode === "selected";

  const parsedRanges = useMemo(
    () => (bytes ? parsePageRanges(rangeInput, pageCount) : { groups: [], errors: [] }),
    [bytes, pageCount, rangeInput],
  );
  useEffect(() => {
    setRangeErrors(parsedRanges.errors);
  }, [parsedRanges]);

  /** Selection edits invalidate any files already exported. */
  const markStale = () => setStale(true);

  const togglePage = (page: number) => {
    setSelected((current) =>
      current.includes(page)
        ? current.filter((entry) => entry !== page)
        : [...current, page].sort((a, b) => a - b),
    );
    markStale();
  };

  const runSplit = useCallback(async () => {
    if (!bytes || !file) return;
    setBusy(true);
    setError(null);
    try {
      let groups;
      if (mode === "selected") {
        const group = selectionToGroup(selected);
        if (!group) {
          toast.error("Select at least one page to export.");
          setBusy(false);
          return;
        }
        groups = [group];
      } else if (mode === "ranges") {
        if (parsedRanges.errors.length > 0) {
          toast.error("Fix the page ranges first.");
          setBusy(false);
          return;
        }
        if (parsedRanges.groups.length === 0) {
          toast.error("Enter at least one page or range.");
          setBusy(false);
          return;
        }
        groups = parsedRanges.groups;
      } else {
        groups = Array.from({ length: pageCount }, (_, index) => ({
          label: `page-${index + 1}`,
          pages: [index + 1],
        }));
      }

      const result = await splitPdf(bytes, file.name, groups);
      setStale(false);
      setOutputs(
        result.outputs.map((output) => ({
          name: output.name,
          blob: bytesToBlob(output.bytes, "application/pdf"),
          pageCount: output.pageCount,
          size: output.bytes.byteLength,
        })),
      );
      toast.success(
        `Exported ${result.outputs.length} PDF${result.outputs.length === 1 ? "" : "s"}`,
      );
      if (result.encrypted) {
        toast.warning("This PDF was password protected", {
          description: "Pages were copied without unlocking the file — check the result.",
        });
      }

      const exportedPages = result.outputs.reduce(
        (sum, output) => sum + output.pageCount,
        0,
      );
      void logRun({
        tool: "pdf-split",
        label: file.name,
        fileCount: result.outputs.length,
        inputBytes: file.size,
        outputBytes: result.outputs.reduce((sum, output) => sum + output.bytes.byteLength, 0),
        status: result.encrypted ? "partial" : "ok",
        detail: `${exportedPages} of ${pageCount} pages exported`,
      });
    } catch (err) {
      const message = describeError(err, "The selected pages couldn't be exported.");
      setError(message);
      toast.error("Export failed", { description: message });
    } finally {
      setBusy(false);
    }
  }, [bytes, file, logRun, mode, pageCount, parsedRanges, selected]);

  const visiblePages = Array.from(
    { length: Math.min(pageCount, limit) },
    (_, index) => index + 1,
  );

  return (
    <div className="flex flex-col gap-5">
      <ToolStep
        step={1}
        title="Select a PDF"
        description="Page previews are rendered in your browser straight from the file you pick."
        state={file ? "done" : "active"}
        headerAside={
          file ? (
            <Badge variant="secondary">
              {pageCount} page{pageCount === 1 ? "" : "s"}
            </Badge>
          ) : null
        }
      >
        {!file ? (
          <FileDropzone
            accept="application/pdf,.pdf"
            onFiles={(files) => {
              if (files[0]) void loadFile(files[0]);
            }}
            disabled={loading}
            title="Drop a PDF here"
            hint="or choose a file from your device"
            formats="PDF"
            icon={<Scissors className="size-5" />}
          />
        ) : (
          <FileList
            items={[
              {
                id: "source",
                name: file.name,
                size: file.size,
                kind: "pdf",
                meta: `${pageCount} pages`,
                tone: encrypted ? "warn" : "default",
                badge: encrypted ? <Badge variant="outline">Protected</Badge> : null,
              },
            ]}
            onRemove={() => {
              setFile(null);
              setBytes(null);
              setThumbs({});
              setOutputs(null);
              setSelected([]);
              void releasePdf();
            }}
          />
        )}
        {loading ? <ProgressIndicator value={null} label="Reading the PDF" /> : null}
        {encrypted ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-warning-foreground dark:text-warning">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            This PDF is encrypted. Pages can be copied without the password, but some
            content may be missing.
          </p>
        ) : null}
        {error && !file ? (
          <p
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </ToolStep>

      {file ? (
        <ToolStep
          step={2}
          title="Pick the pages"
          description="Tap pages to select them, type ranges, or split every page into its own file."
          state={file ? "active" : "todo"}
          headerAside={
            selected.length > 0 ? (
              <Badge variant="secondary">{selected.length} selected</Badge>
            ) : null
          }
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "selected", label: "Selected pages → one PDF" },
                { value: "ranges", label: "Page ranges → several PDFs" },
                { value: "every", label: "Every page → separate files" },
              ] as { value: Mode; label: string }[]
            ).map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={mode === option.value ? "default" : "outline"}
                aria-pressed={mode === option.value}
                onClick={() => {
                  if (option.value !== mode) {
                    setMode(option.value);
                    markStale();
                  }
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {mode !== "ranges" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelected(visiblePages);
                    markStale();
                  }}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelected([]);
                    markStale();
                  }}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelected(visiblePages.filter((page) => !selected.includes(page)));
                    markStale();
                  }}
                >
                  Invert
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selected.length > 0
                    ? `Pages ${selected.slice(0, 12).join(", ")}${selected.length > 12 ? "…" : ""}`
                    : "Nothing selected yet."}
                </span>
              </div>

              {thumbProgress ? (
                <ProgressIndicator
                  value={Math.round((thumbProgress.done / thumbProgress.total) * 100)}
                  label="Rendering page previews"
                  detail={`Page ${thumbProgress.done} of ${thumbProgress.total}`}
                />
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visiblePages.map((page) => {
                  const isSelected = selected.includes(page);
                  const thumb = thumbs[page];
                  return (
                    <button
                      key={page}
                      type="button"
                      aria-pressed={selectingPages ? isSelected : undefined}
                      onClick={() => (selectingPages ? togglePage(page) : undefined)}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                        !selectingPages && "cursor-default opacity-90",
                      )}
                    >
                      <span className="flex h-32 items-center justify-center overflow-hidden rounded border bg-muted/30 sm:h-36">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={`Page ${page}`}
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs">Page {page}</span>
                        {!selectingPages ? (
                          <span className="text-[11px] text-muted-foreground">
                            will export separately
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "flex size-5 items-center justify-center rounded border text-[11px]",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground",
                            )}
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {pageCount > limit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 self-start"
                  onClick={() => setLimit((current) => Math.min(pageCount, current + 60))}
                >
                  <Layers className="size-4" />
                  Load more previews ({pageCount - limit} remaining)
                </Button>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="range-input">Pages to export</Label>
              <Input
                id="range-input"
                value={rangeInput}
                onChange={(event) => {
                  setRangeInput(event.target.value);
                  markStale();
                }}
                placeholder="1-3, 5, 8-10"
                aria-invalid={rangeErrors.length > 0}
              />
              <p className="text-xs text-muted-foreground">
                Each range or single page becomes its own PDF. Use 1-3 for a group, or
                type <span className="font-mono">all</span> for the whole document.
              </p>
              {rangeErrors.length > 0 ? (
                <ul className="flex flex-col gap-1" role="alert">
                  {rangeErrors.map((message) => (
                    <li key={message} className="text-xs text-destructive">
                      {message}
                    </li>
                  ))}
                </ul>
              ) : parsedRanges.groups.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {parsedRanges.groups.length} file
                  {parsedRanges.groups.length === 1 ? "" : "s"} will be created:{" "}
                  {parsedRanges.groups
                    .map((group) => `pages ${group.pages.join(", ")}`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              className="gap-2"
              disabled={busy || pageCount === 0}
              onClick={() => void runSplit()}
            >
              <Scissors className="size-4" />
              Export pages
            </Button>
            {outputs && stale ? (
              <span className="flex items-center gap-1.5 text-xs text-warning-foreground dark:text-warning">
                <RefreshCw className="size-3.5" />
                Selection changed — export again to update the files.
              </span>
            ) : null}
          </div>

          {busy ? <ProgressIndicator value={null} label="Copying pages" /> : null}

          {error && file ? (
            <p
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </ToolStep>
      ) : null}

      {outputs ? (
        <ToolStep
          step={3}
          title="Download the exported pages"
          description="Every file is a complete, standalone PDF."
          state="active"
          headerAside={
            <Badge variant="secondary">
              {outputs.length} file{outputs.length === 1 ? "" : "s"}
            </Badge>
          }
        >
          <ul className="flex flex-col gap-2">
            {outputs.map((output) => (
              <li
                key={output.name}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium tracking-tight">
                    {output.name}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {output.pageCount} page{output.pageCount === 1 ? "" : "s"} ·{" "}
                    {formatBytes(output.size)}
                  </span>
                </span>
                <DownloadButton
                  variant="outline"
                  buttonSize="sm"
                  label="Download"
                  blob={output.blob}
                  filename={output.name}
                  size={output.size}
                  disabled={stale}
                />
              </li>
            ))}
          </ul>
          {outputs.length > 1 ? (
            <DownloadAllButton
              files={outputs.map((output) => ({
                name: output.name,
                blob: output.blob,
              }))}
              zipName="submitready-split-pages.zip"
              disabled={stale}
            />
          ) : null}
        </ToolStep>
      ) : null}
    </div>
  );
}
