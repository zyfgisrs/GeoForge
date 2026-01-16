import Editor, {
  type BeforeMount,
  type Monaco,
  type OnMount,
} from "@monaco-editor/react";
import { Copy, FileWarning, Table as TableIcon, Trash2 } from "lucide-react";
import GeoJSON from "ol/format/GeoJSON";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useGeojsonStore } from "../store/geojsonStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

const STYLE_KEYS = new Set([
  "marker-color",
  "marker-size",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "fill",
  "fill-opacity",
]);

interface EditorPanelProps {
  selectedProjection: string;
  onProjectionChange: (projection: string) => void;
}

export function EditorPanel({
  selectedProjection,
  onProjectionChange,
}: EditorPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("geojson");
  const [showProjectionMenu, setShowProjectionMenu] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const geojsonText = useGeojsonStore((state) => state.geojsonText);
  const wktText = useGeojsonStore((state) => state.wktText);
  const wktDisplayMode = useGeojsonStore((state) => state.wktDisplayMode);
  const setGeojsonText = useGeojsonStore((state) => state.setGeojsonText);
  const setWktText = useGeojsonStore((state) => state.setWktText);
  const setWktDisplayMode = useGeojsonStore((state) => state.setWktDisplayMode);
  const [editorHeight, setEditorHeight] = useState(0);
  const [forceShow, setForceShow] = useState(false);
  const MAX_EDITOR_SIZE = 500_000; // 500KB

  const projections = [
    { code: "EPSG:4326", name: "WGS84" },
    { code: "EPSG:3857", name: "Web Mercator" },
    { code: "EPSG:4269", name: "NAD83" },
    { code: "EPSG:2154", name: "Lambert-93" },
  ];

  const displayGeojsonText = useMemo(() => {
    if (activeTab !== "geojson") return "";
    try {
      const json = JSON.parse(geojsonText);
      if (json.type === "FeatureCollection" && Array.isArray(json.features)) {
        const cleanFeatures = json.features.map((f: any) => {
          const props = { ...f.properties };
          STYLE_KEYS.forEach((key) => delete props[key]);
          return { ...f, properties: props };
        });
        return JSON.stringify({ ...json, features: cleanFeatures }, null, 2);
      }
      return geojsonText;
    } catch {
      return geojsonText;
    }
  }, [geojsonText, activeTab]);

  const activeText = activeTab === "geojson" ? displayGeojsonText : wktText;

  const handleGeoJSONChange = (newValue: string | undefined) => {
    if (!newValue) {
      setGeojsonText("");
      return;
    }

    try {
      const newJson = JSON.parse(newValue);
      // We parse the current store value to get the original features with styles
      let oldJson: any;
      try {
        oldJson = JSON.parse(geojsonText);
      } catch {
        oldJson = {};
      }

      if (
        newJson.type === "FeatureCollection" &&
        Array.isArray(newJson.features) &&
        oldJson.type === "FeatureCollection" &&
        Array.isArray(oldJson.features)
      ) {
        // Merge logic: restore styles from oldJson to newJson
        const mergedFeatures = newJson.features.map(
          (newF: any, index: number) => {
            // Try to find matching old feature
            // Strategy: Use ID if present, otherwise Index
            let oldF = null;
            if (newF.id) {
              oldF = oldJson.features.find((f: any) => f.id === newF.id);
            }
            if (!oldF && oldJson.features[index]) {
              oldF = oldJson.features[index];
            }

            if (oldF && oldF.properties) {
              const restoredProps = { ...newF.properties };
              STYLE_KEYS.forEach((key) => {
                if (oldF.properties[key] !== undefined) {
                  restoredProps[key] = oldF.properties[key];
                }
              });
              return { ...newF, properties: restoredProps };
            }
            return newF;
          }
        );
        setGeojsonText(
          JSON.stringify({ ...newJson, features: mergedFeatures }, null, 2)
        );
      } else {
        setGeojsonText(newValue);
      }
    } catch {
      // If invalid JSON, just set it as is (user might be typing)
      setGeojsonText(newValue);
    }
  };
  const isTooLarge = activeText.length > MAX_EDITOR_SIZE;
  const activeLines = activeText.split("\n");
  const lineHeight = 24;
  const fallbackHeight = Math.max(activeLines.length, 1) * lineHeight;

  const tableData = useMemo(() => {
    // Optimization: Only parse for table if the tab is active.
    // This prevents freezing the main thread on large dataset updates when the user isn't even looking at the table.
    if (activeTab !== "table") {
      return { columns: [], rows: [] };
    }

    if (!geojsonText.trim()) return { columns: [], rows: [] };

    try {
      const format = new GeoJSON();

      // Read features from text.
      // Note: We read as-is to preserve coordinates exactly as they are in the text (which matches selectedProjection)
      const features = format.readFeatures(geojsonText);

      const columns = new Set<string>();
      const rows = features.map((f, index) => {
        const props = f.getProperties();
        delete props.geometry; // Exclude geometry from attribute columns

        Object.keys(props).forEach((k) => {
          if (!STYLE_KEYS.has(k)) {
            columns.add(k);
          }
        });

        return {
          id: f.getId() || `f-${index}`,
          properties: props,
        };
      });

      // Sort columns alphabetically or keep them in insertion order?
      // Alphabetical is usually cleaner for dynamic attributes.
      return {
        columns: Array.from(columns).sort(),
        rows,
      };
    } catch (e) {
      console.error("Failed to parse for table view", e);
      return { columns: [], rows: [] };
    }
  }, [geojsonText, activeTab]);

  const handleEditorWillMount: BeforeMount = (monaco: Monaco) => {
    monaco.editor.defineTheme("geojson-tool", {
      base: "vs-dark",
      inherit: true,
      rules: [{ token: "", foreground: "e4e4e7" }],
      colors: {
        "editor.background": "#0b0b0f",
        "editor.foreground": "#e4e4e7",
        "editorCursor.foreground": "#e4e4e7",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#52525b",
        "editorGutter.background": "#0b0b0f",
        editorLineHighlightBackground: "#0b0b0f",
        "editorOverviewRuler.border": "#0b0b0f",
      },
    });
  };

  const handleEditorMount: OnMount = (editor) => {
    const updateHeight = () => {
      const contentHeight = editor.getContentHeight();
      setEditorHeight(contentHeight);
      editor.layout({
        width: editor.getLayoutInfo().width,
        height: contentHeight,
      });
    };

    updateHeight();
    editor.onDidContentSizeChange(updateHeight);
  };

  const handleCopy = async () => {
    let textToCopy = activeText;

    if (activeTab === "table") {
      const header = tableData.columns.join("\t");
      const rows = tableData.rows
        .map((row) =>
          tableData.columns
            .map((col) => {
              const val = row.properties[col];
              return val === null || val === undefined ? "" : String(val);
            })
            .join("\t")
        )
        .join("\n");
      textToCopy = header ? `${header}\n${rows}` : "";
    }

    if (!textToCopy) {
      setCopyStatus("success");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyStatus("success");
      toast.success(t("editor.copySuccess"));
    } catch {
      setCopyStatus("error");
      toast.error(t("editor.copyFail"));
    }

    window.setTimeout(() => setCopyStatus("idle"), 1200);
  };

  const handleClearAll = () => {
    setGeojsonText(`{
  "type": "FeatureCollection",
  "features": []
}`);
  };

  return (
    <div
      className="w-[420px] bg-[#1e1e1e] border-r border-[#27272a] flex flex-col flex-none"
      style={{ width: 420, minWidth: 420, maxWidth: 420 }}
    >
      {/* Toolbar */}
      <div className="h-12 border-b border-[#27272a] flex items-center justify-between px-4">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("geojson")}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              activeTab === "geojson"
                ? "bg-[#27272a] text-white"
                : "text-[#a1a1aa] hover:text-[#e4e4e7]"
            }`}
          >
            {t("editor.geojson")}
          </button>
          <button
            onClick={() => setActiveTab("wkt")}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              activeTab === "wkt"
                ? "bg-[#27272a] text-white"
                : "text-[#a1a1aa] hover:text-[#e4e4e7]"
            }`}
          >
            {t("editor.wkt")}
          </button>

          <button
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              activeTab === "table"
                ? "bg-[#27272a] text-white"
                : "text-[#a1a1aa] hover:text-[#e4e4e7]"
            }`}
          >
            {t("editor.table")}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            onClick={handleCopy}
            title={
              copyStatus === "success"
                ? t("editor.copySuccess")
                : copyStatus === "error"
                ? t("editor.copyFail")
                : t("common.copy")
            }
            aria-label={t("common.copy")}
          >
            <Copy className="w-4 h-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-1.5 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
                title="Clear all"
                aria-label="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#18181b] border-[#27272a] text-[#e4e4e7]">
              <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="text-sm text-[#e4e4e7]">
                  {t("editor.clearAllTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-[#a1a1aa]">
                  {t("editor.clearAllDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-end">
                <AlertDialogCancel className="border-[#27272a] bg-transparent text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7]">
                  {t("common.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                  onClick={handleClearAll}
                >
                  {t("common.clear")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Code Editor Area */}
      {activeTab === "table" ? (
        <div
          className="flex-1 bg-[#0b0b0f] overflow-auto editor-scrollbar flex flex-col w-full transition-opacity duration-200 ease-in-out"
          style={{ scrollbarGutter: "stable" }}
        >
          <table className="min-w-full text-left text-sm text-[#e4e4e7] border-collapse relative">
            <thead className="bg-[#18181b] sticky top-0 z-10 shadow-sm">
              <tr>
                {tableData.columns.map((col) => (
                  <th
                    key={col}
                    className="p-3 font-medium border-b border-[#27272a] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-[#27272a]/30 hover:bg-[#27272a]/30 transition-colors"
                >
                  {tableData.columns.map((col) => (
                    <td
                      key={col}
                      className="p-3 whitespace-nowrap text-[#e4e4e7]"
                    >
                      {typeof row.properties[col] === "object"
                        ? JSON.stringify(row.properties[col])
                        : String(row.properties[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableData.rows.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-[#52525b] gap-2">
              <TableIcon className="w-8 h-8 opacity-20" />
              <span className="text-sm">{t("common.noData")}</span>
            </div>
          )}
        </div>
      ) : isTooLarge && !forceShow ? (
        <div className="flex-1 bg-[#0b0b0f] flex flex-col items-center justify-center text-[#52525b] gap-4 p-4 text-center">
          <FileWarning className="w-12 h-12 opacity-20" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#e4e4e7]">
              {t("editor.dataTooLarge")}
            </p>
            <p className="text-xs">
              {t("editor.dataLargeDesc", {
                length: new Intl.NumberFormat("en-US").format(
                  activeText.length
                ),
                size: (activeText.length / 1024 / 1024).toFixed(2),
              })}
            </p>
          </div>
          <button
            onClick={() => setForceShow(true)}
            className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-xs rounded transition-colors"
          >
            {t("editor.loadContent")}
          </button>
        </div>
      ) : (
        <div
          className="flex-1 bg-[#0b0b0f] overflow-auto editor-scrollbar transition-opacity duration-200 ease-in-out"
          style={{
            fontFamily: 'Menlo, Monaco, "JetBrains Mono", monospace',
            scrollbarGutter: "stable",
          }}
        >
          <div className="flex min-h-full">
            {/* Line numbers */}
            <div className="px-3 py-4 text-[#52525b] select-none text-xs bg-[#0b0b0f] border-r border-[#27272a]/30">
              {activeLines.map((_, i) => (
                <div key={i} className="leading-6 text-right">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Code content */}
            <div className="flex-1 px-4 py-4">
              <Editor
                value={activeText}
                language="plaintext"
                theme="geojson-tool"
                height={editorHeight || fallbackHeight}
                width="100%"
                loading={null}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorMount}
                onChange={(value) => {
                  if (activeTab === "geojson") {
                    handleGeoJSONChange(value);
                    return;
                  }
                  setWktText(value ?? "");
                }}
                options={{
                  fontFamily: 'Menlo, Monaco, "JetBrains Mono", monospace',
                  fontSize: 12,
                  lineHeight,
                  wordWrap: "on",
                  wrappingIndent: "same",
                  minimap: { enabled: false },
                  lineNumbers: "off",
                  glyphMargin: false,
                  folding: false,
                  renderLineHighlight: "none",
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  scrollBeyondLastLine: false,
                  scrollBeyondLastColumn: 0,
                  scrollbar: {
                    vertical: "hidden",
                    horizontal: "hidden",
                    alwaysConsumeMouseWheel: false,
                  },
                  overviewRulerBorder: false,
                  overviewRulerLanes: 0,
                  renderValidationDecorations: "off",
                  guides: {
                    indentation: false,
                    highlightActiveIndentation: false,
                  },
                  contextmenu: false,
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  links: false,
                  codeLens: false,
                  matchBrackets: "never",
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div
        className="h-6 bg-gradient-to-r from-[#2563eb]/10 to-transparent border-t border-[#27272a] flex items-center justify-end px-4 relative"
        style={{ fontFamily: 'Menlo, Monaco, "JetBrains Mono", monospace' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProjectionMenu(!showProjectionMenu)}
            className="text-[10px] text-[#a1a1aa] hover:text-[#3b82f6] hover:bg-[#27272a] px-2 py-0.5 rounded transition-colors"
          >
            {selectedProjection}
          </button>
          <span className="text-[10px] text-[#52525b]">•</span>
          <span className="text-[10px] text-[#a1a1aa] min-w-[60px] text-right">
            {new Intl.NumberFormat("en-US").format(activeText.length)}{" "}
            {t("editor.charCount")}
          </span>
        </div>

        {/* Projection Dropdown Menu */}
        {showProjectionMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowProjectionMenu(false)}
            ></div>
            <div className="absolute bottom-full right-4 mb-1 bg-[#1e1e1e] border border-[#27272a] rounded-lg shadow-xl overflow-hidden z-20 min-w-[200px]">
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
  );
}
