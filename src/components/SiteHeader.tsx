import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandWordmark } from "@/components/BrandLogo";
import { usePack } from "@/context/pack";
import { useTheme } from "@/hooks/use-theme";
import { PRIMARY_TOOL_ORDER, TOOLS } from "@/lib/seo";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "All tools", to: "/tools" },
  { label: "Application Pack", to: "/application-pack" },
  { label: "Privacy", to: "/privacy" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { summary } = usePack();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="SubmitReady home" className="shrink-0">
          <BrandWordmark />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {summary.total > 0 ? (
            <Link
              to="/application-pack"
              className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 sm:flex"
            >
              <CheckCheck className="size-3.5 text-success" />
              Pack
              <span className="font-mono text-muted-foreground">
                {summary.passed}/{summary.total}
              </span>
            </Link>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={
              theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
            }
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t bg-background md:hidden"
          >
            <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
              <p className="px-2 pb-1 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                Tools
              </p>
              {PRIMARY_TOOL_ORDER.map((kind) => {
                const tool = TOOLS[kind];
                return (
                  <Link
                    key={tool.path}
                    to={tool.path}
                    className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium hover:bg-secondary"
                  >
                    {tool.name}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {tool.accepts}
                    </span>
                  </Link>
                );
              })}
              <div className="mt-2 flex flex-col gap-1 border-t pt-3">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-secondary"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              {summary.total > 0 ? (
                <div className="px-3 pt-2">
                  <Badge variant="secondary">
                    Pack: {summary.passed} of {summary.total} ready
                  </Badge>
                </div>
              ) : null}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
