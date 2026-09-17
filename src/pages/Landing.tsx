import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  ShieldCheck,
  Sparkles,
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

const HOME_FAQS = [
  {
    q: "Are my documents uploaded to a server?",
    a: "No. Compression, resizing, PDF creation, merging, splitting and validation all run in your browser using canvas and JavaScript PDF libraries. Your files stay on your device. The one thing the browser must download is the app itself and its PDF rendering engine.",
  },
  {
    q: "Is SubmitReady really free?",
    a: "Yes. There is no account, no trial and no paywalled export. Because processing happens on your device, there are no per-file server costs to pass on.",
  },
  {
    q: "What if my file can't reach the required size?",
    a: "You'll be told plainly, with the real result and a reason. A photo that is already heavily compressed, or a PDF that is already optimised, may not shrink further — SubmitReady shows the smallest version it produced instead of claiming success.",
  },
  {
    q: "Does compressing a PDF break the text?",
    a: "It depends on the level. Light rebuilds the file structure losslessly, so text stays selectable. Balanced, Strong and Extreme re-render pages as high-quality images, which shrinks scans dramatically but turns text into pixels. The trade-off is stated on every level.",
  },
  {
    q: "Which is the fastest way to prepare a whole application?",
    a: "The Application Pack. Add every document, and each one is checked against its own size, dimension and page rules with one-click fixes and a single final download.",
  },
];

function RequirementPreview() {
  const checks = [
    { label: "File type", detail: "JPG accepted", ok: true },
    { label: "Maximum size", detail: "4.2 MB → 96 KB", ok: true },
    { label: "Dimensions", detail: "350 × 350 px", ok: true },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg border bg-muted/40 text-lg">
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

      <ul className="mt-4 flex flex-col gap-2">
        {checks.map((check, index) => (
          <motion.li
            key={check.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.35, duration: 0.3 }}
            className="flex items-center gap-2 text-xs"
          >
            <CheckCircle2 className="size-3.5 shrink-0 text-success" />
            <span className="font-medium">{check.label}</span>
            <span className="ml-auto font-mono text-muted-foreground">
              {check.detail}
            </span>
          </motion.li>
        ))}
      </ul>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.7, duration: 0.4 }}
        className="mt-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2.5"
      >
        <BadgeCheck className="size-4 shrink-0 text-success" />
        <span className="text-sm font-semibold tracking-tight">
          Everything is submission-ready.
        </span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.1, duration: 0.4 }}
        className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"
      >
        <Lock className="size-3 text-success" />
        processed in this browser · nothing uploaded
      </motion.p>
    </div>
  );
}

export default function Landing() {
  useSeo({
    title: "SubmitReady — make any document ready to submit",
    description:
      "Free browser-based toolkit for upload requirements: compress and resize images, convert images to PDF, compress, merge and split PDFs, and validate a whole application pack. No account, no uploads.",
    path: "/",
    faqs: HOME_FAQS,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
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
                  Free · no account
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Lock className="size-3 text-success" />
                  Files processed in your browser
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
                merge or split files — and check every requirement before you upload.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.18 }}
                className="flex flex-wrap gap-3"
              >
                <Button asChild size="lg" className="gap-2">
                  <Link to="/application-pack">
                    <ClipboardCheck className="size-4" />
                    Prepare an application pack
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2">
                  <Link to="/image-compressor">
                    Compress an image
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </motion.div>

              <motion.dl
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="grid grid-cols-2 gap-4 border-t pt-6 sm:grid-cols-3"
              >
                {[
                  { value: "7", label: "tools, one workflow" },
                  { value: "0", label: "files uploaded" },
                  { value: "100%", label: "free, no sign-up" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-0.5">
                    <dt className="text-2xl font-bold tracking-tight">{stat.value}</dt>
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
              <RequirementPreview />
            </motion.div>
          </div>
        </section>

        {/* Quick actions ---------------------------------------------------- */}
        <section className="border-b bg-surface/50">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
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
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to={action.path}>
                      <Wand2 className="size-3.5 text-primary" />
                      {action.label}
                    </Link>
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* What are you working on ------------------------------------------ */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <motion.div {...fadeUp} className="flex flex-col gap-2">
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
                    "border-primary/50 bg-primary/[0.03] sm:col-span-2 lg:col-span-1",
                )}
              />
            ))}
          </div>
        </section>

        {/* All tools -------------------------------------------------------- */}
        <section className="border-y bg-surface/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <motion.div {...fadeUp} className="flex flex-col gap-2">
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

        {/* Popular requirements --------------------------------------------- */}
        <section className="border-y bg-surface/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <motion.div {...fadeUp} className="flex flex-col gap-2">
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
                    className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/50"
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
                Every tool in SubmitReady runs on your device. There is no upload step,
                no storage bucket and no account — so there is nothing to leak, and
                nothing left behind after you close the tab.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Local processing",
                  body: "Compression, resizing and PDF work use browser APIs — canvas, JavaScript PDF libraries and a local rendering engine.",
                },
                {
                  title: "No accounts, no database",
                  body: "The Application Pack lives in the tab you're using. Reload it and the pack is gone, by design.",
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
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              Stop guessing whether your file will be accepted.
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed opacity-90">
              Add your documents, set the limits from the form, and download files that
              are checked before you upload them.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="gap-2">
                <Link to="/application-pack">
                  <ClipboardCheck className="size-4" />
                  Start an application pack
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/tools">
                  Browse all tools
                  <ArrowRight className="size-4" />
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
