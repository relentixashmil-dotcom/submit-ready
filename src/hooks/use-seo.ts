import { useEffect } from "react";
import type { SeoPage } from "@/lib/seo";

interface SeoInput {
  title: string;
  description: string;
  path: string;
  faqs?: { q: string; a: string }[];
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(path: string) {
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = path;
}

function upsertJsonLd(id: string, data: unknown | null) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  if (!data) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * Sets per-route document metadata so every page has a unique, crawlable
 * title, description and structured data.
 */
export function useSeo(page: SeoInput) {
  useEffect(() => {
    document.title = page.title;
    upsertMeta("name", "description", page.description);
    upsertMeta("property", "og:title", page.title);
    upsertMeta("property", "og:description", page.description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertCanonical(page.path);

    upsertJsonLd(
      "page-jsonld",
      page.faqs && page.faqs.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }
        : null,
    );
  }, [
    page.title,
    page.description,
    page.path,
    page.faqs,
  ]);
}

export function useToolSeo(page: SeoPage) {
  useSeo({
    title: page.title,
    description: page.description,
    path: page.path,
    faqs: page.faqs,
  });
}
