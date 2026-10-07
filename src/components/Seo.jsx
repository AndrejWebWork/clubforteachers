import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pageByPath, siteDescription, siteName } from "../site";

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

export function siteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL;
  if (configured) return String(configured).replace(/\/$/, "");
  return window.location.origin;
}

export default function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = pageByPath(pathname);
    const missing = !page;
    const title = missing ? `Страницата не постои · ${siteName}` : `${page.title} · ${siteName}`;
    const description = missing ? "Бараната страница не постои на платформата Клуб на наставници." : page.description || siteDescription;
    const origin = siteOrigin();
    const url = `${origin}${pathname}`;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", page?.robots || (missing ? "noindex, nofollow" : "index, follow"));
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:locale", "mk_MK");
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:site_name", siteName);
    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertLink("canonical", url);

    const scriptId = "site-jsonld";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${origin}/#website`,
          name: siteName,
          url: origin,
          inLanguage: "mk",
          description: siteDescription,
        },
        {
          "@type": "WebPage",
          name: title,
          description,
          url,
          inLanguage: "mk",
          isPartOf: { "@id": `${origin}/#website` },
        },
      ],
    });
  }, [pathname]);

  return null;
}
