import { BrandWordmark } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/workspace",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

const WHAT_YOU_GET = [
  {
    title: "A real workspace",
    body: "Every operation you run is recorded as a summary — filename, sizes, outcome — so you can see what you prepared and when.",
  },
  {
    title: "Saved requirement presets",
    body: "Store the exact limits a form asked for and apply them to any document slot in one click.",
  },
  {
    title: "Documents stay local",
    body: "Accounts track metadata. The files themselves are still processed in your browser and never uploaded.",
  },
];

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (submitError) {
      console.error("Email sign-in error:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn't send the verification code. Check the address and try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (verifyError) {
      console.error("OTP verification error:", verifyError);
      setError("That code isn't right. Check the six digits and try again.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (guestError) {
      console.error("Guest sign-in error:", guestError);
      setError(
        guestError instanceof Error
          ? `We couldn't start a guest session: ${guestError.message}`
          : "We couldn't start a guest session. Try again in a moment.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left: what an account is for -------------------------------------- */}
      <aside className="grid-paper flex flex-col justify-between gap-8 border-b px-4 py-10 sm:px-8 lg:w-[46%] lg:border-r lg:border-b-0 lg:px-12 lg:py-14">
        <Link to="/" className="w-fit" aria-label="SubmitReady home">
          <BrandWordmark />
        </Link>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="mono-label">accounts</p>
            <h1 className="max-w-md text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Sign in and keep track of what you prepared.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              SubmitReady works without an account. An account adds a workspace: run
              history, saved requirement presets and one place to manage everything
              from. Use the same email to sign up or sign back in — there is no
              separate registration step.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {WHAT_YOU_GET.map((item) => (
              <li key={item.title} className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold tracking-tight">
                    {item.title}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <Lock className="size-3.5 text-success" />
          documents never leave this device
        </p>
      </aside>

      {/* Right: the form --------------------------------------------------- */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <Card className="w-full max-w-md border shadow-none">
          {step === "signIn" ? (
            <>
              <CardHeader className="flex flex-col gap-1.5">
                <p className="mono-label">step 01 — identify</p>
                <CardTitle className="text-xl">Create an account or sign in</CardTitle>
                <CardDescription>
                  Enter your email address and we&apos;ll send a six-digit code. New
                  addresses become accounts automatically.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="auth-email"
                      className="mono-label"
                    >
                      email address
                    </label>
                    <div className="relative flex items-center gap-2">
                      <Mail className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                      <Input
                        id="auth-email"
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        autoComplete="email"
                        className="pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    Email me a code
                  </Button>

                  {error ? (
                    <p
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {error}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="mono-label">or</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="size-4" />
                    Continue as a guest
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    A guest session keeps your history in this browser only. Add an
                    email later from the workspace and nothing is lost.
                  </p>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="flex flex-col gap-1.5">
                <p className="mono-label">step 02 — verify</p>
                <CardTitle className="text-xl">Check your inbox</CardTitle>
                <CardDescription>
                  We sent a six-digit code to{" "}
                  <span className="font-mono text-foreground">{step.email}</span>.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="flex flex-col gap-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (event.target as HTMLElement).closest("form");
                          form?.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error ? (
                    <p role="alert" className="text-center text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}

                  <p className="text-center text-xs text-muted-foreground">
                    Nothing arrived? Check the spam folder, or{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => {
                        setStep("signIn");
                        setError(null);
                        setOtp("");
                      }}
                    >
                      use a different address
                    </Button>
                    .
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      <>
                        Verify and continue
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep("signIn");
                      setError(null);
                      setOtp("");
                    }}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Use a different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="flex items-center justify-center gap-2 border-t px-6 py-4 font-mono text-[11px] text-muted-foreground">
            <Lock className="size-3 text-success" />
            processed in your browser · account holds metadata only
          </div>
        </Card>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
