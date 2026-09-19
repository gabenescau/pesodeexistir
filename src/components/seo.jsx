import { useEffect } from "react";

// Atualiza document.head com title, description, canonical, Open Graph,
// Twitter Card e (opcionalmente) JSON-LD. Tudo via DOM effect para nao
// precisar de um framework de SEO. Cada chamada substitui as tags existentes
// com a mesma chave (via ID) para evitar duplicatas em SPAs.

const SITE_NAME = "OPE Club";
const SITE_LOCALE = "pt_BR";
const DEFAULT_OG_IMAGE = "https://pesodeexistir.online/hero/backgroundnovo.png";
const TWITTER_HANDLE = "@opeclub";

function ensureMeta(id, name, content, attr = "name") {
  if (!content) return null;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    el.setAttribute("data-seo-id", id);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

function ensureLink(rel, href) {
  if (!href) return null;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute("data-seo-id", `link-${rel}`);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  return el;
}

function removeMetaById(id) {
  const el = document.head.querySelector(`[data-seo-id="${id}"]`);
  if (el) el.remove();
}

export function Seo({ title, description, canonical, type = "website", image, robots, jsonLd }) {
  useEffect(() => {
    if (title) document.title = title;
    ensureLink("canonical", canonical);
    ensureMeta("description", "description", description);
    ensureMeta("robots", "robots", robots || "index, follow");

    // Open Graph
    ensureMeta("og:title", "og:title", title, "property");
    ensureMeta("og:description", "og:description", description, "property");
    ensureMeta("og:type", "og:type", type, "property");
    ensureMeta("og:url", "og:url", canonical, "property");
    ensureMeta("og:site_name", "og:site_name", SITE_NAME, "property");
    ensureMeta("og:locale", "og:locale", SITE_LOCALE, "property");
    ensureMeta("og:image", "og:image", image || DEFAULT_OG_IMAGE, "property");

    // Twitter Card
    ensureMeta("twitter:card", "twitter:card", "summary_large_image");
    ensureMeta("twitter:title", "twitter:title", title);
    ensureMeta("twitter:description", "twitter:description", description);
    ensureMeta("twitter:image", "twitter:image", image || DEFAULT_OG_IMAGE);
    ensureMeta("twitter:site", "twitter:site", TWITTER_HANDLE);

    // JSON-LD opcional (rich results do Google)
    if (jsonLd) {
      let script = document.head.querySelector('script[data-seo-id="jsonld"]');
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-id", "jsonld");
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else {
      removeMetaById("jsonld");
    }

    return () => {
      // Em SPA, nao removemos as tags no unmount: o proximo Seo ja
      // sobrescreve. Isso evita flash de "sem meta" durante a transicao.
    };
  }, [title, description, canonical, type, image, robots, jsonLd]);

  return null;
}

// Helper para gerar Organization/Product/Article JSON-LD.
export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: "https://pesodeexistir.online",
    logo: "https://pesodeexistir.online/favicon.svg",
    sameAs: [
      "https://www.instagram.com/ope.club",
    ],
  };
}

export function buildProductJsonLd({ name, description, priceCents, currency = "BRL", url }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: currency,
      price: (priceCents / 100).toFixed(2),
      availability: "https://schema.org/InStock",
    },
  };
}
