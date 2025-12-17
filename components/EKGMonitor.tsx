import React, { useEffect, useRef, useState } from 'react';

const EKGMonitor: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentPhase, setCurrentPhase] = useState<'SÍSTOLE' | 'DIÁSTOLE'>('DIÁSTOLE');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let startTime = Date.now();
        const duration = 1000; // 1 second per beat (60 BPM)

        // EKG Parameters
        const baseline = canvas.height / 2;
        const amplitude = 30; // Height of the QRS complex
        let xPos = 0;
        const speed = 2; // Pixels per frame

        const drawGrid = (context: CanvasRenderingContext2D, width: number, height: number) => {
            context.strokeStyle = '#1a3d3d'; // Dark green grid
            context.lineWidth = 0.5;
            const step = 20;

            context.beginPath();
            for (let x = 0; x < width; x += step) {
                context.moveTo(x, 0);
                context.lineTo(x, height);
            }
            for (let y = 0; y < height; y += step) {
                context.moveTo(0, y);
                context.lineTo(width, y);
            }
            context.stroke();
        };

        // Clear initial canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw Grid (Medical style)
        drawGrid(ctx, canvas.width, canvas.height);

        const getY = (t: number) => {
            // t is 0.0 to 1.0 within the cycle
            // Logic for EKG Waveform approximation

            // P Wave (0.1 - 0.2)
            if (t > 0.1 && t < 0.2) return baseline - Math.sin((t - 0.1) * 10 * Math.PI) * (amplitude * 0.2);

            // QRS Complex (0.35 - 0.45)
            // Q (dip)
            if (t > 0.35 && t < 0.38) return baseline + (amplitude * 0.2);
            // R (spike)
            if (t >= 0.38 && t < 0.42) return baseline - amplitude * 2.5;
            // S (dip)
            if (t >= 0.42 && t < 0.45) return baseline + (amplitude * 0.4);

            // T Wave (0.6 - 0.8)
            if (t > 0.6 && t < 0.8) return baseline - Math.sin((t - 0.6) * 5 * Math.PI) * (amplitude * 0.3);

            return baseline; // Isoelectric line
        };

        const render = () => {
            const now = Date.now();
            const elapsed = (now - startTime) % duration;
            const progress = elapsed / duration;

            // Update Phase Text based on timing (approximate)
            // QRS is start of Systole (Contraction)
            if (progress > 0.38 && progress < 0.8) {
                setCurrentPhase('SÍSTOLE'); // Contraction
            } else {
                setCurrentPhase('DIÁSTOLE'); // Relaxation
            }

            // Move forward
            xPos += speed;

            // Wrap around
            if (xPos > canvas.width) {
                xPos = 0;
                // Fade effect / Clear screen
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Re-draw grid faintly to keep it visible? 
                // Or just clear completely for cleaner look:
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, 20, canvas.height); // Clear leading edge

                // Actually for a monitor effect, let's just loop seamlessly. 
                // We will clear a "bar" ahead of the cursor
            }

            // Leading edge clearing
            ctx.fillStyle = '#000000';
            ctx.fillRect(xPos, 0, 10, canvas.height); // Wipe ahead
            if (xPos % 20 < speed) { // Re-draw vertical grid line efficiently? No, too complex for simple rect. 
                // Just keep black background for simplicity and high contrast green line.
            }

            // Calculate Y
            const y = getY(progress);

            // Draw Line
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00ff00'; // Classic Green
            ctx.lineCap = 'round';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#00ff00';

            ctx.beginPath();
            // Connect from previous point? Ideally yes, but simplified point drawing for high FPS 
            // We need previous Y for smooth lines.
            // Let's rely on high refresh rate.

            // Better: Draw line from prev point
            // ctx.moveTo(prevX, prevY); 
            // ctx.lineTo(xPos, y); 
            // This requires storing state outside loop frame.

            // Simple dots for now, looks okay at high speed or small lineTo
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(xPos, y, 2, 2);

            animationId = requestAnimationFrame(render);
        };

        // Advanced render with Line connection
        let prevX = 0;
        let prevY = baseline;

        const smoothRender = () => {
            const now = Date.now();
            const elapsed = (now - startTime) % duration;
            const progress = elapsed / duration;

            // Phase logic
            if (progress > 0.38 && progress < 0.7) {
                if (currentPhase !== 'SÍSTOLE') setCurrentPhase('SÍSTOLE');
            } else {
                if (currentPhase !== 'DIÁSTOLE') setCurrentPhase('DIÁSTOLE');
            }

            const y = getY(progress);

            // Clearing "cursor" bar ahead
            ctx.fillStyle = 'rgba(0,10,0,1)'; // Dark background
            ctx.fillRect(xPos + 5, 0, 10, canvas.height);

            // Draw
            ctx.beginPath();
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ff66';

            // Handle wrap-around connectivity
            if (xPos < prevX) {
                ctx.moveTo(xPos, y); // Start fresh
            } else {
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(xPos, y);
            }
            ctx.stroke();

            prevX = xPos;
            prevY = y;
            xPos += speed;

            if (xPos > canvas.width) {
                xPos = 0;
                prevX = 0; // Reset prevX to avoid line shooting across screen
            }

            animationId = requestAnimationFrame(smoothRender);
        }


        animationId = requestAnimationFrame(smoothRender);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <div className="flex flex-col gap-2 p-4 bg-black/50 rounded-xl border border-teal-900/50">
            <div className="flex justify-between items-center text-xs font-mono tracking-widest">
                <span className="text-teal-500">FC: 60 LPM</span>
                <span className={`${currentPhase === 'SÍSTOLE' ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                    {currentPhase}
                </span>
            </div>

            <div className="relative w-full h-32 bg-black border border-gray-800 rounded overflow-hidden shadow-inner">
                {/* Grid Background (CSS Overlay for static grid) */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(#0f0 1px, transparent 1px), linear-gradient(90deg, #0f0 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}>
                </div>

                <canvas
                    ref={canvasRef}
                    width={350}
                    height={128}
                    className="absolute inset-0 z-10 w-full h-full"
                />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-mono mt-1">
                <div>PR: 0.16s</div>
                <div>QRS: 0.08s</div>
                <div>QT: 0.40s</div>
                <div className="text-right col-span-2 text-teal-700">DERIVACIÓN II</div>
            </div>
        </div>
    );
};

export default EKGMonitor;
