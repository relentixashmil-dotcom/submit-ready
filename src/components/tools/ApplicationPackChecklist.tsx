import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/tool/FileDropzone";
import { ProgressIndicator } from "@/components/tool/ProgressIndicator";
import { RequirementValidator } from "@/components/tool/RequirementValidator";
import { DownloadAllButton, DownloadButton } from "@/components/tool/DownloadButton";
import { ToolStep } from "@/components/tool/ToolStep";
import { itemDownload, usePack, type PackItem } from "@/context/pack";
import {
  type PackAction,
  type Requirement,
  PACK_SLOTS,
  slotById,
  suggestActions,
} from "@/lib/requirements";
import { KB, downloadBlob, formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function useImagePreview(file: File, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, enabled]);
  return url;
}

function statusLabel(status: "pass" | "warn" | "fail" | undefined) {
  if (status === "pass") return "Valid";
  if (status === "warn") return "Check this";
  if (status === "fail") return "Needs changes";
  return "Checking…";
}

/* -------------------------------------------------------------------------- */
/*  Requirement editor                                                         */
/* -------------------------------------------------------------------------- */

const TYPE_OPTIONS = ["jpg", "png", "webp", "pdf"];

function NumberField({
  id,
  label,
  value,
  placeholder,
  suffix,
  onCommit,
}: {
  id: string;
  label: string;
  value: number | undefined;
  placeholder?: string;
  suffix?: string;
  onCommit: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    setText(value === undefined ? "" : String(value));
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        {suffix ? <span className="text-muted-foreground"> ({suffix})</span> : null}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === "") {
            onCommit(undefined);
            return;
          }
          const parsed = Number.parseFloat(next);
          if (Number.isFinite(parsed)) onCommit(parsed);
        }}
      />
    </div>
  );
}

function RequirementEditor({
  requirement,
  onChange,
}: {
  requirement: Requirement;
  onChange: (next: Requirement) => void;
}) {
  const toggleType = (type: string) => {
    const has = requirement.extensions.includes(type);
    let extensions = has
      ? requirement.extensions.filter((entry) => entry !== type)
      : [...requirement.extensions, type];
    // jpg and jpeg are the same format on the wire.
    if (type === "jpg" && !has) {
      extensions = extensions.filter((entry) => entry !== "jpeg");
    }
    onChange({ ...requirement, extensions });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-tight">Accepted file types</span>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((type) => {
            const active =
              requirement.extensions.includes(type) ||
              (type === "jpg" && requirement.extensions.includes("jpeg"));
            return (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => toggleType(type)}
              >
                {type.toUpperCase()}
              </Button>
            );
          })}
        </div>
        {requirement.extensions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No types selected — any file type is accepted.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          id="req-min-size"
          label="Minimum size"
          suffix="KB"
          value={requirement.minBytes ? Math.round(requirement.minBytes / KB) : undefined}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              minBytes: value === undefined ? undefined : Math.max(1, Math.round(value * KB)),
            })
          }
        />
        <NumberField
          id="req-max-size"
          label="Maximum size"
          suffix="KB"
          value={requirement.maxBytes ? Math.round(requirement.maxBytes / KB) : undefined}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxBytes: value === undefined ? undefined : Math.max(1, Math.round(value * KB)),
            })
          }
        />
        <NumberField
          id="req-width"
          label="Exact width"
          suffix="px"
          value={requirement.exactWidth}
          placeholder="not required"
          onCommit={(value) =>
            onChange({
              ...requirement,
              exactWidth: value === undefined ? undefined : Math.round(value),
            })
          }
        />
        <NumberField
          id="req-height"
          label="Exact height"
          suffix="px"
          value={requirement.exactHeight}
          placeholder="not required"
          onCommit={(value) =>
            onChange({
              ...requirement,
              exactHeight: value === undefined ? undefined : Math.round(value),
            })
          }
        />
        <NumberField
          id="req-max-width"
          label="Max width"
          suffix="px"
          value={requirement.maxWidth}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxWidth: value === undefined ? undefined : Math.round(value),
            })
          }
        />
        <NumberField
          id="req-max-height"
          label="Max height"
          suffix="px"
          value={requirement.maxHeight}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxHeight: value === undefined ? undefined : Math.round(value),
            })
          }
        />
        <NumberField
          id="req-max-pages"
          label="Maximum pages"
          value={requirement.maxPages}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxPages: value === undefined ? undefined : Math.max(1, Math.round(value)),
            })
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...requirement,
              exactWidth: undefined,
              exactHeight: undefined,
              maxWidth: undefined,
              maxHeight: undefined,
              recommendedWidth: undefined,
              recommendedHeight: undefined,
            })
          }
        >
          <RotateCcw className="size-3.5" />
          Clear dimension rules
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...requirement,
              minBytes: undefined,
              maxBytes: undefined,
              maxPages: undefined,
            })
          }
        >
          <RotateCcw className="size-3.5" />
          Clear size &amp; page rules
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Item card                                                                  */
/* -------------------------------------------------------------------------- */

function PackItemCard({ item }: { item: PackItem }) {
  const { removeItem, runAction, updateRequirement, stageForTool } = usePack();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const slot = slotById(item.slotId);
  const isImage = item.facts.kind === "image";
  const previewUrl = useImagePreview(item.file, isImage);
  const actions = item.validation
    ? suggestActions(item.requirement, item.facts, item.validation)
    : [];
  const download = itemDownload(item);
  const status = item.validation?.status;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-4",
        status === "fail"
          ? "border-destructive/40"
          : status === "warn"
            ? "border-warning/50"
            : status === "pass"
              ? "border-success/40"
              : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {isImage && previewUrl ? (
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : item.facts.kind === "pdf" ? (
            <FileText className="size-5 text-muted-foreground" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">{slot.label}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                status === "pass"
                  ? "border-success/40 bg-success/10 text-success"
                  : status === "warn"
                    ? "border-warning/50 bg-warning/10 text-warning-foreground dark:text-warning"
                    : status === "fail"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-border text-muted-foreground",
              )}
            >
              {statusLabel(status)}
            </span>
            {item.prepared ? (
              <Badge variant="secondary">Prepared</Badge>
            ) : null}
          </span>
          <span className="truncate text-sm">{item.prepared?.name ?? item.file.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatBytes(item.facts.size)}
            {item.facts.kind === "image" && item.facts.width
              ? ` · ${item.facts.width} × ${item.facts.height} px`
              : ""}
            {item.facts.pageCount && item.facts.pageCount > 0
              ? ` · ${item.facts.pageCount} pages`
              : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {item.prepared ? (
            <DownloadButton
              blob={download.blob}
              filename={download.name}
              label="Download"
              buttonSize="sm"
              size={download.blob.size}
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={editing ? "Hide requirement" : "Edit requirement"}
            aria-expanded={editing}
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove this document"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => removeItem(item.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {item.runningAction ? (
        <ProgressIndicator value={null} label={item.runningAction} />
      ) : null}

      {item.error ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {item.error}
        </p>
      ) : null}

      <div className="rounded-lg border bg-muted/20 p-3">
        <RequirementValidator
          checks={item.validation?.checks ?? []}
          status={item.validation?.status}
          loading={item.inspecting}
          title="Against this requirement"
          subtitle={`Looking for ${item.requirement.extensions.map((ext) => ext.toUpperCase()).join(" / ") || "any type"}`}
          compact
        />
      </div>

      {actions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-tight">Fix it in one click</span>
          <div className="flex flex-wrap gap-2">
            {actions.map((action: PackAction) => (
              <Button
                key={action.kind}
                type="button"
                size="sm"
                className="gap-2"
                disabled={Boolean(item.runningAction)}
                onClick={() => void runAction(item.id, action)}
              >
                <Wand2 className="size-3.5" />
                {action.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{actions[0]?.reason}</p>
        </div>
      ) : null}

      {item.prepared?.note ? (
        <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-xs leading-relaxed">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
          {item.prepared.note}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isImage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              stageForTool(item.file);
              void navigate("/image-compressor");
            }}
          >
            Open in Image Compressor
            <ArrowUpRight className="size-3.5" />
          </Button>
        ) : item.facts.kind === "pdf" ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                stageForTool(item.file);
                void navigate("/pdf-compressor");
              }}
            >
              Open in PDF Compressor
              <ArrowUpRight className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                stageForTool(item.file);
                void navigate("/split-pdf");
              }}
            >
              Open in Splitter
              <ArrowUpRight className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>

      {editing ? (
        <RequirementEditor
          requirement={item.requirement}
          onChange={(next) => updateRequirement(item.id, next)}
        />
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">
          Requirement:{" "}
          {item.requirement.extensions.map((ext) => ext.toUpperCase()).join(" / ") ||
            "any type"}
          {item.requirement.maxBytes ? ` · max ${formatBytes(item.requirement.maxBytes)}` : ""}
          {item.requirement.minBytes ? ` · min ${formatBytes(item.requirement.minBytes)}` : ""}
          {item.requirement.exactWidth && item.requirement.exactHeight
            ? ` · ${item.requirement.exactWidth} × ${item.requirement.exactHeight} px`
            : ""}
          {item.requirement.maxPages ? ` · max ${item.requirement.maxPages} pages` : ""}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Checklist                                                                  */
/* -------------------------------------------------------------------------- */

export function ApplicationPackChecklist() {
  const {
    items,
    addFiles,
    addFilesAuto,
    clear,
    summary,
    reportText,
  } = usePack();
  const [adding, setAdding] = useState(false);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const allReady = items.length > 0 && summary.passed === items.length;
  const anyFailed = summary.failed > 0;

  const zipFiles = useMemo(
    () =>
      items
        .filter((item) => item.validation?.status !== "fail")
        .map((item) => {
          const download = itemDownload(item);
          return { name: download.name, blob: download.blob };
        }),
    [items],
  );

  const handleSlotPick = async (slotId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAdding(true);
    addFiles(slotId as Parameters<typeof addFiles>[0], Array.from(files));
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <ToolStep
        step={1}
        title="Build the pack"
        description="Add each document the application asks for. Types are detected automatically, and you can add files straight into a specific slot."
        state={items.length > 0 ? "done" : "active"}
      >
        <FileDropzone
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onFiles={async (files) => {
            setAdding(true);
            await addFilesAuto(files);
            setAdding(false);
          }}
          disabled={adding}
          title="Drop all your documents here"
          hint="photos, signatures, resumes, ID proofs, certificates, mark sheets"
          formats="JPG · PNG · WebP · PDF"
          icon={<ClipboardCheck className="size-5" />}
        />

        {adding ? (
          <ProgressIndicator value={null} label="Inspecting files" />
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold tracking-tight">
            Or add to a specific slot
          </span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PACK_SLOTS.map((slot) => {
              const count = items.filter((item) => item.slotId === slot.id).length;
              return (
                <div
                  key={slot.id}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium tracking-tight">
                      {slot.label}
                    </span>
                    {count > 0 ? (
                      <Badge variant="secondary">{count}</Badge>
                    ) : null}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {slot.hint}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-auto gap-1.5 self-start"
                    onClick={() => inputsRef.current[slot.id]?.click()}
                  >
                    <Plus className="size-3.5" />
                    Add file
                  </Button>
                  <input
                    ref={(element) => {
                      inputsRef.current[slot.id] = element;
                    }}
                    type="file"
                    accept={slot.requirement.extensions
                      .map((ext) => (ext === "pdf" ? "application/pdf" : `image/${ext}`))
                      .join(",")}
                    className="sr-only"
                    onChange={(event) => {
                      void handleSlotPick(slot.id, event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ToolStep>

      <ToolStep
        step={2}
        title="Check every requirement"
        description="Each rule is marked met, worth checking, or not met — with the numbers behind the verdict."
        state={items.length > 0 ? "active" : "todo"}
        headerAside={
          items.length > 0 ? (
            <Badge variant={allReady ? "secondary" : "outline"}>
              {summary.passed} of {items.length} ready
            </Badge>
          ) : null
        }
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing added yet. The checklist appears here once you add a document — the
            pack is kept in this browser tab only.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <PackItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </ToolStep>

      <ToolStep
        step={3}
        title="Finish the pack"
        description="Download every prepared file, or keep a record of how each one was checked."
        state={allReady ? "active" : "todo"}
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The final checklist appears here: a clear “everything is submission-ready”
            confirmation plus all your files in one download.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3",
                allReady
                  ? "border-success/50 bg-success/5"
                  : anyFailed
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-warning/50 bg-warning/5",
              )}
            >
              {allReady ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" />
              ) : anyFailed ? (
                <AlertTriangle className="size-5 shrink-0 text-destructive" />
              ) : (
                <AlertTriangle className="size-5 shrink-0 text-warning" />
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold tracking-tight">
                  {allReady
                    ? "Everything is submission-ready."
                    : anyFailed
                      ? `${summary.failed} document${summary.failed === 1 ? "" : "s"} still need changes.`
                      : "Ready — with a few things worth double-checking."}
                </span>
                <span className="text-xs text-muted-foreground">
                  {summary.passed} valid · {summary.warned} to check · {summary.failed} to
                  fix · {items.length} total
                </span>
              </div>
            </div>

            {allReady ? (
              <ul className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                    <span className="font-medium text-foreground">
                      {slotById(item.slotId).label}
                    </span>
                    <span className="truncate">
                      {item.prepared?.name ?? item.file.name}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[11px]">
                      {formatBytes(item.facts.size)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {zipFiles.length > 1 ? (
                <DownloadAllButton
                  files={zipFiles}
                  zipName="submitready-application-pack.zip"
                  label="Download all files as ZIP"
                />
              ) : zipFiles.length === 1 ? (
                <DownloadButton
                  blob={zipFiles[0].blob}
                  filename={zipFiles[0].name}
                  label="Download file"
                  size={zipFiles[0].blob.size}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const blob = new Blob([reportText()], { type: "text/plain" });
                  downloadBlob(blob, "submitready-checklist.txt");
                  toast.success("Checklist report downloaded");
                }}
              >
                <Download className="size-4" />
                Download checklist (.txt)
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={() => {
                  clear();
                  toast("Pack cleared", {
                    description: "All files were removed from this browser session.",
                  });
                }}
              >
                <Trash2 className="size-4" />
                Start a new pack
              </Button>
            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Loader2 className="mt-0.5 size-3.5 shrink-0" />
              Your application documents are never uploaded. The pack lives in this
              browser tab and disappears when you close or reload it.
            </p>
          </div>
        )}
      </ToolStep>
    </div>
  );
}
