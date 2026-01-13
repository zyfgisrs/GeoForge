import { AlertCircle, Download, FileJson, Lock, X } from "lucide-react";
import GeoJSON from "ol/format/GeoJSON";
import KML from "ol/format/KML";
import WKT from "ol/format/WKT";
import { useState } from "react";
// @ts-ignore
import { zip } from "@mapbox/shp-write";
import { toast } from "sonner";
import { useGeojsonStore } from "../store/geojsonStore";

import type { FeatureCollection } from "geojson";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState("geojson");
  const [fileName, setFileName] = useState("export");
  const [showError, setShowError] = useState(false);
  const geojsonText = useGeojsonStore((state) => state.geojsonText);
  const selectedProjection = useGeojsonStore(
    (state) => state.selectedProjection
  );

  const formats = [
    { id: "geojson", label: "GeoJSON" },
    { id: "shapefile", label: "Shapefile" },
    { id: "wkt", label: "WKT" },
    { id: "kml", label: "KML" },
  ];

  const handleDownload = () => {
    try {
      let geojsonObj: FeatureCollection;
      try {
        geojsonObj = JSON.parse(geojsonText) as FeatureCollection;
      } catch (e) {
        console.error("Failed to parse GeoJSON", e);
        toast.error("Invalid GeoJSON data");
        return;
      }

      let featuresList: any[] = [];
      if (geojsonObj.type === "FeatureCollection") {
        featuresList = geojsonObj.features || [];
      } else if (geojsonObj.type === "Feature") {
        featuresList = [geojsonObj];
      } else if (geojsonObj.type && typeof geojsonObj.type === "string") {
        // Assume geometry
        featuresList = [
          { type: "Feature", properties: {}, geometry: geojsonObj },
        ];
      }

      if (featuresList.length === 0) {
        setShowError(true);
        toast.error("No features to export");
        return;
      }

      let content = "";
      let mimeType = "";
      let extension = "";

      if (selectedFormat === "geojson") {
        content = geojsonText;
        mimeType = "application/json";
        extension = "geojson";
      } else if (selectedFormat === "wkt") {
        const format = new GeoJSON();
        const features = format.readFeatures(geojsonText, {
          featureProjection: "EPSG:3857",
          dataProjection: selectedProjection,
        });
        const wktFormat = new WKT();
        content = wktFormat.writeFeatures(features, {
          dataProjection: selectedProjection,
          featureProjection: "EPSG:3857",
        });
        mimeType = "text/plain";
        extension = "wkt";
      } else if (selectedFormat === "kml") {
        const format = new GeoJSON();
        const features = format.readFeatures(geojsonText, {
          featureProjection: "EPSG:3857",
          dataProjection: selectedProjection,
        });
        const kmlFormat = new KML();
        content = kmlFormat.writeFeatures(features, {
          dataProjection: "EPSG:4326", // KML uses WGS84
          featureProjection: "EPSG:3857",
        });
        mimeType = "application/vnd.google-earth.kml+xml";
        extension = "kml";
      } else if (selectedFormat === "shapefile") {
        try {
          // Use the normalized features list
          const downloadData = {
            type: "FeatureCollection" as const,
            features: featuresList,
          };

          // Options for shp-write
          const options = {
            folder: fileName || "export",
            types: {
              point: "points",
              polygon: "polygons",
              line: "lines",
              multipolygon: "multipolygons",
              multiline: "multilines",
            },
            outputType: "blob",
            compression: "DEFLATE" as any,
          } as any;

          // zip returns a Promise that resolves to a Blob (or base64 string, check doc, but usually handle as blob/buffer)
          // shp-write's zip function documentation says it returns a promise with the zip data.
          // However, for browser usage it creates a download directly if we use download().
          // But zip() gives us control.
          // Actually, shp-write implementation: if window is present, it might try to define things differently.
          // Let's assume it returns a base64 string or blob.
          // Based on common usage:

          zip(downloadData, options).then((content: any) => {
            const link = document.createElement("a");
            // content is arraybuffer or base64?
            // Usually shp-write zip() returns a blob in browser if not specified otherwise?
            // Wait, looking at types, likely ArrayBuffer or Blob.
            // If it's a blob we can just use it.
            const blob = new Blob([content], { type: "application/zip" });
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `${fileName || "export"}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            onClose();
            toast.success("Export successful");
            setShowError(false);
          });
          return; // Return here as the rest of the function is for synchronous content (text/json)
        } catch (err) {
          console.error("Shapefile generation error:", err);
          toast.error("Failed to generate Shapefile");
          setShowError(true);
          return;
        }
      }

      if (!content) {
        setShowError(true);
        return;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName || "export"}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
      toast.success("Export successful");
      setShowError(false);
    } catch (e) {
      console.error(e);
      setShowError(true);
      toast.error("Export failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative w-[560px] bg-[#0b0f16] border border-white/10 rounded-[24px] shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-start gap-4">
            {/* Gradient Icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-transparent flex items-center justify-center border border-white/10">
              <FileJson className="w-6 h-6 text-white" />
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <h2 className="text-[#e4e4e7] text-xl mb-1">Export</h2>
              <p className="text-[#a1a1aa] text-sm">
                Export your GeoJSON data in various formats
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/5 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Name Input */}
          <div className="space-y-2">
            <label className="text-[#e4e4e7] text-sm block">File Name</label>
            <div className="relative">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-[#e4e4e7] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 pr-24"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] text-sm bg-[#27272a] px-2 py-1 rounded">
                .{selectedFormat}
              </span>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-[#e4e4e7] text-sm block">Format</label>
            <div className="grid grid-cols-3 gap-3">
              {formats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`px-4 py-3 rounded-lg border text-sm transition-all ${
                    selectedFormat === format.id
                      ? "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                      : "bg-[#18181b] border-[#27272a] text-[#e4e4e7] hover:border-[#3b82f6]/50"
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>

          {/* Coordinate System */}
          <div className="space-y-2">
            <label className="text-[#e4e4e7] text-sm block">
              Coordinate System
            </label>
            <div className="relative">
              <select className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-[#e4e4e7] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 appearance-none cursor-pointer">
                <option>WGS84 (EPSG:4326)</option>
                <option>Web Mercator (EPSG:3857)</option>
                <option>NAD83 (EPSG:4269)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                <span className="bg-[#3b82f6]/20 text-[#3b82f6] text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Locked
                </span>
              </div>
            </div>
          </div>

          {/* Error Message (conditional) */}
          {showError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-400">
                Unable to export: No features found in the current dataset.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[#a1a1aa] text-sm hover:text-[#e4e4e7] hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white text-sm rounded-lg shadow-[0_4px_12px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_16px_rgba(59,130,246,0.4)] transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
