import React, { useEffect, useState } from 'react';
import { AnatomicalPart, AppMode } from '../types.ts';

interface CTPanelProps {
    selectedPart: AnatomicalPart | null;
    mode: AppMode;
}

export const CTPanel: React.FC<CTPanelProps> = ({ selectedPart, mode }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [imgLoading, setImgLoading] = useState(true);

    useEffect(() => {
        // Reset error/loading state when part changes
        setImgError(false);
        setImgLoading(true);

        // Only show if in EXPLORE mode and a part with a CT URL is selected
        if (mode === AppMode.EXPLORE && selectedPart?.ctScanUrl) {
            console.log("CTPanel: Showing for", selectedPart.label, selectedPart.ctScanUrl);
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [selectedPart, mode]);

    if (!isVisible || !selectedPart?.ctScanUrl) return null;

    return (
        <div className={`
      fixed top-24 right-4 z-50 
      w-64 bg-gray-900/90 backdrop-blur-xl 
      border border-teal-500/30 rounded-xl shadow-2xl overflow-hidden
      transition-all duration-500 transform
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}
      animate-fade-in-right
    `}>
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-3 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-xs font-bold text-teal-400 tracking-widest uppercase flex items-center gap-2">
                    <span>☢️</span> Tomografía
                </h3>
                <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                </div>
            </div>

            {/* Image Container */}
            <div className="relative w-full aspect-square bg-black group flex items-center justify-center">
                {imgLoading && !imgError && (
                    <div className="absolute inset-0 flex items-center justify-center text-teal-500">
                        <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                    </div>
                )}

                {imgError ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center">
                        <span className="text-2xl mb-2">⚠️</span>
                        <p className="text-xs">Imagen no disponible</p>
                    </div>
                ) : (
                    <img
                        src={selectedPart.ctScanUrl}
                        alt={`TC de ${selectedPart.label}`}
                        className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoading ? 'opacity-0' : 'opacity-90 group-hover:opacity-100'}`}
                        onLoad={() => setImgLoading(false)}
                        onError={(e) => {
                            console.error("CTPanel: Image load error", e);
                            setImgError(true);
                            setImgLoading(false);
                        }}
                    />
                )}

                {/* Overlay Scanner Effect - Only if image loaded */}
                {!imgError && !imgLoading && (
                    <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 to-transparent pointer-events-none animate-scan"></div>
                )}


                {/* Labels Overlay */}
                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 to-transparent p-3 pt-6">
                    <p className="text-white font-bold text-sm leading-tight">{selectedPart.label}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">Corte Axial • Con Contraste</p>
                </div>
            </div>

            {/* Footer Info */}
            <div className="p-3 bg-gray-900/80 border-t border-gray-700">
                <div className="flex justify-between text-[10px] text-gray-500 font-mono uppercase">
                    <span>Ref: {selectedPart.keywords[0] || 'N/A'}</span>
                    <span>DICOM: Ready</span>
                </div>
            </div>
        </div>
    );
};
