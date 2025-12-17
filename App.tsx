import React, { useState, useRef, useEffect } from 'react';
import { ANATOMY_DATA, AnatomicalPart, AppMode } from './types.ts';
import { useHandControl } from './hooks/useHandControl.ts';
import { InfoPanel } from './components/InfoPanel.tsx';
import { VoiceControl } from './components/VoiceControl.tsx';
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
  const [showWebcam, setShowWebcam] = useState(false);
  const [isVoiceManual, setIsVoiceManual] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [modelSrc, setModelSrc] = useState<string | undefined>(undefined);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // --- QUIZ LOGIC ---

  const startNewQuizRound = async () => {
    setQuizStatus('LOADING');
    setQuizQuestion(null);
    setSelectedPart(null); // Clear any previous selection

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
  };

  const handleVoiceCommand = (command: string) => {
    const normalizedCmd = normalizeText(command);
    console.log("Voice Command Received:", normalizedCmd);

    // 1. Check for commands
    if (normalizedCmd.includes('cerrar') || normalizedCmd.includes('ocultar')) {
      setSelectedPart(null);
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

  const toggleWebcam = () => setShowWebcam(!showWebcam);
  const toggleVoice = () => setIsVoiceManual(!isVoiceManual);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setModelSrc(url);
      setModelError(false);
    }
  };

  // Determine if voice is active (either via Hand Gesture OR Manual Toggle)
  const isVoiceActive = gestureState.mode === 'VOICE' || isVoiceManual;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">

      {/* 3D Viewer */}
      <model-viewer
        id="heart-viewer"
        {...(modelSrc ? { src: modelSrc } : {})}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        disable-pan
        camera-orbit={cameraOrbit}
        tone-mapping="legacy"
        shadow-intensity="8"
        autoplay
        exposure="0.2"
        style={{ width: '100%', height: '100%' }}
        onError={() => setModelError(true)}
      >
        {modelSrc && ANATOMY_DATA.map((part) => (
          <button
            key={part.id}
            className={`
                group relative w-6 h-6 rounded-full border-2 transition-all duration-300
                ${mode === AppMode.EXPLORE && selectedPart?.id === part.id ? 'bg-red-500 border-white scale-125 z-50 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : ''}
                ${mode === AppMode.QUIZ ? 'bg-white/30 border-white/60 hover:bg-yellow-400 hover:scale-125' : 'bg-white/20 border-white/50 hover:bg-red-400 hover:scale-110'}
                opacity-100
            `}
            slot={part.id}
            data-surface={part.position}
            onClick={() => handleHotspotClick(part)}
          >
            {/* Tooltip Label - ONLY VISIBLE IN EXPLORE MODE */}
            <div className={`
                absolute left-8 top-1/2 -translate-y-1/2 bg-white text-black px-3 py-1 rounded shadow-lg text-sm font-bold whitespace-nowrap pointer-events-none
                ${mode === AppMode.QUIZ ? 'hidden' : 'block'}
            `}>
              {part.label}
            </div>
          </button>
        ))}
      </model-viewer>

      {/* Medical Imaging / Upload Interface */}
      {(modelError || !modelSrc) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-50">
          <div className="relative w-full max-w-2xl p-8 rounded-2xl border border-gray-800 bg-gray-900/50 backdrop-blur-xl shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-teal-500 to-blue-500 opacity-50"></div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-900/30 text-blue-400 mb-4 border border-blue-500/30">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <h2 className="text-3xl text-white font-bold tracking-tight mb-2">Iniciar Sesión de Anatomía</h2>
              <p className="text-gray-400 text-sm">Visor DICOM/GLB listo. Por favor cargue el modelo del paciente.</p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-teal-500/50 transition-colors group cursor-pointer relative bg-gray-800/30"
            >
              <div className="space-y-3">
                <p className="text-teal-400 font-semibold group-hover:text-teal-300">
                  Clic para Subir Modelo GLB
                </p>
                <p className="text-xs text-gray-500">
                  Soporta formatos .GLB y .GLTF
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center text-xs text-gray-600">
              <div className="flex gap-4">
                <span>Estado: <span className="text-green-500">En línea</span></span>
                <span>Tutor IA: <span className="text-green-500">Conectado</span></span>
              </div>
              <div>v1.0.8 MedStudent Edition</div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Global File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".glb,.gltf"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* UI Overlay: Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-end items-center pointer-events-none z-30">
        <div className="pointer-events-auto flex gap-4">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full flex items-center justify-center border transition-all shadow-lg bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700"
            title="Subir Modelo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>

          {/* Mode Toggle */}
          <div className="bg-gray-800 rounded-full p-1 flex shadow-lg border border-gray-700">
            <button
              onClick={() => setMode(AppMode.EXPLORE)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${mode === AppMode.EXPLORE ? 'bg-teal-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              Explorar
            </button>
            <button
              onClick={() => setMode(AppMode.QUIZ)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${mode === AppMode.QUIZ ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              Examen
            </button>
          </div>

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
        onClose={() => setSelectedPart(null)}
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

    </div>
  );
};

export default App;