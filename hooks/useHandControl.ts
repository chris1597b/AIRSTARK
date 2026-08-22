import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

interface CameraState {
  theta: number;
  phi: number;
  radius: number;
}

export const useHandControl = (
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  active: boolean
) => {
  const [gestureState, setGestureState] = useState<{ mode: string, active: boolean }>({ mode: 'IDLE', active: false });
  
  // Physics State (Refs to avoid re-renders on every frame)
  const camState = useRef<CameraState>({ theta: 0, phi: Math.PI / 2, radius: 100 });
  const velocity = useRef({ theta: 0, phi: 0, zoom: 0 });
  // Higher lerp factor = snappier, less "lag" feeling
  const smoothVelocity = useRef({ theta: 0, phi: 0 });
  const orbitOutput = useRef<string>("0rad 1.57rad 100%");
  // Store the current gesture mode in a ref so the rAF loop can read it without closure issues
  const gestureModeRef = useRef<string>('IDLE');

  useEffect(() => {
    if (!active) {
      setGestureState({ mode: 'IDLE', active: false });
      gestureModeRef.current = 'IDLE';
      return;
    }

    let camera: any;
    let hands: any;
    let rafId: number;

    const onResults = (results: any) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !videoRef.current) return;

      if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Draw Guidelines (Full Extended Axis + Solid Center Cross) ---
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      // Bold Central Crosshair
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 15, canvas.height / 2);
      ctx.lineTo(canvas.width / 2 + 15, canvas.height / 2);
      ctx.moveTo(canvas.width / 2, canvas.height / 2 - 15);
      ctx.lineTo(canvas.width / 2, canvas.height / 2 + 15);
      ctx.stroke();

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Draw hands
        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#ef4444', lineWidth: 2 });
        window.drawLandmarks(ctx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 2 });

        // Gesture Logic
        const isFingerExtended = (idx: number, pipIdx: number) => {
            const wrist = landmarks[0];
            const tip = landmarks[idx];
            const pip = landmarks[pipIdx];
            return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
        };

        const thumbExt = isFingerExtended(4, 2);
        const indexExt = isFingerExtended(8, 6);
        const pinkyExt = isFingerExtended(20, 18);
        const middleExt = isFingerExtended(12, 10);
        const ringExt = isFingerExtended(16, 14);

        const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

        // 1. Shaka (Voice)
        if (thumbExt && pinkyExt && !indexExt && !middleExt && !ringExt) {
          gestureModeRef.current = 'VOICE';
          setGestureState({ mode: 'VOICE', active: true });
          velocity.current = { theta: 0, phi: 0, zoom: camState.current.radius };
        }
        // 2. Fist (Brake)
        else if (extendedCount === 0 && !thumbExt) {
          gestureModeRef.current = 'LOCKED';
          setGestureState({ mode: 'LOCKED', active: true });
          velocity.current = { theta: 0, phi: 0, zoom: camState.current.radius };
          smoothVelocity.current = { theta: 0, phi: 0 };
        }
        // 3. Pinch/Index (Zoom)
        else if (indexExt && extendedCount === 1) {
            gestureModeRef.current = 'ZOOMING';
            setGestureState({ mode: 'ZOOMING', active: true });
            const dPinch = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
            const zoomTarget = 220 - (dPinch * 600); 
            velocity.current.zoom = zoomTarget;
            velocity.current.theta = 0;
            velocity.current.phi = 0;
        }
        // 4. Open Palm (Rotate)
        else if (extendedCount >= 3) {
            gestureModeRef.current = 'ROTATING';
            setGestureState({ mode: 'ROTATING', active: true });
            const handX = 1.0 - landmarks[9].x; // Mirror
            const handY = landmarks[9].y;
            
            let dx = (handX - 0.5);
            let dy = (handY - 0.5);
            
            // Smaller deadzone for more continuous movement
            if (Math.abs(dx) < 0.06) dx = 0;
            if (Math.abs(dy) < 0.06) dy = 0;

            // Slightly higher speed coefficients for responsive feel
            velocity.current.theta = -dx * 0.18;
            velocity.current.phi = -dy * 0.12;
        } else {
            gestureModeRef.current = 'IDLE';
            setGestureState({ mode: 'IDLE', active: true });
        }

      } else {
        gestureModeRef.current = 'IDLE';
        setGestureState({ mode: 'IDLE', active: false });
        velocity.current = { theta: 0, phi: 0, zoom: camState.current.radius };
      }
      ctx.restore();
    };

    // Initialize MediaPipe
    const initMediaPipe = async () => {
        if (!window.Hands) {
            setTimeout(initMediaPipe, 500);
            return;
        }
        
        hands = new window.Hands({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });
        hands.onResults(onResults);

        if (videoRef.current) {
            camera = new window.Camera(videoRef.current, {
                onFrame: async () => { 
                    try {
                        if (videoRef.current && videoRef.current.videoWidth > 0) {
                            await hands.send({ image: videoRef.current }); 
                        }
                    } catch (e) {
                        console.warn("MediaPipe WebGL send error (ignorado):", e);
                    }
                },
                width: 320,
                height: 240
            });
            camera.start();
        }
    };

    initMediaPipe();

    // ─── rAF Physics Loop ─────────────────────────────────────────────────────
    // Using requestAnimationFrame instead of setInterval ensures the physics
    // runs in sync with the browser's rendering pipeline (true 60fps / no drift).
    // Higher lerp factor (0.28) makes velocity feel snappy and eliminates the
    // "stopping" sensation that was caused by the previous 0.15 factor.
    const physicsLoop = () => {
        const LERP = gestureModeRef.current === 'ROTATING' ? 0.28 : 0.18;

        smoothVelocity.current.theta += (velocity.current.theta - smoothVelocity.current.theta) * LERP;
        smoothVelocity.current.phi   += (velocity.current.phi   - smoothVelocity.current.phi)   * LERP;

        camState.current.theta += smoothVelocity.current.theta;
        camState.current.phi   += smoothVelocity.current.phi;
        
        // Clamp Phi (Polar angle) to avoid flipping
        camState.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, camState.current.phi));

        // Smooth Zoom
        if (velocity.current.zoom !== 0) {
            camState.current.radius += (velocity.current.zoom - camState.current.radius) * 0.12;
        }
        camState.current.radius = Math.max(2, Math.min(250, camState.current.radius));

        const newOrbit = `${camState.current.theta}rad ${camState.current.phi}rad ${camState.current.radius}%`;
        orbitOutput.current = newOrbit;

        // ── Direct DOM write bypass ──────────────────────────────────────────
        // Writing directly to model-viewer's camera-orbit attribute skips the
        // React state cycle entirely, giving sub-frame latency updates.
        if (gestureModeRef.current !== 'IDLE' && gestureModeRef.current !== 'VOICE' && gestureModeRef.current !== 'LOCKED') {
          const viewer = document.getElementById('heart-viewer') as any;
          if (viewer) {
            viewer.setAttribute('camera-orbit', newOrbit);
          }
        }

        rafId = requestAnimationFrame(physicsLoop);
    };
    rafId = requestAnimationFrame(physicsLoop);

    return () => {
        if (camera) camera.stop();
        if (hands) hands.close();
        cancelAnimationFrame(rafId);
    };
  }, [videoRef, canvasRef, active]);

  return { gestureState, orbitOutput };
};