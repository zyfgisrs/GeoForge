import { ChevronDown, Crosshair, Globe } from "lucide-react";
import GeoJSON from "ol/format/GeoJSON";
import { useMemo, useState } from "react";
import { useGeojsonStore } from "../store/geojsonStore";

interface FooterProps {
  selectedProjection: string;
  onProjectionChange: (projection: string) => void;
}

export function Footer({
  selectedProjection,
  onProjectionChange,
}: FooterProps) {
  const [showProjectionMenu, setShowProjectionMenu] = useState(false);
  const geojsonText = useGeojsonStore((state) => state.geojsonText);

  const featureCount = useMemo(() => {
    if (!geojsonText.trim()) return 0;
    try {
      const format = new GeoJSON();
      const features = format.readFeatures(geojsonText);
      return features.length;
    } catch {
      return 0;
    }
  }, [geojsonText]);

  const projections = [
    { code: "EPSG:4326", name: "WGS84" },
    { code: "EPSG:3857", name: "Web Mercator" },
    { code: "EPSG:4269", name: "NAD83" },
    { code: "EPSG:2154", name: "Lambert-93" },
  ];

  const currentProjection = projections.find(
    (p) => p.code === selectedProjection
  );

  return (
    <footer
      className="h-8 bg-[#18181b] border-t border-[#27272a] flex items-center justify-between px-6 text-xs"
      style={{ fontFamily: 'Menlo, Monaco, "JetBrains Mono", monospace' }}
    >
      {/* Left side - Feature count */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
        <span className="text-[#a1a1aa]">{featureCount} Features</span>
      </div>

      {/* Right side - Coordinates and Projection */}
      <div className="flex items-center gap-4">
        {/* Coordinates */}
        <div className="flex items-center gap-2 pr-4 border-r border-[#27272a]">
          <Crosshair className="w-3 h-3 text-[#a1a1aa]" />
          <span className="text-[#a1a1aa]">
            Lat: 37.774900, Lng: -122.419400
          </span>
        </div>

        {/* Projection Selector */}
        <div className="relative">
          <button
            onClick={() => setShowProjectionMenu(!showProjectionMenu)}
            className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] px-2 py-0.5 rounded transition-colors"
          >
            <Globe className="w-3 h-3" />
            <span>{currentProjection?.name}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Projection Dropdown Menu */}
          {showProjectionMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowProjectionMenu(false)}
              ></div>
              <div className="absolute bottom-full right-0 mb-1 bg-[#1e1e1e] border border-[#27272a] rounded-lg shadow-xl overflow-hidden z-20 min-w-[200px]">
                {projections.map((proj) => (
                  <button
                    key={proj.code}
                    onClick={() => {
                      onProjectionChange(proj.code);
                      setShowProjectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                      selectedProjection === proj.code
                        ? "bg-[#3b82f6]/20 text-[#3b82f6]"
                        : "text-[#e4e4e7] hover:bg-[#27272a]"
                    }`}
                  >
                    <span>{proj.code}</span>
                    <span className="text-[#a1a1aa] text-[10px]">
                      {proj.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
