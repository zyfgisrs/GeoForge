import { Download, Globe, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface HeaderProps {
  onExportClick?: () => void;
  onImportClick?: () => void;
}

export function Header({ onExportClick, onImportClick }: HeaderProps) {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

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
          {t("header.import")}
        </button>
        <button
          onClick={onExportClick}
          className="px-4 py-1.5 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors flex items-center gap-2"
          style={{ fontSize: "13px" }}
        >
          <Download className="w-4 h-4" />
          {t("header.export")}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="px-3 py-1.5 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors flex items-center gap-2"
              style={{ fontSize: "13px" }}
            >
              <Globe className="w-4 h-4" />
              {i18n.language === "zh-CN"
                ? "简体"
                : i18n.language === "zh-TW"
                ? "繁體"
                : i18n.language === "ko-KR"
                ? "한국어"
                : i18n.language === "ja-JP"
                ? "日本語"
                : i18n.language === "fr-FR"
                ? "Français"
                : i18n.language === "es-ES"
                ? "Español"
                : "EN"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#27272a] border-[#3f3f46]"
          >
            <DropdownMenuItem
              onClick={() => changeLanguage("zh-CN")}
              className="text-[#e4e4e7] focus:bg-[#3f3f46] focus:text-white cursor-pointer"
            >
              {t("language.zh")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => changeLanguage("zh-TW")}
              className="text-[#e4e4e7] focus:bg-[#3f3f46] focus:text-white cursor-pointer"
            >
              {t("language.zh-TW")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => changeLanguage("en-US")}
              className="text-[#e4e4e7] focus:bg-[#3f3f46] focus:text-white cursor-pointer"
            >
              {t("language.en")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => changeLanguage("ko-KR")}
              className="text-[#e4e4e7] focus:bg-[#3f3f46] focus:text-white cursor-pointer"
            >
              {t("language.ko")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => changeLanguage("ja-JP")}
              className="text-[#e4e4e7] focus:bg-[#3f3f46] focus:text-white cursor-pointer"
            >
              {t("language.ja")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => changeLanguage("fr-FR")}
              className="text-[#e4e4e7] focus:bg-[#3f3f46] focus:text-white cursor-pointer"
            >
              {t("language.fr")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => changeLanguage("es-ES")}
              className="text-[#e4e4e7] focus:bg-[#3f3f46] focus:text-white cursor-pointer"
            >
              {t("language.es")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
