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
    default: "GeoForge - Free Online GeoJSON Editor & GIS Converter",
    template: "%s | GeoForge",
  },
  description:
    "Powerful free online GeoJSON editor and GIS converter. Convert between GeoJSON, WKT, Shapefile, KML formats. Visualize maps, analyze spatial data with OpenLayers and Turf.js. Create hex grids, Voronoi diagrams, and perform geospatial analysis in your browser.",
keywords: [
    "GeoJSON editor online",
    "WKT converter",
    "Shapefile viewer online",
    "KML converter",
    "GIS tool free",
    "spatial analysis",
    "OpenLayers map",
    "Turf.js",
    "hexagonal grid generator",
    "Voronoi diagram creator",
    "coordinate projection",
    "EPSG converter",
    "geospatial data visualization",
    "map editor",
    "geometry converter",
    "geo converter online",
    "spatial data analysis"
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
  "@type": ["WebApplication", "SoftwareApplication"],
  name: "GeoForge",
  applicationCategory: ["UtilitiesApplication", "GeospatialTool"],
  operatingSystem: "Web Browser",
  browserRequirements: "Requires JavaScript, HTML5, WebGL",
  url: "https://www.geo-forge.org",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock"
  },
  description:
    "Powerful free online GeoJSON editor and GIS converter. Convert between GeoJSON, WKT, Shapefile, KML formats. Visualize maps, analyze spatial data with OpenLayers and Turf.js. Create hex grids, Voronoi diagrams, and perform geospatial analysis.",
  featureList: [
    "GeoJSON Editor Online",
    "WKT to GeoJSON Converter",
    "Shapefile Viewer Online",
    "KML Export Converter",
    "Spatial Analysis Tools",
    "Interactive Map Visualization",
    "Coordinate Projection System",
    "Map Drawing Tools",
    "Hexagonal Grid Generator",
    "Voronoi Diagram Creator",
    "Buffer Analysis Tool",
    "Geometry Operations",
    "Real-time Data Processing"
  ],
  screenshot: "https://www.geo-forge.org/og-image.png",
  softwareVersion: "2.0.0",
  datePublished: "2024-01-01",
  dateModified: "2026-01-19",
  inLanguage: ["en", "zh", "ja", "ko", "fr", "es"],
  author: {
    "@type": "Organization",
    name: "GeoForge Team",
    url: "https://www.geo-forge.org",
  },
  publisher: {
    "@type": "Organization",
    name: "GeoForge",
    logo: {
      "@type": "ImageObject",
      url: "https://www.geo-forge.org/logo.png"
    }
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "523",
    bestRating: "5",
    worstRating: "1"
  },
  mainEntity: {
    "@type": "SoftwareApplication",
    name: "GeoForge",
    applicationCategory: "GeospatialTool"
  }
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is GeoForge?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "GeoForge is a free online GeoJSON editor and GIS converter that allows you to convert between GeoJSON, WKT, Shapefile, and KML formats. You can visualize maps, analyze spatial data with OpenLayers and Turf.js, and perform advanced geospatial operations in your browser."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How do I convert GeoJSON to WKT?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Simply paste your GeoJSON data into the editor panel, and GeoForge will automatically convert it to WKT format. You can then copy the WKT output or export it to your preferred format."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Can I upload Shapefile files to GeoForge?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes! GeoForge supports Shapefile upload through ZIP files containing .shp, .shx, .dbf, and .prj files. Simply use the import button to upload your Shapefile and it will be automatically converted to GeoJSON for editing and visualization."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What spatial analysis tools are available?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "GeoForge provides comprehensive spatial analysis tools including buffer analysis, hexagonal grid generation, Voronoi diagrams, union/intersect/difference operations, coordinate projection, and real-time data processing with Turf.js."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is GeoForge really free to use?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, GeoForge is completely free to use with no hidden costs, registration requirements, or usage limits. All conversion and analysis features are available at no charge."
                  }
                }
              ]
            }),
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
