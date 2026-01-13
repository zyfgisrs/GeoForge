import { useState, type CSSProperties } from 'react';
import { Header } from './components/Header';
import { EditorPanel } from './components/EditorPanel';
import { MapPanel } from './components/MapPanel';
import { Footer } from './components/Footer';
import { ExportModal } from './components/ExportModal';
import { ImportModal } from './components/ImportModal';
import { Toaster } from './components/ui/sonner';
import { useGeojsonStore } from './store/geojsonStore';

export default function App() {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const selectedProjection = useGeojsonStore((state) => state.selectedProjection);
  const setSelectedProjection = useGeojsonStore((state) => state.setSelectedProjection);
  const toasterStyle = {
    '--normal-bg': '#18181b',
    '--normal-text': '#e4e4e7',
    '--normal-border': '#27272a',
  } as CSSProperties;

  return (
    <div className="h-screen bg-[#18181b] text-[#e4e4e7] flex flex-col overflow-hidden" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <Header 
        onExportClick={() => setIsExportModalOpen(true)} 
        onImportClick={() => setIsImportModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Editor Panel */}
        <EditorPanel 
          selectedProjection={selectedProjection}
          onProjectionChange={setSelectedProjection}
        />

        {/* Right Map Panel */}
        <MapPanel mapImageUrl="https://images.unsplash.com/photo-1554249906-53d1582266b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b3JsZCUyMG1hcCUyMGxpZ2h0JTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3Njc2MDY0NTN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" />
      </div>

      {/* Footer */}
      <Footer 
        selectedProjection={selectedProjection}
        onProjectionChange={setSelectedProjection}
      />

      {/* Export Modal */}
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />

      {/* Import Modal */}
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />

      <Toaster
        theme="dark"
        position="top-right"
        style={toasterStyle}
        toastOptions={{
          className: 'bg-[#18181b] text-[#e4e4e7] border border-[#27272a] shadow-lg',
        }}
      />
    </div>
  );
}
