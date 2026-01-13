# GeoForge

GeoForge (formerly GeoJSON Tool) is a modern, high-performance web application for creating, editing, analyzing, and visualizing geospatial data. Built with React and OpenLayers, it provides a seamless experience for working with GeoJSON, WKT, and other spatial formats.

![GeoForge Preview](./public/home.png)

## Features

### 🗺️ Map Visualization & Interactivity

- **Engine**: Powered by **OpenLayers** for robust map rendering.
- **Base Maps**: Switch between **OpenStreetMap**, **CartoDB Light**, **CartoDB Dark**, and **ArcGIS Satellite**.
- **Interactions**:
  - **Smooth Navigation**: Zoom, Pan, and Rotate (Ctrl + Drag).
  - **Drawing Tools**: Create Points, LineStrings, Polygons, and Rectangles.
  - **Editing**: Modify existing geometries, snap to vertices, and rotate features.
  - **Measurement**: Interactive Distance (km/m) and Area (km²/m²) tools.

### 📝 Dual-View Editor

- **Monaco Editor**: Integrated VScode-like editor for direct text manipulation.
- **Formats**: Full support for **GeoJSON** and **WKT** (Well-Known Text).
  - **WKT Modes**: View as a single `GEOMETRYCOLLECTION` or individual elements.
- **Table View**: Inspect feature properties in a tabular format.
- **Safety Features**: Large dataset protection (disables preview > 500KB to prevent freezing).
- **Projections**: Real-time re-projection support for:
  - **EPSG:4326** (WGS84)
  - **EPSG:3857** (Web Mercator)
  - **EPSG:4269** (NAD83)
  - **EPSG:2154** (Lambert-93)

### ⚙️ Spatial Analysis

Built-in advanced geospatial analysis tools powered by **Turf.js**:

- **Basic Ops**: Center, Bounding Box (BBox).
- **Geometry**: Buffer, Polygon Smooth, Concave/Convex Hull, Simplify.
- **Spatial Relations**: Points Within Polygon, Union, Difference.
- **Grids & Voronoi**: Generate Hex Grids, Point Grids, and Voronoi Polygons.
- **Attributes**: Calculate Area and Length as feature properties.
- **Visual Feedback**: Analysis results are immediately visualized on the map and provided as GeoJSON output.

### 🔄 Import & Export

- **Import**:
  - **GeoJSON** (`.json`, `.geojson`)
  - **Shapefile** (`.zip` archive)
  - **WKT** (`.wkt`, `.txt`)
- **Export**:
  - **GeoJSON**
  - **Shapefile** (Zipped)
  - **WKT**
  - **KML**

### 🎨 Modern UI

- **Dark Mode**: Sleek, professional dark interface optimized for long sessions.
- **Responsive Layout**: Flexible panels for simultaneous map and code viewing.
- **Components**: Built with **shadcn/ui** and **Tailwind CSS**.

## Tech Stack

- **Frontend Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Map Engine**: [OpenLayers](https://openlayers.org/)
- **Geospatial Analysis**: [Turf.js](https://turfjs.org/)
- **Code Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/yourusername/geoforge.git
    cd geoforge
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Running Locally

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173` (or the port shown in your terminal) to start using GeoForge.

### Building for Production

Build the application for deployment:

```bash
npm run build
```

The output will be in the `dist` directory.

## License

[MIT](LICENSE)
