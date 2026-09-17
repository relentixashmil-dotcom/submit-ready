import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Activity,
  Check,
  Gauge,
  Loader2,
  Megaphone,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsolePanel, ConsoleShell, StatCard } from "@/components/console/ConsoleShell";
import { RequirementFields } from "@/components/RequirementFields";
import { useAccount } from "@/hooks/use-account";
import { PACK_SLOTS } from "@/lib/requirements";
import type { Requirement } from "@/lib/requirements";
import { formatBytes, formatRelativeTime, reductionPercent } from "@/lib/format";
import { TOOLS } from "@/lib/seo";
import { cn } from "@/lib/utils";

const ROLE_ORDER = ["admin", "member", "user"] as const;
type Role = (typeof ROLE_ORDER)[number];

const RUN_STATUS_STYLES: Record<string, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  partial: "border-warning/40 bg-warning/10 text-warning",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

const TONES = ["info", "success", "warning"] as const;

const EMPTY_REQUIREMENT: Requirement = {
  extensions: ["jpg", "png"],
  minBytes: 10 * 1024,
  maxBytes: 200 * 1024,
};

function toolLabel(slug: string): string {
  const match = Object.values(TOOLS).find((tool) => tool.kind === slug);
  return match?.name ?? slug;
}

export default function AdminConsole() {
  const [tab, setTab] = useState("overview");
  const account = useAccount();

  const overview = useQuery(api.admin.overview);
  const accounts = useQuery(api.admin.users);
  const registry = useQuery(api.tools.list);
  const presets = useQuery(api.presets.list);
  const activity = useQuery(api.runs.listRecent);
  const settings = useQuery(api.settings.get);

  const setRole = useMutation(api.admin.setRole);
  const bootstrap = useMutation(api.admin.bootstrap);
  const setToolEnabled = useMutation(api.tools.setEnabled);
  const updateTool = useMutation(api.tools.update);
  const upsertGlobal = useMutation(api.presets.upsertGlobal);
  const removeGlobal = useMutation(api.presets.removeGlobal);
  const resetGlobals = useMutation(api.presets.resetGlobals);
  const setAnnouncement = useMutation(api.settings.setAnnouncement);

  const [bannerText, setBannerText] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("info");
  const [savingBanner, setSavingBanner] = useState(false);

  const [presetName, setPresetName] = useState("");
  const [presetSlot, setPresetSlot] = useState<string>(PACK_SLOTS[0].id as string);
  const [presetRequirement, setPresetRequirement] =
    useState<Requirement>(EMPTY_REQUIREMENT);
  const [savingPreset, setSavingPreset] = useState(false);

  const [toolDrafts, setToolDrafts] = useState<
    Record<string, { name: string; tagline: string; badge: string }>
  >({});

  useEffect(() => {
    if (settings === undefined) return;
    setBannerText(settings.announcement ?? "");
    setTone((settings.tone as (typeof TONES)[number]) ?? "info");
  }, [settings]);

  useEffect(() => {
    if (!registry) return;
    setToolDrafts((current) => {
      const next = { ...current };
      for (const tool of registry) {
        const key = String(tool._id);
        if (!next[key]) {
          next[key] = {
            name: tool.name,
            tagline: tool.tagline,
            badge: tool.badge ?? "",
          };
        }
      }
      return next;
    });
  }, [registry]);

  const savedPercent = overview
    ? reductionPercent(overview.runs.inputBytes, overview.runs.outputBytes)
    : 0;

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of accounts ?? []) {
      counts[entry.role] = (counts[entry.role] ?? 0) + 1;
    }
    return counts;
  }, [accounts]);

  const nav = [
    { id: "overview", label: "Overview", icon: <Gauge className="size-4" /> },
    {
      id: "accounts",
      label: "Accounts",
      icon: <Users className="size-4" />,
      meta: accounts ? String(accounts.length) : undefined,
    },
    {
      id: "tools",
      label: "Tools",
      icon: <Sliders className="size-4" />,
      meta: registry ? String(registry.length) : undefined,
    },
    {
      id: "presets",
      label: "Presets",
      icon: <Upload className="size-4" />,
      meta: presets ? String(presets.global.length) : undefined,
    },
    { id: "broadcast", label: "Broadcast", icon: <Megaphone className="size-4" /> },
    { id: "activity", label: "Activity", icon: <Activity className="size-4" /> },
  ];

  return (
    <ConsoleShell
      eyebrow="admin console"
      title="Deployment control"
      description="Accounts, roles, the tool registry, upload presets and the site-wide announcement. Documents themselves stay on the visitor's device."
      nav={nav}
      activeId={tab}
      onNavigate={setTab}
      aside={
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          <span className="mono-label">signed in as</span>
          <span className="truncate text-sm font-medium">{account.email ?? "—"}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            role: {account.role} ·
            {` ${account.adminCount} admin${account.adminCount === 1 ? "" : "s"}`}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            admin exists: {account.adminExists ? "yes" : "no"}
          </span>
        </div>
      }
    >
      {tab === "overview" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="accounts"
              value={String(overview?.accounts.total ?? 0)}
              hint={`${overview?.accounts.emailAccounts ?? 0} with an email address`}
            />
            <StatCard
              label="admins"
              value={String(overview?.accounts.admins ?? 0)}
              hint="accounts that can open this console"
              accent="brand-2"
            />
            <StatCard
              label="guests"
              value={String(overview?.accounts.guests ?? 0)}
              hint="browser-only sessions"
              accent="brand-3"
            />
            <StatCard
              label="new this week"
              value={String(overview?.accounts.newLastWeek ?? 0)}
              hint={`${overview?.accounts.newLast24h ?? 0} in the last 24 hours`}
              accent="brand-4"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="operations sampled"
              value={String(overview?.runs.sampled ?? 0)}
              hint={`${overview?.runs.last24h ?? 0} in the last 24 hours`}
              accent="brand-5"
            />
            <StatCard
              label="data in"
              value={formatBytes(overview?.runs.inputBytes ?? 0)}
              hint="original files opened by accounts"
              accent="brand-6"
            />
            <StatCard
              label="data out"
              value={formatBytes(overview?.runs.outputBytes ?? 0)}
              hint="files produced for upload"
              accent="brand-7"
            />
            <StatCard
              label="saved"
              value={formatBytes(overview?.runs.savedBytes ?? 0)}
              hint={`${savedPercent}% smaller on average`}
              accent="brand-1"
            />
          </div>

          <ConsolePanel
            monoLabel="registry"
            title="Tool health"
            description="Enable or retire a tool without shipping a new build. Disabled tools stay visible but stop accepting files."
            actions={
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setTab("tools")}
              >
                <Sliders className="size-3.5" />
                Manage registry
              </Button>
            }
          >
            {registry === undefined ? (
              <Loading label="loading registry…" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {registry.map((tool) => (
                  <div
                    key={String(tool._id)}
                    className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {tool.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {tool.slug} · {tool.runCount ?? 0} runs
                      </span>
                    </span>
                    <Badge variant={tool.enabled ? "default" : "secondary"}>
                      {tool.enabled ? "live" : "hidden"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ConsolePanel>

          <ConsolePanel
            monoLabel="pipeline"
            title="Latest operations"
            description="Metadata only: filenames, byte counts, outcomes. No document contents are stored anywhere."
          >
            <RecentRunsTable
              runs={overview?.recent ?? []}
              loading={overview === undefined}
            />
          </ConsolePanel>
        </>
      ) : null}

      {tab === "accounts" ? (
        <ConsolePanel
          monoLabel="accounts.roles"
          title="Accounts and roles"
          description="Promote a member to admin, or dial someone back to a plain account. You cannot change your own role, and the last admin cannot be demoted."
        >
          <div className="flex flex-wrap gap-3 font-mono text-xs text-muted-foreground">
            {ROLE_ORDER.map((role) => (
              <span key={role}>
                {role}: {roleCounts[role] ?? 0}
              </span>
            ))}
          </div>

          {accounts === undefined ? (
            <Loading label="loading accounts…" />
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts on this deployment yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="mono-label py-2 pr-3 font-normal">account</th>
                    <th className="mono-label py-2 pr-3 font-normal">role</th>
                    <th className="mono-label py-2 pr-3 font-normal">runs</th>
                    <th className="mono-label py-2 pr-3 font-normal">traffic</th>
                    <th className="mono-label py-2 font-normal">set role</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((entry) => (
                    <tr key={String(entry.id)} className="border-b border-border/60">
                      <td className="max-w-64 py-2 pr-3">
                        <span className="block truncate font-medium">
                          {entry.name ?? entry.email ?? "guest account"}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {entry.email ?? "no email"}
                          {entry.isAnonymous ? " · guest" : ""}
                          {` · since ${formatRelativeTime(entry.joinedAt)}`}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={entry.role === "admin" ? "default" : "secondary"}>
                          {entry.role}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {entry.runCount}
                        {entry.lastRunAt ? (
                          <span className="block text-[11px] text-muted-foreground">
                            {formatRelativeTime(entry.lastRunAt)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                        {formatBytes(entry.inputBytes)} → {formatBytes(entry.outputBytes)}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {ROLE_ORDER.map((role) => (
                            <Button
                              key={role}
                              type="button"
                              size="sm"
                              variant={entry.role === role ? "default" : "outline"}
                              aria-pressed={entry.role === role}
                              disabled={entry.role === role}
                              onClick={async () => {
                                try {
                                  await setRole({ userId: entry.id, role });
                                  toast.success(`${entry.email ?? "Account"} is now ${role}`);
                                } catch (error) {
                                  toast.error("Could not change the role", {
                                    description:
                                      error instanceof Error
                                        ? error.message
                                        : undefined,
                                  });
                                }
                              }}
                            >
                              {role}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ConsolePanel>
      ) : null}

      {tab === "tools" ? (
        <>
          <ConsolePanel
            monoLabel="registry.tools"
            title="Tool registry"
            description="Names, taglines and badges here drive navigation, cards and the workspace launchpad. Every tool records its own run counts."
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const result = await bootstrap({});
                  toast.success("Catalog seeded", {
                    description: `${result.seededTools} tools and ${result.seededPresets} presets added where missing.`,
                  });
                }}
              >
                <RefreshCw className="size-3.5" />
                Re-seed catalog
              </Button>
            }
          >
            {registry === undefined ? (
              <Loading label="loading registry…" />
            ) : (
              <ul className="flex flex-col gap-3">
                {registry.map((tool) => {
                  const key = String(tool._id);
                  const draft = toolDrafts[key] ?? {
                    name: tool.name,
                    tagline: tool.tagline,
                    badge: tool.badge ?? "",
                  };
                  return (
                    <li
                      key={key}
                      className="flex flex-col gap-3 rounded-lg border bg-background/40 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {tool.slug}
                        </span>
                        <Badge variant={tool.enabled ? "default" : "secondary"}>
                          {tool.enabled ? "live" : "hidden"}
                        </Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          order {tool.order} · {tool.runCount ?? 0} runs
                        </span>
                        <div className="ml-auto flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await setToolEnabled({
                                id: tool._id,
                                enabled: !tool.enabled,
                              });
                              toast(
                                tool.enabled
                                  ? `${tool.name} is now hidden`
                                  : `${tool.name} is live again`,
                              );
                            }}
                          >
                            {tool.enabled ? "Hide" : "Publish"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2"
                            disabled={
                              draft.name === tool.name &&
                              draft.tagline === tool.tagline &&
                              draft.badge === (tool.badge ?? "")
                            }
                            onClick={async () => {
                              await updateTool({
                                id: tool._id,
                                name: draft.name,
                                tagline: draft.tagline,
                                badge: draft.badge,
                              });
                              toast.success(`${draft.name} updated`);
                            }}
                          >
                            <Save className="size-3.5" />
                            Save
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`${key}-name`}>Name</Label>
                          <Input
                            id={`${key}-name`}
                            value={draft.name}
                            onChange={(event) =>
                              setToolDrafts((current) => ({
                                ...current,
                                [key]: { ...draft, name: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`${key}-badge`}>Badge</Label>
                          <Input
                            id={`${key}-badge`}
                            value={draft.badge}
                            placeholder="exact target"
                            onChange={(event) =>
                              setToolDrafts((current) => ({
                                ...current,
                                [key]: { ...draft, badge: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 sm:col-span-3">
                          <Label htmlFor={`${key}-tagline`}>Tagline</Label>
                          <Input
                            id={`${key}-tagline`}
                            value={draft.tagline}
                            onChange={(event) =>
                              setToolDrafts((current) => ({
                                ...current,
                                [key]: { ...draft, tagline: event.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ConsolePanel>
        </>
      ) : null}

      {tab === "presets" ? (
        <>
          <ConsolePanel
            monoLabel="presets.new"
            title="Publish a requirement preset"
            description="Global presets are the defaults every visitor sees. Use them to encode the upload rules an exam, scholarship or employer keeps repeating."
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const result = await resetGlobals({});
                  toast.success("Defaults restored", {
                    description: `${result.restored} presets restored.`,
                  });
                }}
              >
                <RefreshCw className="size-3.5" />
                Restore defaults
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="global-preset-name">Preset name</Label>
                <Input
                  id="global-preset-name"
                  value={presetName}
                  placeholder="SSC CGL photograph"
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
                    await upsertGlobal({
                      name: presetName,
                      description: `Global preset for the ${presetSlot} slot.`,
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
                    toast.success("Global preset published");
                  } catch (error) {
                    toast.error("Could not publish the preset", {
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
                  <Sparkles className="size-4" />
                )}
                Publish preset
              </Button>
            </div>
          </ConsolePanel>

          <ConsolePanel
            monoLabel="presets.global"
            title="Live presets"
            description="Visible to every visitor, including signed-out ones, in the Application Pack."
          >
            {presets === undefined ? (
              <Loading label="loading presets…" />
            ) : presets.global.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No global presets yet. Publish one above or restore the defaults.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {presets.global.map((preset) => (
                  <li
                    key={String(preset._id)}
                    className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {preset.name}
                        </span>
                        {preset.builtIn ? (
                          <Badge variant="secondary">shipped</Badge>
                        ) : null}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {preset.slotId} ·{" "}
                        {preset.extensions.map((ext) => ext.toUpperCase()).join("/") ||
                          "any type"}
                        {preset.maxBytes ? ` · max ${formatBytes(preset.maxBytes)}` : ""}
                        {preset.minBytes ? ` · min ${formatBytes(preset.minBytes)}` : ""}
                        {preset.maxPages ? ` · ${preset.maxPages} pages` : ""}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${preset.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await removeGlobal({ id: preset._id });
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

      {tab === "broadcast" ? (
        <ConsolePanel
          monoLabel="settings.announcement"
          title="Site-wide announcement"
          description="Shown as a banner above the header on every page. Leave it empty to hide the banner."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="announcement">Message</Label>
              <Input
                id="announcement"
                value={bannerText}
                maxLength={200}
                placeholder="New: save your requirement presets to your account."
                onChange={(event) => setBannerText(event.target.value)}
              />
              <span className="font-mono text-[11px] text-muted-foreground">
                {bannerText.length}/200 characters
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {TONES.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={tone === option ? "default" : "outline"}
                  aria-pressed={tone === option}
                  onClick={() => setTone(option)}
                >
                  {option}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="w-fit gap-2"
                disabled={savingBanner}
                onClick={async () => {
                  setSavingBanner(true);
                  try {
                    await setAnnouncement({ announcement: bannerText, tone });
                    toast.success(
                      bannerText.trim().length > 0
                        ? "Announcement published"
                        : "Announcement cleared",
                    );
                  } catch (error) {
                    toast.error("Could not save the announcement", {
                      description:
                        error instanceof Error ? error.message : undefined,
                    });
                  } finally {
                    setSavingBanner(false);
                  }
                }}
              >
                {savingBanner ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Save announcement
              </Button>
              {settings?.updatedAt ? (
                <span className="font-mono text-[11px] text-muted-foreground">
                  last updated {formatRelativeTime(settings.updatedAt)}
                </span>
              ) : null}
            </div>
          </div>
        </ConsolePanel>
      ) : null}

      {tab === "activity" ? (
        <ConsolePanel
          monoLabel="audit.feed"
          title="Activity feed"
          description="The 60 most recent operations across every account."
        >
          {activity === undefined ? (
            <Loading label="loading activity…" />
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been recorded yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {activity.map((run) => (
                <li
                  key={String(run._id)}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="mono-label w-32 shrink-0 truncate">
                    {toolLabel(run.tool)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{run.label}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {run.account?.email ?? "guest"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase",
                      RUN_STATUS_STYLES[run.status] ?? RUN_STATUS_STYLES.ok,
                    )}
                  >
                    {run.status}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatRelativeTime(run.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ConsolePanel>
      ) : null}
    </ConsoleShell>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </span>
  );
}

function RecentRunsTable({
  runs,
  loading,
}: {
  runs: {
    id: string;
    tool: string;
    label: string;
    status: string;
    inputBytes: number;
    outputBytes: number;
    createdAt: number;
    fileCount: number;
  }[];
  loading: boolean;
}) {
  if (loading) return <Loading label="loading runs…" />;
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing recorded yet. Sign in, run any tool, and it will appear here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {runs.map((run) => (
        <li
          key={run.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
        >
          <span className="mono-label w-32 shrink-0 truncate">
            {toolLabel(run.tool)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{run.label}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {run.fileCount} file{run.fileCount === 1 ? "" : "s"}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatBytes(run.inputBytes)} → {formatBytes(run.outputBytes)}
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase",
              RUN_STATUS_STYLES[run.status] ?? RUN_STATUS_STYLES.ok,
            )}
          >
            {run.status}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatRelativeTime(run.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}