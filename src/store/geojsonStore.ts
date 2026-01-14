import type Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import WKT from "ol/format/WKT";
import type Geometry from "ol/geom/Geometry";
import GeometryCollection from "ol/geom/GeometryCollection";
import { create } from "zustand";
import "../lib/projections";

const defaultGeoJSON = `{
  "type": "FeatureCollection",
  "features": []
}`;

const geojsonFormat = new GeoJSON();
const wktFormat = new WKT();
const wktFormatSplit = new WKT({ splitCollection: true });

type WktDisplayMode = "collection" | "elements";
type GeojsonMode = "featureCollection" | "feature" | "geometry";
type FeatureList = Feature<Geometry>[];

const getProjectionOptions = (projection: string) => ({
  dataProjection: projection,
  featureProjection: projection,
});

const geojsonToFeatures = (
  text: string,
  projection: string
): FeatureList | null => {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  try {
    return geojsonFormat.readFeatures(
      trimmed,
      getProjectionOptions(projection)
    ) as FeatureList;
  } catch {
    return null;
  }
};

const detectGeojsonMode = (text: string): GeojsonMode | null => {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as { type?: string };
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.type === "FeatureCollection") {
      return "featureCollection";
    }
    if (parsed.type === "Feature") {
      return "feature";
    }
    if (typeof parsed.type === "string") {
      return "geometry";
    }
  } catch {
    return null;
  }

  return null;
};

const featuresToGeojsonText = (
  features: FeatureList | null,
  projection: string,
  mode: GeojsonMode
) => {
  if (features === null) {
    return null;
  }

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

  const options = getProjectionOptions(projection);
  if (mode === "geometry" && features.length === 1) {
    const geometry = features[0]?.getGeometry();
    if (geometry) {
      return JSON.stringify(
        geojsonFormat.writeGeometryObject(geometry, options),
        null,
        2
      );
    }
  }

  if (mode === "feature" && features.length === 1) {
    return JSON.stringify(
      geojsonFormat.writeFeatureObject(features[0], options),
      null,
      2
    );
  }

  return JSON.stringify(
    geojsonFormat.writeFeaturesObject(features, options),
    null,
    2
  );
};

const featuresToWkt = (
  features: FeatureList | null,
  projection: string,
  mode: WktDisplayMode
) => {
  if (features === null) {
    return null;
  }

  if (features.length === 0) {
    return mode === "collection" ? "GEOMETRYCOLLECTION EMPTY" : "";
  }

  if (mode === "collection") {
    return wktFormat.writeFeatures(features, getProjectionOptions(projection));
  }

  const parts: string[] = [];
  features.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (!geometry) {
      return;
    }

    if (geometry instanceof GeometryCollection) {
      geometry.getGeometriesArray().forEach((geom) => {
        const wkt = wktFormat.writeGeometry(
          geom,
          getProjectionOptions(projection)
        );
        if (wkt) {
          parts.push(wkt);
        }
      });
      return;
    }

    const wkt = wktFormat.writeGeometry(
      geometry,
      getProjectionOptions(projection)
    );
    if (wkt) {
      parts.push(wkt);
    }
  });

  return parts.join("\n\n");
};

const wktToFeatures = (
  text: string,
  projection: string,
  mode: WktDisplayMode
) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  try {
    return mode === "elements"
      ? trimmed
          .split(/\n\s*\n/)
          .map((segment) => segment.trim())
          .filter(Boolean)
          .flatMap((segment) =>
            wktFormatSplit.readFeatures(
              segment,
              getProjectionOptions(projection)
            )
          )
      : (wktFormat.readFeatures(
          trimmed,
          getProjectionOptions(projection)
        ) as FeatureList);
  } catch {
    return null;
  }
};

const reprojectGeojsonText = (
  text: string,
  fromProjection: string,
  toProjection: string,
  mode: GeojsonMode
) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const features = geojsonFormat.readFeatures(trimmed, {
      dataProjection: fromProjection,
      featureProjection: toProjection,
    });
    return featuresToGeojsonText(features as FeatureList, toProjection, mode);
  } catch {
    return null;
  }
};

type GeoJSONStore = {
  geojsonText: string;
  wktText: string;
  wktDisplayMode: WktDisplayMode;
  geojsonMode: GeojsonMode;
  selectedProjection: string;
  setGeojsonText: (text: string) => void;
  setWktText: (text: string) => void;
  setWktDisplayMode: (mode: WktDisplayMode) => void;
  setSelectedProjection: (projection: string) => void;
  cursorLocation: { x: number; y: number } | null;
  setCursorLocation: (location: { x: number; y: number } | null) => void;
};

const defaultProjection = "EPSG:4326";
const initialWkt =
  featuresToWkt(
    geojsonToFeatures(defaultGeoJSON, defaultProjection),
    defaultProjection,
    "collection"
  ) ?? "";

export const useGeojsonStore = create<GeoJSONStore>((set) => ({
  geojsonText: defaultGeoJSON,
  wktText: initialWkt,
  wktDisplayMode: "collection",
  geojsonMode: "featureCollection",
  selectedProjection: defaultProjection,
  setGeojsonText: (text) =>
    set((state) => {
      const nextMode = detectGeojsonMode(text) ?? state.geojsonMode;
      // Performance optimization: Skip WKT generation for large datasets (> 1MB)
      // WKT generation is expensive (O(N) string building) and can crash the browser for large features.
      const isLargeDataset = text.length > 1_000_000;

      let nextWkt = "";
      if (!isLargeDataset) {
        nextWkt =
          featuresToWkt(
            geojsonToFeatures(text, state.selectedProjection),
            state.selectedProjection,
            state.wktDisplayMode
          ) ?? "";
      } else {
        // Keep existing WKT if we are just updating text and it was already large/empty,
        // OR set to a placeholder if we want to be explicit.
        // For now, let's clear it to avoid stale heavy data interaction.
        nextWkt = "";
      }

      return {
        geojsonText: text,
        wktText: nextWkt === null ? state.wktText : nextWkt, // if we returned null above, we keep state.wktText, but we handle it explicitely now
        geojsonMode: nextMode,
      };
    }),
  setWktText: (text) =>
    set((state) => {
      const features = wktToFeatures(
        text,
        state.selectedProjection,
        state.wktDisplayMode
      );
      const nextGeojson = featuresToGeojsonText(
        features,
        state.selectedProjection,
        state.geojsonMode
      );
      return {
        wktText: text,
        geojsonText: nextGeojson === null ? state.geojsonText : nextGeojson,
      };
    }),
  setWktDisplayMode: (mode) =>
    set((state) => {
      const nextWkt = featuresToWkt(
        geojsonToFeatures(state.geojsonText, state.selectedProjection),
        state.selectedProjection,
        mode
      );
      return {
        wktDisplayMode: mode,
        wktText: nextWkt === null ? state.wktText : nextWkt,
      };
    }),
  setSelectedProjection: (projection) =>
    set((state) => {
      if (projection === state.selectedProjection) {
        return state;
      }

      const nextGeojson = reprojectGeojsonText(
        state.geojsonText,
        state.selectedProjection,
        projection,
        state.geojsonMode
      );
      const geojsonText =
        nextGeojson === null ? state.geojsonText : nextGeojson;

      // Performance optimization: Skip WKT generation for large datasets (> 1MB)
      const isLargeDataset = geojsonText.length > 1_000_000;
      let nextWkt = "";

      if (!isLargeDataset) {
        nextWkt =
          featuresToWkt(
            geojsonToFeatures(geojsonText, projection),
            projection,
            state.wktDisplayMode
          ) ?? "";
      }

      return {
        selectedProjection: projection,
        geojsonText,
        wktText: nextWkt === null ? state.wktText : nextWkt,
      };
    }),
  cursorLocation: null,
  setCursorLocation: (location) => set({ cursorLocation: location }),
}));
