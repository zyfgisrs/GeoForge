import { Layers, Minus, Plus, Ruler, Sparkles, Trash2, X } from "lucide-react";
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
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { getArea, getLength } from "ol/sphere";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { createDefaultStyle } from "ol/style/Style";
import View from "ol/View";
import { useEffect, useRef, useState } from "react";
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

type BaseMap = "osm" | "carto-light" | "carto-dark" | "arcgis-sat";

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
    id: "arcgis-sat",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
];

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
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [activeBaseMap, setActiveBaseMap] = useState<BaseMap>("osm");
  const [baseMapMenuOpen, setBaseMapMenuOpen] = useState(false);
  const geojsonText = useGeojsonStore((state) => state.geojsonText);
  const setGeojsonText = useGeojsonStore((state) => state.setGeojsonText);
  const geojsonMode = useGeojsonStore((state) => state.geojsonMode);
  const selectedProjection = useGeojsonStore(
    (state) => state.selectedProjection
  );

  const handleBaseMapChange = (baseMapId: BaseMap) => {
    setActiveBaseMap(baseMapId);
    setBaseMapMenuOpen(false);

    if (!mapRef.current) return;

    const layers = mapRef.current.getLayers();
    const baseLayer = layers.item(0) as TileLayer<any>;
    const baseMap = BASE_MAPS.find((m) => m.id === baseMapId);

    if (!baseMap || !baseLayer) return;

    if (baseMap.id === "osm") {
      baseLayer.setSource(new OSM());
    } else if (baseMap.url) {
      baseLayer.setSource(
        new XYZ({
          url: baseMap.url,
          attributions: baseMap.attribution,
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
  };
  const getEditorPosition = (clientX: number, clientY: number) => {
    const container = mapContainerRef.current;
    if (!container) {
      return { x: 16, y: 16 };
    }

    const rect = container.getBoundingClientRect();
    const panelWidth = 320;
    const panelHeight = 260;
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
    const entries = Object.entries(feature.getProperties())
      .filter(([key]) => key !== "geometry")
      .map(([key, value]) => createPropertyEntry(key, value));
    setPropertyEntries(entries);
    setPropertyEditorFeature(feature);
    setPropertyEditorPosition(getEditorPosition(clientX, clientY));
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
    closePropertyEditor();
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
        const geometryType = feature.getGeometry()?.getType();
        if (geometryType === "Point" || geometryType === "MultiPoint") {
          return new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color: "rgba(34, 211, 238, 0.8)" }),
              stroke: new Stroke({
                color: "rgba(14, 165, 233, 0.9)",
                width: 1.5,
              }),
            }),
          });
        }
        return createDefaultStyle(feature, resolution);
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
          source: new OSM(),
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
        toast(
          "Selected. Double-click or right-click to edit properties. Esc to deselect."
        );
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
      toast("Drawing mode active. Press Esc to exit.");
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

    if (activeMeasureTool !== "distance" && activeMeasureTool !== "area") {
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

    const draw = new Draw({
      source: measureSource,
      type: activeMeasureTool === "area" ? "Polygon" : "LineString",
      style: sketchStyle,
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

      targetElement.style.cursor =
        activeDrawTool || activeMeasureTool ? "crosshair" : "";
    };

    const handleMouseLeave = () => {
      targetElement.style.cursor = "";
    };

    map.on("pointermove" as const, handlePointerMove);
    targetElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      map.un("pointermove" as const, handlePointerMove);
      targetElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [activeDrawTool, activeMeasureTool, isMapReady]);

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

      {/* Drawing Tools - Top Left */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
        <button
          className={`p-2 rounded transition-colors ${
            activeDrawTool === "Point"
              ? "bg-[#3b82f6] text-white"
              : "text-[#e4e4e7] hover:bg-[#27272a]"
          }`}
          title="Draw Point"
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
          title="Draw Line"
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
          title="Draw Polygon"
          aria-pressed={activeDrawTool === "Polygon"}
          onClick={() => {
            setActiveMeasureTool(null);
            setActiveDrawTool(activeDrawTool === "Polygon" ? null : "Polygon");
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
          title="Draw Rectangle"
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
          title="Delete"
          onClick={handleDeleteSelected}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Controls - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* Zoom and Compass */}
        <div className="flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
          <button
            className="p-2 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            title="Zoom In"
            onClick={handleZoomIn}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            className="p-2 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            title="Zoom Out"
            onClick={handleZoomOut}
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="h-px bg-[#27272a] my-1"></div>
          <button
            className="p-2 text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            title="Reset North"
            onClick={handleResetNorth}
          >
            <CompassIcon className="w-4 h-4" style={compassStyle} />
          </button>
        </div>

        {/* Measure Tools */}
        <div className="flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
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
            title="Measure Distance"
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
            title="Measure Area"
          >
            <MeasureAreaIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Analysis Tools */}
        <div className="flex flex-col gap-1 bg-[#18181b] rounded-lg p-1 border border-[#27272a] shadow-lg">
          <button
            onClick={() => setAnalysisOpen((open) => !open)}
            className={`p-2 rounded transition-colors ${
              analysisOpen
                ? "bg-[#3b82f6] text-white"
                : "text-[#e4e4e7] hover:bg-[#27272a]"
            }`}
            title="Spatial Analysis"
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
            className="bg-[#18181b] border border-[#27272a] rounded-lg shadow-lg p-4 text-[#e4e4e7]"
            style={{ width: 320 }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Properties</span>
                <button
                  className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
                  onClick={closePropertyEditor}
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className="flex flex-col gap-2 overflow-auto property-scrollbar"
                style={{ maxHeight: 240 }}
              >
                {propertyEntries.length === 0 ? (
                  <div className="text-xs text-[#71717a]">No properties</div>
                ) : (
                  propertyEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 min-w-0"
                    >
                      <input
                        className="min-w-0 flex-1 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
                        placeholder="key"
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
                        className="min-w-0 flex-1 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
                        placeholder="value"
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
                        title="Remove"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="text-xs text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
                  onClick={addPropertyEntry}
                >
                  Add property
                </button>
                <div className="flex items-center gap-1">
                  <button
                    className="px-3 py-1.5 rounded text-xs text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] transition-colors"
                    onClick={closePropertyEditor}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1.5 rounded text-xs bg-[#3b82f6] text-white"
                    onClick={savePropertyChanges}
                  >
                    Save
                  </button>
                </div>
              </div>
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
                {baseMap.name}
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
          title="Switch Base Map"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {children}
    </div>
  );
}
