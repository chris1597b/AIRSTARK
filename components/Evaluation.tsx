import React, { useState } from 'react';

interface EvaluationProps {
  onExit: () => void;
}

type Tab = 'panel' | 'informacion' | 'modelo' | 'cuestionario' | 'codigo_qr' | 'estadisticas';

export interface Question {
  id: string;
  prompt: string;
  options: { id: string; text: string; isCorrect: boolean }[];
}

export interface SessionConfig {
  nombre: string;
  descripcion: string;
  estado: 'ACTIVA' | 'DESACTIVA';
  fechaActivacion: string;
  duracionMinutos: number;
  modeloSeleccionado: string;
  preguntas: Question[];
}

/* ─────────────────────────────────────────────
   Sub-vista: Panel (dashboard existente)
───────────────────────────────────────────── */
const PanelView: React.FC<{ onNewSession: () => void }> = ({ onNewSession }) => (
  <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
    {/* Header */}
    <div className="flex justify-between items-end mb-12">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Panel de Profesor</h1>
        <p className="text-lg text-gray-400">Gestiona tus simulaciones médicas en realidad aumentada.</p>
      </div>
    </div>

    {/* Bento Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
      {/* Primary */}
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
        <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group min-h-[300px]">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[100px] -top-1/2 -right-1/4 mix-blend-screen transition-opacity group-hover:opacity-40 duration-700" />
          </div>
          <div className="relative z-10 w-full max-w-md flex flex-col items-center">
            <span className="material-symbols-outlined text-6xl text-cyan-400 mb-6" style={{ fontVariationSettings: "'FILL' 1", fontSize: '64px' }}>add_circle</span>
            <button onClick={onNewSession} className="w-full h-16 bg-cyan-400 text-gray-900 text-sm font-bold rounded-lg flex items-center justify-center gap-3 hover:bg-indigo-600 hover:text-white transition-colors duration-300 shadow-[0_0_15px_rgba(0,255,255,0.4)] active:scale-95">
              <span className="material-symbols-outlined">cast</span>
              Crear Nueva Sesión AR
            </button>
            <p className="mt-6 text-sm text-gray-400 max-w-xs mx-auto">
              Proyecta el código QR en clase para que los estudiantes entren
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-600/30">
                <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: '20px' }}>sensors</span>
              </div>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider rounded border border-green-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Live
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1 font-bold">Sesiones Activas Hoy</p>
              <h2 className="text-4xl font-bold text-white">2</h2>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-full bg-slate-700/40 flex items-center justify-center border border-white/10">
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>groups</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1 font-bold">Estudiantes Conectados</p>
              <h2 className="text-4xl font-bold text-white">48</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 h-full flex flex-col">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '20px' }}>history</span>
            Sesiones Recientes
          </h3>
          <div className="flex flex-col gap-4 flex-1">
            {[
              { title: 'Anatomía Cardíaca', date: 'Ayer', students: 24, duration: '45m' },
              { title: 'Neurocirugía Básica', date: 'Mar 12', students: 18, duration: '1h 15m' },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-lg bg-slate-700/50 border border-white/10 hover:bg-slate-600/50 transition-colors cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">{s.title}</h4>
                  <span className="text-xs text-gray-400">{s.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-gray-400">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>groups</span>
                    <span className="text-xs">{s.students}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>timer</span>
                    <span className="text-xs">{s.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-3 mt-4 text-center text-cyan-400 text-sm font-semibold border border-cyan-400/30 rounded-lg hover:bg-indigo-600/20 hover:text-cyan-300 transition-colors">
            Ver Historial Completo
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   Sub-vista: Información (desde Stitch)
───────────────────────────────────────────── */
const InformacionView: React.FC<{ onNext: () => void; config: SessionConfig; setConfig: React.Dispatch<React.SetStateAction<SessionConfig>> }> = ({ onNext, config, setConfig }) => {
  return (
    <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>medical_services</span>
          <span className="text-xs font-bold uppercase tracking-widest">Procedimientos / Evaluación</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white">Información General</h1>
        <p className="text-gray-400 mt-2">Datos iniciales de la sesión</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">
        {/* Columna Izquierda */}
        <div className="xl:col-span-4 space-y-6">

          {/* Fecha de Creación / Programación */}
          <section className="relative overflow-hidden rounded-xl p-6" style={{ background: 'rgba(31,41,55,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 rounded-l-xl" />
            <div className="mb-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block" htmlFor="fecha-activacion">
                Fecha de Activación
              </label>
              <input 
                id="fecha-activacion"
                type="date"
                value={config.fechaActivacion}
                onChange={(e) => setConfig({ ...config, fechaActivacion: e.target.value })}
                className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-200 [color-scheme:dark]"
              />
            </div>
          </section>

          {/* Duración */}
          <section className="relative rounded-xl p-6" style={{ background: 'rgba(31,41,55,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="absolute top-0 left-0 w-1 h-full bg-gray-600 rounded-l-xl" />
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '22px' }}>timer</span>
              Duración
            </h2>
            <div className="mb-4">
              <div className="flex justify-between items-end mb-3">
                <label className="text-gray-400 text-xs font-bold uppercase tracking-wider" htmlFor="duracion-minutos">Tiempo Límite (Minutos)</label>
                <div className="bg-gray-800/80 px-3 py-1 rounded border border-white/10 flex items-center gap-1">
                  <input 
                    id="duracion-minutos"
                    type="number"
                    min={3}
                    max={180}
                    value={config.duracionMinutos}
                    onChange={e => setConfig({ ...config, duracionMinutos: Number(e.target.value) })}
                    className="w-16 bg-transparent text-2xl font-bold text-cyan-400 text-right focus:outline-none appearance-none"
                    style={{ MozAppearance: 'textfield' }}
                  />
                  <span className="text-xs font-bold text-gray-400 ml-1">MIN</span>
                </div>
              </div>
              <div className="relative w-full">
                <input
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  type="range"
                  min={3}
                  max={180}
                  value={config.duracionMinutos}
                  onChange={e => setConfig({ ...config, duracionMinutos: Number(e.target.value) })}
                  style={{
                    background: `linear-gradient(to right, #22d3ee ${((config.duracionMinutos - 3) / 177) * 100}%, #374151 ${((config.duracionMinutos - 3) / 177) * 100}%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>3 min</span>
                  <span>180 min</span>
                </div>
              </div>
            </div>
          </section>

          {/* Estado de sesión */}
          <section className="relative overflow-hidden rounded-xl p-6" style={{ background: 'rgba(31,41,55,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 rounded-l-xl" />
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Estado de la Sesión</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border transition-all ${config.estado === 'ACTIVA' ? 'bg-cyan-400/20 border-cyan-400 text-cyan-400' : 'bg-gray-900/60 border-white/10 text-gray-400 hover:border-gray-400'}`}>
                <input 
                  type="radio" 
                  name="estado" 
                  value="ACTIVA" 
                  checked={config.estado === 'ACTIVA'} 
                  onChange={() => setConfig({ ...config, estado: 'ACTIVA' })} 
                  className="hidden" 
                />
                {config.estado === 'ACTIVA' && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                ACTIVA
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border transition-all ${config.estado === 'DESACTIVA' ? 'bg-gray-700 border-gray-400 text-white' : 'bg-gray-900/60 border-white/10 text-gray-400 hover:border-gray-400'}`}>
                <input 
                  type="radio" 
                  name="estado" 
                  value="DESACTIVA" 
                  checked={config.estado === 'DESACTIVA'} 
                  onChange={() => setConfig({ ...config, estado: 'DESACTIVA' })} 
                  className="hidden" 
                />
                DESACTIVA
              </label>
            </div>
          </section>
        </div>

        {/* Columna Derecha */}
        <div className="xl:col-span-8 flex flex-col">
          <section className="rounded-xl p-6 flex-1 flex flex-col relative" style={{ background: 'rgba(31,41,55,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="absolute top-0 left-0 w-1 h-full bg-gray-600 rounded-l-xl" />

            <div className="space-y-8 flex-1">
              {/* Nombre de la sesión */}
              <div className="group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" htmlFor="session-name">
                  Nombre de la Sesión
                </label>
                <div className="relative">
                  <input
                    id="session-name"
                    type="text"
                    value={config.nombre}
                    onChange={e => setConfig({ ...config, nombre: e.target.value })}
                    placeholder="Ej. Evaluación de Válvula Mitral"
                    className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-200"
                  />
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-cyan-400 transition-all duration-300 group-focus-within:w-full rounded-b-lg" />
                </div>
              </div>

              {/* Descripción de la sesión */}
              <div className="group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" htmlFor="session-desc">
                  Descripción de la Sesión
                </label>
                <div className="relative">
                  <textarea
                    id="session-desc"
                    rows={15}
                    value={config.descripcion}
                    onChange={e => setConfig({ ...config, descripcion: e.target.value })}
                    placeholder="Describa los objetivos y el contexto de esta evaluación..."
                    className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-200 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Acción */}
            <div className="flex justify-end mt-8 pt-4 border-t border-white/10">
              <button onClick={onNext} className="h-12 px-8 bg-cyan-400 text-gray-900 text-sm font-bold rounded-lg flex items-center gap-2 hover:bg-cyan-300 transition-colors shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] active:scale-95">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
                Siguiente
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Sub-vista: Modelo
───────────────────────────────────────────── */
const ModeloView: React.FC<{ onNext: () => void; config: SessionConfig; setConfig: React.Dispatch<React.SetStateAction<SessionConfig>> }> = ({ onNext, config, setConfig }) => {
  const models = [
    { id: 'heart', icon: 'cardiology', label: 'Heart' },
    { id: 'brain', icon: 'neurology', label: 'Brain' },
    { id: 'lungs', icon: 'pulmonology', label: 'Lungs' },
    { id: 'kidneys', icon: 'nephrology', label: 'Kidneys' }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-gray-400 mb-3">
          <span className="material-symbols-outlined text-sm">medical_services</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Procedures / Evaluation</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Selección del Modelo</h1>
        <p className="text-gray-400 mt-2 text-lg max-w-2xl">Seleccione el modelo anatómico para la visualización AR.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">
        {/* Left Column: Model Selection */}
        <div className="xl:col-span-12 flex flex-col gap-6">
          <section className="rounded-xl p-6 border-l-4 border-l-cyan-400 flex-1" style={{ background: 'rgba(31,41,55,0.6)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-cyan-400">biotech</span>
              Modelos Disponibles
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {models.map(m => (
                <button 
                  key={m.id}
                  onClick={() => setConfig({ ...config, modeloSeleccionado: m.id })}
                  className={`flex flex-col items-center justify-center p-8 rounded-lg transition-all group ${
                    config.modeloSeleccionado === m.id 
                    ? 'bg-cyan-400/20 border-2 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.2)]' 
                    : 'bg-slate-800/50 border-2 border-transparent border-white/10 text-gray-400 hover:border-gray-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-5xl mb-4 group-hover:scale-110 transition-transform" style={{ fontVariationSettings: config.modeloSeleccionado === m.id ? "'FILL' 1" : "'FILL' 0" }}>{m.icon}</span>
                  <span className="text-sm font-bold uppercase tracking-tight">{m.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mt-8 pt-6 border-t border-white/10">
        <button className="w-full sm:w-auto h-12 px-8 text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">
          Cancelar
        </button>
        <button onClick={onNext} className="w-full sm:w-auto h-12 px-8 bg-cyan-400 text-gray-900 font-bold rounded-lg flex items-center justify-center gap-3 hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] group active:scale-95">
          Continuar
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform" style={{ fontSize: '20px' }}>arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Sub-vista: Cuestionario
───────────────────────────────────────────── */
const CuestionarioView: React.FC<{ onNext: () => void; config: SessionConfig; setConfig: React.Dispatch<React.SetStateAction<SessionConfig>> }> = ({ onNext, config, setConfig }) => {
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const currentQ = config.preguntas[currentQIndex];

  const updateCurrentQuestion = (updates: Partial<Question>) => {
    const newPreguntas = [...config.preguntas];
    newPreguntas[currentQIndex] = { ...newPreguntas[currentQIndex], ...updates };
    setConfig({ ...config, preguntas: newPreguntas });
  };

  const updateOption = (optId: string, text: string) => {
    const newOptions = currentQ.options.map(o => o.id === optId ? { ...o, text } : o);
    updateCurrentQuestion({ options: newOptions });
  };

  const setCorrectOption = (optId: string) => {
    const newOptions = currentQ.options.map(o => ({ ...o, isCorrect: o.id === optId }));
    updateCurrentQuestion({ options: newOptions });
  };

  const handleAddQuestion = () => {
    const newQ: Question = {
      id: Date.now().toString(),
      prompt: '',
      options: [
        { id: 'A', text: '', isCorrect: true },
        { id: 'B', text: '', isCorrect: false },
        { id: 'C', text: '', isCorrect: false },
        { id: 'D', text: '', isCorrect: false }
      ]
    };
    setConfig({ ...config, preguntas: [...config.preguntas, newQ] });
    setCurrentQIndex(config.preguntas.length);
  };

  const handleDeleteQuestion = () => {
    if (config.preguntas.length <= 1) return; // Prevent deleting last question
    const newPreguntas = config.preguntas.filter((_, i) => i !== currentQIndex);
    setConfig({ ...config, preguntas: newPreguntas });
    setCurrentQIndex(Math.max(0, currentQIndex - 1));
  };

  const handleSaveConfig = async () => {
    // Aquí es donde se llamaría a la API posteriormente.
    console.log("Guardando configuración...", config);
    alert("Configuración guardada en estado global (Próximamente API)");
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <span className="material-symbols-outlined text-sm">medical_services</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Procedures / Evaluation</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Configuración de Cuestionario</h1>
        <p className="text-gray-400 mt-2 text-lg max-w-2xl">Adecue las preguntas para el examen</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">
        <div className="xl:col-span-12 flex flex-col h-full">
          {currentQ ? (
            <section className="rounded-xl p-6 flex-1 flex flex-col relative" style={{ background: 'rgba(31,41,55,0.6)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="absolute top-0 left-0 w-1 h-full bg-gray-600 rounded-l-xl"></div>
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-400">quiz</span>
                  Clinical Questions ({config.preguntas.length})
                </h2>
                <div className="text-xs font-bold text-gray-400 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-white/5">
                  Q{currentQIndex + 1} of {config.preguntas.length}
                </div>
              </div>

              {/* Question Editor */}
              <div className="space-y-6 flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Question Prompt</label>
                  <textarea 
                    value={currentQ.prompt}
                    onChange={(e) => updateCurrentQuestion({ prompt: e.target.value })}
                    placeholder="Escriba la pregunta aquí..."
                    className="w-full bg-gray-900/60 border border-white/10 rounded-lg p-4 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all resize-none h-24" 
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Multiple Choice Options</label>
                  
                  {currentQ.options.map(opt => (
                    <label key={opt.id} className={`flex items-center gap-4 p-4 rounded-lg bg-gray-900/60 border cursor-pointer transition-all group ${opt.isCorrect ? 'border-cyan-400/50 shadow-[0_0_10px_rgba(0,255,255,0.1)]' : 'border-white/10 hover:border-cyan-400/30'}`}>
                      <input 
                        checked={opt.isCorrect} 
                        onChange={() => setCorrectOption(opt.id)}
                        className="w-5 h-5 text-cyan-400 bg-slate-800 border-white/20 focus:ring-cyan-400 focus:ring-offset-gray-900" 
                        name={`q${currentQ.id}`} 
                        type="radio" 
                      />
                      <div className="flex-1 flex gap-3 items-center">
                        <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-700 text-xs font-bold text-gray-400">{opt.id}</span>
                        <input 
                          value={opt.text}
                          onChange={(e) => updateOption(opt.id, e.target.value)}
                          placeholder={`Opción ${opt.id}`}
                          className="bg-transparent border-none p-0 flex-1 text-white focus:ring-0 focus:outline-none" 
                          type="text" 
                        />
                      </div>
                      <span className={`material-symbols-outlined text-xl transition-opacity ${opt.isCorrect ? 'text-green-400 opacity-100' : 'text-gray-500 opacity-0 group-hover:opacity-50'}`}>
                        {opt.isCorrect ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Navigation / Actions */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                <div className="flex flex-col w-full gap-4">
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
                      <span className="material-symbols-outlined text-lg group-hover:text-cyan-400 transition-colors">shuffle</span>
                      <span className="text-xs font-bold uppercase tracking-wider">Activar reordenación aleatoria de la pregunta</span>
                    </button>
                    <div className="flex gap-3">
                      <button onClick={handleSaveConfig} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 border border-cyan-400/30 transition-all">
                        <span className="material-symbols-outlined text-sm">save</span>
                        <span className="text-xs font-bold uppercase tracking-wider">Guardar Formulario</span>
                      </button>
                      <button 
                        onClick={handleDeleteQuestion}
                        disabled={config.preguntas.length <= 1}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900/60 hover:bg-red-500/10 text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span className="text-xs font-bold uppercase tracking-wider">Eliminar</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <button onClick={handleAddQuestion} className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
                      <span className="material-symbols-outlined text-lg">add</span>
                      <span className="text-xs font-bold uppercase tracking-wider">Añadir Pregunta</span>
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCurrentQIndex(Math.max(0, currentQIndex - 1))}
                        disabled={currentQIndex === 0}
                        className="w-10 h-10 rounded-full bg-gray-900/60 flex items-center justify-center text-gray-600 border border-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <button 
                        onClick={() => setCurrentQIndex(Math.min(config.preguntas.length - 1, currentQIndex + 1))}
                        disabled={currentQIndex === config.preguntas.length - 1}
                        className="w-10 h-10 rounded-full bg-gray-900/60 hover:bg-slate-700/50 transition-colors flex items-center justify-center text-white border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end mt-8 pt-6 border-t border-white/10">
        <button onClick={onNext} className="h-12 px-8 bg-cyan-400 text-gray-900 text-sm font-bold rounded-lg flex items-center justify-center gap-3 hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] active:scale-95">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>qr_code_2</span>
          Generar código QR
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Sub-vista: Código QR
───────────────────────────────────────────── */
const CodigoQRView: React.FC<{ onNavigateToStats: () => void }> = ({ onNavigateToStats }) => {
  return (
    <div className="w-full flex-1 flex flex-col lg:flex-row gap-8 -mx-4 md:-mx-8 px-4 md:px-8">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
        
        <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-8 relative z-10">
          <div className="flex flex-col items-center space-y-4">
            <span className="material-symbols-outlined text-green-400 text-5xl drop-shadow-[0_0_15px_rgba(46,204,113,0.3)]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <h1 className="text-4xl font-bold text-white tracking-tight">Sesión de Corazón</h1>
            <p className="text-xl font-bold text-white md:hidden">Sesión Lista para la Clase</p>
          </div>
          
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/30 backdrop-blur-md px-4 py-2 rounded-full">
            <span className="material-symbols-outlined text-indigo-400 text-sm">schedule</span>
            <span className="text-sm font-bold text-indigo-400">Código válido por 2 horas</span>
          </div>
          
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest opacity-80">tiempo limite</span>
              <span className="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.2)]">5 MIN</span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest opacity-80">preguntas</span>
              <span className="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.2)]">3</span>
            </div>
          </div>
          
          <div className="bg-gray-800/60 backdrop-blur-xl border border-white/10 p-6 rounded-xl shadow-2xl relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-xl pointer-events-none"></div>
            <div className="w-[300px] h-[300px] bg-white rounded-lg p-4 flex items-center justify-center relative overflow-hidden ring-1 ring-white/20 shadow-[0_0_30px_rgba(0,255,255,0.1)] group-hover:shadow-[0_0_40px_rgba(0,255,255,0.2)] transition-shadow duration-500">
              <div className="w-full h-full opacity-20" style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMCAwaDEwdjEwSDB6IiBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiLz48L3N2Zz4=')", backgroundSize: '20px 20px' }}></div>
              <span className="absolute text-gray-900 text-sm font-bold uppercase tracking-widest opacity-50">QR PLACEHOLDER</span>
              <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-md"></div>
              <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-md"></div>
              <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-md"></div>
              <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-md"></div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full pt-4">
            <button className="w-full sm:w-auto h-12 px-8 bg-cyan-400 text-gray-900 text-sm font-bold rounded-lg flex items-center justify-center space-x-2 hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all duration-200 active:scale-95">
              <span className="material-symbols-outlined text-lg">content_copy</span>
              <span>Copiar Enlace de Invitación</span>
            </button>
            <button onClick={onNavigateToStats} className="w-full sm:w-auto h-12 px-8 bg-transparent border-2 border-indigo-500 text-indigo-400 text-sm font-bold rounded-lg flex items-center justify-center space-x-2 hover:bg-indigo-500/10 transition-all duration-200 active:scale-95">
              <span className="material-symbols-outlined text-lg">monitoring</span>
              <span>Ir a Resultados en Vivo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Live Status */}
      <aside className="w-full lg:w-80 bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col z-20 overflow-hidden">
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white">Estado</h2>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#2ECC71]"></div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-full max-h-48 overflow-y-auto bg-gray-900/50 border border-white/10 rounded-xl p-4 space-y-3 mb-4 custom-scrollbar">
              <div className="flex items-center space-x-3 border-b border-white/10 pb-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-sm font-medium text-white">Ana Martínez</span>
              </div>
              <div className="flex items-center space-x-3 border-b border-white/10 pb-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-sm font-medium text-white">Carlos Ramírez</span>
              </div>
              <div className="flex items-center space-x-3 pb-1">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-sm font-medium text-white">Laura Gómez</span>
              </div>
            </div>
            
            <div className="relative w-48 h-48 rounded-full border border-white/10 bg-gray-900/50 flex flex-col items-center justify-center shadow-inner">
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-indigo-500/30 animate-[spin_20s_linear_infinite]"></div>
              <span className="text-[72px] leading-none text-cyan-400 drop-shadow-[0_0_15px_rgba(0,255,255,0.2)] font-bold tracking-tighter">3</span>
              <span className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-[0.15em]">Estudiantes<br/>Conectados</span>
            </div>
            
            <div className="flex items-center space-x-3 text-gray-400 bg-gray-900 px-4 py-2 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-cyan-400 animate-[spin_3s_linear_infinite]" style={{ fontSize: '20px' }}>sync</span>
              <span className="text-sm font-medium">Sincronización activa</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Sub-vista: Estadísticas
───────────────────────────────────────────── */
const EstadisticasView: React.FC = () => {
  return (
    <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
      {/* Context Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded bg-cyan-400/20 text-cyan-400">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Sesión: Corazón</h1>
          </div>
          <div className="flex flex-wrap gap-4 text-gray-400 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">timer</span>
              <span>Tiempo: 5 min</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">groups</span>
              <span>Estudiantes: 3/30</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-widest">EN VIVO</span>
          </div>
        </div>
      </header>

      {/* Live Table Dashboard */}
      <section className="bg-gray-800/60 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 border-b border-white/10 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-5 font-semibold">Estudiante</th>
                <th className="p-5 font-semibold">Estado</th>
                <th className="p-5 font-semibold">Tiempo</th>
                <th className="p-5 font-semibold">Puntaje</th>
                <th className="p-5 font-semibold text-right">Nota Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {/* Row 1: Completed */}
              <tr className="hover:bg-slate-700/30 transition-colors">
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center text-cyan-400 font-bold text-xs border border-white/5">
                      AM
                    </div>
                    <span className="text-white font-medium text-sm">Ana Martínez</span>
                  </div>
                </td>
                <td className="p-5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Completado
                  </span>
                </td>
                <td className="p-5 text-gray-400 text-sm font-medium">04:12</td>
                <td className="p-5 text-gray-400 text-sm font-medium">3/3</td>
                <td className="p-5 text-right">
                  <span className="text-green-400 font-bold text-lg">20/20</span>
                </td>
              </tr>
              {/* Row 2: In Progress */}
              <tr className="hover:bg-slate-700/30 transition-colors bg-cyan-400/5 relative">
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center text-cyan-400 font-bold text-xs border border-white/5">
                      CR
                    </div>
                    <span className="text-white font-medium text-sm">Carlos Ramírez</span>
                  </div>
                </td>
                <td className="p-5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-400/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[14px] animate-[spin_2s_linear_infinite]">sync</span>
                    En Progreso
                  </span>
                </td>
                <td className="p-5 text-gray-400 text-sm font-medium">03:45</td>
                <td className="p-5 text-gray-400 text-sm font-medium">2/3</td>
                <td className="p-5 text-right">
                  <span className="text-gray-500 font-bold text-lg">--/20</span>
                </td>
              </tr>
              {/* Row 3: Completed with errors */}
              <tr className="hover:bg-slate-700/30 transition-colors">
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center text-cyan-400 font-bold text-xs border border-white/5">
                      LG
                    </div>
                    <span className="text-white font-medium text-sm">Laura Gómez</span>
                  </div>
                </td>
                <td className="p-5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Completado
                  </span>
                </td>
                <td className="p-5 text-gray-400 text-sm font-medium">04:58</td>
                <td className="p-5 text-gray-400 text-sm font-medium">2/3</td>
                <td className="p-5 text-right">
                  <span className="text-cyan-400 font-bold text-lg">14/20</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Spacer to push footer down */}
        <div className="flex-1"></div>

        {/* Footer & Action */}
        <div className="bg-gray-900/50 p-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Promedio de la clase:</span>
            <span className="text-white font-bold text-xl">17.3/20</span>
          </div>
          <button className="w-full sm:w-auto h-12 px-6 bg-cyan-400 hover:bg-cyan-300 text-gray-900 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)]">
            <span className="material-symbols-outlined text-[20px]">download</span>
            Descargar Reporte PDF
          </button>
        </div>
      </section>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Placeholder genérico para otras pestañas
───────────────────────────────────────────── */
const PlaceholderView: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <div className="flex flex-col items-center justify-center flex-1 text-gray-600">
    <span className="material-symbols-outlined mb-4" style={{ fontSize: '64px', fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    <p className="text-lg font-semibold">{label}</p>
    <p className="text-sm mt-1">Próximamente disponible</p>
  </div>
);

/* ─────────────────────────────────────────────
   Componente principal
───────────────────────────────────────────── */
export const Evaluation: React.FC<EvaluationProps> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<Tab>('panel');
  
  // Estado global para la configuración de la sesión
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    nombre: '',
    descripcion: '',
    estado: 'ACTIVA',
    fechaActivacion: new Date().toISOString().split('T')[0],
    duracionMinutos: 30,
    modeloSeleccionado: 'heart',
    preguntas: [
      {
        id: '1',
        prompt: 'Un paciente con insuficiencia mitral presenta disnea de esfuerzo. En el examen ecocardiográfico, ¿cuál es la estructura anatómica primariamente afectada?',
        options: [
          { id: 'A', text: 'Válvula auriculoventricular izquierda', isCorrect: true },
          { id: 'B', text: 'Válvula semilunar aórtica', isCorrect: false },
          { id: 'C', text: 'Músculo papilar del ventrículo derecho', isCorrect: false },
          { id: 'D', text: 'Tabique interventricular', isCorrect: false }
        ]
      }
    ]
  });

  const navItems: { tab: Tab; icon: string; label: string }[] = [
    { tab: 'panel',         icon: 'space_dashboard', label: 'Panel' },
    { tab: 'informacion',   icon: 'monitor_heart',   label: 'Información' },
    { tab: 'modelo',        icon: '3d_rotation',     label: 'Modelo' },
    { tab: 'cuestionario',  icon: 'quiz',            label: 'Cuestionario' },
    { tab: 'codigo_qr',     icon: 'qr_code_2',       label: 'Código QR' },
    { tab: 'estadisticas',  icon: 'query_stats',     label: 'Estadísticas' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex">
      {/* ── SideNavBar (desktop) ── */}
      <nav className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-white/10 z-40">
        {/* Logo */}
        <div className="p-6 border-b border-white/10 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-cyan-400">AIRSTARK</div>
          <button
            onClick={onExit}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Volver"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>arrow_back</span>
          </button>
        </div>

        {/* Perfil */}
        <div className="p-6 flex items-center gap-4 border-b border-white/10">
          <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden border border-white/10 flex items-center justify-center">
            <img
              alt="Teacher Profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCN-wfwsESke75JMPQJFybEXNj2F-us_WAPc0BZETnOVPjwiENbngQv1s2Egmqb3L5Pzo_APAIFMGZYqZU0xe1nMm_QtDHc5cyaej9ci88TDG-GIl63Dx3OSfJ7HZcCpcdNz3c4JYiYeI009Eoi6b6ciyauK9-k5xvuDCICv42GPapOG0hXGBkS8jx4gqPtreWxDUJ3H_kS54KK3N7cMUyWWBzMNWG0lK22_7TtENq7kVqnPuwcCks-aS6A8IVQnVO5HAbRFIqETlRI"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Dr. Miller</h3>
            <p className="text-xs text-gray-400">Instructor Principal</p>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex flex-col py-4">
          {navItems.map(({ tab, icon, label }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-4 px-6 py-3 transition-all duration-150 text-left w-full ${
                  isActive
                    ? 'text-cyan-400 font-bold bg-white/5 border-r-2 border-cyan-400'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '22px',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {icon}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 h-14 bg-slate-900/90 backdrop-blur-xl border-b border-white/10">
        <div className="text-xl font-bold text-cyan-400">AIRSTARK</div>
        <button onClick={onExit} className="p-1.5 text-gray-400 hover:text-white">
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>arrow_back</span>
        </button>
      </header>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-2 bg-slate-900/90 backdrop-blur-md border-t border-white/10">
        {navItems.map(({ tab, icon, label }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '22px',
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {icon}
              </span>
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Main Content ── */}
      <main className="flex-1 w-full lg:ml-64 bg-gray-900 overflow-y-auto pt-20 lg:pt-12 pb-24 lg:pb-12 px-4 md:px-8 flex flex-col">
        {/* Glow decorativo */}
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-400/5 rounded-full blur-[120px] pointer-events-none -z-10" />

        {activeTab === 'panel'        && <PanelView onNewSession={() => setActiveTab('informacion')} />}
        {activeTab === 'informacion'  && <InformacionView onNext={() => setActiveTab('modelo')} config={sessionConfig} setConfig={setSessionConfig} />}
        {activeTab === 'modelo'       && <ModeloView onNext={() => setActiveTab('cuestionario')} config={sessionConfig} setConfig={setSessionConfig} />}
        {activeTab === 'cuestionario' && <CuestionarioView onNext={() => setActiveTab('codigo_qr')} config={sessionConfig} setConfig={setSessionConfig} />}
        {activeTab === 'codigo_qr'    && <CodigoQRView onNavigateToStats={() => setActiveTab('estadisticas')} />}
        {activeTab === 'estadisticas' && <EstadisticasView />}
      </main>
    </div>
  );
};
