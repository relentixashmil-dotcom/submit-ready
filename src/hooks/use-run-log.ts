import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./use-auth";
import type { ToolKind } from "@/lib/seo";

export type RunStatus = "ok" | "partial" | "failed";

export interface RunEntry {
  tool: ToolKind;
  /** A filename or short description — never file contents. */
  label: string;
  fileCount: number;
  inputBytes: number;
  outputBytes: number;
  status?: RunStatus;
  detail?: string;
}

/**
 * Records what a tool did, so it shows up in the workspace history and the admin
 * activity feed. Silently skips guests and never blocks the tool itself.
 */
export function useRunLog() {
  const { isAuthenticated } = useAuth();
  const record = useMutation(api.runs.record);

  return useCallback(
    async (entry: RunEntry) => {
      if (!isAuthenticated) return;
      try {
        await record({
          tool: entry.tool,
          label: entry.label,
          fileCount: entry.fileCount,
          inputBytes: entry.inputBytes,
          outputBytes: entry.outputBytes,
          status: entry.status ?? "ok",
          detail: entry.detail,
        });
      } catch (error) {
        // Recording is a convenience, never a requirement for the tool to work.
        console.warn("[SubmitReady] run not recorded:", error);
      }
    },
    [isAuthenticated, record],
  );
}
