import React, { useEffect, useState } from 'react';
import { AnatomicalPart, AppMode } from '../../../shared/types/index.ts';
import { getClinicalContext, MedicalData, sendChatMessage } from '../../../shared/lib/geminiService.ts';
import EKGMonitor from '../../navigation/components/EKGMonitor.tsx';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
}

interface InfoPanelProps {
    selectedPart: AnatomicalPart | null;
    mode: AppMode;
    onClose: () => void;
    // Quiz props
    quizQuestion?: string | null;
    quizStatus?: 'IDLE' | 'LOADING' | 'WAITING_FOR_USER' | 'CORRECT' | 'INCORRECT';
    onNextQuestion?: () => void;
    correctAnswerName?: string;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
    selectedPart,
    mode,
    onClose,
    quizQuestion,
    quizStatus,
    onNextQuestion,
    correctAnswerName
}) => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Auto-expand panel when relevant content changes (new selection, new quiz question, or mode switch)
    useEffect(() => {
        setIsMinimized(false);
    }, [selectedPart, quizQuestion, mode]);

    // CHAT INITIALIZATION
    useEffect(() => {
        if (selectedPart && mode === AppMode.EXPLORE) {
            setChatMessages([
                {
                    id: Date.now().toString(),
                    role: 'ai',
                    text: `Hola. Soy tu Asistente Médico de IA. Estoy listo para responder cualquier pregunta clínica, anatómica o fisiopatológica sobre: **${selectedPart.label}**.\n\n¿En qué te puedo ayudar?`
                }
            ]);
            setChatInput('');
        }
    }, [selectedPart, mode]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim() || isChatLoading || !selectedPart) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput.trim() };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const responseText = await sendChatMessage(selectedPart.label, userMsg.text, chatMessages.slice(-5));
            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: responseText };
            setChatMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: "Error de conexión. Por favor, intenta nuevamente." };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // === RENDER: LANDING CARD (No selection) ===
    if (mode === AppMode.EXPLORE && !selectedPart) {
        // Minimized State for Landing Card
        if (isMinimized) {
            return (
                <button
                    onClick={() => setIsMinimized(false)}
                    className="absolute top-20 sm:top-6 left-4 z-40 bg-gray-900/80 p-2 rounded-full border border-teal-500 shadow-lg backdrop-blur-md animate-fade-in hover:bg-gray-800 transition-colors"
                    title="Mostrar Información"
                >
                    <img src="/logo_airstark.jpg" alt="AIRSTARK" className="w-8 h-8 rounded-full object-cover shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                </button>
            );
        }

        // Expanded State for Landing Card
        return (
            <div className="absolute top-20 sm:top-6 left-4 sm:left-6 right-4 sm:w-80 bg-black/80 backdrop-blur-md border-l-4 border-teal-500 rounded-r-xl p-6 text-gray-300 shadow-2xl transition-opacity animate-fade-in pointer-events-auto">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                        <img src="/logo_airstark.jpg" alt="Logo" className="w-8 h-8 rounded-full object-cover" /> AIRSTARK
                    </h2>
                    {/* Minimize Button */}
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="text-gray-500 hover:text-white p-1 transition-colors"
                        title="Minimizar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>

                <p className="mb-4 text-sm text-gray-400">Plataforma de estudio anatómico y clínico.</p>
                <div className="space-y-4">
                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <span className="text-teal-400 font-bold text-sm uppercase block mb-1">Modo Estudio</span>
                        <span className="text-xs text-gray-400">Correlación clínica, fisiopatología y perlas para exámenes.</span>
                    </div>
                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <span className="text-red-400 font-bold text-sm uppercase block mb-1">Modo Quiz</span>
                        <span className="text-xs text-gray-400">Entrenamiento con casos clínicos tipo MIR/USMLE.</span>
                    </div>
                </div>
                <div className="mt-4 text-xs text-gray-600 italic">
                    Usa comandos de voz como "Aorta" o "Explorar".
                </div>
            </div>
        );
    }

    // === RENDER: MAIN PANEL (Explore Detail OR Quiz) ===
    return (
        <div className={`
        fixed sm:absolute 
        bottom-0 sm:bottom-auto sm:top-6 
        left-0 sm:left-6 
        w-full sm:w-80 md:w-96 
        ${isMinimized ? 'h-auto rounded-t-xl sm:rounded-xl' : 'max-h-[50vh] sm:max-h-[85vh]'} 
        overflow-hidden
        bg-gray-900/95 backdrop-blur-xl 
        border-t sm:border border-gray-700 
        rounded-t-2xl sm:rounded-xl 
        shadow-2xl 
        transition-all duration-300 
        z-40 flex flex-col font-sans
    `}>

            {/* Header */}
            <div
                className={`p-4 border-b sticky top-0 bg-gray-900/95 z-10 cursor-pointer ${mode === AppMode.QUIZ ? 'border-red-900 bg-gradient-to-r from-red-900/40 to-transparent' : 'border-teal-900 bg-gradient-to-r from-teal-900/40 to-transparent'}`}
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${mode === AppMode.QUIZ ? 'text-red-400' : mode === AppMode.NAVIGATION ? 'text-teal-400' : 'text-teal-400'}`}>
                            {mode === AppMode.QUIZ ? 'EVALUACIÓN CLÍNICA' : mode === AppMode.NAVIGATION ? 'MONITOR CARDÍACO' : 'FICHA CLÍNICA'}
                        </span>
                        <h2 className="text-2xl font-bold text-white mt-1 leading-tight truncate pr-2">
                            {mode === AppMode.QUIZ ? 'Caso Clínico' : mode === AppMode.NAVIGATION ? 'Ciclo Cardíaco' : selectedPart?.label}
                        </h2>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Minimize/Expand Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            {isMinimized ? (
                                // Expand Icon
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4" /></svg>
                            ) : (
                                // Minimize Icon
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            )}
                        </button>

                        {/* Close Button (Only in Explore mode) */}
                        {mode === AppMode.EXPLORE && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onClose(); }}
                                className="text-gray-500 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                                title="Cerrar Ficha"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content - Hidden when minimized */}
            {!isMinimized && (
                <div className="p-5 flex-1 overflow-y-auto space-y-4 animate-fade-in">

                    {/* === EXPLORE MODE === */}
                    {mode === AppMode.EXPLORE && selectedPart && (
                        <>
                            <div className="text-gray-300 text-sm leading-relaxed pb-2">
                                {selectedPart.description}
                            </div>

                            <div className="flex flex-col h-[350px] bg-gray-900/50 rounded-lg border border-gray-700/50 mt-2 overflow-hidden shadow-inner">
                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                    {chatMessages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                                                msg.role === 'user' 
                                                ? 'bg-teal-600/80 text-white rounded-tr-sm' 
                                                : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-sm'
                                            }`}>
                                                {msg.role === 'ai' && <div className="flex items-center gap-2 mb-1 opacity-70"><span className="text-[10px] font-bold text-teal-400 uppercase">AIRSTARK IA</span></div>}
                                                <div className="whitespace-pre-wrap leading-relaxed">{msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-800 text-gray-400 border border-gray-700 rounded-xl rounded-tl-sm p-3 text-sm flex items-center gap-2">
                                                <span className="text-xs italic">Analizando información médica</span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse"></span>
                                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse delay-100"></span>
                                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse delay-200"></span>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Chat Input */}
                                <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-700/50 bg-gray-800/50 flex gap-2">
                                    <input 
                                        type="text" 
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Pregunta sobre anatomía o fisiología..." 
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!chatInput.trim() || isChatLoading}
                                        className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 px-3 rounded-lg transition-colors flex items-center justify-center"
                                        title="Enviar"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    </button>
                                </form>
                            </div>
                        </>

                    )}

                    {/* === NAVIGATION MODE === */}
                    {mode === AppMode.NAVIGATION && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">
                                Monitor en tiempo real sincronizado con ciclo de 60 BPM.
                            </p>
                            <EKGMonitor />

                            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 mt-4">
                                <h3 className="text-teal-400 font-bold text-xs uppercase mb-2">Leyenda del Ciclo</h3>
                                <ul className="space-y-2 text-xs text-gray-300">
                                    <li className="flex gap-2">
                                        <span className="font-bold text-white">Sístole:</span> Contracción ventricular (QRS + ST).
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="font-bold text-white">Diástole:</span> Relajación y llenado (T + P).
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* === QUIZ MODE === */}
                    {mode === AppMode.QUIZ && (
                        <div className="space-y-6">
                            {/* The Vignette */}
                            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 shadow-inner relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Caso Clínico (MIR/USMLE)</h3>
                                <div className="text-lg text-white font-medium leading-relaxed font-serif">
                                    {quizStatus === 'LOADING' ? (
                                        <span className="animate-pulse text-gray-400">Analizando registros médicos... generando caso...</span>
                                    ) : (
                                        `"${quizQuestion}"`
                                    )}
                                </div>
                            </div>

                            {/* Instructions */}
                            {quizStatus === 'WAITING_FOR_USER' && (
                                <div className="text-center p-2 text-sm text-gray-400 animate-pulse border border-dashed border-gray-700 rounded bg-gray-800/30">
                                    Minimiza este panel si tapa el modelo y selecciona la estructura correcta.
                                </div>
                            )}

                            {/* Incorrect Feedback */}
                            {quizStatus === 'INCORRECT' && (
                                <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-3 animate-shake">
                                    <div className="bg-red-500/20 p-2 rounded-full shrink-0">
                                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="text-red-400 font-bold text-sm">Incorrecto</h4>
                                        <p className="text-red-200/80 text-xs mt-1">Esa no es la estructura descrita. Inténtalo de nuevo.</p>
                                    </div>
                                </div>
                            )}

                            {/* Correct Feedback & Next Button */}
                            {quizStatus === 'CORRECT' && (
                                <div className="animate-fade-in-up">
                                    <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg flex items-start gap-3 mb-4">
                                        <div className="bg-green-500/20 p-2 rounded-full shrink-0">
                                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-green-400 font-bold text-sm">¡Correcto!</h4>
                                            <p className="text-green-200/80 text-sm mt-1">
                                                El caso clínico corresponde a: <strong className="text-white uppercase">{correctAnswerName}</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onNextQuestion}
                                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 transform hover:scale-[1.02]"
                                    >
                                        <span>Siguiente Caso Clínico</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
            }
        </div >
    );
};