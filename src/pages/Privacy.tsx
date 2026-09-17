import { Link } from "react-router";
import { AlertTriangle, Globe, HardDrive, Lock, Server, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useSeo } from "@/hooks/use-seo";

const LOCAL = [
  {
    title: "Image compression",
    body: "Your image is decoded, drawn onto a canvas and re-encoded (JPEG/WebP/PNG) inside the page. Quality and dimension search loops run in JavaScript. The bytes never leave the tab.",
  },
  {
    title: "Image resizing and cropping",
    body: "Scaling, aspect-ratio fitting and centre-cropping all happen on a canvas element.",
  },
  {
    title: "Images to PDF",
    body: "Each image is re-encoded locally and assembled into a PDF with a JavaScript PDF library. Pages, margins and page size are computed in the browser.",
  },
  {
    title: "PDF merge and split",
    body: "Pages are copied between documents in memory with pdf-lib. No rendering, no upload, and original page sizes are preserved.",
  },
  {
    title: "PDF compression",
    body: "The file structure is rebuilt in memory. At higher levels, pages are rendered to a canvas by a locally loaded PDF engine and re-encoded as JPEGs.",
  },
  {
    title: "Application Pack",
    body: "Files are inspected (dimensions, page counts, sizes) and kept in the tab's memory only, so moving between tools keeps your pack together. Closing or reloading the tab discards it.",
  },
];

const SERVER = [
  {
    title: "The app itself",
    body: "Loading SubmitReady downloads the app's HTML, CSS and JavaScript from the host — the same as any website. That is a request for code, not for your documents.",
  },
  {
    title: "PDF rendering assets",
    body: "When a PDF tool renders page previews, it fetches font maps, character maps and WebAssembly decoders from the same origin as the site. These are static files; your PDF is not part of the request.",
  },
  {
    title: "Web font",
    body: "The interface loads the Inter typeface from Google Fonts. Your browser requests that font from Google's servers — no file data is included.",
  },
  {
    title: "Crash diagnostics",
    body: "If the interface hits a JavaScript error, the hosting platform may receive the error message and stack trace so the bug can be fixed. File names and file contents are never included.",
  },
];

export default function Privacy() {
  useSeo({
    title: "Privacy & processing — where your files actually go | SubmitReady",
    description:
      "Exactly how SubmitReady processes files: what runs in your browser, what the page still requests from the network, and the few cases where a browser genuinely can't do the job.",
    path: "/privacy",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4">
          <Badge variant="secondary" className="w-fit gap-1.5">
            <ShieldCheck className="size-3" />
            Privacy
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Where your files actually go
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            The short version: your documents are processed in your browser and are not
            uploaded to us. The longer version is below, because &ldquo;100% private&rdquo;
            is a claim worth being precise about.
          </p>
        </header>

        <section className="mt-10 flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <HardDrive className="size-5 text-success" />
            What stays on your device
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every tool listed here runs entirely in the page you are looking at. No file
            is ever sent to a SubmitReady server, because there is no SubmitReady server
            handling files — there is no upload endpoint, no storage bucket and no
            database of documents.
          </p>
          <div className="flex flex-col gap-3">
            {LOCAL.map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Globe className="size-5 text-info" />
            What the page still requests
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A browser-based tool is not the same as an offline one. These requests happen
            when the app loads, and none of them carry your documents.
          </p>
          <ul className="flex flex-col gap-3">
            {SERVER.map((item) => (
              <li key={item.title} className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <AlertTriangle className="size-5 text-warning" />
            Honest limits
          </h2>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">An exact target size is not always possible.</span>{" "}
              Compression depends on what is inside a file. SubmitReady reduces quality and
              resolution until the limit is met, and when that stops working it shows the
              real output size and says the target could not be reached.
            </p>
            <p>
              <span className="font-medium text-foreground">Password-protected PDFs can&apos;t be unlocked here.</span>{" "}
              Pages may still be copied without the password, but content can be missing.
              Remove the password in a PDF reader first for a reliable result.
            </p>
            <p>
              <span className="font-medium text-foreground">Very large files depend on your device.</span>{" "}
              Processing happens in your browser&apos;s memory. A 100 MB PDF works on a
              desktop and can fail on an older phone. When memory runs out, the tool says so
              rather than producing a broken file.
            </p>
            <p>
              <span className="font-medium text-foreground">Nothing is stored for you.</span>{" "}
              There is no account and no history. If you close the tab, the Application Pack
              is gone. Download what you need before you leave.
            </p>
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Lock className="size-4 text-success" />
            In one sentence
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your files are read, rewritten and handed back by your own browser; the network
            is used to load the app and its rendering assets, and to report interface errors
            — never your documents.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/tools">
                <Server className="size-4" />
                Back to the tools
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link to="/application-pack">Open the Application Pack</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
