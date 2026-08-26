const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components/Evaluation.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Types
code = code.replace(
  /type Tab = 'panel' \| 'informacion' \| 'modelo' \| 'cuestionario' \| 'codigo_qr' \| 'estadisticas';/,
  `type Tab = 'panel' | 'informacion' | 'modelo' | 'cuestionario' | 'codigo_qr' | 'estadisticas';

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
}`
);

// 2. Modify InformacionView
const infoViewMatch = code.match(/const InformacionView: React\.FC<\{ onNext: \(\) => void \}> = \(\{ onNext \}\) => \{[\s\S]*?^\};\n/m);
if (infoViewMatch) {
  const newInfoView = `const InformacionView: React.FC<{ onNext: () => void; config: SessionConfig; setConfig: React.Dispatch<React.SetStateAction<SessionConfig>> }> = ({ onNext, config, setConfig }) => {
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
                className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-200"
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
                    background: \`linear-gradient(to right, #22d3ee \${((config.duracionMinutos - 3) / 177) * 100}%, #374151 \${((config.duracionMinutos - 3) / 177) * 100}%)\`
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
              <label className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border transition-all \${config.estado === 'ACTIVA' ? 'bg-cyan-400/20 border-cyan-400 text-cyan-400' : 'bg-gray-900/60 border-white/10 text-gray-400 hover:border-gray-400'}\`}>
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
              <label className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border transition-all \${config.estado === 'DESACTIVA' ? 'bg-gray-700 border-gray-400 text-white' : 'bg-gray-900/60 border-white/10 text-gray-400 hover:border-gray-400'}\`}>
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
`;
  code = code.replace(infoViewMatch[0], newInfoView);
}

// 3. Modify ModeloView
const modeloViewMatch = code.match(/const ModeloView: React\.FC<\{ onNext: \(\) => void \}> = \(\{ onNext \}\) => \{[\s\S]*?^\};\n/m);
if (modeloViewMatch) {
  const newModeloView = `const ModeloView: React.FC<{ onNext: () => void; config: SessionConfig; setConfig: React.Dispatch<React.SetStateAction<SessionConfig>> }> = ({ onNext, config, setConfig }) => {
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
                  className={\`flex flex-col items-center justify-center p-8 rounded-lg transition-all group \${
                    config.modeloSeleccionado === m.id 
                    ? 'bg-cyan-400/20 border-2 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.2)]' 
                    : 'bg-slate-800/50 border-2 border-transparent border-white/10 text-gray-400 hover:border-gray-400 hover:text-white'
                  }\`}
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
`;
  code = code.replace(modeloViewMatch[0], newModeloView);
}

// 4. Modify CuestionarioView
const cuestionarioViewMatch = code.match(/const CuestionarioView: React\.FC<\{ onNext: \(\) => void \}> = \(\{ onNext \}\) => \{[\s\S]*?^\};\n/m);
if (cuestionarioViewMatch) {
  const newCuestionarioView = `const CuestionarioView: React.FC<{ onNext: () => void; config: SessionConfig; setConfig: React.Dispatch<React.SetStateAction<SessionConfig>> }> = ({ onNext, config, setConfig }) => {
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
                    <label key={opt.id} className={\`flex items-center gap-4 p-4 rounded-lg bg-gray-900/60 border cursor-pointer transition-all group \${opt.isCorrect ? 'border-cyan-400/50 shadow-[0_0_10px_rgba(0,255,255,0.1)]' : 'border-white/10 hover:border-cyan-400/30'}\`}>
                      <input 
                        checked={opt.isCorrect} 
                        onChange={() => setCorrectOption(opt.id)}
                        className="w-5 h-5 text-cyan-400 bg-slate-800 border-white/20 focus:ring-cyan-400 focus:ring-offset-gray-900" 
                        name={\`q\${currentQ.id}\`} 
                        type="radio" 
                      />
                      <div className="flex-1 flex gap-3 items-center">
                        <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-700 text-xs font-bold text-gray-400">{opt.id}</span>
                        <input 
                          value={opt.text}
                          onChange={(e) => updateOption(opt.id, e.target.value)}
                          placeholder={\`Opción \${opt.id}\`}
                          className="bg-transparent border-none p-0 flex-1 text-white focus:ring-0 focus:outline-none" 
                          type="text" 
                        />
                      </div>
                      <span className={\`material-symbols-outlined text-xl transition-opacity \${opt.isCorrect ? 'text-green-400 opacity-100' : 'text-gray-500 opacity-0 group-hover:opacity-50'}\`}>
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
`;
  code = code.replace(cuestionarioViewMatch[0], newCuestionarioView);
}

// 5. Modify Evaluation component
const evaluationMatch = code.match(/export const Evaluation: React\.FC<EvaluationProps> = \(\{ onExit \}\) => \{[\s\S]*?const \[activeTab, setActiveTab\] = useState<Tab>\('panel'\);/);
if (evaluationMatch) {
  const newEvaluationStart = `export const Evaluation: React.FC<EvaluationProps> = ({ onExit }) => {
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
  });`;
  code = code.replace(evaluationMatch[0], newEvaluationStart);
}

// 6. Update view rendering inside Evaluation
code = code.replace(
  /\{activeTab === 'informacion'  && <InformacionView onNext=\{\(\) => setActiveTab\('modelo'\)\} \/>\}/,
  `{activeTab === 'informacion'  && <InformacionView onNext={() => setActiveTab('modelo')} config={sessionConfig} setConfig={setSessionConfig} />}`
);
code = code.replace(
  /\{activeTab === 'modelo'       && <ModeloView onNext=\{\(\) => setActiveTab\('cuestionario'\)\} \/>\}/,
  `{activeTab === 'modelo'       && <ModeloView onNext={() => setActiveTab('cuestionario')} config={sessionConfig} setConfig={setSessionConfig} />}`
);
code = code.replace(
  /\{activeTab === 'cuestionario' && <CuestionarioView onNext=\{\(\) => setActiveTab\('codigo_qr'\)\} \/>\}/,
  `{activeTab === 'cuestionario' && <CuestionarioView onNext={() => setActiveTab('codigo_qr')} config={sessionConfig} setConfig={setSessionConfig} />}`
);

fs.writeFileSync(filePath, code);
console.log('Done refactoring Evaluation.tsx');
