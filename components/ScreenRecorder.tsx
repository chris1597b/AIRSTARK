import React, { useState, useRef } from 'react';

export const ScreenRecorder: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<number | null>(null);
    const streamsRef = useRef<MediaStream[]>([]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            // 1. Capture screen stream (including system audio if possible)
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 30 } },
                audio: true
            });

            // 2. Capture microphone stream
            let micStream: MediaStream | null = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e) {
                console.warn("Microphone access denied or not available", e);
            }

            // 3. Combine streams
            const tracks = [...screenStream.getVideoTracks()];

            // Handle Audio Merging (System + Mic)
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
                // Fallback to screen audio only if mixing failed
                tracks.push(screenStream.getAudioTracks()[0]);
            }

            const combinedStream = new MediaStream(tracks);
            streamsRef.current = [screenStream];
            if (micStream) streamsRef.current.push(micStream);

            // 4. Setup MediaRecorder
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
                a.download = `AIRSTARK_Recording_${new Date().getTime()}.${extension}`;
                a.click();
                URL.revokeObjectURL(url);

                // Stop all tracks
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

            // Listener for when user stops sharing via browser bar
            screenStream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

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
            {isRecording && (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-500/50 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></div>
                    <span className="text-white text-xs font-mono font-bold">{formatTime(recordingTime)}</span>
                </div>
            )}

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
