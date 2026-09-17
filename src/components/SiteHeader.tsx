import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandWordmark } from "@/components/BrandLogo";
import { usePack } from "@/context/pack";
import { useAuth } from "@/hooks/use-auth";
import { useAccount } from "@/hooks/use-account";
import { useTheme } from "@/hooks/use-theme";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PRIMARY_TOOL_ORDER, TOOLS } from "@/lib/seo";
import { cn } from "@/lib/utils";

function initialsFor(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "you";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function AnnouncementBanner() {
  const settings = useQuery(api.settings.get);
  if (!settings?.announcement) return null;

  const tone = settings.tone ?? "info";
  return (
    <div
      className={cn(
        "border-b px-4 py-2 text-center font-mono text-xs sm:px-6",
        tone === "success"
          ? "border-success/30 bg-success/10 text-success"
          : tone === "warning"
            ? "border-warning/30 bg-warning/10 text-warning"
            : "border-primary/30 bg-primary/10 text-primary",
      )}
    >
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="size-3.5" />
        {settings.announcement}
      </span>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { summary } = usePack();
  const { isAuthenticated, signOut } = useAuth();
  const account = useAccount();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { label: "Tools", to: "/tools" },
    ...(isAuthenticated
      ? [
          { label: "Workspace", to: "/workspace" },
          ...(account.isAdmin ? [{ label: "Console", to: "/admin" }] : []),
        ]
      : []),
    { label: "Privacy", to: "/privacy" },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <AnnouncementBanner />
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="SubmitReady home" className="shrink-0">
          <span className="flex items-center gap-2">
            <BrandWordmark />
            <span className="mono-label hidden lg:inline">v1.0</span>
          </span>
        </Link>

        <nav className="ml-3 hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-md px-3 py-2 font-mono text-xs tracking-wide uppercase transition-colors",
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
              className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 font-mono text-xs transition-colors hover:border-primary/60 sm:flex"
            >
              <CheckCheck className="size-3.5 text-success" />
              pack
              <span className="text-muted-foreground">
                {summary.passed}/{summary.total}
              </span>
            </Link>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={
              theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"
            }
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 font-mono"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {initialsFor(account.name, account.email)}
                  </span>
                  <span className="hidden sm:inline">
                    {account.isAnonymous ? "guest" : account.role}
                  </span>
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    signed in as
                  </span>
                  <span className="truncate text-sm">
                    {account.email ?? account.name ?? "guest account"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => navigate("/workspace")}
                >
                  <LayoutDashboard className="size-4" />
                  Workspace
                </DropdownMenuItem>
                {account.isAdmin ? (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => navigate("/admin")}
                  >
                    <ShieldCheck className="size-4" />
                    Admin console
                  </DropdownMenuItem>
                ) : !account.adminExists ? (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => navigate("/admin")}
                  >
                    <Sparkles className="size-4" />
                    Claim admin access
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="gap-2">
              <Link to="/auth">
                <UserRound className="size-4" />
                Sign in
              </Link>
            </Button>
          )}

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

      <div className="brand-rule h-px w-full opacity-70" />

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
              <p className="mono-label px-2 pb-1">Tools</p>
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
              <Link
                to="/split-pdf"
                className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium hover:bg-secondary"
              >
                {TOOLS["pdf-split"].name}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {TOOLS["pdf-split"].accepts}
                </span>
              </Link>
              <div className="mt-2 flex flex-col gap-1 border-t pt-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="rounded-lg px-3 py-3 font-mono text-xs tracking-wide uppercase hover:bg-secondary"
                  >
                    {link.label}
                  </Link>
                ))}
                {!isAuthenticated ? (
                  <Link
                    to="/auth"
                    className="rounded-lg px-3 py-3 font-mono text-xs tracking-wide uppercase text-primary hover:bg-secondary"
                  >
                    Sign in or create an account
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="rounded-lg px-3 py-3 text-left font-mono text-xs tracking-wide uppercase text-destructive hover:bg-secondary"
                  >
                    Sign out
                  </button>
                )}
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
