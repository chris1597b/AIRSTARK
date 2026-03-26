import React, { useState, useRef, useEffect } from 'react';
import { ANATOMY_DATA, AnatomicalPart, AppMode } from './types.ts';
import { useHandControl } from './hooks/useHandControl.ts';
import { InfoPanel } from './components/InfoPanel.tsx';
import { VoiceControl } from './components/VoiceControl.tsx';
import { ScreenRecorder } from './components/ScreenRecorder.tsx';
import { getQuizQuestion } from './services/geminiService.ts';

// Extend JSX for model-viewer
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
        'disable-pan'?: boolean;
        'camera-orbit'?: string;
        'camera-target'?: string; // Added for focus support
        'tone-mapping'?: string;
        'shadow-intensity'?: string;
        autoplay?: boolean;
        exposure?: string;
        onError?: () => void;
        [key: string]: any;
      };
    }
  }
}

// Helper for fuzzy matching text (removes accents/diacritics)
const normalizeText = (text: string) => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.EXPLORE);
  const [selectedPart, setSelectedPart] = useState<AnatomicalPart | null>(null);

  // Quiz State
  const [quizTarget, setQuizTarget] = useState<AnatomicalPart | null>(null);
  const [quizQuestion, setQuizQuestion] = useState<string | null>(null);
  const [quizStatus, setQuizStatus] = useState<'IDLE' | 'LOADING' | 'WAITING_FOR_USER' | 'CORRECT' | 'INCORRECT'>('IDLE');

  const [cameraOrbit, setCameraOrbit] = useState("0deg 75deg 105%");
  const [cameraTarget, setCameraTarget] = useState("auto");
  const [showWebcam, setShowWebcam] = useState(false);
  const [isVoiceManual, setIsVoiceManual] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [isTransparent, setIsTransparent] = useState(false);
  const [modelSrc, setModelSrc] = useState<string>('/corazon.glb');
  const [lockedOrbit, setLockedOrbit] = useState<{ theta: number, phi: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const modelViewerRef = useRef<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


  // Custom Hook handles MediaPipe logic
  const { gestureState, orbitOutput } = useHandControl(videoRef, canvasRef);

  // Update camera based on hand gestures if active
  useEffect(() => {
    if (gestureState.mode !== 'IDLE' && gestureState.mode !== 'VOICE' && gestureState.mode !== 'LOCKED') {
      setCameraOrbit(orbitOutput.current);
    }
  }, [gestureState, orbitOutput]);

  // Loop to sync ref to state for smoother animation
  useEffect(() => {
    let animId: number;
    const updateLoop = () => {
      if (gestureState.mode !== 'IDLE' && gestureState.mode !== 'VOICE' && gestureState.mode !== 'LOCKED') {
        setCameraOrbit(orbitOutput.current);
      }
      animId = requestAnimationFrame(updateLoop);
    };
    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, [gestureState.mode]);

  // Handle Model Loading Events
  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer) return;

    const onProgress = (event: any) => {
      const progress = event.detail.totalProgress * 100;
      setLoadingProgress(Math.round(progress));
    };

    const onLoad = () => {
      // Small delay for smooth transition
      setTimeout(() => setIsLoading(false), 500);
    };

    viewer.addEventListener('progress', onProgress);
    viewer.addEventListener('load', onLoad);

    return () => {
      viewer.removeEventListener('progress', onProgress);
      viewer.removeEventListener('load', onLoad);
    };
  }, []);

  // --- QUIZ LOGIC ---

  const startNewQuizRound = async () => {
    setQuizStatus('LOADING');
    setQuizQuestion(null);
    setSelectedPart(null); // Clear any previous selection

    // Reset camera for the new question
    setCameraOrbit("0deg 75deg 105%");
    setCameraTarget("auto");
    setLockedOrbit(null);

    // Pick random part
    const randomIndex = Math.floor(Math.random() * ANATOMY_DATA.length);
    const target = ANATOMY_DATA[randomIndex];
    setQuizTarget(target);

    // Get vignette from Gemini
    const question = await getQuizQuestion(target.label);
    setQuizQuestion(question);
    setQuizStatus('WAITING_FOR_USER');
  };

  // Trigger quiz start when mode changes to QUIZ
  useEffect(() => {
    if (mode === AppMode.QUIZ) {
      startNewQuizRound();
    } else {
      // Reset quiz state when leaving quiz mode
      setQuizTarget(null);
      setQuizQuestion(null);
      setQuizStatus('IDLE');
    }
  }, [mode]);


  const handleHotspotClick = (clickedPart: AnatomicalPart) => {
    if (mode === AppMode.EXPLORE) {
      setSelectedPart(clickedPart);
    } else if (mode === AppMode.QUIZ) {
      // Evaluate answer
      if (quizStatus !== 'WAITING_FOR_USER' && quizStatus !== 'INCORRECT') return;

      if (quizTarget && clickedPart.id === quizTarget.id) {
        setQuizStatus('CORRECT');
        setSelectedPart(clickedPart); // Show info for the correct part
      } else {
        setQuizStatus('INCORRECT');
        // Do not set selectedPart so the panel doesn't switch to explore mode logic
      }
    }

    // --- CAMERA: Rotate to face the exact hotspot location ---
    const viewer = document.getElementById('heart-viewer') as any;
    if (!viewer) return;
    const hotspotData = viewer.queryHotspot(clickedPart.id);
    if (!hotspotData) return;

    // Use real world-space position and normal returned by model-viewer
    const pos = hotspotData.position;   // {x, y, z} world coords
    const norm = hotspotData.normal;    // {x, y, z} surface normal in world space

    const nx = norm?.x ?? 0;
    const ny = norm?.y ?? 0;
    const nz = norm?.z ?? 0;

    // Convert surface normal to model-viewer spherical orbit angles
    // Camera should be ALONG the normal direction from the hotspot position
    const theta = Math.atan2(nx, nz) * (180 / Math.PI);
    const phiRad = Math.atan2(ny, Math.sqrt(nx * nx + nz * nz));
    const phi = 90 - phiRad * (180 / Math.PI);

    // Set camera-target to exact hotspot world position (camera looks AT the hotspot)
    setCameraTarget(`${pos.x}m ${pos.y}m ${pos.z}m`);
    // Orbit around that point from the direction the normal points, at same distance (105%)
    setCameraOrbit(`${theta}deg ${phi}deg 105%`);
    
    // Lock rotation ONLY in Explore mode to allow free inspection during Quiz
    if (mode !== AppMode.QUIZ) {
      setLockedOrbit({ theta, phi });
    }
  };

  const handleVoiceCommand = (command: string) => {
    const normalizedCmd = normalizeText(command);
    console.log("Voice Command Received:", normalizedCmd);

    // 1. Check for commands
    if (normalizedCmd.includes('cerrar') || normalizedCmd.includes('ocultar')) {
      handleCloseInfo();
      return;
    }
    if (normalizedCmd.includes('explorar') || normalizedCmd.includes('modo explorar')) {
      setMode(AppMode.EXPLORE);
      return;
    }
    if (normalizedCmd.includes('quiz') || normalizedCmd.includes('examen') || normalizedCmd.includes('prueba')) {
      setMode(AppMode.QUIZ);
      return;
    }
    if (normalizedCmd.includes('navegacion') || normalizedCmd.includes('modo navegacion')) {
      setMode(AppMode.NAVIGATION);
      return;
    }

    // 2. Check for anatomical parts
    // Improved Logic: Find the "best" match (longest keyword found)
    // This prevents generic keywords like "pulmonar" from shadowing specific ones like "venas pulmonares"
    let bestMatch: AnatomicalPart | null = null;
    let maxMatchLength = 0;

    ANATOMY_DATA.forEach(part => {
      part.keywords.forEach(keyword => {
        const normalizedKey = normalizeText(keyword);
        if (normalizedCmd.includes(normalizedKey)) {
          // If this match is more specific (longer), prefer it
          if (normalizedKey.length > maxMatchLength) {
            maxMatchLength = normalizedKey.length;
            bestMatch = part;
          }
        }
      });
    });

    if (bestMatch) {
      console.log("Voice Match Found:", bestMatch.label);
      handleHotspotClick(bestMatch);
    }
  };

  const handleCloseInfo = () => {
    setSelectedPart(null);
    setCameraOrbit("0deg 75deg 105%");
    setCameraTarget("auto");
    setLockedOrbit(null);
  };

  // Effect to reset camera and selections when switching modes
  useEffect(() => {
    setCameraOrbit("0deg 75deg 105%");
    setCameraTarget("auto");
    setLockedOrbit(null);
    setSelectedPart(null);
    
    // Reset transparency when leaving navigation mode
    if (mode !== AppMode.NAVIGATION) {
      setIsTransparent(false);
    }
  }, [mode]);

  // Effect to handle model source changes based on mode and transparency
  useEffect(() => {
    if (mode === AppMode.NAVIGATION) {
      setModelSrc(isTransparent ? '/corazon_transparente.glb' : '/corazon.glb');
    } else {
      setModelSrc('/corazon.glb');
    }
  }, [mode, isTransparent]);

  const toggleWebcam = () => setShowWebcam(!showWebcam);
  const toggleVoice = () => setIsVoiceManual(!isVoiceManual);



  // Determine if voice is active (either via Hand Gesture OR Manual Toggle)
  const isVoiceActive = gestureState.mode === 'VOICE' || isVoiceManual;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">

      {/* 3D Viewer */}
      <model-viewer
        id="heart-viewer"
        ref={modelViewerRef}
        {...(modelSrc ? { src: modelSrc } : {})}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        disable-pan
        camera-orbit={cameraOrbit}
        camera-target={cameraTarget}
        tone-mapping="legacy"
        shadow-intensity="8"
        autoplay
        exposure="0.2"
        min-camera-orbit={lockedOrbit ? `${lockedOrbit.theta}deg ${lockedOrbit.phi}deg auto` : "auto auto auto"}
        max-camera-orbit={lockedOrbit ? `${lockedOrbit.theta}deg ${lockedOrbit.phi}deg auto` : "auto auto auto"}
        style={{ width: '100%', height: '100%' }}
        onError={() => setModelError(true)}
      >
        {modelSrc && mode !== AppMode.NAVIGATION && ANATOMY_DATA.map((part) => {
          const isSelected = selectedPart?.id === part.id;
          return (
            <button
              key={part.id}
              className={`
                hotspot group relative w-5 h-5 rounded-full border-2 transition-all duration-500
                ${isSelected
                  ? 'bg-red-500 border-white scale-150 z-50 shadow-[0_0_20px_rgba(239,68,68,0.9)] opacity-100'
                  : 'bg-white/30 border-white/40 opacity-60 data-[visible]:bg-green-100 data-[visible]:opacity-100 data-[visible]:border-green-200'
                }
                ${mode === AppMode.QUIZ && !isSelected ? 'bg-white/20 border-white/40' : ''}
              `}
              slot={part.id}
              data-surface={part.position}
              data-visibility-attribute="visible"
              onClick={() => handleHotspotClick(part)}
            >
              {/* Pulse Ring for selected/hovered hotspots */}
              {(isSelected || true) && (
                <div className={`pulse-ring ${isSelected ? 'border-red-500' : 'border-white opacity-0'}`}></div>
              )}

              {/* Tooltip Label - VISIBLE ON HOVER OR SELECTION */}
              <div className={`
                absolute left-full ml-4 top-1/2 -translate-y-1/2 
                bg-gray-950/90 backdrop-blur-md text-white 
                px-4 py-2 rounded-xl border border-white/20 
                shadow-[0_10px_30px_rgba(0,0,0,0.5)] 
                text-sm font-bold whitespace-nowrap 
                pointer-events-none transition-all duration-300 transform
                ${isSelected ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-4 scale-90'}
                z-[60]
              `}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-red-500 animate-pulse' : 'bg-red-400'}`}></div>
                  {part.label}
                </div>
                {/* Decorative Indicator */}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-gray-950/90"></div>
              </div>
            </button>
          );
        })}
      </model-viewer>

      {/* Error Message if Model Fails */}
      {modelError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-50">
          <div className="relative w-full max-w-md p-8 rounded-2xl border border-red-800 bg-gray-900/90 backdrop-blur-xl shadow-2xl text-center">
            <h2 className="text-2xl text-red-500 font-bold mb-2">Error de Carga</h2>
            <p className="text-gray-300">No se pudo cargar el modelo 3D (corazon.glb).</p>
            <p className="text-gray-500 text-sm mt-2">Asegúrate de que el archivo existe en la carpeta del proyecto.</p>
          </div>
        </div>
      )}

      {/* Camera Error Info */}
      <div className="hidden" id="camera-error-handler">
        {/* Este div podría ser usado para inyectar errores de MediaPipe si fuera necesario */}
      </div>



      {/* UI Overlay: Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-end items-center pointer-events-none z-30">
        <div className="pointer-events-auto flex gap-4 items-center">
          {/* Screen Recorder */}
          <ScreenRecorder />

          {/* Mode Toggle */}
          <div className="bg-gray-800 rounded-full p-1 flex shadow-lg border border-gray-700">
            <button
              onClick={() => setMode(AppMode.EXPLORE)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${mode === AppMode.EXPLORE ? 'bg-teal-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              Explorar
            </button>
            <button
              onClick={() => setMode(AppMode.NAVIGATION)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${mode === AppMode.NAVIGATION ? 'bg-blue-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              Navegación
            </button>
            <button
              onClick={() => setMode(AppMode.QUIZ)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${mode === AppMode.QUIZ ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              Examen
            </button>
          </div>

          {/* Transparency Toggle - ONLY IN NAVIGATION MODE */}
          {mode === AppMode.NAVIGATION && (
            <button
              onClick={() => setIsTransparent(!isTransparent)}
              className={`px-4 py-2 rounded-full border border-blue-500/50 transition-all font-semibold text-sm shadow-lg backdrop-blur-md
                ${isTransparent ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-black/40 text-blue-400 hover:bg-blue-900/30'}
              `}
            >
              {isTransparent ? 'Ver Sólido' : 'Ver Transparencia'}
            </button>
          )}



          {/* Manual Voice Toggle */}
          <button
            onClick={toggleVoice}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all shadow-lg ${isVoiceManual ? 'bg-red-600 border-red-400 text-white animate-pulse' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
            title="Activar Voz"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>

          {/* Webcam Toggle */}
          <button
            onClick={toggleWebcam}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all shadow-lg ${showWebcam ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
            title="Gestos de Mano"
          >
            ✋
          </button>
        </div>
      </div>

      {/* Info Sidebar */}
      <InfoPanel
        selectedPart={selectedPart}
        mode={mode}
        onClose={handleCloseInfo}
        quizQuestion={quizQuestion}
        quizStatus={quizStatus}
        onNextQuestion={startNewQuizRound}
        correctAnswerName={quizTarget?.label}
      />

      {/* Voice Control Component (Headless but functional) */}
      <VoiceControl isActive={isVoiceActive} onCommand={handleVoiceCommand} />

      {/* Gesture Status & Webcam Feed */}
      <div className={`absolute bottom-6 right-6 transition-all duration-500 ease-in-out z-30 ${showWebcam ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className={`relative rounded-lg overflow-hidden border-2 shadow-2xl w-64 h-48 bg-black transition-colors duration-300 ${gestureState.mode === 'ROTATING' ? 'border-teal-400' :
          gestureState.mode === 'LOCKED' ? 'border-red-500' :
            gestureState.mode === 'VOICE' ? 'border-pink-500' :
              gestureState.mode === 'ZOOMING' ? 'border-blue-400' : 'border-gray-600'
          }`}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" playsInline></video>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100"></canvas>

          {/* Status Text */}
          <div className="absolute bottom-0 w-full bg-black/60 backdrop-blur-sm p-2 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white">
              {gestureState.mode === 'IDLE' ? 'Esperando Mano...' :
                gestureState.mode === 'ROTATING' ? 'Rotando' :
                  gestureState.mode === 'ZOOMING' ? 'Zoom' :
                    gestureState.mode === 'LOCKED' ? 'Pausado' :
                      gestureState.mode === 'VOICE' ? 'Voz' : gestureState.mode}
            </p>
          </div>
        </div>

        {/* Gesture Legend */}
        {showWebcam && (
          <div className="mt-2 bg-black/50 backdrop-blur rounded p-2 text-xs text-gray-300 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400"></span> Mano (Rotar)</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Puño (Parar)</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Índice (Zoom)</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Shaka (Voz)</div>
          </div>
        )}
      </div>

      {/* Premium Loading Screen Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-gray-900 overflow-hidden">
          {/* Background Decorative Elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-600 rounded-full blur-[120px] animate-pulse delay-700"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6 text-center">
            {/* Official Logo Animation - No Bounce */}
            <div className="relative mb-12">
              <div className="w-48 h-48 flex items-center justify-center shadow-[0_0_80px_rgba(255,255,255,0.25)] rounded-full overflow-hidden">
                <img src="/logo_airstark.jpg" alt="AIRSTARK Logo" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 w-48 h-48 border-4 border-white rounded-full animate-ping opacity-20"></div>
            </div>

            <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-8">Sincronizando Sistema Anatómico</p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden border border-white/5 shadow-inner mb-4 relative">
              <div
                className="h-full bg-gradient-to-r from-teal-500 via-red-500 to-blue-500 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite] transition-all duration-300 ease-out shadow-[0_0_15px_rgba(20,184,166,0.5)]"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>

            <div className="flex justify-between w-full text-[10px] font-bold text-gray-500">
              <span className="uppercase tracking-tighter">{loadingProgress < 100 ? 'Cargando Estructuras...' : 'Iniciando Interfaz...'}</span>
              <span>{loadingProgress}%</span>
            </div>
          </div>

          {/* Style for the animated gradient progress bar */}
          <style>{`
            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </div>
      )}

    </div >
  );
};

export default App;