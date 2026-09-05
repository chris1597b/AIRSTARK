import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

export const ScreenRecorder: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isTakingShot, setIsTakingShot] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<number | null>(null);
    const streamsRef = useRef<MediaStream[]>([]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // --- Captura de Pantalla compuesta (3D nativo + DOM overlay) ---
    const takeScreenshot = async () => {
        if (isTakingShot) return;
        setIsTakingShot(true);
        try {
            const W = window.innerWidth;
            const H = window.innerHeight;
            const dpr = window.devicePixelRatio || 1;

            // 1. Capturar el render 3D via la API nativa de model-viewer (.toDataURL)
            //    Esta es la forma oficial y evita el problema del buffer WebGL limpiado
            const modelViewer = document.getElementById('heart-viewer') as any;
            let modelDataURL: string | null = null;
            if (modelViewer && typeof modelViewer.toDataURL === 'function') {
                modelDataURL = modelViewer.toDataURL('image/png');
            }

            // 2. Capturar la UI (DOM) en transparente con html2canvas
            const domCanvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                scale: dpr,
                backgroundColor: null,
                logging: false,
                ignoreElements: (el) =>
                    el.tagName === 'MODEL-VIEWER' || el.id === 'heart-viewer',
            });

            // 3. Componer en canvas final
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width  = W * dpr;
            finalCanvas.height = H * dpr;
            const ctx = finalCanvas.getContext('2d')!;
            ctx.scale(dpr, dpr);

            // Fondo negro
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);

            // Capa 1: render 3D del corazón (vía API oficial de model-viewer)
            if (modelDataURL) {
                await new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => { ctx.drawImage(img, 0, 0, W, H); resolve(); };
                    img.onerror = () => resolve();
                    img.src = modelDataURL!;
                });
            }

            // Capa 2: UI del DOM encima
            ctx.drawImage(domCanvas, 0, 0, W, H);

            // 4. Descargar PNG
            const link = document.createElement('a');
            link.download = `AIRSTARK_Captura_${Date.now()}.png`;
            link.href = finalCanvas.toDataURL('image/png');
            link.click();

        } catch (e) {
            console.error('Error al tomar captura:', e);
        } finally {
            setIsTakingShot(false);
        }
    };

    // --- Grabación de Pantalla ---
    const startRecording = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 30 } },
                audio: true
            });

            let micStream: MediaStream | null = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e) {
                console.warn("Microphone access denied or not available", e);
            }

            const tracks = [...screenStream.getVideoTracks()];
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const destination = audioContext.createMediaStreamDestination();

            if (screenStream.getAudioTracks().length > 0) {
                const source1 = audioContext.createMediaStreamSource(screenStream);
                source1.connect(destination);
            }
            if (micStream && micStream.getAudioTracks().length > 0) {
                const source2 = audioContext.createMediaStreamSource(micStream);
                source2.connect(destination);
            }

            const combinedAudioTrack = destination.stream.getAudioTracks()[0];
            if (combinedAudioTrack) {
                tracks.push(combinedAudioTrack);
            } else if (screenStream.getAudioTracks().length > 0) {
                tracks.push(screenStream.getAudioTracks()[0]);
            }

            const combinedStream = new MediaStream(tracks);
            streamsRef.current = [screenStream];
            if (micStream) streamsRef.current.push(micStream);

            const possibleTypes = [
                'video/mp4;codecs=h264,aac',
                'video/mp4',
                'video/webm;codecs=vp9,opus',
                'video/webm'
            ];
            const mimeType = possibleTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';

            const recorder = new MediaRecorder(combinedStream, { mimeType });
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `AIRSTARK_Grabacion_${Date.now()}.${extension}`;
                a.click();
                URL.revokeObjectURL(url);
                streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
                if (audioContext.state !== 'closed') audioContext.close();
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            screenStream.getVideoTracks()[0].onended = () => stopRecording();

        } catch (err) {
            console.error("Error starting recording:", err);
            alert("No se pudo iniciar la grabación. Asegúrate de dar los permisos necesarios.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {/* Indicador de tiempo de grabación */}
            {isRecording && (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-500/50 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></div>
                    <span className="text-white text-xs font-mono font-bold">{formatTime(recordingTime)}</span>
                </div>
            )}

            {/* Botón Capturar Pantalla */}
            <button
                onClick={takeScreenshot}
                disabled={isTakingShot}
                title="Capturar Pantalla"
                className={`
                    flex items-center justify-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-bold text-sm shadow-lg
                    ${isTakingShot
                        ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] animate-pulse'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 hover:border-white/40'}
                `}
            >
                {isTakingShot ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6.364 1.636l-.707.707M20 12h-1M17.657 17.657l-.707-.707M12 19v1M6.343 17.657l-.707.707M4 12H3M6.343 6.343l.707.707" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                )}
                Capturar
            </button>

            {/* Botón Grabar Pantalla */}
            <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`
                    flex items-center justify-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-bold text-sm shadow-lg
                    ${isRecording
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 hover:border-white/40'}
                `}
            >
                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-red-600'} transition-all`}></div>
                {isRecording ? 'Detener' : 'Grabar Pantalla'}
            </button>
        </div>
    );
};
