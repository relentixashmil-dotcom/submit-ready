import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ConvexConfigNotice } from "@/components/ConvexConfigNotice";
import { PackProvider } from "@/context/pack";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const ToolsIndex = lazy(() => import("./pages/ToolsIndex.tsx"));
const ToolPage = lazy(() => import("./pages/ToolPage.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Workspace = lazy(() => import("./pages/Workspace.tsx"));
const AdminConsole = lazy(() => import("./pages/AdminConsole.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the page blank. Technical details
 *  are development-only; production gets a plain, user-facing explanation. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[SubmitReady] Root crash:", err);
  }
  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-lg text-center">
          <p className="text-sm font-semibold">
            {isDev ? "Preview runtime error" : "Something went wrong"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground break-words">
            {isDev
              ? this.state.message
              : "SubmitReady hit an unexpected error while rendering this page. Reloading usually clears it — your files are never uploaded."}
          </p>
          {isDev && this.state.stack ? (
            <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
              {this.state.stack}
            </pre>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}

/**
 * The Convex deployment URL is inlined by Vite at build time, so a deployment
 * built without it cannot talk to any backend. Constructing the client with an
 * empty or malformed address throws while this module is still evaluating —
 * before React can mount — which left the deployed site completely blank.
 */
const convexUrl = ((import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "").trim();

function createConvexClient(address: string): ConvexReactClient | null {
  if (!address) return null;
  try {
    return new ConvexReactClient(address);
  } catch (error) {
    // The address itself is never logged; it is public but may be malformed.
    console.error("[SubmitReady] VITE_CONVEX_URL is not a usable Convex address:", error);
    return null;
  }
}

const convex = createConvexClient(convexUrl);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    // Each tool is a full page of work — always start it from the top.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** The whole application. Only rendered when a Convex client exists, because
 *  every screen and the auth hooks underneath it need the provider. */
function SubmitReadyApp({ client }: { client: ConvexReactClient }) {
  return (
    <StrictMode>
      <RootErrorBoundary>
        {/* Honour prefers-reduced-motion: decorative motion switches off globally. */}
        <MotionConfig reducedMotion="user">
        <ToolbarErrorBoundary>
          <VlyToolbar />
        </ToolbarErrorBoundary>
        <ConvexAuthProvider client={client}>
          <PackProvider>
            <BrowserRouter>
              <RouteSyncer />
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/tools" element={<ToolsIndex />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route
                    path="/auth"
                    element={<AuthPage redirectAfterAuth="/workspace" />}
                  />
                  <Route
                    path="/workspace"
                    element={
                      <RequireAuth>
                        <Workspace />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <RequireAuth>
                        <RequireAdmin>
                          <AdminConsole />
                        </RequireAdmin>
                      </RequireAuth>
                    }
                  />
                  {/* Every tool and SEO landing page is resolved from one slug config. */}
                  <Route path="/:slug" element={<ToolPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </PackProvider>
          <Toaster />
        </ConvexAuthProvider>
        </MotionConfig>
      </RootErrorBoundary>
    </StrictMode>
  );
}

/**
 * Last-resort fallback for a failure that happens before React can mount.
 * Plain DOM, so it renders even if the component tree never starts.
 */
function renderBootstrapFailure(container: HTMLElement | null, error: unknown) {
  console.error("[SubmitReady] Failed to start:", error);

  const target = container ?? document.body;
  target.textContent = "";

  const panel = document.createElement("div");
  panel.style.cssText =
    "max-width:34rem;margin:14vh auto 0;padding:1.5rem;border:1px solid #2b3040;" +
    "border-radius:0.75rem;background:#16181f;color:#e7e9f0;line-height:1.6;" +
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";

  const title = document.createElement("p");
  title.textContent = "SubmitReady could not start";
  title.style.cssText = "margin:0;font-size:0.95rem;font-weight:600";

  const body = document.createElement("p");
  body.textContent =
    "The page failed to initialise. Reload to try again; if it keeps happening, check that the " +
    "deployment build completed and that VITE_CONVEX_URL is configured for the build environment.";
  body.style.cssText = "margin:0.5rem 0 0;font-size:0.8rem;opacity:0.75";

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload page";
  reload.style.cssText =
    "margin-top:1.1rem;padding:0.5rem 0.9rem;border-radius:0.5rem;border:1px solid #2b3040;" +
    "background:#1f2331;color:inherit;font:inherit;font-size:0.8rem;cursor:pointer";
  reload.addEventListener("click", () => window.location.reload());

  panel.append(title, body);

  if (import.meta.env.DEV && error instanceof Error && error.stack) {
    const detail = document.createElement("pre");
    detail.textContent = error.stack;
    detail.style.cssText =
      "margin-top:0.75rem;max-height:10rem;overflow:auto;white-space:pre-wrap;font-size:0.65rem;opacity:0.6";
    panel.append(detail);
  }

  panel.append(reload);
  target.append(panel);
}

const container = document.getElementById("root");

try {
  if (!container) {
    throw new Error("The #root element is missing from index.html");
  }

  const root = createRoot(container);

  if (convex) {
    root.render(<SubmitReadyApp client={convex} />);
  } else {
    // No usable Convex URL: explain what is missing instead of letting the
    // Convex client throw during module evaluation and blank the page.
    root.render(
      <StrictMode>
        <ConvexConfigNotice invalid={convexUrl.length > 0} />
      </StrictMode>,
    );
  }
} catch (error) {
  renderBootstrapFailure(container, error);
}
