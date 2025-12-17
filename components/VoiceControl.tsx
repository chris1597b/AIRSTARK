import React, { useEffect, useState, useRef } from 'react';

interface VoiceControlProps {
  isActive: boolean;
  onCommand: (text: string) => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({ isActive, onCommand }) => {
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Browser compatibility check
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Tu navegador no soporta reconocimiento de voz.");
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true; // Keep listening
    rec.lang = 'es-ES';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.toLowerCase().trim();
      if (text) {
          console.log("Speech recognized:", text);
          onCommand(text);
      }
    };

    rec.onerror = (event: any) => {
      console.warn("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        setError("Permiso de micrófono denegado.");
      }
    };

    // Auto-restart logic only if strictly active and not stopped intentionally
    rec.onend = () => {
       // We handle restart logic in the effect dependency on isActive
       console.log("Speech Recognition Ended");
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch(e) {}
      }
    };
  }, []); // Only init once on mount

  // Toggle logic
  useEffect(() => {
      const rec = recognitionRef.current;
      if (!rec) return;

      if (isActive) {
          try {
              rec.start();
              console.log("Microphone started");
              setError(null);
          } catch (e) {
              // Usually means it's already started, which is fine
              console.log("Mic start request ignored (already active or busy)");
          }
      } else {
          try {
              rec.stop();
              console.log("Microphone stopped");
          } catch (e) {
              // Ignore
          }
      }
  }, [isActive, onCommand]);

  if (!isActive) return null;

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
       {error ? (
           <div className="bg-red-900/90 text-red-200 px-4 py-2 rounded-lg shadow-lg backdrop-blur text-sm border border-red-500">
               ⚠️ {error}
           </div>
       ) : (
           <div className="bg-red-600/90 text-white px-6 py-2 rounded-full shadow-lg backdrop-blur-sm animate-pulse flex items-center gap-2">
               <span className="text-xl">🎙️</span>
               <span className="font-bold tracking-wide text-sm">ESCUCHANDO...</span>
           </div>
       )}
    </div>
  );
};