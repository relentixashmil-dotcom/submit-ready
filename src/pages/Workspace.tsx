import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Activity,
  BadgeCheck,
  Bookmark,
  ClipboardList,
  Gauge,
  History,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsolePanel, ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { RequirementFields } from "@/components/RequirementFields";
import { ToolCard } from "@/components/ToolCard";
import { toolIcon } from "@/components/ToolPageShell";
import { useAccount } from "@/hooks/use-account";
import { useAuth } from "@/hooks/use-auth";
import { usePack } from "@/context/pack";
import { PRIMARY_TOOL_ORDER, TOOLS } from "@/lib/seo";
import { PACK_SLOTS } from "@/lib/requirements";
import type { Requirement } from "@/lib/requirements";
import { formatBytes, formatRelativeTime, reductionPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  partial: "border-warning/40 bg-warning/10 text-warning",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

function toolLabel(slug: string): string {
  const match = Object.values(TOOLS).find((tool) => tool.kind === slug);
  return match?.name ?? slug;
}

export default function Workspace() {
  const [tab, setTab] = useState("overview");
  const account = useAccount();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { summary, clear, items } = usePack();

  const summaryMine = useQuery(api.runs.summaryMine);
  const runs = useQuery(api.runs.listMine);
  const presets = useQuery(api.presets.list);

  const createPreset = useMutation(api.presets.createPersonal);
  const removePreset = useMutation(api.presets.remove);
  const updateName = useMutation(api.profiles.updateName);
  const bootstrap = useMutation(api.admin.bootstrap);

  const [displayName, setDisplayName] = useState(account.name ?? "");
  const [savingName, setSavingName] = useState(false);

  const [presetName, setPresetName] = useState("");
  const [presetSlot, setPresetSlot] = useState(PACK_SLOTS[0].id as string);
  const [presetRequirement, setPresetRequirement] = useState<Requirement>({
    extensions: ["jpg", "png"],
    minBytes: 10 * 1024,
    maxBytes: 200 * 1024,
    exactWidth: 350,
    exactHeight: 350,
  });
  const [savingPreset, setSavingPreset] = useState(false);

  const nav = [
    { id: "overview", label: "Overview", icon: <Gauge className="size-4" /> },
    {
      id: "history",
      label: "History",
      icon: <History className="size-4" />,
      meta: summaryMine ? String(summaryMine.totalRuns) : undefined,
    },
    {
      id: "presets",
      label: "Presets",
      icon: <Bookmark className="size-4" />,
      meta: presets ? String(presets.personal.length) : undefined,
    },
    { id: "account", label: "Account", icon: <UserRound className="size-4" /> },
  ];

  const savedPercent = summaryMine
    ? reductionPercent(summaryMine.inputBytes, summaryMine.outputBytes)
    : 0;

  return (
    <ConsoleShell
      eyebrow="workspace"
      title={account.name ? account.name : "Your workspace"}
      description="Run history, saved requirement presets and account settings. Files themselves never leave your device."
      nav={nav}
      activeId={tab}
      onNavigate={setTab}
      aside={
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          <span className="mono-label">session</span>
          <span className="truncate text-sm font-medium">
            {account.email ?? "guest account"}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            role: {account.role}
            {account.isAnonymous ? " · local only" : ""}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 gap-2"
            onClick={() => void signOut().then(() => navigate("/"))}
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      }
    >
      {account.isAnonymous ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
          <Sparkles className="size-4 shrink-0 text-warning" />
          <p className="flex-1 text-sm">
            You are signed in as a guest, so this history only exists in this browser.
            Add an email address to keep it under a real account.
          </p>
          <Button asChild size="sm">
            <Link to="/auth?switch=1">Add an email</Link>
          </Button>
        </div>
      ) : null}

      {tab === "overview" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="runs recorded"
              value={String(summaryMine?.totalRuns ?? 0)}
              hint={
                summaryMine?.truncated
                  ? "counting the most recent 500"
                  : "operations logged on this account"
              }
            />
            <StatCard
              label="data in"
              value={formatBytes(summaryMine?.inputBytes ?? 0)}
              hint="original files you opened"
              accent="brand-2"
            />
            <StatCard
              label="data out"
              value={formatBytes(summaryMine?.outputBytes ?? 0)}
              hint="files you downloaded"
              accent="brand-3"
            />
            <StatCard
              label="saved"
              value={formatBytes(summaryMine?.savedBytes ?? 0)}
              hint={`${savedPercent}% smaller on average`}
              accent="brand-4"
            />
          </div>

          <ConsolePanel
            monoLabel="pipeline"
            title="Recent operations"
            description="Metadata only — filenames, sizes and outcomes. No document contents are ever stored."
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("history")}
                className="gap-2"
              >
                <Activity className="size-3.5" />
                Full history
              </Button>
            }
          >
            {runs === undefined ? (
              <span className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> loading runs…
              </span>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing recorded yet. Use any tool while signed in and it will show up
                here.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {runs.slice(0, 6).map((run) => (
                  <li
                    key={String(run._id)}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                  >
                    <span className="mono-label w-32 shrink-0 truncate">
                      {toolLabel(run.tool)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{run.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatBytes(run.inputBytes)} → {formatBytes(run.outputBytes)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatRelativeTime(run.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ConsolePanel>

          <ConsolePanel
            monoLabel="application pack"
            title="Pack in this session"
            description="Prepared files live in the browser tab. Recorded runs are only summaries."
            actions={
              <>
                <Button asChild size="sm" className="gap-2">
                  <Link to="/application-pack">
                    <ClipboardList className="size-3.5" />
                    Open the pack
                  </Link>
                </Button>
                {items.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      clear();
                      toast("Pack cleared for this session");
                    }}
                  >
                    Clear pack
                  </Button>
                ) : null}
              </>
            }
          >
            <div className="flex flex-wrap gap-3 font-mono text-xs text-muted-foreground">
              <span>files: {summary.total}</span>
              <span>valid: {summary.passed}</span>
              <span>to check: {summary.warned}</span>
              <span>to fix: {summary.failed}</span>
            </div>
          </ConsolePanel>

          <ConsolePanel
            monoLabel="launch"
            title="Jump back into a tool"
            description="Every tool records what it did once you are signed in."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PRIMARY_TOOL_ORDER.map((kind) => (
                <ToolCard
                  key={kind}
                  title={TOOLS[kind].name}
                  subtitle={TOOLS[kind].blurb}
                  to={TOOLS[kind].path}
                  icon={toolIcon(kind)}
                  accepts={TOOLS[kind].accepts}
                />
              ))}
            </div>
          </ConsolePanel>
        </>
      ) : null}

      {tab === "history" ? (
        <ConsolePanel
          monoLabel="audit"
          title="Run history"
          description="Up to the 40 most recent operations on this account."
        >
          {runs === undefined ? (
            <span className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> loading runs…
            </span>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="mono-label py-2 pr-3 font-normal">tool</th>
                    <th className="mono-label py-2 pr-3 font-normal">item</th>
                    <th className="mono-label py-2 pr-3 font-normal">files</th>
                    <th className="mono-label py-2 pr-3 font-normal">size</th>
                    <th className="mono-label py-2 pr-3 font-normal">status</th>
                    <th className="mono-label py-2 font-normal">when</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={String(run._id)} className="border-b border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">
                        {toolLabel(run.tool)}
                      </td>
                      <td className="max-w-56 truncate py-2 pr-3">{run.label}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{run.fileCount}</td>
                      <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                        {formatBytes(run.inputBytes)} → {formatBytes(run.outputBytes)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase",
                            STATUS_STYLES[run.status] ?? STATUS_STYLES.ok,
                          )}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {formatRelativeTime(run.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ConsolePanel>
      ) : null}

      {tab === "presets" ? (
        <>
          <ConsolePanel
            monoLabel="presets.save"
            title="Save a requirement preset"
            description="Store the exact limits a form asked for, then reuse them in the Application Pack without retyping."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preset-name">Preset name</Label>
                <Input
                  id="preset-name"
                  value={presetName}
                  placeholder="SSC CGL 2026 — photograph"
                  onChange={(event) => setPresetName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Document slot</Label>
                <div className="flex flex-wrap gap-2">
                  {PACK_SLOTS.map((slot) => (
                    <Button
                      key={slot.id}
                      type="button"
                      size="sm"
                      variant={presetSlot === slot.id ? "default" : "outline"}
                      aria-pressed={presetSlot === slot.id}
                      onClick={() => setPresetSlot(slot.id)}
                    >
                      {slot.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <RequirementFields
              requirement={presetRequirement}
              onChange={setPresetRequirement}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-2"
                disabled={savingPreset || presetName.trim().length === 0}
                onClick={async () => {
                  setSavingPreset(true);
                  try {
                    await createPreset({
                      name: presetName,
                      description: `Saved preset for the ${presetSlot} slot.`,
                      slotId: presetSlot,
                      extensions: presetRequirement.extensions,
                      minBytes: presetRequirement.minBytes,
                      maxBytes: presetRequirement.maxBytes,
                      exactWidth: presetRequirement.exactWidth,
                      exactHeight: presetRequirement.exactHeight,
                      maxWidth: presetRequirement.maxWidth,
                      maxHeight: presetRequirement.maxHeight,
                      maxPages: presetRequirement.maxPages,
                    });
                    setPresetName("");
                    toast.success("Preset saved");
                  } catch (error) {
                    toast.error("Could not save the preset", {
                      description:
                        error instanceof Error ? error.message : undefined,
                    });
                  } finally {
                    setSavingPreset(false);
                  }
                }}
              >
                {savingPreset ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save preset
              </Button>
            </div>
          </ConsolePanel>

          <ConsolePanel
            monoLabel="presets.mine"
            title="Your presets"
            description="Applied to any pack slot with one click."
          >
            {presets === undefined ? (
              <span className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> loading presets…
              </span>
            ) : presets.personal.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You haven&apos;t saved any presets yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {presets.personal.map((preset) => (
                  <li
                    key={String(preset._id)}
                    className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{preset.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {preset.slotId} ·{" "}
                        {preset.extensions.map((ext) => ext.toUpperCase()).join("/") || "any"}
                        {preset.maxBytes ? ` · max ${formatBytes(preset.maxBytes)}` : ""}
                        {preset.exactWidth && preset.exactHeight
                          ? ` · ${preset.exactWidth}×${preset.exactHeight}px`
                          : ""}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${preset.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await removePreset({ id: preset._id });
                        toast("Preset deleted");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ConsolePanel>
        </>
      ) : null}

      {tab === "account" ? (
        <>
          <ConsolePanel
            monoLabel="account.profile"
            title="Profile"
            description="Your display name appears in the console and in the admin account list."
          >
            <div className="flex flex-col gap-3 sm:max-w-sm">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  placeholder="Your name"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <Button
                type="button"
                className="w-fit gap-2"
                disabled={savingName}
                onClick={async () => {
                  setSavingName(true);
                  try {
                    await updateName({ name: displayName });
                    toast.success("Display name saved");
                  } catch (error) {
                    toast.error("Could not save your name", {
                      description:
                        error instanceof Error ? error.message : undefined,
                    });
                  } finally {
                    setSavingName(false);
                  }
                }}
              >
                {savingName ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BadgeCheck className="size-4" />
                )}
                Save name
              </Button>
            </div>
          </ConsolePanel>

          <ConsolePanel monoLabel="account.access" title="Access">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="mono-label">email</dt>
                <dd className="truncate text-sm">{account.email ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="mono-label">role</dt>
                <dd className="text-sm">
                  <Badge variant={account.isAdmin ? "default" : "secondary"}>
                    {account.role}
                  </Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="mono-label">account type</dt>
                <dd className="text-sm">
                  {account.isAnonymous ? "Guest (browser only)" : "Email account"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="mono-label">admins on this deployment</dt>
                <dd className="font-mono text-sm">{account.adminCount}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              {account.isAdmin ? (
                <Button asChild className="gap-2">
                  <Link to="/admin">
                    <ShieldCheck className="size-4" />
                    Open the admin console
                  </Link>
                </Button>
              ) : !account.adminExists ? (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={async () => {
                    const result = await bootstrap({});
                    toast[result.granted ? "success" : "warning"](
                      result.granted ? "Admin access granted" : "Admin already exists",
                      { description: result.reason },
                    );
                  }}
                >
                  <ShieldCheck className="size-4" />
                  Claim admin access
                </Button>
              ) : null}
            </div>
          </ConsolePanel>

          <ConsolePanel
            monoLabel="account.privacy"
            title="What is stored, and what is not"
            description="Runs record a filename, byte counts, the tool used and the outcome. Document contents, previews and prepared files stay in the browser."
          >
            <Button
              type="button"
              variant="outline"
              className="w-fit gap-2"
              onClick={() => void signOut().then(() => navigate("/"))}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </ConsolePanel>
        </>
      ) : null}
    </ConsoleShell>
  );
}
