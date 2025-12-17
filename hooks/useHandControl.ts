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

export const useHandControl = (videoRef: React.RefObject<HTMLVideoElement>, canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const [gestureState, setGestureState] = useState<{ mode: string, active: boolean }>({ mode: 'IDLE', active: false });
  
  // Physics State (Refs to avoid re-renders on every frame)
  const camState = useRef<CameraState>({ theta: 0, phi: Math.PI / 2, radius: 100 });
  const velocity = useRef({ theta: 0, phi: 0, zoom: 0 });
  const smoothVelocity = useRef({ theta: 0, phi: 0 });
  const orbitOutput = useRef<string>("0rad 1.57rad 100%");

  useEffect(() => {
    let camera: any;
    let hands: any;

    const onResults = (results: any) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !videoRef.current) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

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
          setGestureState({ mode: 'VOICE', active: true });
          velocity.current = { theta: 0, phi: 0, zoom: camState.current.radius };
        }
        // 2. Fist (Brake)
        else if (extendedCount === 0 && !thumbExt) {
          setGestureState({ mode: 'LOCKED', active: true });
          velocity.current = { theta: 0, phi: 0, zoom: camState.current.radius };
          smoothVelocity.current = { theta: 0, phi: 0 };
        }
        // 3. Pinch/Index (Zoom)
        else if (indexExt && extendedCount === 1) {
            setGestureState({ mode: 'ZOOMING', active: true });
            const dPinch = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
            const zoomTarget = 200 - (dPinch * 400);
            velocity.current.zoom = zoomTarget;
            velocity.current.theta = 0;
            velocity.current.phi = 0;
        }
        // 4. Open Palm (Rotate)
        else if (extendedCount >= 3) {
            setGestureState({ mode: 'ROTATING', active: true });
            const handX = 1.0 - landmarks[9].x; // Mirror
            const handY = landmarks[9].y;
            
            let dx = (handX - 0.5);
            let dy = (handY - 0.5);
            
            // Deadzone
            if (Math.abs(dx) < 0.1) dx = 0;
            if (Math.abs(dy) < 0.1) dy = 0;

            velocity.current.theta = -dx * 0.15; // Speed
            velocity.current.phi = -dy * 0.1;
        } else {
            setGestureState({ mode: 'IDLE', active: true });
        }

      } else {
        setGestureState({ mode: 'IDLE', active: false });
        velocity.current = { theta: 0, phi: 0, zoom: camState.current.radius };
      }
      ctx.restore();
    };

    // Initialize MediaPipe
    const initMediaPipe = async () => {
        if (!window.Hands) {
            setTimeout(initMediaPipe, 500); // Wait for script load
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
                onFrame: async () => { await hands.send({ image: videoRef.current }); },
                width: 320,
                height: 240
            });
            camera.start();
        }
    };

    initMediaPipe();

    // Physics Loop
    const physicsInterval = setInterval(() => {
        smoothVelocity.current.theta += (velocity.current.theta - smoothVelocity.current.theta) * 0.15;
        smoothVelocity.current.phi += (velocity.current.phi - smoothVelocity.current.phi) * 0.15;

        camState.current.theta += smoothVelocity.current.theta;
        camState.current.phi += smoothVelocity.current.phi;
        
        // Clamp Phi (Polar angle) to avoid flipping
        camState.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, camState.current.phi));

        // Smooth Zoom
        if (velocity.current.zoom !== 0) {
            camState.current.radius += (velocity.current.zoom - camState.current.radius) * 0.1;
        }
        camState.current.radius = Math.max(10, Math.min(200, camState.current.radius));

        orbitOutput.current = `${camState.current.theta}rad ${camState.current.phi}rad ${camState.current.radius}%`;
    }, 1000 / 60);

    return () => {
        if (camera) camera.stop();
        if (hands) hands.close();
        clearInterval(physicsInterval);
    };
  }, [videoRef, canvasRef]);

  return { gestureState, orbitOutput };
};