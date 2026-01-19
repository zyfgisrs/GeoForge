"use client";

import {
  Camera,
  Globe,
  Layers,
  Minus,
  Plus,
  Ruler,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { defaults as defaultControls } from "ol/control";
import type { EventsKey } from "ol/events";
import { all, mouseActionButton } from "ol/events/condition";
import type BaseEvent from "ol/events/Event";
import { isEmpty as isExtentEmpty } from "ol/extent";
import type Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import LineString from "ol/geom/LineString";
import Polygon from "ol/geom/Polygon";
import { defaults as defaultInteractions } from "ol/interaction";
import DragRotate from "ol/interaction/DragRotate";
import Draw, { createBox, DrawEvent } from "ol/interaction/Draw";
import Modify from "ol/interaction/Modify";
import Select, { SelectEvent } from "ol/interaction/Select";
import Snap from "ol/interaction/Snap";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Map from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";
import "ol/ol.css";
import Overlay from "ol/Overlay";
import { fromLonLat, toLonLat, transform } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { getArea, getLength } from "ol/sphere";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { createDefaultStyle } from "ol/style/Style";
import View from "ol/View";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useGeojsonStore } from "../store/geojsonStore";
import { AnalysisPanel } from "./AnalysisPanel";
import {
  CompassIcon,
  LineStringIcon,
  MeasureAreaIcon,
  PointIcon,
  PolygonIcon,
  RectangleIcon,
} from "./GisIcons";

interface MapPanelProps {
  mapImageUrl?: string;
  children?: React.ReactNode;
}

type DrawTool = "Point" | "LineString" | "Polygon" | "Rectangle" | null;
type PropertyEntry = {
  id: string;
  key: string;
  value: string;
};

type BaseMap =
  | "osm"
  | "carto-light"
  | "carto-dark"
  | "carto-voyager"
  | "arcgis-sat"
  | "arcgis-topo"
  | "opentopo";
type EditorTab = "properties" | "style";

// SimpleStyle Spec compatible style interface
interface FeatureStyle {
  // Point styles
  "marker-color"?: string;
  "marker-size"?: number;
  // Stroke styles (Line & Polygon)
  stroke?: string;
  "stroke-width"?: number;
  "stroke-opacity"?: number;
  "stroke-dasharray"?: "none" | "dash" | "dot" | "dashdot";
  // Fill styles (Polygon)
  fill?: string;
  "fill-opacity"?: number;
}

const DEFAULT_STYLES: Record<string, FeatureStyle> = {
  Point: {
    "marker-color": "#22d3ee",
    "marker-size": 6,
    stroke: "#0ea5e9",
    "stroke-width": 1.5,
  },
  LineString: {
    stroke: "#3b82f6",
    "stroke-width": 3,
    "stroke-opacity": 1,
    "stroke-dasharray": "none",
  },
  Polygon: {
    stroke: "#3b82f6",
    "stroke-width": 2,
    "stroke-opacity": 1,
    fill: "#3b82f6",
    "fill-opacity": 0.3,
  },
};

const DASH_PATTERNS: Record<string, number[] | undefined> = {
  none: undefined,
  dash: [12, 8],
  dot: [2, 6],
  dashdot: [12, 6, 2, 6],
};

// Convert hex color to rgba with opacity
const hexToRgba = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
const BASE_MAPS: {
  id: BaseMap;
  name: string;
  url?: string;
  attribution?: string;
}[] = [
  { id: "osm", name: "OpenStreetMap" },
  {
    id: "carto-light",
    name: "CartoDB Light",
    url: "https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "carto-dark",
    name: "CartoDB Dark",
    url: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "carto-voyager",
    name: "CartoDB Voyager",
    url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "arcgis-sat",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  {
    id: "arcgis-topo",
    name: "ArcGIS Topo",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012",
  },
  {
    id: "opentopo",
    name: "OpenTopoMap",
    url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  },
];

const interpolateGreatCircle = (start: number[], end: number[]) => {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;

  // To Radians
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLon1 = (lon1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const rLon2 = (lon2 * Math.PI) / 180;

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.pow(Math.sin((rLat1 - rLat2) / 2), 2) +
          Math.cos(rLat1) *
            Math.cos(rLat2) *
            Math.pow(Math.sin((rLon1 - rLon2) / 2), 2)
      )
    );

  if (d === 0) return [start, end];

  const points = [];
  const segments = 100; // Fixed segmentation for smoothness

  let lastLon = lon1;

  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x =
      A * Math.cos(rLat1) * Math.cos(rLon1) +
      B * Math.cos(rLat2) * Math.cos(rLon2);
    const y =
      A * Math.cos(rLat1) * Math.sin(rLon1) +
      B * Math.cos(rLat2) * Math.sin(rLon2);
    const z = A * Math.sin(rLat1) + B * Math.sin(rLat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);

    let lonDeg = (lon * 180) / Math.PI;

    // Unwrap longitude
    const delta = lonDeg - lastLon;
    if (delta > 180) {
      lonDeg -= 360;
    } else if (delta < -180) {
      lonDeg += 360;
    }
    lastLon = lonDeg;

    points.push([lonDeg, (lat * 180) / Math.PI]);
  }

  return points;
};

const ctrlDragOnly = (event: { originalEvent: KeyboardEvent | MouseEvent }) => {
  const originalEvent = event.originalEvent;
  return (
    originalEvent.ctrlKey &&
    !originalEvent.altKey &&
    !originalEvent.shiftKey &&
    !originalEvent.metaKey
  );
};

export function MapPanel({ mapImageUrl, children }: MapPanelProps) {
  const { t } = useTranslation();
  const [activeMeasureTool, setActiveMeasureTool] = useState<string | null>(
    null
  );
  const [activeDrawTool, setActiveDrawTool] = useState<DrawTool>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapRotation, setMapRotation] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const analysisSourceRef = useRef<VectorSource | null>(null);
  const analysisLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const dragRotateRef = useRef<DragRotate | null>(null);
  const measureDrawRef = useRef<Draw | null>(null);
  const modifyInteractionRef = useRef<Modify | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const snapInteractionRef = useRef<Snap | null>(null);
  const measureSourceRef = useRef<VectorSource | null>(null);
  const measureLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const measureTooltipRef = useRef<Overlay | null>(null);
  const measureTooltipElementRef = useRef<HTMLDivElement | null>(null);
  const measureChangeKeyRef = useRef<EventsKey | null>(null);
  const geojsonFormatRef = useRef(new GeoJSON());
  const suppressSyncRef = useRef(false);
  const lastAppliedTextRef = useRef<string | null>(null);
  const isEditingRef = useRef(false);
  const previousDrawToolRef = useRef<DrawTool>(null);
  const geojsonUpdateSourceRef = useRef<"map" | null>(null);
  const geolocationOnceRef = useRef(false);
  const propertyEditorRef = useRef<HTMLDivElement | null>(null);
  const [propertyEditorOpen, setPropertyEditorOpen] = useState(false);
  const [propertyEditorFeature, setPropertyEditorFeature] =
    useState<Feature<Geometry> | null>(null);
  const [propertyEditorPosition, setPropertyEditorPosition] = useState({
    x: 16,
    y: 16,
  });
  const [propertyEntries, setPropertyEntries] = useState<PropertyEntry[]>([]);
  const [activeEditorTab, setActiveEditorTab] =
    useState<EditorTab>("properties");
  const [featureStyle, setFeatureStyle] = useState<FeatureStyle>({});
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [activeBaseMap, setActiveBaseMap] = useState<BaseMap>("osm");
  const [baseMapMenuOpen, setBaseMapMenuOpen] = useState(false);
  const geojsonText = useGeojsonStore((state) => state.geojsonText);
  const setGeojsonText = useGeojsonStore((state) => state.setGeojsonText);
  const geojsonMode = useGeojsonStore((state) => state.geojsonMode);
  const selectedProjection = useGeojsonStore(
    (state) => state.selectedProjection
  );

  const setCursorLocation = useGeojsonStore((state) => state.setCursorLocation);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}`
      );
      const data = await response.json();
      setSearchResults(data);

      if (data && data.length > 0) {
        const first = data[0];
        const view = mapRef.current?.getView();
        if (view) {
          view.animate({
            center: fromLonLat([parseFloat(first.lon), parseFloat(first.lat)]),
            zoom: 12,
            duration: 1000,
          });
        }
      } else {
        toast.error(t("map.search.noResults") || "No results found");
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error(t("map.search.error") || "Search failed");
    }
  };

  const handleBaseMapChange = (baseMapId: BaseMap) => {
    setActiveBaseMap(baseMapId);
    setBaseMapMenuOpen(false);

    if (!mapRef.current) return;

    const layers = mapRef.current.getLayers();
    const baseLayer = layers.item(0) as TileLayer<any>;
    const baseMap = BASE_MAPS.find((m) => m.id === baseMapId);

    if (!baseMap || !baseLayer) return;

    if (baseMap.id === "osm") {
      baseLayer.setSource(new OSM({ crossOrigin: "anonymous" }));
    } else if (baseMap.url) {
      baseLayer.setSource(
        new XYZ({
          url: baseMap.url,
          attributions: baseMap.attribution,
          crossOrigin: "anonymous",
        })
      );
    }
  };

  const sketchStyle = (feature: any, resolution: number) => {
    const geometryType = feature.getGeometry()?.getType();
    if (geometryType === "Point") {
      return [];
    }
    return createDefaultStyle(feature, resolution);
  };
  const setEditingState = (next: boolean) => {
    isEditingRef.current = next;
  };
  const formatPropertyValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  const createPropertyEntry = (key: string, value: unknown): PropertyEntry => ({
    id: `prop-${Math.random().toString(36).slice(2, 9)}`,
    key,
    value: formatPropertyValue(value),
  });
  const parsePropertyValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const looksJson =
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed === "true" ||
      trimmed === "false" ||
      trimmed === "null" ||
      /^-?\d+(\.\d+)?$/.test(trimmed);
    if (!looksJson) {
      return value;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  };
  const closePropertyEditor = () => {
    setPropertyEditorOpen(false);
    setPropertyEditorFeature(null);
    setActiveEditorTab("properties");
    setFeatureStyle({});
  };

  // Extract style properties from feature
  const getStyleFromFeature = (feature: Feature<Geometry>): FeatureStyle => {
    const props = feature.getProperties();
    const geomType = feature.getGeometry()?.getType();
    const baseType = geomType?.replace("Multi", "") || "Polygon";
    const defaults = DEFAULT_STYLES[baseType] || DEFAULT_STYLES.Polygon;

    return {
      "marker-color": props["marker-color"] ?? defaults["marker-color"],
      "marker-size": props["marker-size"] ?? defaults["marker-size"],
      stroke: props["stroke"] ?? defaults["stroke"],
      "stroke-width": props["stroke-width"] ?? defaults["stroke-width"],
      "stroke-opacity": props["stroke-opacity"] ?? defaults["stroke-opacity"],
      "stroke-dasharray":
        props["stroke-dasharray"] ?? defaults["stroke-dasharray"],
      fill: props["fill"] ?? defaults["fill"],
      "fill-opacity": props["fill-opacity"] ?? defaults["fill-opacity"],
    };
  };

  // Get simple geometry type (Point, LineString, Polygon)
  const getSimpleGeomType = (feature: Feature<Geometry> | null): string => {
    if (!feature) return "Polygon";
    const geomType = feature.getGeometry()?.getType() || "Polygon";
    return geomType.replace("Multi", "");
  };

  const getEditorPosition = (clientX: number, clientY: number) => {
    const container = mapContainerRef.current;
    if (!container) {
      return { x: 16, y: 16 };
    }

    const rect = container.getBoundingClientRect();
    const panelWidth = 360;
    const panelHeight = 340;
    const padding = 12;
    let x = clientX - rect.left + 8;
    let y = clientY - rect.top + 8;
    const maxX = rect.width - panelWidth - padding;
    const maxY = rect.height - panelHeight - padding;
    x = Math.min(Math.max(padding, x), Math.max(padding, maxX));
    y = Math.min(Math.max(padding, y), Math.max(padding, maxY));

    return { x, y };
  };

  const openPropertyEditor = (
    feature: Feature<Geometry>,
    clientX: number,
    clientY: number
  ) => {
    // Extract properties (excluding geometry and style properties)
    const styleKeys = [
      "marker-color",
      "marker-size",
      "stroke",
      "stroke-width",
      "stroke-opacity",
      "stroke-dasharray",
      "fill",
      "fill-opacity",
    ];
    const entries = Object.entries(feature.getProperties())
      .filter(([key]) => key !== "geometry" && !styleKeys.includes(key))
      .map(([key, value]) => createPropertyEntry(key, value));

    setPropertyEntries(entries);
    setPropertyEditorFeature(feature);
    setPropertyEditorPosition(getEditorPosition(clientX, clientY));
    setFeatureStyle(getStyleFromFeature(feature));
    setActiveEditorTab("properties");
    setPropertyEditorOpen(true);
  };
  const updatePropertyEntry = (
    id: string,
    field: "key" | "value",
    nextValue: string
  ) => {
    setPropertyEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, [field]: nextValue } : entry
      )
    );
  };
  const addPropertyEntry = () => {
    setPropertyEntries((prev) => [...prev, createPropertyEntry("", "")]);
  };
  const removePropertyEntry = (id: string) => {
    setPropertyEntries((prev) => prev.filter((entry) => entry.id !== id));
  };
  const savePropertyChanges = () => {
    if (!propertyEditorFeature) {
      closePropertyEditor();
      return;
    }

    const nextProps: Record<string, unknown> = {};
    propertyEntries.forEach((entry) => {
      const key = entry.key.trim();
      if (!key) {
        return;
      }
      nextProps[key] = parsePropertyValue(entry.value);
    });

    // Also preserve style properties
    const styleKeys = [
      "marker-color",
      "marker-size",
      "stroke",
      "stroke-width",
      "stroke-opacity",
      "stroke-dasharray",
      "fill",
      "fill-opacity",
    ];
    styleKeys.forEach((key) => {
      const value = featureStyle[key as keyof FeatureStyle];
      if (value !== undefined) {
        nextProps[key] = value;
      }
    });

    const existingProps = propertyEditorFeature.getProperties();
    Object.keys(existingProps).forEach((key) => {
      if (key === "geometry") {
        return;
      }
      if (!(key in nextProps)) {
        propertyEditorFeature.unset(key);
      }
    });

    propertyEditorFeature.setProperties(nextProps);
    // Force feature to redraw (in case style properties were changed)
    propertyEditorFeature.changed();
    vectorLayerRef.current?.changed();
    closePropertyEditor();
  };

  const saveStyleChanges = () => {
    if (!propertyEditorFeature) {
      closePropertyEditor();
      return;
    }

    // Apply style to feature properties
    const geomType = getSimpleGeomType(propertyEditorFeature);
    const styleProps: Record<string, unknown> = {};

    if (geomType === "Point") {
      styleProps["marker-color"] = featureStyle["marker-color"];
      styleProps["marker-size"] = featureStyle["marker-size"];
      styleProps["stroke"] = featureStyle["stroke"];
      styleProps["stroke-width"] = featureStyle["stroke-width"];
    } else if (geomType === "LineString") {
      styleProps["stroke"] = featureStyle["stroke"];
      styleProps["stroke-width"] = featureStyle["stroke-width"];
      styleProps["stroke-opacity"] = featureStyle["stroke-opacity"];
      styleProps["stroke-dasharray"] = featureStyle["stroke-dasharray"];
    } else {
      // Polygon
      styleProps["stroke"] = featureStyle["stroke"];
      styleProps["stroke-width"] = featureStyle["stroke-width"];
      styleProps["stroke-opacity"] = featureStyle["stroke-opacity"];
      styleProps["fill"] = featureStyle["fill"];
      styleProps["fill-opacity"] = featureStyle["fill-opacity"];
    }

    // Also keep existing non-style properties
    const existingProps = propertyEditorFeature.getProperties();
    Object.entries(existingProps).forEach(([key, value]) => {
      if (key !== "geometry" && !(key in styleProps)) {
        styleProps[key] = value;
      }
    });

    propertyEditorFeature.setProperties(styleProps);
    // Force feature to redraw with new style
    propertyEditorFeature.changed();
    // Also refresh the layer to ensure immediate visual update
    vectorLayerRef.current?.changed();

    // Clear selection so user can see the new style immediately
    selectInteractionRef.current?.getFeatures().clear();

    closePropertyEditor();
  };

  const updateFeatureStyle = (key: keyof FeatureStyle, value: any) => {
    setFeatureStyle((prev) => ({ ...prev, [key]: value }));
  };

  const handleSnapshot = () => {
    const map = mapRef.current;
    if (!map) return;

    map.renderSync();
    const mapCanvas = document.createElement("canvas");
    const size = map.getSize();
    if (!size) return;

    mapCanvas.width = size[0];
    mapCanvas.height = size[1];
    const mapContext = mapCanvas.getContext("2d");
    if (!mapContext) return;

    const canvases = map
      .getViewport()
      .querySelectorAll(".ol-layer canvas, canvas.ol-layer");

    Array.prototype.forEach.call(canvases, function (canvas) {
      if (canvas.width > 0) {
        const opacity = canvas.parentNode.style.opacity;
        mapContext.globalAlpha = opacity === "" ? 1 : Number(opacity);
        const transform = canvas.style.transform;

        // Get the transform matrix from the style
        const matrix = transform
          .match(/^matrix\(([^\(]*)\)$/)?.[1]
          .split(",")
          .map(Number);

        if (matrix) {
          mapContext.setTransform(
            matrix[0],
            matrix[1],
            matrix[2],
            matrix[3],
            matrix[4],
            matrix[5]
          );
        }

        mapContext.drawImage(canvas, 0, 0);
      }
    });

    try {
      const blobCallback = (blob: Blob | null) => {
        if (blob) {
          const link = document.createElement("a");
          link.download = "map-snapshot.png";
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
      };

      // @ts-ignore - IE support not needed but if types were present
      if (window.navigator?.msSaveBlob && mapCanvas.msToBlob) {
        // @ts-ignore
        window.navigator.msSaveBlob(mapCanvas.msToBlob(), "map-snapshot.png");
      } else {
        mapCanvas.toBlob(blobCallback);
      }
    } catch (e) {
      console.error("Snapshot failed", e);
      toast.error(t("export.error.failed"));
    }
  };
  const formatGeojsonFromFeatures = (features: Feature<Geometry>[]) => {
    const options = {
      dataProjection: selectedProjection,
      featureProjection: "EPSG:3857",
    };

    if (features.length === 0) {
      return JSON.stringify(
        {
          type: "FeatureCollection",
          features: [],
        },
        null,
        2
      );
    }

    if (geojsonMode === "geometry" && features.length === 1) {
      const geometry = features[0].getGeometry();
      if (geometry) {
        return JSON.stringify(
          geojsonFormatRef.current.writeGeometryObject(geometry, options),
          null,
          2
        );
      }
    }

    if (geojsonMode === "feature" && features.length === 1) {
      return JSON.stringify(
        geojsonFormatRef.current.writeFeatureObject(features[0], options),
        null,
        2
      );
    }

    const geojsonObject = geojsonFormatRef.current.writeFeaturesObject(
      features,
      options
    );
    return JSON.stringify(geojsonObject, null, 2);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature, resolution) => {
        const props = feature.getProperties();
        const geometryType = feature.getGeometry()?.getType();
        const baseType = geometryType?.replace("Multi", "") || "Polygon";

        // Get style from properties or use defaults
        const defaults = DEFAULT_STYLES[baseType] || DEFAULT_STYLES.Polygon;

        if (baseType === "Point") {
          const markerColor =
            props["marker-color"] ?? defaults["marker-color"] ?? "#22d3ee";
          const markerSize =
            props["marker-size"] ?? defaults["marker-size"] ?? 6;
          const strokeColor =
            props["stroke"] ?? defaults["stroke"] ?? "#0ea5e9";
          const strokeWidth =
            props["stroke-width"] ?? defaults["stroke-width"] ?? 1.5;

          return new Style({
            image: new CircleStyle({
              radius: markerSize,
              fill: new Fill({ color: markerColor }),
              stroke: new Stroke({
                color: strokeColor,
                width: strokeWidth,
              }),
            }),
          });
        }

        if (baseType === "LineString") {
          const strokeColor =
            props["stroke"] ?? defaults["stroke"] ?? "#3b82f6";
          const strokeWidth =
            props["stroke-width"] ?? defaults["stroke-width"] ?? 3;
          const strokeOpacity =
            props["stroke-opacity"] ?? defaults["stroke-opacity"] ?? 1;
          const dashType =
            props["stroke-dasharray"] ?? defaults["stroke-dasharray"] ?? "none";
          const lineDash = DASH_PATTERNS[dashType] || undefined;

          // Parse color with opacity
          const colorWithOpacity =
            strokeOpacity < 1
              ? hexToRgba(strokeColor, strokeOpacity)
              : strokeColor;

          return new Style({
            stroke: new Stroke({
              color: colorWithOpacity,
              width: strokeWidth,
              lineDash,
            }),
          });
        }

        // Polygon
        const strokeColor = props["stroke"] ?? defaults["stroke"] ?? "#3b82f6";
        const strokeWidth =
          props["stroke-width"] ?? defaults["stroke-width"] ?? 2;
        const strokeOpacity =
          props["stroke-opacity"] ?? defaults["stroke-opacity"] ?? 1;
        const fillColor = props["fill"] ?? defaults["fill"] ?? "#3b82f6";
        const fillOpacity =
          props["fill-opacity"] ?? defaults["fill-opacity"] ?? 0.3;

        const strokeWithOpacity =
          strokeOpacity < 1
            ? hexToRgba(strokeColor, strokeOpacity)
            : strokeColor;
        const fillWithOpacity = hexToRgba(fillColor, fillOpacity);

        return new Style({
          stroke: new Stroke({
            color: strokeWithOpacity,
            width: strokeWidth,
          }),
          fill: new Fill({ color: fillWithOpacity }),
        });
      },
    });
    vectorLayerRef.current = vectorLayer;

    const analysisSource = new VectorSource();
    analysisSourceRef.current = analysisSource;
    const analysisLayer = new VectorLayer({
      source: analysisSource,
      style: (feature) => {
        const geometryType = feature.getGeometry()?.getType();
        if (geometryType === "Point" || geometryType === "MultiPoint") {
          return new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: "rgba(16, 185, 129, 0.9)" }),
              stroke: new Stroke({
                color: "rgba(255, 255, 255, 0.9)",
                width: 2,
              }),
            }),
          });
        }

        return new Style({
          stroke: new Stroke({
            color: "rgba(16, 185, 129, 0.9)",
            width: 2,
            lineDash: [6, 4],
          }),
          fill: new Fill({ color: "rgba(16, 185, 129, 0.12)" }),
        });
      },
    });
    analysisLayerRef.current = analysisLayer;

    const measureSource = new VectorSource();
    measureSourceRef.current = measureSource;
    const measureLayer = new VectorLayer({
      source: measureSource,
      style: new Style({
        stroke: new Stroke({
          color: "#f59e0b",
          width: 2,
          lineDash: [8, 8],
        }),
        fill: new Fill({ color: "rgba(245, 158, 11, 0.15)" }),
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({ color: "#f59e0b" }),
          stroke: new Stroke({ color: "#18181b", width: 1 }),
        }),
      }),
    });
    measureLayerRef.current = measureLayer;

    mapRef.current = new Map({
      target: mapContainerRef.current,
      interactions: defaultInteractions({
        altShiftDragRotate: false,
        pinchRotate: true,
        doubleClickZoom: false,
      }),
      layers: [
        new TileLayer({
          source: new OSM({ crossOrigin: "anonymous" }),
        }),
        vectorLayer,
        analysisLayer,
        measureLayer,
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
      controls: defaultControls({
        zoom: false,
        rotate: false,
        attribution: false,
      }),
    });

    const dragRotate = new DragRotate({
      condition: all(mouseActionButton, ctrlDragOnly),
      duration: 200,
    });
    const select = new Select({
      layers: [vectorLayer],
      style: (feature) => {
        const geometryType = feature.getGeometry()?.getType();
        if (geometryType === "Point" || geometryType === "MultiPoint") {
          return new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: "rgba(59, 130, 246, 0.35)" }),
              stroke: new Stroke({ color: "#3b82f6", width: 2 }),
            }),
          });
        }

        return new Style({
          stroke: new Stroke({ color: "#3b82f6", width: 2 }),
          fill: new Fill({ color: "rgba(59, 130, 246, 0.2)" }),
        });
      },
    });
    const modify = new Modify({ features: select.getFeatures() });
    const snap = new Snap({ source: vectorSource });
    mapRef.current.addInteraction(dragRotate);
    mapRef.current.addInteraction(modify);
    mapRef.current.addInteraction(select);
    mapRef.current.addInteraction(snap);
    dragRotateRef.current = dragRotate;
    modifyInteractionRef.current = modify;
    selectInteractionRef.current = select;
    snapInteractionRef.current = snap;
    setIsMapReady(true);

    const selectKey = select.on("select", (event: SelectEvent) => {
      const hasSelection =
        event.selected.length > 0 || select.getFeatures().getLength() > 0;
      if (hasSelection && !isEditingRef.current) {
        setEditingState(true);
        toast(t("map.properties.selected"));
        return;
      }
      if (!hasSelection && isEditingRef.current) {
        setEditingState(false);
        closePropertyEditor();
      }
    });

    return () => {
      if (mapRef.current && drawInteractionRef.current) {
        mapRef.current.removeInteraction(drawInteractionRef.current);
      }
      if (mapRef.current && dragRotateRef.current) {
        mapRef.current.removeInteraction(dragRotateRef.current);
      }
      if (mapRef.current && measureDrawRef.current) {
        mapRef.current.removeInteraction(measureDrawRef.current);
      }
      if (mapRef.current && modifyInteractionRef.current) {
        mapRef.current.removeInteraction(modifyInteractionRef.current);
      }
      if (mapRef.current && selectInteractionRef.current) {
        mapRef.current.removeInteraction(selectInteractionRef.current);
      }
      if (mapRef.current && snapInteractionRef.current) {
        mapRef.current.removeInteraction(snapInteractionRef.current);
      }
      unByKey(selectKey);
      if (mapRef.current && measureTooltipRef.current) {
        mapRef.current.removeOverlay(measureTooltipRef.current);
      }
      mapRef.current?.setTarget(undefined);
      mapRef.current = null;
      vectorSourceRef.current = null;
      vectorLayerRef.current = null;
      analysisSourceRef.current = null;
      analysisLayerRef.current = null;
      drawInteractionRef.current = null;
      dragRotateRef.current = null;
      measureDrawRef.current = null;
      modifyInteractionRef.current = null;
      selectInteractionRef.current = null;
      snapInteractionRef.current = null;
      measureSourceRef.current = null;
      measureLayerRef.current = null;
      measureTooltipRef.current = null;
      measureTooltipElementRef.current = null;
      measureChangeKeyRef.current = null;
      setEditingState(false);
    };
  }, []);

  useEffect(() => {
    if (!isMapReady) {
      return;
    }

    const select = selectInteractionRef.current;
    const modify = modifyInteractionRef.current;
    const isDrawing = Boolean(activeDrawTool);

    select?.setActive(!isDrawing);
    modify?.setActive(!isDrawing);

    if (isDrawing) {
      select?.getFeatures().clear();
      setEditingState(false);
      closePropertyEditor();
    }

    if (!previousDrawToolRef.current && isDrawing) {
      toast(t("map.drawing.modeActive"));
    }

    previousDrawToolRef.current = activeDrawTool;
  }, [activeDrawTool, isMapReady]);

  useEffect(() => {
    if (!activeMeasureTool) {
      return;
    }
    if (propertyEditorOpen) {
      closePropertyEditor();
    }
  }, [activeMeasureTool, propertyEditorOpen]);

  useEffect(() => {
    const map = mapRef.current;
    const source = vectorSourceRef.current;
    if (!map || !source || !isMapReady) {
      return;
    }

    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }

    if (!activeDrawTool) {
      return;
    }

    let geometryFunction: any = undefined;
    let type: any = activeDrawTool;
    if (activeDrawTool === "Rectangle") {
      type = "Circle";
      geometryFunction = createBox();
    }
    const draw = new Draw({
      source,
      type,
      style: sketchStyle as any,
      geometryFunction,
    });
    drawInteractionRef.current = draw;
    map.addInteraction(draw);

    return () => {
      map.removeInteraction(draw);
      if (drawInteractionRef.current === draw) {
        drawInteractionRef.current = null;
      }
    };
  }, [activeDrawTool, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const measureSource = measureSourceRef.current;
    if (!map || !measureSource || !isMapReady) {
      return;
    }

    if (measureDrawRef.current) {
      map.removeInteraction(measureDrawRef.current);
      measureDrawRef.current = null;
    }
    if (measureTooltipRef.current) {
      map.removeOverlay(measureTooltipRef.current);
      measureTooltipRef.current = null;
      measureTooltipElementRef.current = null;
    }
    if (measureChangeKeyRef.current) {
      unByKey(measureChangeKeyRef.current);
      measureChangeKeyRef.current = null;
    }

    if (
      activeMeasureTool !== "distance" &&
      activeMeasureTool !== "area" &&
      activeMeasureTool !== "geodesic"
    ) {
      measureSource.clear();
      return;
    }

    const formatLength = (line: LineString) => {
      const length = getLength(line, { projection: "EPSG:3857" });
      if (length > 1000) {
        return `${(length / 1000).toFixed(2)} km`;
      }
      return `${length.toFixed(1)} m`;
    };

    const formatArea = (polygon: Polygon) => {
      const area = getArea(polygon, { projection: "EPSG:3857" });
      if (area > 1_000_000) {
        return `${(area / 1_000_000).toFixed(2)} km²`;
      }
      return `${area.toFixed(1)} m²`;
    };

    const createMeasureTooltip = () => {
      if (measureTooltipRef.current) {
        map.removeOverlay(measureTooltipRef.current);
      }

      const element = document.createElement("div");
      element.style.background = "#18181b";
      element.style.border = "1px solid #27272a";
      element.style.borderRadius = "6px";
      element.style.color = "#e4e4e7";
      element.style.fontSize = "11px";
      element.style.padding = "4px 8px";
      element.style.whiteSpace = "nowrap";
      element.style.pointerEvents = "none";

      measureTooltipElementRef.current = element;
      measureTooltipRef.current = new Overlay({
        element,
        offset: [0, -12],
        positioning: "bottom-center",
        stopEvent: false,
      });
      map.addOverlay(measureTooltipRef.current);
    };

    createMeasureTooltip();

    const type = activeMeasureTool === "area" ? "Polygon" : "LineString";
    let geometryFunction: any;

    if (activeMeasureTool === "geodesic") {
      geometryFunction = (coordinates: any, geometry: any) => {
        if (!geometry) {
          geometry = new LineString([]);
        }

        const flatCoords = coordinates;
        if (flatCoords.length < 2) {
          geometry.setCoordinates(flatCoords);
          return geometry;
        }

        const densifiedPoints: any[] = [];
        for (let i = 0; i < flatCoords.length - 1; i++) {
          const start = toLonLat(flatCoords[i]);
          const end = toLonLat(flatCoords[i + 1]);
          const segment = interpolateGreatCircle(start, end);
          const projectedSegment = segment.map((c) => fromLonLat(c));

          // Align segment start with actual flatCoords start (handle world wrapping)
          const startProj = flatCoords[i];
          const calculatedStartProj = projectedSegment[0];

          if (startProj && calculatedStartProj) {
            const offsetX = startProj[0] - calculatedStartProj[0];
            // Apply offset to all points in segment if significant drift
            if (Math.abs(offsetX) > 100) {
              for (let k = 0; k < projectedSegment.length; k++) {
                projectedSegment[k] = [
                  projectedSegment[k][0] + offsetX,
                  projectedSegment[k][1],
                ];
              }
            }
          }

          if (i > 0) {
            projectedSegment.shift();
          }
          densifiedPoints.push(...projectedSegment);
        }

        geometry.setCoordinates(densifiedPoints);
        return geometry;
      };
    }

    const draw = new Draw({
      source: measureSource,
      type,
      style: sketchStyle,
      geometryFunction,
      maxPoints: activeMeasureTool === "geodesic" ? 2 : undefined,
    });
    measureDrawRef.current = draw;
    map.addInteraction(draw);

    draw.on("drawstart", (event: DrawEvent) => {
      measureSource.clear();
      createMeasureTooltip();

      const geometry = event.feature.getGeometry();
      if (!geometry) {
        return;
      }

      measureChangeKeyRef.current = geometry.on(
        "change",
        (geometryEvent: BaseEvent) => {
          const target = geometryEvent.target;
          let output = "";
          let position;

          if (target instanceof Polygon) {
            output = formatArea(target);
            position = target.getInteriorPoint().getCoordinates();
          } else if (target instanceof LineString) {
            output = formatLength(target);
            position = target.getLastCoordinate();
          }

          if (!output || !position) {
            return;
          }

          if (measureTooltipElementRef.current) {
            measureTooltipElementRef.current.innerText = output;
          }
          if (measureTooltipRef.current) {
            measureTooltipRef.current.setPosition(position);
          }
        }
      );
    });

    draw.on("drawend", () => {
      if (measureChangeKeyRef.current) {
        unByKey(measureChangeKeyRef.current);
        measureChangeKeyRef.current = null;
      }
    });

    return () => {
      map.removeInteraction(draw);
      if (measureDrawRef.current === draw) {
        measureDrawRef.current = null;
      }
    };
  }, [activeMeasureTool, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = vectorLayerRef.current;
    if (!map || !layer || !isMapReady) {
      return;
    }

    const targetElement = map.getTargetElement();
    if (!targetElement) {
      return;
    }

    const handlePointerMove = (event: MapBrowserEvent) => {
      if (event.dragging) {
        return;
      }

      const isOverFeature = map.hasFeatureAtPixel(event.pixel, {
        layerFilter: (candidate) => candidate === layer,
      });

      if (isOverFeature) {
        targetElement.style.cursor = "pointer";
        return;
      }

      if (isOverFeature) {
        targetElement.style.cursor = "pointer";
      } else {
        targetElement.style.cursor =
          activeDrawTool || activeMeasureTool ? "crosshair" : "";
      }

      const coordinate = event.coordinate;
      if (coordinate) {
        try {
          // View is always EPSG:3857
          const transformed = transform(
            coordinate,
            "EPSG:3857",
            selectedProjection
          );
          setCursorLocation({ x: transformed[0], y: transformed[1] });
        } catch (e) {
          // Fallback or ignore
        }
      }
    };

    const handleMouseLeave = () => {
      targetElement.style.cursor = "";
      setCursorLocation(null);
    };

    map.on("pointermove" as const, handlePointerMove);
    targetElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      map.un("pointermove" as const, handlePointerMove);
      targetElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [
    activeDrawTool,
    activeMeasureTool,
    isMapReady,
    selectedProjection,
    setCursorLocation,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = vectorLayerRef.current;
    if (!map || !layer || !isMapReady) {
      return;
    }

    const viewport = map.getViewport();
    const handleContextMenu = (event: MouseEvent) => {
      if (activeDrawTool || activeMeasureTool) {
        return;
      }

      const feature = map.forEachFeatureAtPixel(
        map.getEventPixel(event),
        (candidate, candidateLayer) => {
          if (candidateLayer === layer) {
            return candidate as Feature<Geometry>;
          }
          return undefined;
        },
        {
          layerFilter: (candidate) => candidate === layer,
        }
      );

      if (!feature) {
        if (propertyEditorOpen) {
          closePropertyEditor();
        }
        return;
      }

      event.preventDefault();
      const select = selectInteractionRef.current;
      if (select) {
        select.getFeatures().clear();
        select.getFeatures().push(feature as Feature<Geometry>);
      }
      setEditingState(true);
      openPropertyEditor(
        feature as Feature<Geometry>,
        event.clientX,
        event.clientY
      );
    };

    viewport.addEventListener("contextmenu", handleContextMenu);
    viewport.addEventListener("dblclick", handleContextMenu);

    return () => {
      viewport.removeEventListener("contextmenu", handleContextMenu);
      viewport.removeEventListener("dblclick", handleContextMenu);
    };
  }, [activeDrawTool, activeMeasureTool, isMapReady, propertyEditorOpen]);

  useEffect(() => {
    if (!propertyEditorOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (
        propertyEditorRef.current &&
        propertyEditorRef.current.contains(event.target as Node)
      ) {
        return;
      }
      closePropertyEditor();
    };

    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [propertyEditorOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) {
      return;
    }

    const view = map.getView();
    const syncRotation = () => {
      setMapRotation(view.getRotation() ?? 0);
    };

    syncRotation();
    view.on("change:rotation", syncRotation);

    return () => {
      view.un("change:rotation", syncRotation);
    };
  }, [isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || geolocationOnceRef.current) {
      return;
    }

    if (!("geolocation" in navigator)) {
      return;
    }

    geolocationOnceRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const view = map.getView();
        const { latitude, longitude } = position.coords;
        view.animate({
          center: fromLonLat([longitude, latitude]),
          zoom: 12,
          duration: 600,
        });
      },
      () => {
        // Ignore geolocation errors silently.
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      }
    );
  }, [isMapReady]);

  useEffect(() => {
    if (!activeDrawTool) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      drawInteractionRef.current?.abortDrawing();
      setActiveDrawTool(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDrawTool]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (propertyEditorOpen) {
        closePropertyEditor();
        return;
      }

      if (!isEditingRef.current) {
        return;
      }

      selectInteractionRef.current?.clearSelection();
      setEditingState(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const source = vectorSourceRef.current;
    if (!source) {
      return;
    }

    const updateSource = geojsonUpdateSourceRef.current;
    geojsonUpdateSourceRef.current = null;

    const normalizedText = geojsonText.trim();
    if (normalizedText === lastAppliedTextRef.current) {
      return;
    }

    let features: Feature<Geometry>[] = [];
    try {
      features = geojsonFormatRef.current.readFeatures(normalizedText, {
        dataProjection: selectedProjection,
        featureProjection: "EPSG:3857",
      });
    } catch {
      features = [];
    }

    suppressSyncRef.current = true;
    source.clear();
    if (features.length > 0) {
      source.addFeatures(features);
    }
    suppressSyncRef.current = false;
    lastAppliedTextRef.current = normalizedText;

    if (updateSource !== "map" && features.length > 0) {
      const view = mapRef.current?.getView();
      if (view) {
        const extent = source.getExtent();
        if (!isExtentEmpty(extent)) {
          view.fit(extent, {
            padding: [40, 40, 40, 40],
            duration: 300,
            maxZoom: 16,
          });
        }
      }
    }
  }, [geojsonText, selectedProjection]);

  useEffect(() => {
    analysisSourceRef.current?.clear();
  }, [geojsonMode, geojsonText, selectedProjection]);

  useEffect(() => {
    const source = vectorSourceRef.current;
    if (!source) {
      return;
    }

    const syncFromMap = () => {
      if (suppressSyncRef.current) {
        return;
      }

      const features = source.getFeatures();
      const nextText = formatGeojsonFromFeatures(features);

      if (nextText !== geojsonText) {
        lastAppliedTextRef.current = nextText.trim();
        geojsonUpdateSourceRef.current = "map";
        setGeojsonText(nextText);
      }
    };

    source.on("addfeature", syncFromMap);
    source.on("changefeature", syncFromMap);
    source.on("removefeature", syncFromMap);

    return () => {
      source.un("addfeature", syncFromMap);
      source.un("changefeature", syncFromMap);
      source.un("removefeature", syncFromMap);
    };
  }, [geojsonMode, geojsonText, selectedProjection, setGeojsonText]);

  const handleZoomIn = () => {
    const view = mapRef.current?.getView();
    if (!view) {
      return;
    }

    const currentZoom = view.getZoom() ?? 0;
    view.animate({ zoom: currentZoom + 1, duration: 150 });
  };

  const handleZoomOut = () => {
    const view = mapRef.current?.getView();
    if (!view) {
      return;
    }

    const currentZoom = view.getZoom() ?? 0;
    view.animate({ zoom: currentZoom - 1, duration: 150 });
  };

  const handleResetNorth = () => {
    const view = mapRef.current?.getView();
    if (!view) {
      return;
    }

    const rotation = view.getRotation() ?? 0;
    if (rotation === 0) {
      return;
    }
    view.animate({ rotation: 0, duration: 200 });
  };

  const compassStyle = {
    transform: `rotate(${mapRotation * (180 / Math.PI)}deg)`,
    transition: "transform 120ms ease-out",
  };

  const handleDeleteSelected = () => {
    const source = vectorSourceRef.current;
    const select = selectInteractionRef.current;
    if (!source || !select) {
      return;
    }

    const selectedFeatures = select.getFeatures();
    if (selectedFeatures.getLength() === 0) {
      return;
    }

    selectedFeatures
      .getArray()
      .slice()
      .forEach((feature) => {
        source.removeFeature(feature);
      });
    selectedFeatures.clear();
  };

  return (
    <div className="flex-1 bg-white relative">
      {/* Map */}
      <div className="absolute inset-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-4 pointer-events-none items-start">
        {/* Expanding Search */}
        <div style={{ pointerEvents: "auto" }}>
          <div
            className="flex items-center bg-[#18181b] rounded-full border border-[#27272a] shadow-lg overflow-hidden transition-all duration-300 ease-in-out"
            style={{ width: searchOpen ? "280px" : "36px" }}
          >
            <button
              onClick={() => {
                setSearchOpen(!searchOpen);
                if (!searchOpen) {
                  toast.info(t("map.searchHint"));
                  setTimeout(
                    () => document.getElementById("search-input")?.focus(),
                    100
                  );
                }
              }}
              className="p-2 text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors flex-shrink-0"
              title={t("map.search")}
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Search input - only visible when expanded */}
            <form
              onSubmit={handleSearch}
              className={`flex-1 flex items-center pr-3 transition-opacity duration-200 ${
                searchOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("map.search")}
                className="flex-1 bg-transparent border-none text-sm text-[#e4e4e7] placeholder-[#52525b] focus:outline-none"
                tabIndex={searchOpen ? 0 : -1}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-[#52525b] hover:text-[#e4e4e7] rounded-full hover:bg-[#27272a] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Drawing Tools */}
        <div
          className="flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg"
          style={{ pointerEvents: "auto" }}
        >
          <button
            className={`p-2 rounded transition-colors ${
              activeDrawTool === "Point"
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.drawing.point")}
            aria-pressed={activeDrawTool === "Point"}
            onClick={() => {
              setActiveMeasureTool(null);
              setActiveDrawTool(activeDrawTool === "Point" ? null : "Point");
            }}
          >
            <PointIcon className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded transition-colors ${
              activeDrawTool === "LineString"
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.drawing.line")}
            aria-pressed={activeDrawTool === "LineString"}
            onClick={() => {
              setActiveMeasureTool(null);
              setActiveDrawTool(
                activeDrawTool === "LineString" ? null : "LineString"
              );
            }}
          >
            <LineStringIcon className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded transition-colors ${
              activeDrawTool === "Polygon"
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.drawing.polygon")}
            aria-pressed={activeDrawTool === "Polygon"}
            onClick={() => {
              setActiveMeasureTool(null);
              setActiveDrawTool(
                activeDrawTool === "Polygon" ? null : "Polygon"
              );
            }}
          >
            <PolygonIcon className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded transition-colors ${
              activeDrawTool === "Rectangle"
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.drawing.rectangle")}
            aria-pressed={activeDrawTool === "Rectangle"}
            onClick={() => {
              setActiveMeasureTool(null);
              setActiveDrawTool(
                activeDrawTool === "Rectangle" ? null : "Rectangle"
              );
            }}
          >
            <RectangleIcon className="w-4 h-4" />
          </button>
          <div className="h-px bg-[#27272a] my-1"></div>
          <button
            className="p-2 text-[#ef4444] hover:bg-[#27272a] rounded transition-colors"
            title={t("map.drawing.delete")}
            onClick={handleDeleteSelected}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Controls - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
        {/* Zoom and Compass */}
        <div className="w-9 flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
          <button
            className="p-2 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            title={t("map.navigation.zoomIn")}
            onClick={handleZoomIn}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            className="p-2 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            title={t("map.navigation.zoomOut")}
            onClick={handleZoomOut}
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="h-px bg-[#27272a] my-1"></div>
          <button
            className="p-2 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            title={t("map.navigation.resetNorth")}
            onClick={handleResetNorth}
          >
            <CompassIcon className="w-4 h-4" style={compassStyle} />
          </button>
        </div>

        {/* Measure Tools */}
        <div className="w-9 flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
          <button
            onClick={() => {
              const nextTool =
                activeMeasureTool === "distance" ? null : "distance";
              setActiveMeasureTool(nextTool);
              if (nextTool) {
                setActiveDrawTool(null);
              }
            }}
            className={`p-2 rounded transition-colors ${
              activeMeasureTool === "distance"
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.measure.distance")}
          >
            <Ruler className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const nextTool = activeMeasureTool === "area" ? null : "area";
              setActiveMeasureTool(nextTool);
              if (nextTool) {
                setActiveDrawTool(null);
              }
            }}
            className={`p-2 rounded transition-colors ${
              activeMeasureTool === "area"
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.measure.area")}
          >
            <MeasureAreaIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const nextTool =
                activeMeasureTool === "geodesic" ? null : "geodesic";
              setActiveMeasureTool(nextTool);
              if (nextTool) {
                setActiveDrawTool(null);
              }
            }}
            className={`p-2 rounded transition-colors ${
              activeMeasureTool === "geodesic"
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.measure.geodesic")}
          >
            <Globe className="w-4 h-4" />
          </button>
        </div>

        <div className="w-9 flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
          <button
            onClick={handleSnapshot}
            className="p-2 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            title={t("map.snapshot")}
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Analysis Tools */}
        <div className="w-9 flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
          <button
            onClick={() => setAnalysisOpen((open) => !open)}
            className={`p-2 rounded transition-colors ${
              analysisOpen
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title={t("map.analysis.title")}
            aria-pressed={analysisOpen}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

      {analysisOpen && (
        <AnalysisPanel
          isOpen={analysisOpen}
          onClose={() => setAnalysisOpen(false)}
          geojsonText={geojsonText}
          geojsonMode={geojsonMode}
          selectedProjection={selectedProjection}
          map={mapRef.current}
          analysisSource={analysisSourceRef.current}
        />
      )}

      {propertyEditorOpen && (
        <div
          className="absolute z-20"
          style={{
            left: propertyEditorPosition.x,
            top: propertyEditorPosition.y,
          }}
        >
          <div
            ref={propertyEditorRef}
            className="bg-[#18181b] border border-[#27272a] rounded-lg shadow-lg text-[#e4e4e7]"
            style={{ width: 360 }}
            onContextMenu={(event) => event.preventDefault()}
          >
            {/* Tab Header */}
            <div className="flex border-b border-[#27272a]">
              <button
                className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                  activeEditorTab === "properties"
                    ? "text-[#3b82f6] border-b-2 border-[#3b82f6] bg-[#3b82f6]/5"
                    : "text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a]/50"
                }`}
                onClick={() => setActiveEditorTab("properties")}
              >
                {t("map.properties.title")}
              </button>
              <button
                className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                  activeEditorTab === "style"
                    ? "text-[#3b82f6] border-b-2 border-[#3b82f6] bg-[#3b82f6]/5"
                    : "text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a]/50"
                }`}
                onClick={() => setActiveEditorTab("style")}
              >
                {t("map.style.title")}
              </button>
              <button
                className="px-3 py-2 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] transition-colors"
                onClick={closePropertyEditor}
                title={t("map.properties.close")}
                aria-label={t("map.properties.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* Properties Tab Content */}
              {activeEditorTab === "properties" && (
                <div className="flex flex-col gap-3">
                  <div
                    className="flex flex-col gap-2 overflow-auto property-scrollbar"
                    style={{ maxHeight: 200 }}
                  >
                    {propertyEntries.length === 0 ? (
                      <div className="text-xs text-[#71717a] py-2">
                        {t("map.properties.noProperties")}
                      </div>
                    ) : (
                      propertyEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-2 min-w-0"
                        >
                          <input
                            className="min-w-0 flex-1 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1.5 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
                            placeholder={t("map.properties.key")}
                            value={entry.key}
                            onChange={(event) =>
                              updatePropertyEntry(
                                entry.id,
                                "key",
                                event.target.value
                              )
                            }
                          />
                          <input
                            className="min-w-0 flex-1 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1.5 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
                            placeholder={t("map.properties.value")}
                            value={entry.value}
                            onChange={(event) =>
                              updatePropertyEntry(
                                entry.id,
                                "value",
                                event.target.value
                              )
                            }
                          />
                          <button
                            className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
                            onClick={() => removePropertyEntry(entry.id)}
                            title={t("map.properties.remove")}
                            aria-label={t("map.properties.remove")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#27272a]">
                    <button
                      className="text-xs text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
                      onClick={addPropertyEntry}
                    >
                      + {t("map.properties.add")}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        className="px-3 py-1.5 rounded text-xs text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] transition-colors"
                        onClick={closePropertyEditor}
                      >
                        {t("map.properties.cancel")}
                      </button>
                      <button
                        className="px-3 py-1.5 rounded text-xs bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
                        onClick={savePropertyChanges}
                      >
                        {t("map.properties.save")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Style Tab Content */}
              {activeEditorTab === "style" && (
                <div className="flex flex-col gap-3">
                  <div
                    className="flex flex-col gap-3 overflow-auto property-scrollbar"
                    style={{ maxHeight: 240 }}
                  >
                    {/* Point Styles */}
                    {getSimpleGeomType(propertyEditorFeature) === "Point" && (
                      <>
                        {/* Marker Color */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.fillColor")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="w-8 h-8 rounded border border-[#27272a] bg-transparent cursor-pointer"
                              value={featureStyle["marker-color"] || "#22d3ee"}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "marker-color",
                                  e.target.value
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-16">
                              {featureStyle["marker-color"] || "#22d3ee"}
                            </span>
                          </div>
                        </div>
                        {/* Marker Size */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.size")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="2"
                              max="20"
                              step="1"
                              className="w-24 accent-[#3b82f6]"
                              value={featureStyle["marker-size"] || 6}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "marker-size",
                                  Number(e.target.value)
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-10 text-right">
                              {featureStyle["marker-size"] || 6}px
                            </span>
                          </div>
                        </div>
                        {/* Stroke Color */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.strokeColor")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="w-8 h-8 rounded border border-[#27272a] bg-transparent cursor-pointer"
                              value={featureStyle["stroke"] || "#0ea5e9"}
                              onChange={(e) =>
                                updateFeatureStyle("stroke", e.target.value)
                              }
                            />
                            <span className="text-xs text-[#71717a] w-16">
                              {featureStyle["stroke"] || "#0ea5e9"}
                            </span>
                          </div>
                        </div>
                        {/* Stroke Width */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.strokeWidth")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              className="w-24 accent-[#3b82f6]"
                              value={featureStyle["stroke-width"] || 1.5}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "stroke-width",
                                  Number(e.target.value)
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-10 text-right">
                              {featureStyle["stroke-width"] || 1.5}px
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* LineString Styles */}
                    {getSimpleGeomType(propertyEditorFeature) ===
                      "LineString" && (
                      <>
                        {/* Stroke Color */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.strokeColor")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="w-8 h-8 rounded border border-[#27272a] bg-transparent cursor-pointer"
                              value={featureStyle["stroke"] || "#3b82f6"}
                              onChange={(e) =>
                                updateFeatureStyle("stroke", e.target.value)
                              }
                            />
                            <span className="text-xs text-[#71717a] w-16">
                              {featureStyle["stroke"] || "#3b82f6"}
                            </span>
                          </div>
                        </div>
                        {/* Stroke Width */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.strokeWidth")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="1"
                              max="20"
                              step="0.5"
                              className="w-24 accent-[#3b82f6]"
                              value={featureStyle["stroke-width"] || 3}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "stroke-width",
                                  Number(e.target.value)
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-10 text-right">
                              {featureStyle["stroke-width"] || 3}px
                            </span>
                          </div>
                        </div>
                        {/* Stroke Opacity */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.opacity")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              className="w-24 accent-[#3b82f6]"
                              value={featureStyle["stroke-opacity"] ?? 1}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "stroke-opacity",
                                  Number(e.target.value)
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-10 text-right">
                              {Math.round(
                                (featureStyle["stroke-opacity"] ?? 1) * 100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                        {/* Dash Style */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.dashStyle")}
                          </label>
                          <select
                            className="bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1.5 text-xs text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
                            value={featureStyle["stroke-dasharray"] || "none"}
                            onChange={(e) =>
                              updateFeatureStyle(
                                "stroke-dasharray",
                                e.target.value as any
                              )
                            }
                          >
                            <option value="none">{t("map.style.none")}</option>
                            <option value="dash">{t("map.style.dash")}</option>
                            <option value="dot">{t("map.style.dot")}</option>
                            <option value="dashdot">
                              {t("map.style.dashdot")}
                            </option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Polygon Styles */}
                    {getSimpleGeomType(propertyEditorFeature) === "Polygon" && (
                      <>
                        {/* Fill Color */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.fillColor")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="w-8 h-8 rounded border border-[#27272a] bg-transparent cursor-pointer"
                              value={featureStyle["fill"] || "#3b82f6"}
                              onChange={(e) =>
                                updateFeatureStyle("fill", e.target.value)
                              }
                            />
                            <span className="text-xs text-[#71717a] w-16">
                              {featureStyle["fill"] || "#3b82f6"}
                            </span>
                          </div>
                        </div>
                        {/* Fill Opacity */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.fillOpacity")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              className="w-24 accent-[#3b82f6]"
                              value={featureStyle["fill-opacity"] ?? 0.3}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "fill-opacity",
                                  Number(e.target.value)
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-10 text-right">
                              {Math.round(
                                (featureStyle["fill-opacity"] ?? 0.3) * 100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                        {/* Stroke Color */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.strokeColor")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="w-8 h-8 rounded border border-[#27272a] bg-transparent cursor-pointer"
                              value={featureStyle["stroke"] || "#3b82f6"}
                              onChange={(e) =>
                                updateFeatureStyle("stroke", e.target.value)
                              }
                            />
                            <span className="text-xs text-[#71717a] w-16">
                              {featureStyle["stroke"] || "#3b82f6"}
                            </span>
                          </div>
                        </div>
                        {/* Stroke Width */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.strokeWidth")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              className="w-24 accent-[#3b82f6]"
                              value={featureStyle["stroke-width"] || 2}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "stroke-width",
                                  Number(e.target.value)
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-10 text-right">
                              {featureStyle["stroke-width"] || 2}px
                            </span>
                          </div>
                        </div>
                        {/* Stroke Opacity */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#a1a1aa]">
                            {t("map.style.strokeOpacity")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              className="w-24 accent-[#3b82f6]"
                              value={featureStyle["stroke-opacity"] ?? 1}
                              onChange={(e) =>
                                updateFeatureStyle(
                                  "stroke-opacity",
                                  Number(e.target.value)
                                )
                              }
                            />
                            <span className="text-xs text-[#71717a] w-10 text-right">
                              {Math.round(
                                (featureStyle["stroke-opacity"] ?? 1) * 100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-[#27272a]">
                    <button
                      className="px-3 py-1.5 rounded text-xs text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] transition-colors"
                      onClick={closePropertyEditor}
                    >
                      {t("map.properties.cancel")}
                    </button>
                    <button
                      className="px-3 py-1.5 rounded text-xs bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
                      onClick={saveStyleChanges}
                    >
                      {t("map.style.apply")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Base Map Switcher - Bottom Right */}
      <div
        className="absolute z-10 flex flex-col gap-2"
        style={{ right: "1.5rem", bottom: "1.5rem" }}
      >
        {baseMapMenuOpen && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-1.5 flex flex-col gap-1 w-40 shadow-xl animate-in fade-in zoom-in-95 duration-200 mb-2">
            {BASE_MAPS.map((baseMap) => (
              <button
                key={baseMap.id}
                onClick={() => handleBaseMapChange(baseMap.id)}
                className={`text-left px-3 py-2 rounded text-xs transition-colors ${
                  activeBaseMap === baseMap.id
                    ? "bg-[#3b82f6] text-white"
                    : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7]"
                }`}
              >
                {baseMap.id === "osm"
                  ? t("map.baseMap.osm")
                  : baseMap.id === "carto-light"
                  ? t("map.baseMap.cartoLight")
                  : baseMap.id === "carto-dark"
                  ? t("map.baseMap.cartoDark")
                  : baseMap.id === "carto-voyager"
                  ? t("map.baseMap.cartoVoyager")
                  : baseMap.id === "arcgis-sat"
                  ? t("map.baseMap.satellite")
                  : baseMap.id === "arcgis-topo"
                  ? t("map.baseMap.arcgisTopo")
                  : t("map.baseMap.opentopo")}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setBaseMapMenuOpen(!baseMapMenuOpen)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border border-[#27272a] transition-all duration-200 shadow-lg ${
            baseMapMenuOpen
              ? "bg-[#3b82f6] text-white border-[#3b82f6]"
              : "bg-[#18181b] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7] hover:border-[#3f3f46]"
          }`}
          title={t("map.baseMap.switch")}
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {children}
    </div>
  );
}
