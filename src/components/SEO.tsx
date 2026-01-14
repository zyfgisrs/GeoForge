import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

export function SEO({
  title,
  description,
  keywords,
  image = "/og-image.png",
  url = "https://www.geo-forge.org/",
}: SEOProps) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const siteTitle = "GeoForge";
  const finalTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const defaultDescription =
    "A modern, high-performance web application for creating, editing, analyzing, and visualizing geospatial data. Supports GeoJSON, WKT, and more.";
  const finalDescription = description || defaultDescription;

  return (
    <Helmet prioritizeSeoTags>
      <html lang={currentLang} />
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Canonical */}
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={finalTitle} />
      <meta property="twitter:description" content={finalDescription} />
      <meta property="twitter:image" content={image} />

      {/* Alternate Languages - Hreflang */}
      {/* Ideally, we should list all supported routes for each language here if they had unique URLs. 
          Since this is an SPA on a single URL, simply declaring the lang attribute on html tag is the most critical step. 
          But for crawlers that support fragment-based crawling or if we had separate paths:
      */}
      <link rel="alternate" hrefLang="en" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="zh" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="ja" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="ko" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="fr" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="es" href="https://www.geo-forge.org/" />
      <link
        rel="alternate"
        hrefLang="x-default"
        href="https://www.geo-forge.org/"
      />
    </Helmet>
  );
}
