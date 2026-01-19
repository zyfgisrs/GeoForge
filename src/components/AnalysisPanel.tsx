"use client";

import Editor, { type BeforeMount, type Monaco } from "@monaco-editor/react";
import {
  bboxPolygon,
  area as turfArea,
  bbox as turfBbox,
  buffer as turfBuffer,
  center as turfCenter,
  concave as turfConcave,
  convex as turfConvex,
  difference as turfDifference,
  distance as turfDistance,
  featureCollection as turfFeatureCollection,
  hexGrid as turfHexGrid,
  intersect as turfIntersect,
  length as turfLength,
  midpoint as turfMidpoint,
  point as turfPoint,
  pointGrid as turfPointGrid,
  pointsWithinPolygon as turfPointsWithinPolygon,
  polygonSmooth as turfPolygonSmooth,
  simplify as turfSimplify,
  squareGrid as turfSquareGrid,
  union as turfUnion,
  voronoi as turfVoronoi,
} from "@turf/turf";
import {
  ArrowRightLeft,
  Copy,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { isEmpty as isExtentEmpty } from "ol/extent";
import type Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import type Map from "ol/Map";
import type VectorSource from "ol/source/Vector";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useGeojsonStore } from "../store/geojsonStore";

type GeojsonMode = "featureCollection" | "feature" | "geometry";
type AnalysisTool = {
  id: string;
  name: string;
  description: string;
  run: () => void;
  renderOptions?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
};

interface AnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  geojsonText: string;
  geojsonMode: GeojsonMode;
  selectedProjection: string;
  map: Map | null;
  analysisSource: VectorSource | null;
}

export function AnalysisPanel({
  isOpen,
  onClose,
  geojsonText,
  geojsonMode,
  selectedProjection,
  map,
  analysisSource,
}: AnalysisPanelProps) {
  const { t } = useTranslation();
  const [analysisActiveTool, setAnalysisActiveTool] = useState<string | null>(
    null
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [analysisResultText, setAnalysisResultText] = useState("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [polygonSmoothIterations, setPolygonSmoothIterations] = useState("3");
  const [bufferRadius, setBufferRadius] = useState("100");
  const [bufferUnits, setBufferUnits] = useState("meters");
  const [concaveMaxEdge, setConcaveMaxEdge] = useState("1");
  const [concaveUnits, setConcaveUnits] = useState("kilometers");
  const [hexGridCellSide, setHexGridCellSide] = useState("10");
  const [hexGridUnits, setHexGridUnits] = useState("kilometers");
  const [pointGridCellSide, setPointGridCellSide] = useState("10");
  const [pointGridUnits, setPointGridUnits] = useState("kilometers");

  const [squareGridCellSide, setSquareGridCellSide] = useState("10");
  const [squareGridUnits, setSquareGridUnits] = useState("kilometers");
  const [simplifyTolerance, setSimplifyTolerance] = useState("0.01");
  const [differenceReverse, setDifferenceReverse] = useState(false);
  const geojsonFormatRef = useRef(new GeoJSON());
  const setGeojsonText = useGeojsonStore((state) => state.setGeojsonText);
  const [isProcessing, setIsProcessing] = useState(false);

  const analysisInputLabel =
    geojsonMode === "featureCollection"
      ? t("analysis.inputs.featureCollection")
      : geojsonMode === "feature"
      ? t("analysis.inputs.feature")
      : t("analysis.inputs.geometry");

  const handleAnalysisEditorWillMount: BeforeMount = (monaco: Monaco) => {
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

  useEffect(() => {
    setAnalysisResultText("");
    setAnalysisError(null);
    setAnalysisActiveTool(null);
    analysisSource?.clear();
  }, [geojsonMode, geojsonText, selectedProjection, analysisSource]);

  const rawGeojson = useMemo(() => {
    try {
      return JSON.parse(geojsonText);
    } catch {
      return null;
    }
  }, [geojsonText]);

  const isPointFeatureCollection = (raw: unknown) => {
    if (!raw || typeof raw !== "object") {
      return false;
    }
    const candidate = raw as {
      type?: unknown;
      features?: unknown;
    };
    if (candidate.type !== "FeatureCollection") {
      return false;
    }
    if (!Array.isArray(candidate.features) || candidate.features.length === 0) {
      return false;
    }
    return candidate.features.every((feature) => {
      if (!feature || typeof feature !== "object") {
        return false;
      }
      const entry = feature as {
        type?: unknown;
        geometry?: { type?: unknown } | null;
      };
      return entry.type === "Feature" && entry.geometry?.type === "Point";
    });
  };

  useEffect(() => {
    if (!rawGeojson || typeof rawGeojson !== "object") {
      return;
    }

    // Calculate BBox and Dimensions for generic defaults (like HexGrid)
    const [minX, minY, maxX, maxY] = turfBbox(rawGeojson);
    const width = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([maxX, minY]),
      { units: "kilometers" }
    );
    const height = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([minX, maxY]),
      { units: "kilometers" }
    );

    // Set generic defaults
    const minDim = Math.min(width || 1, height || 1);
    // Use 1/15th of the smallest dimension as a reasonable default cell size
    const recommendedCellSide = minDim / 15;
    // ensure it's not too small (e.g. 0)
    const safeCellSide = recommendedCellSide > 0 ? recommendedCellSide : 1;

    setHexGridCellSide(safeCellSide.toFixed(4));
    setHexGridUnits("kilometers");
    setPointGridCellSide(safeCellSide.toFixed(4));
    setPointGridUnits("kilometers");
    setSquareGridCellSide(safeCellSide.toFixed(4));
    setSquareGridUnits("kilometers");

    // Specific logic for Point FeatureCollections (Concave Hull)
    if (isPointFeatureCollection(rawGeojson)) {
      const featureCollection = rawGeojson as { features: unknown[] };
      const pointCount = featureCollection.features.length;

      const baseGap =
        pointCount < 2 ? 1 : Math.sqrt((width * height) / pointCount);
      const recommended = Number.isFinite(baseGap) ? baseGap * 2.5 : 2.5;

      setConcaveUnits("kilometers");
      setConcaveMaxEdge(recommended.toFixed(3));
    }
  }, [rawGeojson]);

  const polygonCount = useMemo(() => {
    if (!rawGeojson || typeof rawGeojson !== "object") return 0;
    // Check if it's a FeatureCollection
    if (
      "type" in rawGeojson &&
      rawGeojson.type === "FeatureCollection" &&
      "features" in rawGeojson &&
      Array.isArray(rawGeojson.features)
    ) {
      return rawGeojson.features.filter((f: any) => {
        const type = f.geometry?.type;
        return type === "Polygon" || type === "MultiPolygon";
      }).length;
    }
    // Check if it's a single Feature
    if (
      "type" in rawGeojson &&
      rawGeojson.type === "Feature" &&
      "geometry" in rawGeojson
    ) {
      const type = (rawGeojson.geometry as any)?.type;
      return type === "Polygon" || type === "MultiPolygon" ? 1 : 0;
    }
    return 0;
  }, [rawGeojson]);

  const pointCount = useMemo(() => {
    if (!rawGeojson || typeof rawGeojson !== "object") return 0;
    if (
      "type" in rawGeojson &&
      rawGeojson.type === "FeatureCollection" &&
      "features" in rawGeojson &&
      Array.isArray(rawGeojson.features)
    ) {
      return rawGeojson.features.filter((f: any) => {
        const type = f.geometry?.type;
        return type === "Point";
      }).length;
    }
    if (
      "type" in rawGeojson &&
      rawGeojson.type === "Feature" &&
      "geometry" in rawGeojson
    ) {
      const type = (rawGeojson.geometry as any)?.type;
      return type === "Point" ? 1 : 0;
    }
    return 0;
  }, [rawGeojson]);

  const getAnalysisInput = () => {
    const trimmed = geojsonText.trim();
    if (!trimmed) {
      return { error: t("analysis.errors.noInput") };
    }

    let features: Feature<Geometry>[] = [];
    try {
      features = geojsonFormatRef.current.readFeatures(trimmed, {
        dataProjection: selectedProjection,
        featureProjection: "EPSG:4326",
      }) as Feature<Geometry>[];
    } catch {
      return { error: t("analysis.errors.invalidJson") };
    }

    if (features.length === 0) {
      return { error: t("analysis.errors.noFeatures") };
    }

    const rawInput = rawGeojson;

    const inputObject =
      selectedProjection === "EPSG:4326" && rawInput
        ? rawInput
        : geojsonFormatRef.current.writeFeaturesObject(features, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:4326",
          });

    return { inputObject, features };
  };

  const setAnalysisOutput = (feature: unknown, label: string) => {
    const outputFeatures = geojsonFormatRef.current.readFeatures(feature, {
      dataProjection: "EPSG:4326",
      featureProjection: selectedProjection,
    });
    if (outputFeatures.length === 0) {
      setAnalysisError(t("analysis.errors.emptyResult", { label }));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const outputObject =
      outputFeatures.length === 1
        ? geojsonFormatRef.current.writeFeatureObject(outputFeatures[0], {
            dataProjection: selectedProjection,
            featureProjection: selectedProjection,
          })
        : geojsonFormatRef.current.writeFeaturesObject(outputFeatures, {
            dataProjection: selectedProjection,
            featureProjection: selectedProjection,
          });
    const outputText = JSON.stringify(outputObject, null, 2);
    setAnalysisResultText(outputText);
    setAnalysisError(null);

    const mapFeatures = geojsonFormatRef.current.readFeatures(feature, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    analysisSource?.clear();
    if (mapFeatures.length > 0) {
      analysisSource?.addFeatures(mapFeatures);
      const extent = analysisSource?.getExtent();
      const view = map?.getView();
      if (extent && view && !isExtentEmpty(extent)) {
        view.fit(extent, {
          padding: [40, 40, 40, 40],
          duration: 350,
          maxZoom: (view.getZoom() ?? 12) + 2,
        });
      }
    }
  };

  const runCenterAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let centerFeature: unknown;
    try {
      centerFeature = turfCenter(analysisInput.inputObject);
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Center" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Center");
    setAnalysisOutput(centerFeature, "Center");
  };

  const runBboxAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let bboxValues: number[];
    try {
      bboxValues = turfBbox(analysisInput.inputObject, { recompute: false });
    } catch {
      setAnalysisError("BBox calculation failed.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const bboxFeature = bboxPolygon(bboxValues as any);
    setAnalysisActiveTool("BBox");
    setAnalysisOutput(bboxFeature, "BBox");
  };
  const runPolygonSmoothAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const hasInvalidGeometry = analysisInput.features.some((feature) => {
      const geometryType = feature.getGeometry()?.getType();
      return geometryType !== "Polygon" && geometryType !== "MultiPolygon";
    });

    if (hasInvalidGeometry) {
      setAnalysisError(t("analysis.errors.requiresPolygon"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const parsedIterations = Number.parseInt(
      polygonSmoothIterations.trim(),
      10
    );
    const iterations = Number.isFinite(parsedIterations)
      ? Math.max(0, parsedIterations)
      : 0;

    let smoothed: unknown;
    try {
      smoothed = turfPolygonSmooth(analysisInput.inputObject, {
        iterations,
      });
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Polygon Smooth" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool(t("analysis.tools.polygonSmooth.name"));
    setAnalysisOutput(smoothed, "Polygon Smooth");
  };
  const runBufferAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const parsedRadius = Number.parseFloat(bufferRadius.trim());
    if (!Number.isFinite(parsedRadius)) {
      setAnalysisError(t("analysis.errors.invalidBufferRadius"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let buffered: unknown;
    try {
      buffered = turfBuffer(analysisInput.inputObject, parsedRadius, {
        units: bufferUnits as any,
      });
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Buffer" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Buffer");
    setAnalysisOutput(buffered, "Buffer");
  };

  const runVoronoiAnalysis = () => {
    const rawInput = rawGeojson;
    if (!isPointFeatureCollection(rawInput)) {
      setAnalysisError(t("analysis.errors.requiresPoint"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let bboxValues: number[];
    try {
      bboxValues = turfBbox(analysisInput.inputObject);
    } catch {
      setAnalysisError("BBox calculation failed.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let result: unknown;
    try {
      result = turfVoronoi(analysisInput.inputObject, {
        bbox: bboxValues as any,
      });
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Voronoi" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result) {
      setAnalysisError(t("analysis.errors.voronoiEmpty"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Voronoi");
    setAnalysisOutput(result, "Voronoi");
  };

  const runSimplifyAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const tolerance = Number.parseFloat(simplifyTolerance.trim());
    const validTolerance = Number.isFinite(tolerance) ? tolerance : 0.01;

    let result: unknown;
    try {
      result = turfSimplify(analysisInput.inputObject, {
        tolerance: validTolerance,
        highQuality: true,
      });
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Simplify" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Simplify");
    setAnalysisOutput(result, "Simplify");
  };

  const runMeasurementAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const inputFeatures = analysisInput.features;
    let resultFeatures: any[] = [];

    // Process each feature to add measurement properties
    try {
      // Turf expects GeoJSON objects, we have OpenLayers features.
      // We already have analysisInput.inputObject which might be a single object or collection.
      // Let's iterate over the features to handle mixed types properly.

      const turfFeatures = inputFeatures.map((f) =>
        geojsonFormatRef.current.writeFeatureObject(f, {
          dataProjection: "EPSG:4326",
          featureProjection: selectedProjection,
        })
      );

      resultFeatures = turfFeatures.map((feature: any) => {
        const geomType = feature.geometry?.type;
        const newProps = { ...feature.properties };

        if (geomType === "Polygon" || geomType === "MultiPolygon") {
          const areaSqm = turfArea(feature);
          newProps["AREA_SQM"] = areaSqm;
          newProps["AREA_SQKM"] = areaSqm / 1000000;
        } else if (
          geomType === "LineString" ||
          geomType === "MultiLineString"
        ) {
          const lengthKm = turfLength(feature, { units: "kilometers" });
          newProps["LENGTH_KM"] = lengthKm;
          newProps["LENGTH_M"] = lengthKm * 1000;
        }

        return {
          ...feature,
          properties: newProps,
        };
      });
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Measurement" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const result = {
      type: "FeatureCollection",
      features: resultFeatures,
    };

    setAnalysisActiveTool("Measurement");
    setAnalysisOutput(result, "Measurement");
    toast.success(t("analysis.success.measurementAdded"));
  };

  const runPointsWithinAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // We need both Points and Polygons in the input
    const features = analysisInput.features;
    const points = features.filter((f) => {
      const t = f.getGeometry()?.getType();
      return t === "Point" || t === "MultiPoint";
    });
    const polygons = features.filter((f) => {
      const t = f.getGeometry()?.getType();
      return t === "Polygon" || t === "MultiPolygon";
    });

    if (points.length === 0 || polygons.length === 0) {
      setAnalysisError(t("analysis.errors.requiresPointAndPolygon"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Convert to Turf
    const turfPoints = points.map((f) =>
      geojsonFormatRef.current.writeFeatureObject(f, {
        dataProjection: "EPSG:4326",
        featureProjection: selectedProjection,
      })
    );
    const turfPolygons = polygons.map((f) =>
      geojsonFormatRef.current.writeFeatureObject(f, {
        dataProjection: "EPSG:4326",
        featureProjection: selectedProjection,
      })
    );

    let result: unknown;
    try {
      const pointCollection = turfFeatureCollection(turfPoints as any);
      const polygonCollection = turfFeatureCollection(turfPolygons as any);
      result = turfPointsWithinPolygon(
        pointCollection as any,
        polygonCollection as any
      );
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Points Within" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result || (result as any).features?.length === 0) {
      setAnalysisError("No points found within polygons.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Points Within");
    setAnalysisOutput(result, "Points Within");
  };

  const runConcaveAnalysis = () => {
    const rawInput = rawGeojson;
    if (!isPointFeatureCollection(rawInput)) {
      setAnalysisError(t("analysis.errors.requiresPoint"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const parsedMaxEdge = Number.parseFloat(concaveMaxEdge.trim());
    const maxEdge = Number.isFinite(parsedMaxEdge) ? parsedMaxEdge : 0;

    let result: unknown;
    try {
      result = turfConcave(analysisInput.inputObject, {
        maxEdge,
        units: concaveUnits as any,
      });
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Concave" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result) {
      setAnalysisError("Concave result is empty.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Concave");
    setAnalysisOutput(result, "Concave");
  };
  const runConvexAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let result: unknown;
    try {
      result = turfConvex(analysisInput.inputObject);
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Convex" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result) {
      setAnalysisError("Convex result is empty.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Convex");
    setAnalysisOutput(result, "Convex");
  };

  const runUnionAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const features = analysisInput.features;
    if (features.length < 2) {
      setAnalysisError(t("analysis.errors.unionRequiresTwo"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Filter for Polygons/MultiPolygons
    const validPolygons = features.filter((f) => {
      const type = f.getGeometry()?.getType();
      return type === "Polygon" || type === "MultiPolygon";
    });

    if (validPolygons.length < 2) {
      setAnalysisError(t("analysis.errors.unionRequiresTwo"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Convert OpenLayers features to Turf features
    const turfFeatures = validPolygons.map((f) =>
      geojsonFormatRef.current.writeFeatureObject(f, {
        dataProjection: "EPSG:4326",
        featureProjection: selectedProjection,
      })
    );

    let result: any;

    try {
      // Use turf.union with FeatureCollection as per documentation
      const featureCollection = turfFeatureCollection(turfFeatures as any);
      result = turfUnion(featureCollection as any);
    } catch (err) {
      setAnalysisError(
        `Union calculation failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result) {
      setAnalysisError("Union result is empty.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Union");
    setAnalysisOutput(result, "Union");
  };

  const runIntersectAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const features = analysisInput.features;
    if (features.length < 2) {
      setAnalysisError(t("analysis.errors.intersectRequiresTwo"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Filter for Polygons/MultiPolygons
    const validPolygons = features.filter((f) => {
      const type = f.getGeometry()?.getType();
      return type === "Polygon" || type === "MultiPolygon";
    });

    if (validPolygons.length < 2) {
      setAnalysisError(t("analysis.errors.intersectRequiresTwo"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Convert OpenLayers features to Turf features for processing
    const turfFeatures = validPolygons.map((f) =>
      geojsonFormatRef.current.writeFeatureObject(f, {
        dataProjection: "EPSG:4326",
        featureProjection: selectedProjection,
      })
    );

    let result: any;

    try {
      const collection = turfFeatureCollection(turfFeatures);
      result = turfIntersect(collection as any);
    } catch (err) {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Intersect" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result) {
      setAnalysisError("No intersection found.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Intersect");
    setAnalysisOutput(result, "Intersect");
  };

  const runDifferenceAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const features = analysisInput.features;
    if (features.length < 2) {
      setAnalysisError(t("analysis.errors.differenceRequiresTwo"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Filter for Polygons/MultiPolygons
    const validPolygons = features.filter((f) => {
      const type = f.getGeometry()?.getType();
      return type === "Polygon" || type === "MultiPolygon";
    });

    if (validPolygons.length < 2) {
      setAnalysisError(t("analysis.errors.differenceRequiresTwo"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Convert OpenLayers features to Turf features for processing
    const turfFeatures = validPolygons.map((f) =>
      geojsonFormatRef.current.writeFeatureObject(f, {
        dataProjection: "EPSG:4326",
        featureProjection: selectedProjection,
      })
    );

    let result: any;

    try {
      const featuresToDiff = differenceReverse
        ? [turfFeatures[1], turfFeatures[0]]
        : [turfFeatures[0], turfFeatures[1]];
      const collection = turfFeatureCollection(featuresToDiff);
      // Turf difference only accepts 2 polygons, but we pass them as a collection
      // Actually turf.difference(p1, p2) is the standard call, but v7 supports collection?
      // Let's stick to standard v7 usage if possible.
      // Turf v7 difference(features) takes a FeatureCollection
      result = turfDifference(collection as any);
    } catch (err) {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Difference" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result) {
      setAnalysisError("Difference result is empty.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Difference");
    setAnalysisOutput(result, "Difference");
  };

  const runMidpointAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const features = analysisInput.features;
    // Filter for Points
    const validPoints = features.filter((f) => {
      const type = f.getGeometry()?.getType();
      return type === "Point";
    });

    if (validPoints.length !== 2) {
      setAnalysisError(t("analysis.errors.midpointRequiresTwo"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Convert OpenLayers features to Turf features
    const turfFeatures = validPoints.map((f) =>
      geojsonFormatRef.current.writeFeatureObject(f, {
        dataProjection: "EPSG:4326",
        featureProjection: selectedProjection,
      })
    );

    let result: unknown;
    try {
      result = turfMidpoint(turfFeatures[0] as any, turfFeatures[1] as any);
    } catch {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Midpoint" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Midpoint");
    setAnalysisOutput(result, "Midpoint");
  };

  const runHexGridAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let bboxValues: number[];
    try {
      bboxValues = turfBbox(analysisInput.inputObject);
    } catch {
      setAnalysisError("BBox calculation failed.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const cellSide = Number.parseFloat(hexGridCellSide.trim());
    if (!Number.isFinite(cellSide) || cellSide <= 0) {
      setAnalysisError(t("analysis.errors.invalidCellSide"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Safety check: Estimate number of hexagons
    // Area of hexagon ~= 2.598 * side^2
    const [minX, minY, maxX, maxY] = bboxValues;
    const width = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([maxX, minY]),
      { units: hexGridUnits as any }
    );
    const height = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([minX, maxY]),
      { units: hexGridUnits as any }
    );

    const estimatedCount = (width * height) / (2.6 * cellSide * cellSide);
    const MAX_HEX_COUNT = 50000;

    if (estimatedCount > MAX_HEX_COUNT) {
      setAnalysisError(
        t("analysis.errors.gridTooDense", {
          countVal: Math.round(estimatedCount).toLocaleString(),
          maxVal: MAX_HEX_COUNT.toLocaleString(),
        })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let result: any;
    try {
      result = turfHexGrid(bboxValues as any, cellSide, {
        units: hexGridUnits as any,
      });
    } catch (err) {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Hex Grid" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result || !result.features || result.features.length === 0) {
      setAnalysisError(
        "Result is empty. Cell size might be too large for the selected area."
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Hex Grid");
    setAnalysisOutput(result, "Hex Grid");
  };

  const runPointGridAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let bboxValues: number[];
    try {
      bboxValues = turfBbox(analysisInput.inputObject);
    } catch {
      setAnalysisError("BBox calculation failed.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const cellSide = Number.parseFloat(pointGridCellSide.trim());
    if (!Number.isFinite(cellSide) || cellSide <= 0) {
      setAnalysisError(t("analysis.errors.invalidCellSide"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Safety check: Estimate number of points
    const [minX, minY, maxX, maxY] = bboxValues;
    const width = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([maxX, minY]),
      { units: pointGridUnits as any }
    );
    const height = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([minX, maxY]),
      { units: pointGridUnits as any }
    );

    // Number of points ~= (width/cellSide) * (height/cellSide)
    const estimatedCount = (width / cellSide) * (height / cellSide);
    const MAX_POINT_COUNT = 50000;

    if (estimatedCount > MAX_POINT_COUNT) {
      setAnalysisError(
        t("analysis.errors.gridTooDense", {
          countVal: Math.round(estimatedCount).toLocaleString(),
          maxVal: MAX_POINT_COUNT.toLocaleString(),
        })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let result: any;
    try {
      result = turfPointGrid(bboxValues as any, cellSide, {
        units: pointGridUnits as any,
      });
    } catch (err) {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Point Grid" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result || !result.features || result.features.length === 0) {
      setAnalysisError(
        "Result is empty. Cell size might be too large for the selected area."
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Point Grid");
    setAnalysisOutput(result, "Point Grid");
  };

  const runSquareGridAnalysis = () => {
    const analysisInput = getAnalysisInput();
    if ("error" in analysisInput) {
      setAnalysisError(analysisInput.error || null);
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let bboxValues: number[];
    try {
      bboxValues = turfBbox(analysisInput.inputObject);
    } catch {
      setAnalysisError("BBox calculation failed.");
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    const cellSide = Number.parseFloat(squareGridCellSide.trim());
    if (!Number.isFinite(cellSide) || cellSide <= 0) {
      setAnalysisError(t("analysis.errors.invalidCellSide"));
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    // Safety check: Estimate number of squares
    const [minX, minY, maxX, maxY] = bboxValues;
    const width = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([maxX, minY]),
      { units: squareGridUnits as any }
    );
    const height = turfDistance(
      turfPoint([minX, minY]),
      turfPoint([minX, maxY]),
      { units: squareGridUnits as any }
    );

    // Number of squares ~= (width/cellSide) * (height/cellSide)
    const estimatedCount = (width / cellSide) * (height / cellSide);
    const MAX_SQUARE_COUNT = 50000;

    if (estimatedCount > MAX_SQUARE_COUNT) {
      setAnalysisError(
        t("analysis.errors.gridTooDense", {
          countVal: Math.round(estimatedCount).toLocaleString(),
          maxVal: MAX_SQUARE_COUNT.toLocaleString(),
        })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    let result: any;
    try {
      result = turfSquareGrid(bboxValues as any, cellSide, {
        units: squareGridUnits as any,
      });
    } catch (err) {
      setAnalysisError(
        t("analysis.errors.calculationFailed", { label: "Square Grid" })
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    if (!result || !result.features || result.features.length === 0) {
      setAnalysisError(
        "Result is empty. Cell size might be too large for the selected area."
      );
      setAnalysisResultText("");
      analysisSource?.clear();
      return;
    }

    setAnalysisActiveTool("Square Grid");
    setAnalysisOutput(result, "Square Grid");
  };

  const handleCopy = async () => {
    if (!analysisResultText) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(analysisResultText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = analysisResultText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyStatus("success");
      toast.success(t("analysis.labels.copyResult"));
    } catch {
      setCopyStatus("error");
    }

    window.setTimeout(() => setCopyStatus("idle"), 1200);
  };

  const handleReplace = () => {
    if (!analysisResultText || isProcessing) return;

    setIsProcessing(true);
    // Use setTimeout to yield to the main thread so UI can update (show loading state)
    setTimeout(() => {
      try {
        // Quick check for size warning
        const resultJson = JSON.parse(analysisResultText);
        let featureCount = 0;
        if (
          resultJson.type === "FeatureCollection" &&
          Array.isArray(resultJson.features)
        ) {
          featureCount = resultJson.features.length;
        } else if (resultJson.type === "Feature") {
          featureCount = 1;
        }

        if (featureCount > 10000) {
          toast.warning(t("analysis.labels.largeDataset"), {
            duration: 5000,
          });
        }

        setGeojsonText(analysisResultText);
        toast.success(t("analysis.success.replaced"));
        onClose();
      } catch (e) {
        console.error("Failed to replace content:", e);
        toast.error("Failed to replace content.");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleExport = () => {
    if (!analysisResultText) return;

    const blob = new Blob([analysisResultText], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const toolName = analysisActiveTool
      ? analysisActiveTool.toLowerCase().replace(/\s+/g, "-")
      : "result";
    link.download = `geoforge-analysis-${toolName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAdd = () => {
    if (!analysisResultText || isProcessing) return;

    setIsProcessing(true);
    // Use setTimeout to yield to the main thread
    setTimeout(() => {
      try {
        const resultJson = JSON.parse(analysisResultText);
        let newFeatures: any[] = [];

        // Normalize result features
        if (resultJson.type === "FeatureCollection") {
          newFeatures = resultJson.features;
        } else if (resultJson.type === "Feature") {
          newFeatures = [resultJson];
        } else {
          // Geometry
          newFeatures = [
            { type: "Feature", properties: {}, geometry: resultJson },
          ];
        }

        if (newFeatures.length > 10000) {
          toast.warning(t("analysis.labels.largeDataset"), {
            duration: 5000,
          });
        }

        const existingJson = rawGeojson;
        let existingFeatures: any[] = [];

        // Normalize existing features
        if (existingJson) {
          if (
            typeof existingJson === "object" &&
            "type" in existingJson &&
            existingJson.type === "FeatureCollection" &&
            "features" in existingJson &&
            Array.isArray(existingJson.features)
          ) {
            existingFeatures = existingJson.features;
          } else if (
            typeof existingJson === "object" &&
            "type" in existingJson &&
            existingJson.type === "Feature"
          ) {
            existingFeatures = [existingJson];
          } else if (typeof existingJson === "object") {
            // Geometry or other object, wrap as feature if it looks like geometry
            existingFeatures = [
              { type: "Feature", properties: {}, geometry: existingJson },
            ];
          }
        }

        const merged = {
          type: "FeatureCollection",
          features: [...existingFeatures, ...newFeatures],
        };

        setGeojsonText(JSON.stringify(merged, null, 2));
        toast.success(t("analysis.success.added"));
        onClose();
      } catch (e) {
        console.error("Failed to add result:", e);
        toast.error("Failed to add analysis result.");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const concaveEnabled = isPointFeatureCollection(rawGeojson);
  const hasAnalysisResult = !!analysisResultText;

  const analysisTools: AnalysisTool[] = [
    {
      id: "center",
      name: t("analysis.tools.center.name"),
      description: t("analysis.tools.center.desc"),
      run: runCenterAnalysis,
    },
    {
      id: "bbox",
      name: t("analysis.tools.bbox.name"),
      description: t("analysis.tools.bbox.desc"),
      run: runBboxAnalysis,
    },
    {
      id: "polygonSmooth",
      name: t("analysis.tools.polygonSmooth.name"),
      description: t("analysis.tools.polygonSmooth.desc"),
      run: runPolygonSmoothAnalysis,
      renderOptions: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a1a1aa]">
            {t("analysis.labels.iterations")}
          </span>
          <input
            type="number"
            min={0}
            className="w-16 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 no-spinner"
            value={polygonSmoothIterations}
            onChange={(event) => setPolygonSmoothIterations(event.target.value)}
          />
        </div>
      ),
    },
    {
      id: "buffer",
      name: t("analysis.tools.buffer.name"),
      description: t("analysis.tools.buffer.desc"),
      run: runBufferAnalysis,
      renderOptions: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a1a1aa]">
            {t("analysis.labels.radius")}
          </span>
          <input
            type="number"
            className="w-16 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 no-spinner"
            value={bufferRadius}
            onChange={(event) => setBufferRadius(event.target.value)}
          />
          <select
            className="bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
            value={bufferUnits}
            onChange={(event) => setBufferUnits(event.target.value)}
          >
            <option value="meters">{t("analysis.meters")}</option>
            <option value="kilometers">{t("analysis.kilometers")}</option>
            <option value="inches">{t("analysis.inches")}</option>
          </select>
        </div>
      ),
    },
    {
      id: "voronoi",
      name: t("analysis.tools.voronoi.name"),
      description: t("analysis.tools.voronoi.desc"),
      run: runVoronoiAnalysis,
      disabled: !concaveEnabled,
      disabledReason: concaveEnabled
        ? undefined
        : t("analysis.errors.requiresPoint"),
    },
    {
      id: "simplify",
      name: t("analysis.tools.simplify.name"),
      description: t("analysis.tools.simplify.desc"),
      run: runSimplifyAnalysis,
      renderOptions: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a1a1aa]">
            {t("analysis.labels.tolerance")}
          </span>
          <input
            type="number"
            step="0.001"
            className="w-16 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 no-spinner"
            value={simplifyTolerance}
            onChange={(event) => setSimplifyTolerance(event.target.value)}
          />
        </div>
      ),
    },
    {
      id: "concave",
      name: t("analysis.tools.concave.name"),
      description: t("analysis.tools.concave.desc"),
      run: runConcaveAnalysis,
      disabled: !concaveEnabled,
      disabledReason: concaveEnabled
        ? undefined
        : t("analysis.errors.requiresPoint"),
      renderOptions: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a1a1aa]">
            {t("analysis.labels.maxEdge")}
          </span>
          <input
            type="number"
            className="w-16 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 no-spinner"
            value={concaveMaxEdge}
            onChange={(event) => setConcaveMaxEdge(event.target.value)}
          />
          <select
            className="bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
            value={concaveUnits}
            onChange={(event) => setConcaveUnits(event.target.value)}
          >
            <option value="meters">{t("analysis.meters")}</option>
            <option value="kilometers">{t("analysis.kilometers")}</option>
            <option value="inches">{t("analysis.inches")}</option>
          </select>
        </div>
      ),
    },
    {
      id: "union",
      name: t("analysis.tools.union.name"),
      description: t("analysis.tools.union.desc"),
      run: runUnionAnalysis,
      disabled: polygonCount < 2,
      disabledReason:
        polygonCount < 2 ? t("analysis.errors.unionRequiresTwo") : undefined,
    },
    {
      id: "intersect",
      name: t("analysis.tools.intersect.name"),
      description: t("analysis.tools.intersect.desc"),
      run: runIntersectAnalysis,
    },
    {
      id: "difference",
      name: t("analysis.tools.difference.name"),
      description: t("analysis.tools.difference.desc"),
      run: runDifferenceAnalysis,
      disabled: polygonCount !== 2,
      disabledReason:
        polygonCount !== 2
          ? t("analysis.errors.differenceRequiresTwo")
          : undefined,
      renderOptions: (
        <button
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${
            differenceReverse
              ? "bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]"
              : "bg-[#27272a] border-[#3f3f46] text-[#a1a1aa]"
          } transition-colors`}
          onClick={() => setDifferenceReverse(!differenceReverse)}
          title="Swap subtrahend and minuend"
        >
          <ArrowRightLeft className="w-3 h-3" />
          <span>{differenceReverse ? "B - A" : "A - B"}</span>
        </button>
      ),
    },
    {
      id: "midpoint",
      name: t("analysis.tools.midpoint.name"),
      description: t("analysis.tools.midpoint.desc"),
      run: runMidpointAnalysis,
      disabled: pointCount !== 2,
      disabledReason:
        pointCount !== 2 ? t("analysis.errors.midpointRequiresTwo") : undefined,
    },
    {
      id: "measurement",
      name: t("analysis.tools.measurement.name"),
      description: t("analysis.tools.measurement.desc"),
      run: runMeasurementAnalysis,
    },
    {
      id: "pointsWithin",
      name: t("analysis.tools.pointsWithin.name"),
      description: t("analysis.tools.pointsWithin.desc"),
      run: runPointsWithinAnalysis,
      disabled: pointCount === 0 || polygonCount === 0,
      disabledReason:
        pointCount === 0 || polygonCount === 0
          ? t("analysis.errors.requiresPointAndPolygon")
          : undefined,
    },
    {
      id: "hexGrid",
      name: t("analysis.tools.hexGrid.name"),
      description: t("analysis.tools.hexGrid.desc"),
      run: runHexGridAnalysis,
      renderOptions: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a1a1aa]">
            {t("analysis.labels.cellSide")}
          </span>
          <input
            type="number"
            className="w-16 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 no-spinner"
            value={hexGridCellSide}
            onChange={(event) => setHexGridCellSide(event.target.value)}
          />
          <select
            className="bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
            value={hexGridUnits}
            onChange={(event) => setHexGridUnits(event.target.value)}
          >
            <option value="meters">{t("analysis.meters")}</option>
            <option value="kilometers">{t("analysis.kilometers")}</option>
            <option value="miles">{t("analysis.miles")}</option>
          </select>
        </div>
      ),
    },
    {
      id: "pointGrid",
      name: t("analysis.tools.pointGrid.name"),
      description: t("analysis.tools.pointGrid.desc"),
      run: runPointGridAnalysis,
      renderOptions: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a1a1aa]">
            {t("analysis.labels.cellSide")}
          </span>
          <input
            type="number"
            className="w-16 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 no-spinner"
            value={pointGridCellSide}
            onChange={(event) => setPointGridCellSide(event.target.value)}
          />
          <select
            className="bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
            value={pointGridUnits}
            onChange={(event) => setPointGridUnits(event.target.value)}
          >
            <option value="meters">{t("analysis.meters")}</option>
            <option value="kilometers">{t("analysis.kilometers")}</option>
            <option value="miles">{t("analysis.miles")}</option>
          </select>
        </div>
      ),
    },
    {
      id: "squareGrid",
      name: t("analysis.tools.squareGrid.name"),
      description: t("analysis.tools.squareGrid.desc"),
      run: runSquareGridAnalysis,
      renderOptions: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a1a1aa]">
            {t("analysis.labels.cellSide")}
          </span>
          <input
            type="number"
            className="w-16 bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 no-spinner"
            value={squareGridCellSide}
            onChange={(event) => setSquareGridCellSide(event.target.value)}
          />
          <select
            className="bg-[#0b0b0f] border border-[#27272a] rounded px-2 py-1 text-[#e4e4e7] text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
            value={squareGridUnits}
            onChange={(event) => setSquareGridUnits(event.target.value)}
          >
            <option value="meters">{t("analysis.meters")}</option>
            <option value="kilometers">{t("analysis.kilometers")}</option>
            <option value="miles">{t("analysis.miles")}</option>
          </select>
        </div>
      ),
    },
    {
      id: "convex",
      name: t("analysis.tools.convex.name"),
      description: t("analysis.tools.convex.desc"),
      run: runConvexAnalysis,
    },
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute z-10" style={{ top: 16, right: 72 }}>
      <div className="w-[400px] bg-[#18181b] border border-[#27272a] rounded-lg shadow-lg p-4 text-[#e4e4e7]">
        <div className="flex items-center justify-between">
          <span className="text-sm">{t("analysis.title")}</span>
          <button
            className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-[#a1a1aa] mt-3">
          {t("analysis.labels.input")}: {analysisInputLabel}
          {geojsonMode === "geometry"
            ? ` (${t("analysis.inputs.feature")})`
            : ""}
        </div>

        <div className="relative mt-3 mb-3">
          <input
            type="text"
            placeholder={t("analysis.labels.searchTools")}
            className="w-full bg-[#0b0b0f] border border-[#27272a] rounded-md px-3 py-1.5 text-xs text-[#e4e4e7] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="h-px bg-[#27272a] my-3"></div>

        <div className="flex flex-col gap-3">
          <div
            className="flex flex-col gap-2 overflow-auto property-scrollbar"
            style={{ maxHeight: 400 }}
          >
            {analysisTools
              .filter((tool) =>
                tool.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-start justify-between gap-3 border border-[#27272a] rounded-md p-2"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">{tool.name}</span>
                    <span className="text-xs text-[#71717a]">
                      {tool.description}
                    </span>
                    {tool.renderOptions}
                    {tool.disabledReason && (
                      <span className="text-[10px] text-[#ef4444]">
                        {tool.disabledReason}
                      </span>
                    )}
                  </div>
                  <button
                    className={`px-3 py-1 rounded text-xs ${
                      tool.disabled
                        ? "bg-[#27272a] text-[#71717a] cursor-not-allowed"
                        : "bg-[#3b82f6] text-white"
                    }`}
                    onClick={tool.run}
                    disabled={tool.disabled}
                  >
                    {t("analysis.labels.run")}
                  </button>
                </div>
              ))}
          </div>

          {analysisError && (
            <div className="text-xs text-[#ef4444]">{analysisError}</div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-[#a1a1aa]">
              {t("analysis.labels.result")}
              {analysisActiveTool ? ` · ${analysisActiveTool}` : ""}
            </div>
            {analysisResultText && (
              <button
                className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
                onClick={handleCopy}
                title={
                  copyStatus === "success"
                    ? t("analysis.labels.copyResult")
                    : copyStatus === "error"
                    ? t("editor.copyFail")
                    : t("analysis.labels.copyResult")
                }
                aria-label={t("analysis.labels.copyResult")}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {analysisResultText && (
              <div className="flex items-center gap-1">
                <button
                  className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
                  onClick={handleReplace}
                  disabled={isProcessing}
                  title={t("analysis.labels.replace")}
                  aria-label={t("analysis.labels.replace")}
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
                  onClick={handleAdd}
                  disabled={isProcessing}
                  title={t("analysis.labels.addToMap")}
                  aria-label={t("analysis.labels.addToMap")}
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  className="p-1 text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#27272a] rounded transition-colors"
                  onClick={handleExport}
                  disabled={isProcessing}
                  title={t("export.title")}
                  aria-label={t("export.title")}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div
            className="bg-[#0b0b0f] border border-[#27272a] rounded-lg overflow-hidden"
            style={{ height: 200 }}
          >
            <Editor
              value={analysisResultText}
              language="json"
              theme="geojson-tool"
              height="100%"
              width="100%"
              loading={null}
              beforeMount={handleAnalysisEditorWillMount}
              options={{
                fontFamily: 'Menlo, Monaco, "JetBrains Mono", monospace',
                fontSize: 12,
                lineHeight: 20,
                wordWrap: "on",
                minimap: { enabled: false },
                lineNumbers: "off",
                glyphMargin: false,
                folding: false,
                renderLineHighlight: "none",
                scrollBeyondLastLine: false,
                scrollbar: {
                  vertical: "auto",
                  horizontal: "hidden",
                  alwaysConsumeMouseWheel: false,
                },
                overviewRulerBorder: false,
                overviewRulerLanes: 0,
                readOnly: true,
                renderValidationDecorations: "off",
                contextmenu: false,
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                links: false,
                matchBrackets: "never",
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
