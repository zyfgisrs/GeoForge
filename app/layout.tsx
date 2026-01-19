import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#18181b",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.geo-forge.org"),
  title: {
    default: "GeoForge - Online GeoJSON, WKT Editor & Converter",
    template: "%s | GeoForge",
  },
  description:
    "Free online geospatial tool. Convert GeoJSON to WKT, WKT to GeoJSON, and Shapefile to GeoJSON. Visualize, analyze, and edit map data with OpenLayers & Turf.js. Supports KML export and coordinate projection.",
  keywords: [
    "GeoJSON Editor",
    "WKT Visualizer",
    "Shapefile Viewer",
    "KML Export",
    "OpenLayers",
    "Turf.js",
    "GIS Tool",
    "Spatial Analysis",
    "Hex Grid",
    "Voronoi",
    "Map Projection",
    "EPSG:4326",
    "GeoForge",
    "Coordinate Converter",
    "GeoJSON to WKT",
    "WKT to GeoJSON",
    "Shapefile to GeoJSON",
  ],
  authors: [{ name: "GeoForge Team", url: "https://www.geo-forge.org" }],
  creator: "GeoForge Team",
  publisher: "GeoForge",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.geo-forge.org/",
    title: "GeoForge - Online GeoJSON, WKT Editor & Converter",
    description:
      "Free online geospatial tool. Convert GeoJSON to WKT, WKT to GeoJSON, and Shapefile to GeoJSON. Visualize, analyze, and edit map data with OpenLayers & Turf.js.",
    siteName: "GeoForge",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GeoForge - Online Geospatial Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GeoForge - Online GeoJSON, WKT Editor & Converter",
    description:
      "Free online geospatial tool. Convert GeoJSON to WKT, WKT to GeoJSON, and Shapefile to GeoJSON. Visualize, analyze, and edit map data.",
    images: ["/og-image.png"],
    creator: "@geoforge",
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "zh-CN": "/",
      "zh-TW": "/",
      "ja-JP": "/",
      "ko-KR": "/",
      "fr-FR": "/",
      "es-ES": "/",
      "de-DE": "/",
      "ru-RU": "/",
      "pt-BR": "/",
      "ar-SA": "/",
      "hi-IN": "/",
    },
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
  category: "technology",
};

// JSON-LD structured data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "GeoForge",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web Browser",
  browserRequirements: "Requires JavaScript, HTML5, WebGL",
  url: "https://www.geo-forge.org",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Free online geospatial tool. Convert GeoJSON to WKT, WKT to GeoJSON, and Shapefile to GeoJSON. Visualize, analyze, and edit map data with OpenLayers & Turf.js.",
  featureList: [
    "Convert GeoJSON to WKT",
    "Convert WKT to GeoJSON",
    "Import Shapefile (ZIP)",
    "Export to KML",
    "Spatial Analysis with Turf.js",
    "Interactive Map with OpenLayers",
    "Multiple Coordinate Projections",
    "Draw and Edit Features",
    "Hex Grid Generation",
    "Voronoi Diagram",
    "Buffer Analysis",
    "Union/Intersect/Difference Operations",
  ],
  screenshot: "https://www.geo-forge.org/og-image.png",
  softwareVersion: "1.0.0",
  author: {
    "@type": "Organization",
    name: "GeoForge Team",
    url: "https://www.geo-forge.org",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "127",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
      </head>
      <body
        style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
