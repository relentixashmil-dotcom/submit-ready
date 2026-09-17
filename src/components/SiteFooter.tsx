import { Link } from "react-router";
import { Lock } from "lucide-react";
import { BrandWordmark } from "@/components/BrandLogo";
import { POPULAR_REQUIREMENTS, PRIMARY_TOOL_ORDER, TOOLS } from "@/lib/seo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-surface/60">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <BrandWordmark />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            A free toolkit for making documents satisfy upload requirements —
            compress, resize, convert, merge, split and verify. Built for
            students, job applicants, exam candidates and anyone handed a form
            with strict file rules.
          </p>
          <p className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-success" />
            Your files are processed in your browser. An account stores run
            summaries only — never document contents.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-tight uppercase">
            Tools
          </h2>
          {PRIMARY_TOOL_ORDER.map((kind) => (
            <Link
              key={kind}
              to={TOOLS[kind].path}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {TOOLS[kind].name}
            </Link>
          ))}
          <Link
            to="/split-pdf"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Split PDF
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-tight uppercase">
            Popular requirements
          </h2>
          {POPULAR_REQUIREMENTS.map((item) => (
            <Link
              key={item.path + item.label}
              to={item.path}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/privacy"
            className="mt-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            How processing works
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-tight uppercase">
            Account
          </h2>
          <Link
            to="/workspace"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Workspace
          </Link>
          <Link
            to="/workspace"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Run history
          </Link>
          <Link
            to="/admin"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Admin console
          </Link>
          <Link
            to="/auth"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Create an account
          </Link>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            SubmitReady — make any document ready to submit. Free to use, with or
            without an account.
          </p>
          <p className="font-mono">
            © {new Date().getFullYear()} SubmitReady
          </p>
        </div>
      </div>
    </footer>
  );
}
