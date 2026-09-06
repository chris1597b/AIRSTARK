import React, { useState, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css"; // ← CRÍTICO: sin esto los íconos y layout se rompen
import type { ExcalidrawImperativeAPI, AppState } from "@excalidraw/excalidraw/types";

interface ExcalidrawEditorProps {
  onClose: () => void;
}

export const ExcalidrawEditor: React.FC<ExcalidrawEditorProps> = ({ onClose }) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  const onExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const onChange = useCallback((elements: readonly any[], appState: AppState) => {
    try {
      localStorage.setItem('excalidraw_elements', JSON.stringify(elements));
    } catch (e) {
      console.error("Error saving Excalidraw elements temporarily", e);
    }
  }, []);

  // Cargar elementos previos si los hay
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialElems: any[] = [];
  try {
     const saved = localStorage.getItem('excalidraw_elements');
     if (saved) initialElems = JSON.parse(saved);
  } catch(e){}

  return (
    <div className="absolute inset-0 z-40 pointer-events-auto" style={{ width: "100%", height: "100%" }}>
      <style>{`
        /* Oculta únicamente el botón de hamburguesa y Library */
        .excalidraw [data-testid="main-menu-trigger"],
        .excalidraw .layer-ui__library-button,
        .excalidraw .sidebar-trigger,
        .excalidraw [aria-label="Library"],
        .excalidraw [aria-label="Biblioteca"] {
          display: none !important;
          pointer-events: none !important;
        }
      `}</style>
      <Excalidraw
        excalidrawAPI={onExcalidrawAPI}
        onChange={onChange}
        initialData={{ 
           elements: initialElems,
           appState: { viewBackgroundColor: "transparent" }
        }}
        theme="dark"
        // Habilitamos el grid mode si es útil, pero para anotaciones encima del 3D mejor limpio.
        gridModeEnabled={false} 
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: { saveFileToDisk: true },
          },
        }}
      />
    </div>
  );
};
