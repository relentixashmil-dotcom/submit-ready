import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRunLog } from "@/hooks/use-run-log";
import { compressImage, prepareImageForPdf, resizeImage } from "@/lib/image";
import { imagesToPdf, readPdfInfo, splitPdf } from "@/lib/pdf";
import { compressPdf, type CompressionLevel } from "@/lib/pdf-compress";
import {
  type FileFacts,
  type PackAction,
  type Requirement,
  type SlotId,
  type ValidationResult,
  inspectFile,
  slotById,
  validateAgainstRequirement,
} from "@/lib/requirements";
import {
  MB,
  baseNameOf,
  bytesToBlob,
  describeError,
  formatBytes,
  readAsArrayBuffer,
  suffixName,
  uid,
} from "@/lib/format";

export interface PreparedFile {
  blob: Blob;
  name: string;
  facts: FileFacts;
  /** What the one-click fix did, shown in the checklist. */
  action: string;
  note?: string;
}

export interface PackItem {
  id: string;
  slotId: SlotId;
  requirement: Requirement;
  /** The file as added, or the fixed version once a fix has run. */
  file: File;
  facts: FileFacts;
  validation: ValidationResult | null;
  inspecting: boolean;
  runningAction: string | null;
  error: string | null;
  prepared: PreparedFile | null;
}

interface PackContextValue {
  items: PackItem[];
  addFiles: (slotId: SlotId, files: File[]) => void;
  addFilesAuto: (files: File[]) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  updateRequirement: (id: string, requirement: Requirement) => void;
  runAction: (id: string, action: PackAction) => Promise<void>;
  /** Queue a file so a full tool page can open with it already loaded. */
  stageForTool: (file: File) => void;
  consumeHandoff: () => File | null;
  summary: { total: number; passed: number; warned: number; failed: number };
  reportText: () => string;
  /**
   * The saved preset this slot starts from, if any. Personal presets win over
   * the global ones an administrator publishes.
   */
  presetFor: (slotId: SlotId) => { name: string; requirement: Requirement } | null;
}

const PackContext = createContext<PackContextValue | null>(null);

function guessSlot(facts: FileFacts): SlotId {
  if (facts.kind === "pdf") {
    if (facts.pageCount && facts.pageCount > 4) return "mark-sheet";
    return "resume";
  }
  if (facts.kind === "image") {
    const ratio = (facts.width ?? 1) / (facts.height ?? 1);
    return ratio > 1.6 ? "signature" : "photograph";
  }
  return "other";
}

interface PresetLike {
  name: string;
  slotId: string;
  extensions: string[];
  minBytes?: number;
  maxBytes?: number;
  exactWidth?: number;
  exactHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPages?: number;
}

function presetToRequirement(preset: PresetLike): Requirement {
  return {
    extensions: preset.extensions,
    minBytes: preset.minBytes,
    maxBytes: preset.maxBytes,
    exactWidth: preset.exactWidth,
    exactHeight: preset.exactHeight,
    maxWidth: preset.maxWidth,
    maxHeight: preset.maxHeight,
    maxPages: preset.maxPages,
  };
}

function levelForTarget(targetBytes?: number): CompressionLevel {
  if (!targetBytes) return "balanced";
  if (targetBytes <= 150 * 1024) return "strong";
  if (targetBytes >= MB) return "balanced";
  return "balanced";
}

export function PackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PackItem[]>([]);
  const handoffRef = useRef<File | null>(null);
  const itemsRef = useRef<PackItem[]>([]);
  itemsRef.current = items;

  // Presets published by an administrator (global) and saved by the viewer
  // (personal) decide what a slot starts from, so the pack matches the rules a
  // form actually asked for without retyping them.
  const logRun = useRunLog();
  const presets = useQuery(api.presets.list);
  const presetMap = useMemo(() => {
    const map = new Map<string, { name: string; requirement: Requirement }>();
    for (const preset of presets?.global ?? []) {
      map.set(preset.slotId, {
        name: preset.name,
        requirement: presetToRequirement(preset),
      });
    }
    for (const preset of presets?.personal ?? []) {
      map.set(preset.slotId, {
        name: preset.name,
        requirement: presetToRequirement(preset),
      });
    }
    return map;
  }, [presets]);

  const presetFor = useCallback(
    (slotId: SlotId) => presetMap.get(slotId) ?? null,
    [presetMap],
  );

  const inspect = useCallback(
    async (id: string, file: File, requirement: Requirement) => {
      try {
        const facts = await inspectFile(file);
        const validation = validateAgainstRequirement(requirement, facts);
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  facts,
                  validation,
                  inspecting: false,
                  error: facts.kind === "other" && !facts.type
                    ? "This file type isn't supported yet."
                    : null,
                }
              : item,
          ),
        );
      } catch (error) {
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  inspecting: false,
                  error: describeError(error, "This file couldn't be read."),
                }
              : item,
          ),
        );
      }
    },
    [],
  );

  const addFilesWithSlot = useCallback(
    (slotId: SlotId, files: File[], requirementOverride?: Requirement) => {
      const fresh = files.map((file) => {
        const slot = slotById(slotId);
        const id = uid("pack");
        const saved = presetMap.get(slotId);
        return {
          id,
          slotId,
          requirement: requirementOverride ??
            (saved ? { ...saved.requirement } : { ...slot.requirement }),
          file,
          facts: {
            name: file.name,
            size: file.size,
            type: file.type,
            extension: file.name.split(".").pop()?.toLowerCase() ?? "",
            kind: "other" as const,
          },
          validation: null,
          inspecting: true,
          runningAction: null,
          error: null,
          prepared: null,
        } satisfies PackItem;
      });

      setItems((current) => [...current, ...fresh]);
      fresh.forEach((item) => {
        void inspect(item.id, item.file, item.requirement);
      });
    },
    [inspect, presetMap],
  );

  const addFiles = useCallback(
    (slotId: SlotId, files: File[]) => addFilesWithSlot(slotId, files),
    [addFilesWithSlot],
  );

  const addFilesAuto = useCallback(
    async (files: File[]) => {
      // Inspect first so each file lands in a sensible slot automatically.
      for (const file of files) {
        let slotId: SlotId = "other";
        try {
          const facts = await inspectFile(file);
          slotId = guessSlot(facts);
          addFilesWithSlot(slotId, [file]);
        } catch {
          addFilesWithSlot(slotId, [file]);
        }
      }
    },
    [addFilesWithSlot],
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const updateRequirement = useCallback(
    (id: string, requirement: Requirement) => {
      setItems((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            requirement,
            validation: validateAgainstRequirement(requirement, item.facts),
          };
        }),
      );
    },
    [],
  );

  const stageForTool = useCallback((file: File) => {
    handoffRef.current = file;
  }, []);

  const consumeHandoff = useCallback(() => {
    const file = handoffRef.current;
    handoffRef.current = null;
    return file;
  }, []);

  const runAction = useCallback(
    async (id: string, action: PackAction) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!item) return;

      setItems((current) =>
        current.map((entry) =>
          entry.id === id
            ? { ...entry, runningAction: action.label, error: null }
            : entry,
        ),
      );

      try {
        const { file, requirement } = item;
        let blob: Blob;
        let name: string;
        let note: string | undefined;

        switch (action.kind) {
          case "compress-image": {
            const output = await compressImage(file, {
              targetBytes: action.targetBytes ?? requirement.maxBytes ?? null,
              quality: 0.82,
            });
            blob = output.blob;
            name = suffixName(file.name, "ready", output.format === "jpeg" ? "jpg" : output.format);
            note = output.metTarget
              ? `Compressed to ${formatBytes(output.outputBytes)} at ${output.width} × ${output.height} px.`
              : `${formatBytes(output.outputBytes)} was the smallest possible size — ${output.notes[0] ?? "the target could not be reached."}`;
            break;
          }

          case "compress-pdf": {
            const bytes = new Uint8Array(await readAsArrayBuffer(file));
            const result = await compressPdf(bytes, {
              level: levelForTarget(action.targetBytes),
              targetBytes: action.targetBytes ?? requirement.maxBytes ?? null,
            });
            blob = bytesToBlob(result.bytes, "application/pdf");
            name = suffixName(file.name, "ready", "pdf");
            note = result.metTarget
              ? `Compressed to ${formatBytes(result.finalBytes)}.`
              : `${formatBytes(result.finalBytes)} was the smallest this browser could produce for that PDF.`;
            break;
          }

          case "resize": {
            const width = action.width ?? requirement.exactWidth ?? 350;
            const height = action.height ?? requirement.exactHeight ?? 350;
            const wantsJpeg = requirement.extensions.some(
              (ext) => ext === "jpg" || ext === "jpeg",
            );
            const output = await resizeImage(file, {
              mode: "exact",
              width,
              height,
              keepAspectRatio: true,
              crop: true,
              format: wantsJpeg ? "jpeg" : "original",
              background: wantsJpeg ? "#ffffff" : null,
            });
            blob = output.blob;
            const ext = output.format === "jpeg" ? "jpg" : output.format;
            name = suffixName(file.name, `${width}x${height}`, ext);
            note = `Resized to exactly ${output.width} × ${output.height} px.`;
            break;
          }

          case "to-pdf": {
            const image = await prepareImageForPdf(file, { quality: 0.85 });
            const result = await imagesToPdf([image], {
              pageSize: "a4",
              orientation: "auto",
              margin: 0,
            });
            blob = bytesToBlob(result.bytes, "application/pdf");
            name = suffixName(file.name, "converted", "pdf");
            note = "Converted to a single-page PDF.";
            break;
          }

          case "to-jpg": {
            const output = await compressImage(file, {
              format: "jpeg",
              quality: 0.9,
              targetBytes: requirement.maxBytes ?? null,
            });
            blob = output.blob;
            name = suffixName(file.name, "converted", "jpg");
            note = `Converted to JPG at ${formatBytes(output.outputBytes)}.`;
            break;
          }

          case "limit-pages": {
            const bytes = new Uint8Array(await readAsArrayBuffer(file));
            const pages = action.pages ?? requirement.maxPages ?? 1;
            const result = await splitPdf(bytes, file.name, [
              {
                label: `first-${pages}`,
                pages: Array.from({ length: pages }, (_, index) => index + 1),
              },
            ]);
            const first = result.outputs[0];
            blob = bytesToBlob(first.bytes, "application/pdf");
            name = suffixName(file.name, `first-${pages}`, "pdf");
            note = `Kept the first ${first.pageCount} page${first.pageCount === 1 ? "" : "s"}.`;
            break;
          }

          default: {
            throw new Error("That fix isn't available for this file.");
          }
        }

        const fixedFile = new File([blob], name, {
          type: blob.type || "application/octet-stream",
        });
        const facts = await inspectFile(fixedFile);
        const validation = validateAgainstRequirement(requirement, facts);

        setItems((current) =>
          current.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  file: fixedFile,
                  facts,
                  validation,
                  inspecting: false,
                  runningAction: null,
                  prepared: {
                    blob,
                    name,
                    facts,
                    action: action.label,
                    note,
                  },
                }
              : entry,
          ),
        );

        void logRun({
          tool: "application-pack",
          label: `${item.file.name} → ${name}`,
          fileCount: 1,
          inputBytes: file.size,
          outputBytes: blob.size,
          status: validation.status === "pass" ? "ok" : "partial",
          detail: action.label,
        });
      } catch (error) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  runningAction: null,
                  error: describeError(error, "That fix could not be completed."),
                }
              : entry,
          ),
        );
      }
    },
    [logRun],
  );

  const summary = useMemo(() => {
    let passed = 0;
    let warned = 0;
    let failed = 0;
    for (const item of items) {
      if (!item.validation) continue;
      if (item.validation.status === "pass") passed += 1;
      else if (item.validation.status === "warn") warned += 1;
      else failed += 1;
    }
    return { total: items.length, passed, warned, failed };
  }, [items]);

  const reportText = useCallback(() => {
    const lines: string[] = [
      "SubmitReady — application checklist",
      `Generated ${new Date().toLocaleString()}`,
      "",
    ];
    for (const item of items) {
      const slot = slotById(item.slotId);
      const status = item.validation?.status ?? "unknown";
      const icon = status === "pass" ? "[OK]" : status === "warn" ? "[CHECK]" : "[FAIL]";
      lines.push(`${icon} ${slot.label}: ${item.prepared?.name ?? item.file.name}`);
      lines.push(`     size: ${formatBytes(item.facts.size)}`);
      if (item.facts.kind === "image" && item.facts.width) {
        lines.push(`     dimensions: ${item.facts.width} × ${item.facts.height} px`);
      }
      if (item.facts.pageCount && item.facts.pageCount > 0) {
        lines.push(`     pages: ${item.facts.pageCount}`);
      }
      item.validation?.checks.forEach((check) => {
        const mark = check.status === "pass" ? "  +" : check.status === "warn" ? "  !" : "  x";
        lines.push(`${mark} ${check.label}: ${check.detail}`);
      });
      lines.push("");
    }
    lines.push(
      "All processing happened locally in the browser. No files were uploaded.",
    );
    lines.push(
      "Account and run metadata may be stored by SubmitReady; document contents are not.",
    );
    return lines.join("\n");
  }, [items]);

  const value = useMemo<PackContextValue>(
    () => ({
      items,
      addFiles,
      addFilesAuto,
      removeItem,
      clear,
      updateRequirement,
      runAction,
      stageForTool,
      consumeHandoff,
      summary,
      reportText,
      presetFor,
    }),
    [
      items,
      addFiles,
      addFilesAuto,
      removeItem,
      clear,
      updateRequirement,
      runAction,
      stageForTool,
      consumeHandoff,
      summary,
      reportText,
      presetFor,
    ],
  );

  return <PackContext.Provider value={value}>{children}</PackContext.Provider>;
}

export function usePack(): PackContextValue {
  const context = useContext(PackContext);
  if (!context) {
    throw new Error("usePack must be used inside a PackProvider.");
  }
  return context;
}

/** Convenience helper: the bytes a user should download for an item. */
export function itemDownload(item: PackItem): { blob: Blob; name: string } {
  if (item.prepared) {
    return { blob: item.prepared.blob, name: item.prepared.name };
  }
  return { blob: item.file, name: baseNameOf(item.file.name) + "." + item.facts.extension };
}
