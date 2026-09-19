import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Combine, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/tool/FileDropzone";
import { FileList, type FileListItem } from "@/components/tool/FileList";
import { ProgressIndicator } from "@/components/tool/ProgressIndicator";
import { DownloadButton } from "@/components/tool/DownloadButton";
import { EmptyState, ErrorState } from "@/components/tool/StateMessage";
import { ResultStatus } from "@/components/tool/ResultStatus";
import { ToolStep } from "@/components/tool/ToolStep";
import { mergePdfs, readPdfInfo } from "@/lib/pdf";
import {
  bytesToBlob,
  describeError,
  formatBytes,
  readAsArrayBuffer,
  uid,
} from "@/lib/format";
import { usePack } from "@/context/pack";
import { useRunLog } from "@/hooks/use-run-log";

interface MergeItem {
  id: string;
  file: File;
  bytes: Uint8Array;
  pageCount: number;
  encrypted: boolean;
}

interface MergeResultState {
  blob: Blob;
  pageCount: number;
  fileCount: number;
  name: string;
  size: number;
  order: string;
}

export function PdfMergerTool() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [busy, setBusy] = useState(false);
  const logRun = useRunLog();
  const [reading, setReading] = useState(0);
  const [result, setResult] = useState<MergeResultState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { consumeHandoff } = usePack();
  const handoffUsed = useRef(false);

  const order = useMemo(() => items.map((item) => item.id).join(","), [items]);
  const stale = Boolean(result && result.order !== order);
  const totalPages = items.reduce((sum, item) => sum + item.pageCount, 0);
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);

  const addFiles = useCallback(async (files: File[]) => {
    setReading(files.length);
    const added: MergeItem[] = [];
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await readAsArrayBuffer(file));
        const info = await readPdfInfo(bytes);
        added.push({
          id: uid("merge"),
          file,
          bytes,
          pageCount: info.pageCount,
          encrypted: info.encrypted,
        });
      } catch (err) {
        toast.error(`${file.name} was skipped`, {
          description: describeError(
            err,
            "It isn't a readable PDF. Password-protected files must be unlocked first.",
          ),
        });
      } finally {
        setReading((current) => Math.max(0, current - 1));
      }
    }
    if (added.length > 0) {
      setItems((current) => [...current, ...added]);
      setResult(null);
    }
  }, []);

  useEffect(() => {
    if (handoffUsed.current) return;
    const staged = consumeHandoff();
    if (staged) {
      handoffUsed.current = true;
      void addFiles([staged]);
    }
  }, [addFiles, consumeHandoff]);

  const move = useCallback((id: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const reorder = useCallback((fromId: string, toId: string) => {
    setItems((current) => {
      const from = current.findIndex((item) => item.id === fromId);
      const to = current.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const merge = useCallback(async () => {
    if (items.length < 2) {
      toast.error("Add at least two PDFs to merge.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const merged = await mergePdfs(
        items.map((item) => ({ name: item.file.name, bytes: item.bytes })),
      );
      const blob = bytesToBlob(merged.bytes, "application/pdf");
      setResult({
        blob,
        pageCount: merged.pageCount,
        fileCount: merged.fileCount,
        name: "submitready-merged.pdf",
        size: blob.size,
        order,
      });
      toast.success(
        `Merged ${merged.fileCount} files into ${merged.pageCount} pages`,
        { description: formatBytes(blob.size) },
      );
      if (merged.encryptedFiles.length > 0) {
        toast.warning("Some files were password protected", {
          description: `${merged.encryptedFiles.join(", ")} — pages were copied, but check the result.`,
        });
      }

      void logRun({
        tool: "pdf-merge",
        label: `${merged.fileCount} PDFs into one file`,
        fileCount: merged.fileCount,
        inputBytes: items.reduce((sum, item) => sum + item.file.size, 0),
        outputBytes: blob.size,
        status: merged.encryptedFiles.length > 0 ? "partial" : "ok",
        detail: `${merged.pageCount} pages`,
      });
    } catch (err) {
      const message = describeError(
        err,
        "Merging failed. One of the files may be corrupted or protected.",
      );
      setError(message);
      toast.error("Merge failed", { description: message });
    } finally {
      setBusy(false);
    }
  }, [items, logRun, order]);

  const listItems: FileListItem[] = items.map((item) => ({
    id: item.id,
    name: item.file.name,
    size: item.file.size,
    kind: "pdf",
    meta: `${item.pageCount} page${item.pageCount === 1 ? "" : "s"}`,
    tone: item.encrypted ? "warn" : "default",
    badge: item.encrypted ? (
      <Badge variant="outline">Protected</Badge>
    ) : (
      <Badge variant="secondary">{item.pageCount}p</Badge>
    ),
  }));

  return (
    <div className="flex flex-col gap-5">
      <ToolStep
        step={1}
        title="Add the PDFs"
        description="The merge follows this exact order — use the arrows or drag rows to rearrange."
        state={items.length > 0 ? "done" : "active"}
        headerAside={
          items.length > 0 ? (
            <Badge variant="secondary">
              {items.length} files · {totalPages} pages · {formatBytes(totalBytes)}
            </Badge>
          ) : null
        }
      >
        <FileDropzone
          accept="application/pdf,.pdf"
          multiple
          onFiles={(files) => void addFiles(files)}
          disabled={reading > 0}
          title="Drop PDFs here"
          hint="add two or more files to combine"
          formats="PDF"
          icon={<Combine className="size-5" />}
        />
        {reading > 0 ? (
          <ProgressIndicator
            value={null}
            label={`Reading ${reading} file${reading === 1 ? "" : "s"}`}
          />
        ) : null}
        <FileList
          items={listItems}
          reorderable
          onRemove={(id) => {
            setItems((current) => current.filter((item) => item.id !== id));
            setResult(null);
          }}
          onMove={move}
          onReorder={reorder}
          emptyLabel="No PDFs added yet."
        />
      </ToolStep>

      <ToolStep
        step={2}
        title="Merge"
        description="Page sizes, orientation and quality are preserved exactly — pages are copied, not re-rendered."
        state={items.length > 0 ? "active" : "todo"}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            className="gap-2"
            disabled={busy || items.length < 2}
            onClick={() => void merge()}
          >
            <Combine className="size-4" />
            {result ? "Merge again" : "Merge PDFs"}
          </Button>
          {items.length === 1 ? (
            <span className="text-xs text-muted-foreground">
              Add one more PDF to enable merging.
            </span>
          ) : null}
          {stale ? (
            <span className="flex items-center gap-1.5 text-xs text-warning-foreground dark:text-warning">
              <RefreshCw className="size-3.5" />
              The order or file list changed — merge again.
            </span>
          ) : null}
        </div>

        {busy ? <ProgressIndicator value={null} label="Copying pages into one PDF" /> : null}

        {error ? (
          <ErrorState title="Merge failed" message={error} />
        ) : null}
      </ToolStep>

      <ToolStep
        step={3}
        title="Download the merged PDF"
        description="One file containing every page you added, in order."
        state={result ? "active" : "todo"}
      >
        {!result ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="The merged file appears here"
            description="Add two or more PDFs, set the order, and the combined document will be shown with its total page count and size."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {stale ? (
              <ErrorState
                title="The file list changed since this merge"
                message="Merge again to produce a file that matches the order shown above."
              />
            ) : (
              <ResultStatus
                originalBytes={totalBytes}
                resultBytes={result.size}
                resultLabel="Merged PDF"
                resultDetail={`${result.pageCount} pages`}
                action="Merging"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {result.fileCount} files combined into one document, in the order shown
              above. Page sizes and quality are preserved exactly.
            </p>
            <DownloadButton
              blob={result.blob}
              filename={result.name}
              label={`Download merged PDF (${formatBytes(result.size)})`}
              size={result.size}
              disabled={stale}
            />
          </div>
        )}
      </ToolStep>
    </div>
  );
}
