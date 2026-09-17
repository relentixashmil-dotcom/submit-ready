import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ToolCardProps {
  title: string;
  subtitle: string;
  to: string;
  icon: ReactNode;
  badge?: string;
  accepts?: string;
  className?: string;
  index?: number;
  /** Larger treatment for the homepage hero cards. */
  size?: "default" | "large";
}

export function ToolCard({
  title,
  subtitle,
  to,
  icon,
  badge,
  accepts,
  className,
  index = 0,
  size = "default",
}: ToolCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Link
        to={to}
        className={cn(
          "group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 sm:p-5",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex items-center justify-center rounded-lg border bg-secondary text-primary",
              size === "large" ? "size-11" : "size-9",
            )}
          >
            {icon}
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h3
            className={cn(
              "font-semibold tracking-tight",
              size === "large" ? "text-lg" : "text-base",
            )}
          >
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          {accepts ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              {accepts}
            </span>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
