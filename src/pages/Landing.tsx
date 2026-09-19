import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  History,
  Lock,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserRoundPlus,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toolIcon } from "@/components/ToolPageShell";
import { useSeo } from "@/hooks/use-seo";
import { useAuth } from "@/hooks/use-auth";
import { useAccount } from "@/hooks/use-account";
import {
  HOME_CARDS,
  POPULAR_REQUIREMENTS,
  PRIMARY_TOOL_ORDER,
  QUICK_ACTIONS,
  TOOLS,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.4 },
};

const STEPS = [
  {
    title: "Select a file",
    body: "Drag, drop or pick from your device — camera capture included on phones.",
  },
  {
    title: "Set the requirement",
    body: "Type the limit the form gave you: 100 KB, 350 × 350 px, 2 pages, A4.",
  },
  {
    title: "Preview the result",
    body: "See the actual output before you save it, with the real file size.",
  },
  {
    title: "Verify it passes",
    body: "Every rule gets a ✅, ⚠️ or ❌ with the numbers behind the verdict.",
  },
  {
    title: "Download",
    body: "One file, a batch, or a single ZIP — ready to upload straight away.",
  },
];

const ACCOUNT_FEATURES = [
  {
    icon: <History className="size-4" />,
    title: "Run history that stays put",
    body: "Every compression, conversion and merge is recorded as a summary you can look back at from your workspace.",
  },
  {
    icon: <Sliders className="size-4" />,
    title: "Requirement presets",
    body: "Save the exact limits a form asked for — type, size cap, pixel dimensions, page count — and reuse them in one click.",
  },
  {
    icon: <Gauge className="size-4" />,
    title: "Totals you can act on",
    body: "See how many files you prepared, how much data went in and out, and how much you saved overall.",
  },
  {
    icon: <ShieldCheck className="size-4" />,
    title: "An admin area for teams",
    body: "The first account on a deployment can take admin and run the whole thing from one console.",
  },
];

const HOME_FAQS = [
  {
    q: "Do I need an account to use SubmitReady?",
    a: "No. Every tool works without signing in, and your files never leave your browser either way. An account adds a workspace: run history, saved requirement presets and a central place to manage your settings. Guest sessions are offered too, and they keep that history in the browser only.",
  },
  {
    q: "Are my documents uploaded to a server?",
    a: "Not as files. Compression, resizing, PDF creation, merging, splitting and validation all run in your browser using canvas and JavaScript PDF libraries. Accounts store summaries — a filename, byte counts and the outcome — so the history and admin views have something to show. Document contents are never stored.",
  },
  {
    q: "Who can see my activity?",
    a: "You can, in your workspace. Administrators of the deployment can see the same summaries across accounts in the admin console, because that is what the console is for. If you would rather leave no trace at all, use a guest session or stay signed out.",
  },
  {
    q: "Is SubmitReady free?",
    a: "Yes. There is no trial and no paywalled export. Because processing happens on your device, there are no per-file server costs to pass on — which is also why the tools can stay free.",
  },
  {
    q: "What is the admin console for?",
    a: "It is a control room for the deployment: manage accounts and roles, enable or retire tools, publish the global requirement presets everyone sees, post a site-wide announcement, and watch aggregate activity. The first account on a fresh deployment can claim admin from the console or from the workspace.",
  },
  {
    q: "What if my file can't reach the required size?",
    a: "You'll be told plainly, with the real result and a reason. A photo that is already heavily compressed, or a PDF that is already optimised, may not shrink further — SubmitReady shows the smallest version it produced instead of claiming success.",
  },
  {
    q: "Does compressing a PDF break the text?",
    a: "It depends on the level. Light rebuilds the file structure losslessly, so text stays selectable. Balanced, Strong and Extreme re-render pages as high-quality images, which shrinks scans dramatically but turns text into pixels. The trade-off is stated on every level.",
  },
];

/** Small technical readout used in the hero panel. */
function ReadoutRow({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "success" | "warning";
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="mono-label w-28 shrink-0">{label}</span>
      <span
        className={cn(
          "truncate font-mono text-xs",
          tone === "success"
            ? "text-success"
            : tone === "warning"
              ? "text-warning"
              : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ConsolePreview() {
  const checks = [
    { label: "type", detail: "JPG accepted", ok: true },
    { label: "max size", detail: "4.2 MB → 96 KB", ok: true },
    { label: "dimensions", detail: "350 × 350 px", ok: true },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 glow-soft sm:p-5">
      <div className="flex items-center gap-2 border-b pb-3">
        <span className="flex size-6 items-center justify-center rounded-md border bg-secondary">
          <ClipboardCheck className="size-3.5 text-primary" />
        </span>
        <span className="mono-label">application pack</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          photograph.jpg
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg border bg-secondary text-lg">
          📷
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold tracking-tight">
            application-photo.jpg
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            4.2 MB · 4128 × 3096 px
          </span>
        </div>
        <Badge variant="outline" className="gap-1">
          <XCircle className="size-3 text-destructive" />
          before
        </Badge>
      </div>

      <div className="rounded-lg border bg-background/60 px-3 py-1.5">
        {checks.map((check, index) => (
          <motion.div
            key={check.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.3, duration: 0.3 }}
          >
            <ReadoutRow
              label={check.label}
              value={check.detail}
              tone="success"
            />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.4 }}
        className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2.5"
      >
        <BadgeCheck className="size-4 shrink-0 text-success" />
        <span className="text-sm font-semibold tracking-tight">
          Everything is submission-ready.
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.9, duration: 0.4 }}
        className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3"
      >
        <span className="mono-label">workspace.log</span>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3 text-success" />
          image-compress · 1 file · 92% smaller
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3 text-success" />
          image-resize · 350 × 350 px
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <Lock className="size-3 text-success" />
          files processed in this browser
        </div>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const account = useAccount();

  useSeo({
    title: "SubmitReady — make any document ready to submit",
    description:
      "A browser-based toolkit for upload requirements: compress and resize images, convert images to PDF, compress, merge and split PDFs, and validate a whole application pack. Free accounts add a workspace and saved presets.",
    path: "/",
    faqs: HOME_FAQS,
  });

  const primaryCta = isAuthenticated
    ? { to: "/workspace", label: "Open your workspace" }
    : { to: "/auth", label: "Create a free account" };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        {/* Hero ------------------------------------------------------------- */}
        <section className="grid-paper border-b">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-20">
            <div className="flex flex-col gap-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex flex-wrap items-center gap-2"
              >
                <Badge variant="secondary" className="gap-1.5">
                  <Sparkles className="size-3" />
                  Free · v1.0
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Lock className="size-3 text-success" />
                  Processed in your browser
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <ShieldCheck className="size-3 text-primary" />
                  Accounts &amp; admin console
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 }}
                className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl"
              >
                What are you trying to make submission-ready?
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.12 }}
                className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
              >
                Make any document ready to submit. Compress and resize photos and
                signatures, turn images into a PDF, shrink documents to an exact size,
                merge or split files — then check every requirement before you upload.
                Sign in and the whole run is logged in your workspace.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.18 }}
                className="flex flex-wrap gap-3"
              >
                <Button asChild size="lg" className="gap-2">
                  <Link to={primaryCta.to}>
                    {isAuthenticated ? (
                      <Gauge className="size-4" />
                    ) : (
                      <UserRoundPlus className="size-4" />
                    )}
                    {primaryCta.label}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2">
                  <Link to="/application-pack">
                    <ClipboardCheck className="size-4" />
                    Prepare an application pack
                  </Link>
                </Button>
              </motion.div>

              {account.isAdmin ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.24 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <ShieldCheck className="size-3.5 text-primary" />
                  You have admin access on this deployment —{" "}
                  <Link
                    to="/admin"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    open the console
                  </Link>
                </motion.p>
              ) : null}

              <motion.dl
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="grid grid-cols-2 gap-4 border-t pt-6 sm:grid-cols-3"
              >
                {[
                  { value: "7", label: "tools, one workflow" },
                  { value: "0", label: "files uploaded" },
                  { value: "5s", label: "to your first result" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-0.5">
                    <dt className="font-mono text-2xl font-bold tracking-tight text-primary">
                      {stat.value}
                    </dt>
                    <dd className="text-xs text-muted-foreground">{stat.label}</dd>
                  </div>
                ))}
              </motion.dl>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <ConsolePreview />
            </motion.div>
          </div>
        </section>

        {/* Start with what you have ----------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <motion.div {...fadeUp} className="flex flex-col gap-2">
            <p className="mono-label">choose your entry point</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Start with what you have
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Most upload problems are one of five shapes. Pick the closest one and the
              right tool opens with sensible defaults.
            </p>
          </motion.div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_CARDS.map((card, index) => (
              <ToolCard
                key={card.title}
                title={`${card.emoji} ${card.title}`}
                subtitle={card.subtitle}
                to={card.path}
                icon={
                  card.title === "Application Pack" ? (
                    <ClipboardCheck className="size-5" />
                  ) : (
                    <Sparkles className="size-5" />
                  )
                }
                index={index}
                size="large"
                className={cn(
                  card.title === "Application Pack" &&
                    "border-primary/50 bg-primary/[0.04] sm:col-span-2 lg:col-span-1",
                )}
              />
            ))}
          </div>
        </section>

        {/* Quick actions — the most common jobs, one tap away ---------------- */}
        <section className="border-b bg-surface/50">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-mono text-sm font-semibold tracking-tight">
                Jump straight into a tool
              </h2>
              <Link
                to="/tools"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                See all tools
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action, index) => (
                <motion.div
                  key={action.path}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                >
                  <Button asChild variant="outline" className="h-10 gap-2 px-4">
                    <Link to={action.path}>
                      <Wand2 className="size-4 text-primary" />
                      {action.label}
                    </Link>
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Popular requirements --------------------------------------------- */}
        <section className="border-b bg-surface/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <motion.div {...fadeUp} className="flex flex-col gap-2">
              <p className="mono-label">common limits</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Popular requirements
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                These are the limits that show up most often on exam, scholarship,
                government and job portals — each links to a tool with the target already
                set.
              </p>
            </motion.div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {POPULAR_REQUIREMENTS.map((item, index) => (
                <motion.div
                  key={item.path + item.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                >
                  <Link
                    to={item.path}
                    className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 outline-none transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex flex-col">
                      <span className="font-mono text-sm font-semibold tracking-tight">
                        {item.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Accounts --------------------------------------------------------- */}
        <section className="border-y bg-surface/40">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <motion.div {...fadeUp} className="flex flex-col gap-4">
              <Badge variant="secondary" className="w-fit gap-1.5">
                <ShieldCheck className="size-3" />
                Accounts, optional but useful
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Every tool works signed out. Signing in gives you a memory.
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                Email sign-up takes a six-digit code — no password to invent or reset.
                The first account on a deployment can claim admin and manage accounts,
                tools, presets and announcements from one console.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="gap-2">
                  <Link to={primaryCta.to}>
                    {primaryCta.label}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/privacy">What gets stored</Link>
                </Button>
              </div>
            </motion.div>

            <div className="grid gap-3 sm:grid-cols-2">
              {ACCOUNT_FEATURES.map((feature) => (
                <motion.div
                  key={feature.title}
                  {...fadeUp}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-4"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-secondary text-primary">
                    {feature.icon}
                  </span>
                  <span className="text-sm font-semibold tracking-tight">
                    {feature.title}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {feature.body}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* All tools -------------------------------------------------------- */}
        <section className="border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <motion.div {...fadeUp} className="flex flex-col gap-2">
              <p className="mono-label">the full registry</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Every tool in the toolkit
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Each one follows the same five steps — select, configure, preview,
                verify, download — so nothing feels like guesswork.
              </p>
            </motion.div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <ToolCard
                title={TOOLS["pdf-split"].name}
                subtitle={TOOLS["pdf-split"].blurb}
                to={TOOLS["pdf-split"].path}
                icon={toolIcon("pdf-split")}
                accepts={TOOLS["pdf-split"].accepts}
              />
            </div>
          </div>
        </section>

        {/* Steps ------------------------------------------------------------ */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <motion.div {...fadeUp} className="flex flex-col gap-2">
            <p className="mono-label">pipeline</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Built around how upload forms actually behave
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A form gives you a size, a format and sometimes a pixel dimension. The
              toolkit works backwards from those numbers.
            </p>
          </motion.div>

          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, index) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                className="flex flex-col gap-2 rounded-xl border bg-card p-4"
              >
                <span className="font-mono text-xs text-primary">
                  Step {index + 1}
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  {step.title}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {step.body}
                </span>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* Privacy ---------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <motion.div
            {...fadeUp}
            className="flex flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8"
          >
            <div className="flex flex-col gap-2">
              <Badge variant="secondary" className="w-fit gap-1.5">
                <ShieldCheck className="size-3" />
                Privacy by architecture
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Your files are processed in your browser
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Every tool runs on your device: there is no upload step and no storage
                bucket for documents. When you are signed in we record a summary of what
                you did — a filename, the byte counts, the outcome — so your workspace
                and the admin console have something to show. The contents never leave
                the tab.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Local processing",
                  body: "Compression, resizing and PDF work use browser APIs — canvas, JavaScript PDF libraries and a local rendering engine.",
                },
                {
                  title: "Metadata, not documents",
                  body: "An account stores filenames, sizes and outcomes. Prepared files live in the tab you're using and disappear when you close it.",
                },
                {
                  title: "Honest limits",
                  body: "Where a browser genuinely can't do something — like an exact target on an already-optimised PDF — we say so instead of guessing.",
                },
              ].map((point) => (
                <div key={point.title} className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <Lock className="size-3.5 text-success" />
                    {point.title}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {point.body}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/privacy">
                  Read how processing works
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </section>

        {/* FAQ -------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-3xl px-4 pb-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Common questions
          </h2>
          <Accordion type="single" collapsible className="mt-4">
            {HOME_FAQS.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Final CTA -------------------------------------------------------- */}
        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-12 sm:px-6 sm:py-14">
            <p className="mono-label !text-primary-foreground/70">ready when you are</p>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              Stop guessing whether your file will be accepted.
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed opacity-90">
              Add your documents, set the limits from the form, and download files that
              are checked before you upload them. Sign in if you want the history kept.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="gap-2">
                <Link to={primaryCta.to}>
                  {primaryCta.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/application-pack">
                  <ClipboardCheck className="size-4" />
                  Start an application pack
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
