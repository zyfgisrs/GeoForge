import {
  AlertCircle,
  FileArchive,
  FileJson,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import shp from "shpjs";
import { useGeojsonStore } from "../store/geojsonStore";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    {
      id: "geojson",
      label: "GeoJSON",
      extensions: [".geojson", ".json"],
      icon: FileJson,
      color: "#3b82f6",
    },
    {
      id: "shapefile",
      label: "Shapefile",
      extensions: [".zip"],
      icon: FileArchive,
      color: "#8b5cf6",
    },
    {
      id: "wkt",
      label: "WKT",
      extensions: [".txt", ".wkt"],
      icon: FileText,
      color: "#10b981",
    },
  ];

  const handleFileSelect = (file: File) => {
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isSupported = supportedFormats.some((format) =>
      format.extensions.includes(fileExtension)
    );

    if (!isSupported) {
      setError(
        "Unsupported file format. Please upload a GeoJSON, Shapefile (ZIP), or WKT (TXT) file."
      );
      setSelectedFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const setGeojsonText = useGeojsonStore((state) => state.setGeojsonText);
  const setWktText = useGeojsonStore((state) => state.setWktText);

  const handleImport = async () => {
    if (selectedFile) {
      try {
        const text = await selectedFile.text();
        const extension =
          "." + selectedFile.name.split(".").pop()?.toLowerCase();

        if (extension === ".json" || extension === ".geojson") {
          try {
            JSON.parse(text); // Validate JSON
            setGeojsonText(text);
            onClose();
          } catch (e) {
            setError("Invalid GeoJSON file.");
          }
        } else if (extension === ".wkt" || extension === ".txt") {
          setWktText(text);
          onClose();
        } else if (extension === ".zip") {
          const buffer = await selectedFile.arrayBuffer();
          const geojson = await shp(buffer);

          let finalGeoJSON;
          if (Array.isArray(geojson)) {
            const features = geojson.flatMap((g) => g.features);
            finalGeoJSON = { type: "FeatureCollection", features };
          } else {
            finalGeoJSON = geojson;
          }

          setGeojsonText(JSON.stringify(finalGeoJSON, null, 2));
          onClose();
        } else {
          setError("Unsupported file type.");
        }
      } catch (err) {
        setError("Failed to read file.");
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10b981] to-transparent flex items-center justify-center border border-white/10">
              <Upload className="w-6 h-6 text-white" />
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <h2 className="text-[#e4e4e7] text-xl mb-1">Import Data</h2>
              <p className="text-[#a1a1aa] text-sm">
                Upload GeoJSON, Shapefile, or WKT files
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
          {/* File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 transition-all ${
              isDragging
                ? "border-[#3b82f6] bg-[#3b82f6]/5"
                : "border-[#27272a] hover:border-[#3b82f6]/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              accept=".geojson,.json,.zip,.txt,.wkt"
              className="hidden"
            />

            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#18181b] flex items-center justify-center border border-[#27272a]">
                <Upload className="w-8 h-8 text-[#a1a1aa]" />
              </div>

              {selectedFile ? (
                <div className="text-center space-y-2">
                  <div className="flex items-center gap-2 bg-[#18181b] px-4 py-2 rounded-lg border border-[#27272a]">
                    <FileJson className="w-4 h-4 text-[#3b82f6]" />
                    <span className="text-[#e4e4e7] text-sm">
                      {selectedFile.name}
                    </span>
                    <span className="text-[#a1a1aa] text-xs">
                      ({formatFileSize(selectedFile.size)})
                    </span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="ml-2 p-0.5 text-[#a1a1aa] hover:text-[#e4e4e7] rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-[#e4e4e7]">Drag and drop your file here</p>
                  <p className="text-[#a1a1aa] text-sm">or</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#18181b] text-[#e4e4e7] text-sm rounded-lg border border-[#27272a] hover:border-[#3b82f6]/50 transition-colors"
                  >
                    Browse Files
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Supported Formats */}
          <div className="space-y-2">
            <label className="text-[#e4e4e7] text-sm block">
              Supported Formats
            </label>
            <div className="grid grid-cols-3 gap-3">
              {supportedFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <div
                    key={format.id}
                    className="px-4 py-3 rounded-lg border bg-[#18181b] border-[#27272a] flex flex-col items-center gap-2"
                  >
                    <Icon className="w-5 h-5" style={{ color: format.color }} />
                    <span className="text-[#e4e4e7] text-sm">
                      {format.label}
                    </span>
                    <span className="text-[#71717a] text-xs">
                      {format.extensions.join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Message (conditional) */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}

          {/* File Info */}
          <div className="space-y-2">
            <label className="text-[#e4e4e7] text-sm block">
              Import Options
            </label>
            <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="replaceExisting"
                  defaultChecked
                  className="w-4 h-4 rounded border-[#27272a] bg-transparent text-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/50"
                />
                <label
                  htmlFor="replaceExisting"
                  className="text-[#e4e4e7] text-sm cursor-pointer"
                >
                  Replace existing features
                </label>
              </div>
            </div>
          </div>
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
            onClick={handleImport}
            disabled={!selectedFile}
            className={`px-5 py-2.5 text-white text-sm rounded-lg flex items-center gap-2 transition-all ${
              selectedFile
                ? "bg-gradient-to-r from-[#10b981] to-[#059669] shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_16px_rgba(16,185,129,0.4)]"
                : "bg-[#27272a] text-[#52525b] cursor-not-allowed"
            }`}
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
