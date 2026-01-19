"use client";

import "@/i18n/i18n";
import { useGeojsonStore } from "@/store/geojsonStore";
import dynamic from "next/dynamic";
import { useState, type CSSProperties } from "react";

// Dynamic imports for ALL components that use browser APIs or i18n
// This prevents hydration mismatch caused by language detection
const Header = dynamic(
  () => import("@/components/Header").then((mod) => mod.Header),
  { ssr: false }
);

const Footer = dynamic(
  () => import("@/components/Footer").then((mod) => mod.Footer),
  { ssr: false }
);

const EditorPanel = dynamic(
  () => import("@/components/EditorPanel").then((mod) => mod.EditorPanel),
  {
    ssr: false,
    loading: () => (
      <div className="w-[420px] bg-[#1e1e1e] border-r border-[#27272a] flex items-center justify-center">
        <div className="text-[#a1a1aa] text-sm">Loading editor...</div>
      </div>
    ),
  }
);

const MapPanel = dynamic(
  () => import("@/components/MapPanel").then((mod) => mod.MapPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 bg-[#0b0b0f] flex items-center justify-center">
        <div className="text-[#a1a1aa] text-sm">Loading map...</div>
      </div>
    ),
  }
);

const ExportModal = dynamic(
  () => import("@/components/ExportModal").then((mod) => mod.ExportModal),
  { ssr: false }
);

const ImportModal = dynamic(
  () => import("@/components/ImportModal").then((mod) => mod.ImportModal),
  { ssr: false }
);

const Toaster = dynamic(
  () => import("@/components/ui/sonner").then((mod) => mod.Toaster),
  { ssr: false }
);

export default function Home() {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const selectedProjection = useGeojsonStore(
    (state) => state.selectedProjection
  );
  const setSelectedProjection = useGeojsonStore(
    (state) => state.setSelectedProjection
  );

  const toasterStyle = {
    "--normal-bg": "#18181b",
    "--normal-text": "#e4e4e7",
    "--normal-border": "#27272a",
  } as CSSProperties;

  return (
    <div
      className="h-screen bg-[#18181b] text-[#e4e4e7] flex flex-col overflow-hidden"
      style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      {/* Header */}
      <Header
        onExportClick={() => setIsExportModalOpen(true)}
        onImportClick={() => setIsImportModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Editor Panel */}
        <EditorPanel
          selectedProjection={selectedProjection}
          onProjectionChange={setSelectedProjection}
        />

        {/* Right Map Panel */}
        <MapPanel mapImageUrl="https://images.unsplash.com/photo-1554249906-53d1582266b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b3JsZCUyMG1hcCUyMGxpZ2h0JTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3Njc2MDY0NTN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" />
      </div>

      {/* Footer */}
      <Footer
        selectedProjection={selectedProjection}
        onProjectionChange={setSelectedProjection}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      <Toaster
        theme="dark"
        position="top-right"
        style={toasterStyle}
        toastOptions={{
          className:
            "bg-[#18181b] text-[#e4e4e7] border border-[#27272a] shadow-lg",
        }}
      />
    </div>
  );
}
