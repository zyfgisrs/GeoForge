import { Download, Upload } from "lucide-react";

interface HeaderProps {
  onExportClick?: () => void;
  onImportClick?: () => void;
}

export function Header({ onExportClick, onImportClick }: HeaderProps) {
  return (
    <header className="h-14 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between px-6">
      <div className="flex items-center gap-0.5">
        <span className="text-white text-xl">Geo</span>
        <span className="text-[#3b82f6] text-xl">Forge</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onImportClick}
          className="px-4 py-1.5 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors flex items-center gap-2"
          style={{ fontSize: "13px" }}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <button
          onClick={onExportClick}
          className="px-4 py-1.5 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors flex items-center gap-2"
          style={{ fontSize: "13px" }}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
    </header>
  );
}
