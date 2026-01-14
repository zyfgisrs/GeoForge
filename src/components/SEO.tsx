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


  const siteTitle = "GeoForge - Online GeoJSON, WKT Editor & Converter";
  const finalTitle = title ? `${title} | ${siteTitle}` : siteTitle;

  const defaultDescription =
    "Free online geospatial tool. Convert GeoJSON to WKT, WKT to GeoJSON, and Shapefile to GeoJSON. Visualize, analyze, and edit map data with OpenLayers & Turf.js. Supports KML export and coordinate projection.";

  const finalDescription = description || defaultDescription;


  const defaultKeywords =
    "GeoJSON Editor, WKT Visualizer, Shapefile Viewer, KML, OpenLayers, Turf.js, GIS Tool, Spatial Analysis, Hex Grid, Voronoi, Map Projection, EPSG:4326, GeoForge";

  const finalKeywords = keywords || defaultKeywords;

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "GeoForge",
    applicationCategory: "GeospatialTool",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: finalDescription,
    featureList:
      "Convert GeoJSON to WKT, Convert WKT to GeoJSON, View Shapefile, Edit Geospatial Data, Spatial Analysis",
  };

  return (
    <Helmet prioritizeSeoTags>
      <html lang={currentLang} />
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />

      {/* Canonical */}
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="GeoForge" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={finalTitle} />
      <meta property="twitter:description" content={finalDescription} />
      <meta property="twitter:image" content={image} />

      {/* JSON-LD Script */}
      <script type="application/ld+json">{JSON.stringify(schemaData)}</script>

      <link rel="alternate" hrefLang="en" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="zh" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="ja" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="ko" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="fr" href="https://www.geo-forge.org/" />
      <link rel="alternate" hrefLang="es" href="https://www.geo-forge.org/" />
      {/* ...其他语言保持不变... */}
      <link
        rel="alternate"
        hrefLang="x-default"
        href="https://www.geo-forge.org/"
      />
    </Helmet>
  );
}
